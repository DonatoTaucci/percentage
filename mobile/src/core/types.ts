/* Tipi condivisi fra interfaccia, persistenza e task in background. */

export type TipoGiornata = 'lavoro' | 'ferie' | 'permesso' | 'malattia' | 'festivo' | 'riposo';

export type Shift = {
  id: string;
  date: string;        // YYYY-MM-DD
  start: string;       // HH:MM
  end: string;         // HH:MM
  breakMin: number;
  tipo: TipoGiornata;
  note: string;
};

export type Pausa = { from: number; to: number | null };

export type Punch = {
  date: string;
  startedAt: number;
  pauses: Pausa[];
};

export type OrarioStandard = {
  inizio: string;
  pausaInizio: string;
  pausaFine: string;
  fine: string;
};

export type GeoConfig = {
  attivo: boolean;
  lat: number | null;
  lng: number | null;
  etichetta: string;
  raggio: number;
  autoEntrata: boolean;
  autoUscita: boolean;
  pausaAuto: boolean;
  notifiche: boolean;
};

export type Settings = {
  orario: OrarioStandard;
  oreGiornaliere: number;      // derivato da orario
  pausaPredefinita: number;    // derivato da orario
  giorniLavorativi: number[];  // 0 = domenica
  pausaRetribuita: boolean;
  sogliaStraordinario: number;
  maggiorazione: number;
  pagaOraria: number;
  valuta: string;
  oreMensiliFisse: number;
  inizioSettimana: number;
  arrotondamento: number;
  geo: GeoConfig;
  tema: 'dark' | 'light' | 'auto';
};

export type Checkin = {
  id: string;
  ts: number;
  answers: Record<string, number>;
  dims: Record<string, number | null>;
  score: number;
  level: string;
};

export type AppData = {
  settings: Settings;
  shifts: Shift[];
  checkins: Checkin[];
  punch: Punch | null;
};

export const TIPI: Record<TipoGiornata, { label: string; conteggia: 'ore' | 'target' | 'nulla' }> = {
  lavoro: { label: 'Lavoro', conteggia: 'ore' },
  ferie: { label: 'Ferie', conteggia: 'target' },
  permesso: { label: 'Permesso', conteggia: 'target' },
  malattia: { label: 'Malattia', conteggia: 'target' },
  festivo: { label: 'Festività', conteggia: 'target' },
  riposo: { label: 'Riposo', conteggia: 'nulla' },
};

export const DEFAULT_SETTINGS: Settings = {
  orario: { inizio: '09:00', pausaInizio: '13:00', pausaFine: '14:00', fine: '18:00' },
  oreGiornaliere: 8,
  pausaPredefinita: 60,
  giorniLavorativi: [1, 2, 3, 4, 5],
  pausaRetribuita: false,
  sogliaStraordinario: 8,
  maggiorazione: 25,
  pagaOraria: 0,
  valuta: '€',
  oreMensiliFisse: 0,
  inizioSettimana: 1,
  arrotondamento: 1,
  geo: {
    attivo: false,
    lat: null,
    lng: null,
    etichetta: '',
    raggio: 150,
    autoEntrata: true,
    autoUscita: true,
    pausaAuto: true,
    notifiche: true,
  },
  tema: 'dark',
};
