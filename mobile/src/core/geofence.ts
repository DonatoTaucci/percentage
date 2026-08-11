/* geofence.ts — decisione presa quando il sistema segnala l'ingresso o
   l'uscita dall'area del posto di lavoro.

   Sul nativo il geofencing è del sistema operativo: iOS e Android
   risvegliano l'app anche se chiusa, quindi qui non serve la macchina a
   stati con isteresi che era necessaria nella versione web. Resta la
   parte che il sistema non può sapere: se un'uscita è una pausa pranzo
   o la fine del turno.

   Funzione pura: riceve lo stato, restituisce lo stato nuovo più la
   notifica da mostrare. Testabile senza emulatore. */

import { AppData } from './types';
import { parseTime, punchTotals, fmtDuration, timeFromMs, shiftMinutes } from './calc';
import { startPunch, stopPunch, toggleBreak } from './punch';

export type GeoEvento = 'enter' | 'exit';

export type GeoAzione =
  | 'entrata'
  | 'fine-pausa'
  | 'inizio-pausa'
  | 'uscita'
  | 'promemoria-entrata'
  | 'promemoria-uscita'
  | null;

export type GeoEsito = {
  azione: GeoAzione;
  data: AppData;
  notifica: { title: string; body: string } | null;
};

/** Tolleranza attorno alla pausa standard entro cui un'uscita è letta come pausa. */
export const TOLLERANZA_PAUSA_MIN = 75;

export function inFinestraPausa(data: AppData, nowMs: number): boolean {
  const o = data.settings.orario;
  if (!o.pausaInizio || !o.pausaFine) return false;
  const a = parseTime(o.pausaInizio);
  const b = parseTime(o.pausaFine);
  if (a === null || b === null) return false;
  const d = new Date(nowMs);
  const min = d.getHours() * 60 + d.getMinutes();
  return min >= a - TOLLERANZA_PAUSA_MIN && min <= b + TOLLERANZA_PAUSA_MIN;
}

export function decidi(evento: GeoEvento, data: AppData, nowMs: number = Date.now()): GeoEsito {
  const geo = data.settings.geo;
  const ora = timeFromMs(nowMs);

  if (evento === 'enter') {
    if (!data.punch) {
      if (!geo.autoEntrata) {
        return {
          azione: 'promemoria-entrata',
          data,
          notifica: { title: 'Sei arrivato al lavoro', body: 'Apri Work Balance per timbrare l\'entrata.' },
        };
      }
      return {
        azione: 'entrata',
        data: startPunch(data, nowMs),
        notifica: { title: 'Entrata registrata', body: `Timbratura avviata alle ${ora}.` },
      };
    }

    const t = punchTotals(data.punch, nowMs);
    if (t.inPausa) {
      return {
        azione: 'fine-pausa',
        data: toggleBreak(data, nowMs),
        notifica: { title: 'Pausa terminata', body: `Rientro alle ${ora} · pausa di ${fmtDuration(t.pausa)}.` },
      };
    }
    return { azione: null, data, notifica: null };
  }

  /* uscita dall'area */
  if (!data.punch) return { azione: null, data, notifica: null };

  const t = punchTotals(data.punch, nowMs);
  if (t.inPausa) return { azione: null, data, notifica: null };

  if (geo.pausaAuto && inFinestraPausa(data, nowMs)) {
    return {
      azione: 'inizio-pausa',
      data: toggleBreak(data, nowMs),
      notifica: {
        title: 'Pausa iniziata',
        body: `Uscita alle ${ora}. Al rientro la pausa si chiude da sola.`,
      },
    };
  }

  if (geo.autoUscita) {
    const res = stopPunch(data, nowMs);
    const min = res.shift ? shiftMinutes(res.shift, data.settings) : 0;
    return {
      azione: 'uscita',
      data: res.data,
      notifica: {
        title: 'Uscita registrata',
        body: res.shift
          ? `Giornata di ${fmtDuration(min)} (${res.shift.start}–${res.shift.end}).`
          : `Uscita alle ${ora}.`,
      },
    };
  }

  return {
    azione: 'promemoria-uscita',
    data,
    notifica: { title: 'Ti sei allontanato dal lavoro', body: 'La timbratura è ancora aperta: ricordati di uscire.' },
  };
}

/** Distanza in metri fra due coordinate (formula dell'emisenoverso). */
export function distanza(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function fmtDist(m: number | null | undefined): string {
  if (m === null || m === undefined) return '—';
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
