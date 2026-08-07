/* storage.ts — persistenza locale.
   L'app resta utilizzabile offline: la copia locale è la fonte di verità
   immediata, il server è la copia condivisa fra dispositivi. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, DEFAULT_SETTINGS, Settings } from '../core/types';
import { deriveOrario } from '../core/calc';

const KEY = 'percentage.data.v1';
const SYNC_KEY = 'percentage.sync.v1';

export type SyncState = {
  lastPulledAt: string | null;   // ISO del server
  dirtyShifts: string[];
  dirtyCheckins: string[];
  dirtySettings: boolean;
  dirtyPunch: boolean;
  deletedShifts: string[];
  deletedCheckins: string[];
  lastSyncAt: number | null;
  lastError: string | null;
};

export const EMPTY_SYNC: SyncState = {
  lastPulledAt: null,
  dirtyShifts: [],
  dirtyCheckins: [],
  dirtySettings: false,
  dirtyPunch: false,
  deletedShifts: [],
  deletedCheckins: [],
  lastSyncAt: null,
  lastError: null,
};

export function emptyData(): AppData {
  return { settings: { ...DEFAULT_SETTINGS }, shifts: [], checkins: [], punch: null };
}

/** Completa impostazioni parziali e ricalcola i valori derivati. */
export function normalizeSettings(input: Partial<Settings> | undefined): Settings {
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...(input || {}),
    orario: { ...DEFAULT_SETTINGS.orario, ...(input?.orario || {}) },
    geo: { ...DEFAULT_SETTINGS.geo, ...(input?.geo || {}) },
  };
  return deriveOrario(merged);
}

export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      settings: normalizeSettings(parsed.settings),
      shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
      checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
      punch: parsed.punch ?? null,
    };
  } catch {
    return emptyData();
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function loadSync(): Promise<SyncState> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_KEY);
    return raw ? { ...EMPTY_SYNC, ...JSON.parse(raw) } : { ...EMPTY_SYNC };
  } catch {
    return { ...EMPTY_SYNC };
  }
}

export async function saveSync(state: SyncState): Promise<void> {
  await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(state));
}

/** Svuota tutto: usato all'uscita dall'account, per non lasciare dati di un altro utente. */
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove([KEY, SYNC_KEY]);
}

const uniq = (a: string[]) => Array.from(new Set(a));

export const markShiftDirty = (s: SyncState, id: string): SyncState =>
  ({ ...s, dirtyShifts: uniq([...s.dirtyShifts, id]) });

export const markCheckinDirty = (s: SyncState, id: string): SyncState =>
  ({ ...s, dirtyCheckins: uniq([...s.dirtyCheckins, id]) });

export const markShiftDeleted = (s: SyncState, id: string): SyncState =>
  ({ ...s, deletedShifts: uniq([...s.deletedShifts, id]), dirtyShifts: s.dirtyShifts.filter(x => x !== id) });

export const markCheckinDeleted = (s: SyncState, id: string): SyncState =>
  ({ ...s, deletedCheckins: uniq([...s.deletedCheckins, id]), dirtyCheckins: s.dirtyCheckins.filter(x => x !== id) });
