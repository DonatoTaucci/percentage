/* store.tsx — stato dell'app.
   Ogni modifica è immediata in locale (l'app funziona anche senza rete
   e senza account) e viene marcata per l'invio al server. */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';

import { AppData, Checkin, Settings, Shift } from '../core/types';
import { deriveOrario } from '../core/calc';
import * as P from '../core/punch';
import {
  loadData, saveData, loadSync, saveSync, emptyData,
  SyncState, EMPTY_SYNC, clearAll,
  markShiftDirty, markShiftDeleted, markCheckinDirty, markCheckinDeleted,
} from './storage';
import { syncNow, resetClient, registraProfilo, eliminaTuttoSulServer } from './sync';
import { SINCRONIZZAZIONE_DISPONIBILE } from '../config';
import * as Geo from '../services/geofencing';

type Ctx = {
  data: AppData;
  pronto: boolean;
  sync: SyncState;
  sincronizzando: boolean;
  aggiornaImpostazioni: (patch: Partial<Settings>) => void;
  salvaTurno: (input: Partial<Shift> & { date: string }) => Shift;
  eliminaTurno: (id: string) => void;
  entrata: () => void;
  pausa: () => void;
  uscita: () => Shift | null;
  annullaTimbratura: () => void;
  aggiungiCheckin: (c: Omit<Checkin, 'id' | 'ts'>) => void;
  eliminaCheckin: (id: string) => void;
  sincronizza: (silenzioso?: boolean) => Promise<string | null>;
  scollega: () => Promise<void>;
  eliminaTutto: () => Promise<{ righe: boolean; account: boolean; errore: string | null }>;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp va usato dentro AppProvider');
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const [data, setData] = useState<AppData>(emptyData);
  const [sync, setSync] = useState<SyncState>(EMPTY_SYNC);
  const [pronto, setPronto] = useState(false);
  const [sincronizzando, setSincronizzando] = useState(false);

  // Riferimenti sempre aggiornati: servono ai callback asincroni
  // (sincronizzazione, cambio di stato dell'app) per non lavorare su copie vecchie.
  const dataRef = useRef(data);
  const syncRef = useRef(sync);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { syncRef.current = sync; }, [sync]);

  /* ---------- caricamento iniziale ---------- */
  useEffect(() => {
    (async () => {
      const [d, s] = await Promise.all([loadData(), loadSync()]);
      setData(d);
      setSync(s);
      setPronto(true);
      Geo.allinea(d.settings.geo).catch(() => {});
    })();
  }, []);

  /* ---------- persistenza ---------- */
  const scrivi = useCallback((nuovo: AppData, patchSync: Partial<SyncState>) => {
    setData(nuovo);
    dataRef.current = nuovo;
    saveData(nuovo).catch(() => {});
    setSync(prev => {
      const s = { ...prev, ...patchSync };
      syncRef.current = s;
      saveSync(s).catch(() => {});
      return s;
    });
  }, []);

  /* ---------- sincronizzazione ---------- */
  const sincronizza = useCallback(async (silenzioso = false): Promise<string | null> => {
    if (!SINCRONIZZAZIONE_DISPONIBILE || !isSignedIn) return null;
    if (!silenzioso) setSincronizzando(true);
    // Prima l'anagrafica: chi si registra e non tocca nulla deve comunque
    // risultare al server, altrimenti per l'amministrazione non esiste.
    await registraProfilo(getToken, userId ?? '', user?.username ?? '');
    const res = await syncNow(dataRef.current, syncRef.current, getToken, 'mobile');
    if (!res.error) {
      setData(res.data);
      dataRef.current = res.data;
      await saveData(res.data);
      Geo.allinea(res.data.settings.geo).catch(() => {});
    }
    setSync(res.sync);
    syncRef.current = res.sync;
    await saveSync(res.sync);
    if (!silenzioso) setSincronizzando(false);
    return res.error;
  }, [isSignedIn, getToken, userId, user?.username]);

  // Alla connessione dell'account e a ogni ritorno in primo piano.
  useEffect(() => {
    if (!pronto || !isSignedIn) return;
    sincronizza(true);
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') sincronizza(true);
    });
    return () => sub.remove();
  }, [pronto, isSignedIn, sincronizza]);

  /* ---------- azioni ---------- */

  const aggiornaImpostazioni = useCallback((patch: Partial<Settings>) => {
    const settings = deriveOrario({ ...dataRef.current.settings, ...patch });
    // La soglia straordinario segue le ore contrattuali finché non la si tocca a mano.
    if (!('sogliaStraordinario' in patch) &&
        Math.abs(dataRef.current.settings.sogliaStraordinario - dataRef.current.settings.oreGiornaliere) < 0.01) {
      settings.sogliaStraordinario = settings.oreGiornaliere;
    }
    scrivi({ ...dataRef.current, settings }, { dirtySettings: true });
    Geo.allinea(settings.geo).catch(() => {});
  }, [scrivi]);

  const salvaTurno = useCallback((input: Partial<Shift> & { date: string }) => {
    const res = P.saveShift(dataRef.current, input);
    scrivi(res.data, { dirtyShifts: [...new Set([...syncRef.current.dirtyShifts, res.shift.id])] });
    return res.shift;
  }, [scrivi]);

  const eliminaTurno = useCallback((id: string) => {
    scrivi(P.deleteShift(dataRef.current, id), markShiftDeleted(syncRef.current, id));
  }, [scrivi]);

  const entrata = useCallback(() => {
    scrivi(P.startPunch(dataRef.current), { dirtyPunch: true });
  }, [scrivi]);

  const pausa = useCallback(() => {
    scrivi(P.toggleBreak(dataRef.current), { dirtyPunch: true });
  }, [scrivi]);

  const uscita = useCallback(() => {
    const res = P.stopPunch(dataRef.current);
    if (!res.shift) return null;
    scrivi(res.data, {
      dirtyPunch: true,
      dirtyShifts: [...new Set([...syncRef.current.dirtyShifts, res.shift.id])],
    });
    return res.shift;
  }, [scrivi]);

  const annullaTimbratura = useCallback(() => {
    scrivi(P.cancelPunch(dataRef.current), { dirtyPunch: true });
  }, [scrivi]);

  const aggiungiCheckin = useCallback((c: Omit<Checkin, 'id' | 'ts'>) => {
    const entry: Checkin = { ...c, id: P.uid(), ts: Date.now() };
    const nuovo = { ...dataRef.current, checkins: [...dataRef.current.checkins, entry] };
    scrivi(nuovo, markCheckinDirty(syncRef.current, entry.id));
  }, [scrivi]);

  const eliminaCheckin = useCallback((id: string) => {
    const nuovo = { ...dataRef.current, checkins: dataRef.current.checkins.filter(c => c.id !== id) };
    scrivi(nuovo, markCheckinDeleted(syncRef.current, id));
  }, [scrivi]);

  /* Uscendo dall'account i dati locali vanno rimossi: su un dispositivo
     condiviso non devono restare visibili a chi accede dopo. */
  const scollega = useCallback(async () => {
    await Geo.ferma().catch(() => {});
    await clearAll();
    resetClient();
    setData(emptyData());
    setSync({ ...EMPTY_SYNC });
    dataRef.current = emptyData();
    syncRef.current = { ...EMPTY_SYNC };
  }, []);

  /* Cancellazione completa: righe sul server, poi l'account Clerk, poi il
     dispositivo. L'ordine non è estetico — chiuso l'account il token non
     vale più e le righe resterebbero lì senza nessuno autorizzato a
     toglierle. L'esito è dettagliato apposta: su una cancellazione un
     generico "non riuscito" costringerebbe a fidarsi, e non ci si fida. */
  const eliminaTutto = useCallback(async () => {
    const esito = { righe: false, account: false, errore: null as string | null };

    const sul = await eliminaTuttoSulServer(getToken, userId ?? '');
    esito.righe = sul.fatto;
    if (!sul.fatto) { esito.errore = sul.errore; return esito; }

    try {
      // Richiede che nel pannello Clerk sia consentito eliminare il proprio
      // account; se non lo è, i dati sono già spariti e resta il solo profilo.
      if (user) await user.delete();
      esito.account = true;
    } catch (e: any) {
      esito.errore = e?.message ?? String(e);
    }

    await scollega();
    return esito;
  }, [getToken, userId, user, scollega]);

  const value = useMemo<Ctx>(() => ({
    data, pronto, sync, sincronizzando,
    aggiornaImpostazioni, salvaTurno, eliminaTurno,
    entrata, pausa, uscita, annullaTimbratura,
    aggiungiCheckin, eliminaCheckin, sincronizza, scollega, eliminaTutto,
  }), [data, pronto, sync, sincronizzando, aggiornaImpostazioni, salvaTurno, eliminaTurno,
       entrata, pausa, uscita, annullaTimbratura, aggiungiCheckin, eliminaCheckin, sincronizza,
       scollega, eliminaTutto]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
