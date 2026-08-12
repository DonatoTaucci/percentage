/* sync.ts — sincronizzazione con il server condiviso (Supabase).

   Modello: local-first. Ogni modifica è immediata in locale e viene
   marcata "da inviare"; alla sincronizzazione si spinge ciò che è
   cambiato e si tira ciò che è cambiato altrove dall'ultimo giro.
   In caso di conflitto vince la scrittura più recente (updated_at).

   L'identità arriva da Clerk: il token viene passato a Supabase, che
   applica le policy per riga sul claim "sub". */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppData, Checkin, Shift } from '../core/types';
import { SyncState, normalizeSettings } from './storage';
import { SUPABASE_URL, SUPABASE_KEY } from '../config';

export type TokenGetter = () => Promise<string | null>;

let client: SupabaseClient | null = null;

/** Client unico, con il token Clerk letto a ogni richiesta. */
export function getClient(getToken: TokenGetter): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      accessToken: async () => (await getToken()) ?? '',
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function resetClient(): void {
  client = null;
}

export function isConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_KEY;
}

/* ---------- conversioni fra riga del database e modello locale ---------- */

type ShiftRow = {
  id: string; date: string; start_time: string; end_time: string;
  break_min: number; tipo: string; note: string;
  updated_at: string; deleted_at: string | null;
};

const rowToShift = (r: ShiftRow): Shift => ({
  id: r.id,
  date: r.date,
  start: r.start_time || '',
  end: r.end_time || '',
  breakMin: r.break_min || 0,
  tipo: (r.tipo || 'lavoro') as Shift['tipo'],
  note: r.note || '',
});

const shiftToRow = (s: Shift) => ({
  id: s.id,
  date: s.date,
  start_time: s.start,
  end_time: s.end,
  break_min: s.breakMin,
  tipo: s.tipo,
  note: s.note,
  deleted_at: null,
});

type CheckinRow = {
  id: string; ts: number; answers: Record<string, number>;
  dims: Record<string, number | null>; score: number; level: string;
  updated_at: string; deleted_at: string | null;
};

const rowToCheckin = (r: CheckinRow): Checkin => ({
  id: r.id, ts: Number(r.ts), answers: r.answers || {}, dims: r.dims || {},
  score: r.score || 0, level: r.level || '',
});

const checkinToRow = (c: Checkin) => ({
  id: c.id, ts: c.ts, answers: c.answers, dims: c.dims,
  score: c.score, level: c.level, deleted_at: null,
});

/* ---------------------------- sincronizzazione ---------------------------- */

export type SyncResult = {
  data: AppData;
  sync: SyncState;
  pushed: number;
  pulled: number;
  error: string | null;
};

/* Registra l'account nel database appena si entra.

   Gli account stanno su Clerk: senza questa riga il server saprebbe di una
   persona solo quando sincronizza il primo turno, e chi si registra senza
   usare l'app resterebbe invisibile alla pagina di amministrazione. Email e
   id li riscrive il server leggendoli dal token: da qui parte solo il nome
   utente. Un errore non deve fermare la sincronizzazione. */
export async function registraProfilo(
  getToken: TokenGetter,
  userId: string,
  username: string
): Promise<void> {
  if (!isConfigured() || !userId) return;
  try {
    // Il nome utente si scrive solo se Clerk ne ha uno: da quando lo chiediamo
    // noi, la fonte è la tabella, e mandare stringa vuota a ogni accesso
    // cancellerebbe il nome scelto la volta prima.
    const riga: Record<string, unknown> = { user_id: userId, ultimo_accesso: new Date().toISOString() };
    if (username) riga.username = username;
    await getClient(getToken).from('profili').upsert(riga, { onConflict: 'user_id' });
  } catch {
    /* ignorato di proposito */
  }
}

/* Cancella tutte le righe dell'utente sul server.

   L'ordine conta rispetto alla chiusura dell'account: le policy per riga
   autorizzano in base al token, e chiuso l'account il token non vale più.
   Prima i dati, poi la porta — chi chiama deve rispettare quest'ordine. */
export async function eliminaTuttoSulServer(
  getToken: TokenGetter,
  userId: string
): Promise<{ fatto: boolean; errore: string | null }> {
  if (!isConfigured() || !userId) return { fatto: true, errore: null };
  const sb = getClient(getToken);
  for (const tabella of ['shifts', 'checkins', 'settings', 'punches', 'profili'] as const) {
    const { error } = await sb.from(tabella).delete().eq('user_id', userId);
    if (error) return { fatto: false, errore: `${tabella}: ${error.message}` };
  }
  return { fatto: true, errore: null };
}

/* Il nome utente vive nella tabella `profili`, non su Clerk.

   Lo chiedeva Clerk durante l'iscrizione, ma sul sito quella schermata la
   serve il suo portale ospitato: chi si registrava finiva su un indirizzo che
   non è il nostro. Chiedendolo dopo l'accesso, da entrambi i client, la
   registrazione non esce mai dall'applicazione. */
export async function leggiUsername(getToken: TokenGetter, userId: string): Promise<string | null> {
  if (!isConfigured() || !userId) return null;
  try {
    const { data, error } = await getClient(getToken)
      .from('profili').select('username').eq('user_id', userId).maybeSingle();
    if (error) return null;
    return (data?.username as string) ?? '';
  } catch {
    return null;      // non lo sappiamo: è diverso da "non ce l'ha"
  }
}

export async function impostaUsername(
  getToken: TokenGetter,
  nome: string
): Promise<{ ok: boolean; motivo?: string; username?: string }> {
  if (!isConfigured()) return { ok: false, motivo: 'non-configurato' };
  const { data, error } = await getClient(getToken).rpc('imposta_username', { p_username: nome });
  if (error) return { ok: false, motivo: 'errore' };
  return (data as { ok: boolean; motivo?: string; username?: string }) ?? { ok: false, motivo: 'errore' };
}

export async function syncNow(
  data: AppData,
  sync: SyncState,
  getToken: TokenGetter,
  device = 'mobile'
): Promise<SyncResult> {
  if (!isConfigured()) {
    return { data, sync, pushed: 0, pulled: 0, error: 'Server non configurato.' };
  }

  const sb = getClient(getToken);
  let pushed = 0;
  let pulled = 0;

  try {
    /* ---------------- push ---------------- */

    const daInviare = data.shifts.filter(s => sync.dirtyShifts.includes(s.id));
    if (daInviare.length) {
      const { error } = await sb.from('shifts').upsert(daInviare.map(shiftToRow));
      if (error) throw error;
      pushed += daInviare.length;
    }

    if (sync.deletedShifts.length) {
      const { error } = await sb.from('shifts')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', sync.deletedShifts);
      if (error) throw error;
      pushed += sync.deletedShifts.length;
    }

    const checkinsDaInviare = data.checkins.filter(c => sync.dirtyCheckins.includes(c.id));
    if (checkinsDaInviare.length) {
      const { error } = await sb.from('checkins').upsert(checkinsDaInviare.map(checkinToRow));
      if (error) throw error;
      pushed += checkinsDaInviare.length;
    }

    if (sync.deletedCheckins.length) {
      const { error } = await sb.from('checkins')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', sync.deletedCheckins);
      if (error) throw error;
      pushed += sync.deletedCheckins.length;
    }

    if (sync.dirtySettings) {
      const { error } = await sb.from('settings').upsert({ data: data.settings }, { onConflict: 'user_id' });
      if (error) throw error;
      pushed++;
    }

    if (sync.dirtyPunch) {
      const { error } = await sb.from('punches')
        .upsert({ punch: data.punch, device }, { onConflict: 'user_id' });
      if (error) throw error;
      pushed++;
    }

    /* ---------------- pull ---------------- */

    const since = sync.lastPulledAt || '1970-01-01T00:00:00Z';
    let next: AppData = { ...data };

    const { data: shiftRows, error: e1 } = await sb.from('shifts')
      .select('*').gt('updated_at', since);
    if (e1) throw e1;

    if (shiftRows?.length) {
      const map = new Map(next.shifts.map(s => [s.id, s]));
      for (const r of shiftRows as ShiftRow[]) {
        // Non sovrascrivo ciò che ho modificato in locale e non ho ancora inviato.
        if (sync.dirtyShifts.includes(r.id)) continue;
        if (r.deleted_at) map.delete(r.id);
        else map.set(r.id, rowToShift(r));
        pulled++;
      }
      next.shifts = [...map.values()].sort((a, b) =>
        a.date === b.date ? a.start.localeCompare(b.start) : (a.date < b.date ? -1 : 1));
    }

    const { data: checkinRows, error: e2 } = await sb.from('checkins')
      .select('*').gt('updated_at', since);
    if (e2) throw e2;

    if (checkinRows?.length) {
      const map = new Map(next.checkins.map(c => [c.id, c]));
      for (const r of checkinRows as CheckinRow[]) {
        if (sync.dirtyCheckins.includes(r.id)) continue;
        if (r.deleted_at) map.delete(r.id);
        else map.set(r.id, rowToCheckin(r));
        pulled++;
      }
      next.checkins = [...map.values()].sort((a, b) => a.ts - b.ts);
    }

    if (!sync.dirtySettings) {
      const { data: rows, error: e3 } = await sb.from('settings')
        .select('*').gt('updated_at', since).limit(1);
      if (e3) throw e3;
      if (rows?.length) {
        next.settings = normalizeSettings(rows[0].data);
        pulled++;
      }
    }

    if (!sync.dirtyPunch) {
      const { data: rows, error: e4 } = await sb.from('punches')
        .select('*').gt('updated_at', since).limit(1);
      if (e4) throw e4;
      if (rows?.length) {
        next.punch = rows[0].punch ?? null;   // timbratura aperta su un altro dispositivo
        pulled++;
      }
    }

    const nuovoSync: SyncState = {
      ...sync,
      dirtyShifts: [],
      dirtyCheckins: [],
      dirtySettings: false,
      dirtyPunch: false,
      deletedShifts: [],
      deletedCheckins: [],
      lastPulledAt: new Date().toISOString(),
      lastSyncAt: Date.now(),
      lastError: null,
    };

    return { data: next, sync: nuovoSync, pushed, pulled, error: null };
  } catch (err: any) {
    // Le modifiche locali restano marcate: si riproveranno al prossimo giro.
    const msg = err?.message || 'Sincronizzazione non riuscita.';
    return { data, sync: { ...sync, lastError: msg }, pushed, pulled, error: msg };
  }
}

/** Primo accesso su un dispositivo nuovo: scarica tutto. */
export async function pullAll(getToken: TokenGetter): Promise<Partial<AppData>> {
  const sb = getClient(getToken);
  const out: Partial<AppData> = {};

  const { data: shifts } = await sb.from('shifts').select('*').is('deleted_at', null);
  if (shifts) out.shifts = (shifts as ShiftRow[]).map(rowToShift);

  const { data: checkins } = await sb.from('checkins').select('*').is('deleted_at', null);
  if (checkins) out.checkins = (checkins as CheckinRow[]).map(rowToCheckin).sort((a, b) => a.ts - b.ts);

  const { data: settings } = await sb.from('settings').select('*').limit(1);
  if (settings?.length) out.settings = normalizeSettings(settings[0].data);

  const { data: punches } = await sb.from('punches').select('*').limit(1);
  if (punches?.length) out.punch = punches[0].punch ?? null;

  return out;
}
