/* geofencing.ts — timbratura automatica basata sulla posizione.

   È la differenza sostanziale rispetto alla versione web: qui il
   geofencing lo fa il sistema operativo. iOS e Android tengono d'occhio
   l'area anche ad app chiusa e la risvegliano quando entri o esci,
   quindi non serve né tenere l'app aperta né consumare batteria con un
   GPS sempre attivo.

   Il task gira senza React: legge lo stato da AsyncStorage, decide con
   il modulo puro `core/geofence` e riscrive. La sincronizzazione con il
   server avviene alla prima apertura dell'app (in background non c'è un
   token di sessione utilizzabile), quindi la timbratura non si perde mai
   ma può arrivare sul PC con un po' di ritardo. */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { decidi } from '../core/geofence';
import { loadData, saveData, loadSync, saveSync } from '../data/storage';
import { notifica } from './notifications';

export const GEOFENCE_TASK = 'percentage-geofence';
export const REGION_ID = 'lavoro';

/* Il task va definito al livello del modulo: il sistema può invocarlo
   quando l'app non è in esecuzione, prima che qualunque schermata esista. */
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) return;
  const eventType = data?.eventType;
  if (eventType !== Location.GeofencingEventType.Enter && eventType !== Location.GeofencingEventType.Exit) return;

  try {
    const stato = await loadData();
    if (!stato.settings.geo.attivo) return;

    const evento = eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';
    const esito = decidi(evento, stato, Date.now());

    if (esito.azione) {
      await saveData(esito.data);
      const sync = await loadSync();
      await saveSync({ ...sync, dirtyPunch: true });   // verrà inviato all'apertura
      if (stato.settings.geo.notifiche && esito.notifica) {
        await notifica(esito.notifica.title, esito.notifica.body);
      }
    }
  } catch {
    // Un errore qui non deve mai far crashare un task di sistema.
  }
});

export type PermessiGeo = {
  primoPiano: boolean;
  background: boolean;
  puoChiedereBackground: boolean;
};

export async function statoPermessi(): Promise<PermessiGeo> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return {
    primoPiano: fg.granted,
    background: bg.granted,
    puoChiedereBackground: bg.canAskAgain,
  };
}

/**
 * Il permesso "sempre" va chiesto in due tempi: prima quello in primo
 * piano, poi quello in background. È un requisito di iOS e Android, e
 * anche la sequenza che l'utente capisce meglio.
 */
export async function chiediPermessi(): Promise<PermessiGeo> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { primoPiano: false, background: false, puoChiedereBackground: false };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { primoPiano: true, background: bg.granted, puoChiedereBackground: bg.canAskAgain };
}

export async function posizioneCorrente(): Promise<{ lat: number; lng: number; acc: number }> {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    acc: Math.round(pos.coords.accuracy ?? 0),
  };
}

export async function attivo(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  } catch {
    return false;
  }
}

/** Registra (o aggiorna) l'area sorvegliata. */
export async function avvia(lat: number, lng: number, raggio: number): Promise<void> {
  // iOS ha un minimo pratico di ~100 m; sotto, il sistema genera falsi eventi.
  const r = Math.max(Platform.OS === 'ios' ? 100 : 50, Math.round(raggio));
  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: REGION_ID,
      latitude: lat,
      longitude: lng,
      radius: r,
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);
}

export async function ferma(): Promise<void> {
  if (await attivo()) await Location.stopGeofencingAsync(GEOFENCE_TASK);
}

/** Allinea il geofencing di sistema alle impostazioni correnti. */
export async function allinea(geo: { attivo: boolean; lat: number | null; lng: number | null; raggio: number }): Promise<void> {
  if (geo.attivo && geo.lat !== null && geo.lng !== null) {
    const permessi = await statoPermessi();
    if (!permessi.background) { await ferma(); return; }
    await avvia(geo.lat, geo.lng, geo.raggio);
  } else {
    await ferma();
  }
}
