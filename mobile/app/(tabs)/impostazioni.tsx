/* Impostazioni — orario standard, GPS, account e sincronizzazione. */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, Alert, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';

import { useApp } from '../../src/data/store';
import * as C from '../../src/core/calc';
import * as Geo from '../../src/services/geofencing';
import { distanza, fmtDist } from '../../src/core/geofence';
import { chiediPermesso as chiediNotifiche } from '../../src/services/notifications';
import {
  Badge, Btn, Campo, Card, Chip, Interruttore, Nota, Riga, RigaTra, Titolo, Txt, usePalette,
} from '../../src/ui/components';
import { S } from '../../src/ui/theme';
import { SINCRONIZZAZIONE_DISPONIBILE } from '../../src/config';

export default function Impostazioni() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data, aggiornaImpostazioni, sincronizza, sincronizzando, sync, scollega } = useApp();
  const st = data.settings;

  const [permessi, setPermessi] = useState<Geo.PermessiGeo | null>(null);
  const [geofenceAttivo, setGeofenceAttivo] = useState(false);

  useEffect(() => {
    Geo.statoPermessi().then(setPermessi).catch(() => {});
    Geo.attivo().then(setGeofenceAttivo).catch(() => {});
  }, [st.geo.attivo, st.geo.lat, st.geo.raggio]);

  const setGeo = (patch: Partial<typeof st.geo>) => aggiornaImpostazioni({ geo: { ...st.geo, ...patch } });
  const setOrario = (patch: Partial<typeof st.orario>) => aggiornaImpostazioni({ orario: { ...st.orario, ...patch } });

  async function attivaGeo(v: boolean) {
    if (!v) { setGeo({ attivo: false }); await Geo.ferma().catch(() => {}); setGeofenceAttivo(false); return; }
    const perm = await Geo.chiediPermessi();
    setPermessi(perm);
    if (!perm.primoPiano) {
      Alert.alert('Permesso negato', 'Senza accesso alla posizione la timbratura automatica non può funzionare.');
      return;
    }
    if (!perm.background) {
      Alert.alert(
        'Serve "Consenti sempre"',
        Platform.OS === 'ios'
          ? 'In Impostazioni > Percentage > Posizione scegli "Sempre": solo così il sistema può avvisare l\'app quando arrivi o esci, anche se è chiusa.'
          : 'In Impostazioni > App > Percentage > Autorizzazioni > Posizione scegli "Consenti sempre".',
        [{ text: 'Ok' }, { text: 'Apri impostazioni', onPress: () => Linking.openSettings() }]
      );
    }
    await chiediNotifiche();
    setGeo({ attivo: true });
  }

  async function salvaPosizione() {
    try {
      const pos = await Geo.posizioneCorrente();
      setGeo({ lat: pos.lat, lng: pos.lng });
      Alert.alert('Posizione salvata', `Precisione ${fmtDist(pos.acc)}. Il raggio attuale è ${st.geo.raggio} m.`);
    } catch (e: any) {
      Alert.alert('Posizione non disponibile', e?.message ?? 'Riprova all\'aperto.');
    }
  }

  async function verificaDistanza() {
    try {
      const pos = await Geo.posizioneCorrente();
      if (st.geo.lat === null) { Alert.alert('Salva prima la posizione del lavoro.'); return; }
      const d = distanza(pos.lat, pos.lng, st.geo.lat, st.geo.lng!);
      Alert.alert('Verifica', `Sei a ${fmtDist(d)} dal punto salvato (raggio ${st.geo.raggio} m): ${d <= st.geo.raggio ? 'dentro' : 'fuori'}.`);
    } catch (e: any) {
      Alert.alert('Posizione non disponibile', e?.message ?? '');
    }
  }

  async function esci() {
    Alert.alert('Uscire dall\'account?', 'I dati restano sul server e li ritrovi al prossimo accesso. Dal telefono verranno rimossi.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await sincronizza(true);   // non lasciare indietro modifiche non inviate
          await scollega();
          await signOut();
        },
      },
    ]);
  }

  const giorni = [1, 2, 3, 4, 5, 6, 0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 40 }}
    >
      {/* ---------------- account ---------------- */}
      <Card>
        <Titolo>Account</Titolo>
        <RigaTra style={{ marginTop: S.md }}>
          <View style={{ flex: 1 }}>
            <Txt weight="600">{user?.primaryEmailAddress?.emailAddress ?? 'Accesso effettuato'}</Txt>
            <Txt dim size={12}>
              {sync.lastSyncAt
                ? `Ultima sincronizzazione ${new Date(sync.lastSyncAt).toLocaleString('it-IT')}`
                : 'Non ancora sincronizzato'}
            </Txt>
          </View>
          <Btn title={sincronizzando ? '…' : 'Sincronizza'} piccolo onPress={() => sincronizza()} disabled={sincronizzando} />
        </RigaTra>
        {!!sync.lastError && <View style={{ marginTop: S.sm }}><Nota tone="bad">{sync.lastError}</Nota></View>}
        {!SINCRONIZZAZIONE_DISPONIBILE && (
          <View style={{ marginTop: S.sm }}>
            <Nota tone="warn">Server non configurato: l'app funziona in locale, ma i dati non vengono condivisi con il PC.</Nota>
          </View>
        )}
        <Txt dim size={12} style={{ marginTop: S.md }}>
          Gli stessi dati sono disponibili dal browser accedendo con questa email.
        </Txt>
        <Btn title="Esci dall'account" variante="pericolo" piccolo onPress={esci} style={{ marginTop: S.md }} />
      </Card>

      {/* ---------------- orario standard ---------------- */}
      <Card>
        <Titolo>Orario standard</Titolo>
        <Txt dim size={13} style={{ marginTop: 6 }}>
          Da qui l'app ricava le ore contrattuali, precompila i turni e riconosce la finestra della pausa pranzo.
        </Txt>
        <Riga gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
          <Campo label="Inizio" value={st.orario.inizio} onChangeText={v => setOrario({ inizio: v })} placeholder="09:00" />
          <Campo label="Fine" value={st.orario.fine} onChangeText={v => setOrario({ fine: v })} placeholder="18:00" />
        </Riga>
        <Riga gap={S.sm} style={{ marginTop: S.sm, flexWrap: 'wrap' }}>
          <Campo label="Pausa da" value={st.orario.pausaInizio} onChangeText={v => setOrario({ pausaInizio: v })} placeholder="13:00" />
          <Campo label="Pausa a" value={st.orario.pausaFine} onChangeText={v => setOrario({ pausaFine: v })} placeholder="14:00" />
        </Riga>
        <View style={{ marginTop: S.md }}>
          <Nota>
            {`Giornata contrattuale: ${C.fmtDuration(Math.round(st.oreGiornaliere * 60))}`}
            {st.pausaPredefinita > 0 ? ` (pausa di ${st.pausaPredefinita} min ${st.pausaRetribuita ? 'retribuita' : 'non retribuita'})` : ' senza pausa'}
            {` · settimana da ${C.fmtDuration(Math.round(st.oreGiornaliere * 60 * st.giorniLavorativi.length))}.`}
          </Nota>
        </View>

        <Txt dim size={12} weight="700" style={{ marginTop: S.lg, marginBottom: 6 }}>GIORNI LAVORATIVI</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {giorni.map(g => (
            <Chip
              key={g}
              label={C.GIORNI_BREVI[g]}
              on={st.giorniLavorativi.includes(g)}
              onPress={() => {
                const l = st.giorniLavorativi.includes(g)
                  ? st.giorniLavorativi.filter(x => x !== g)
                  : [...st.giorniLavorativi, g].sort();
                aggiornaImpostazioni({ giorniLavorativi: l });
              }}
            />
          ))}
        </View>

        <View style={{ marginTop: S.md }}>
          <Interruttore
            label="La pausa è retribuita"
            descrizione="Se attiva, la pausa conta come tempo lavorato."
            value={st.pausaRetribuita}
            onChange={v => aggiornaImpostazioni({ pausaRetribuita: v })}
          />
        </View>

        <Riga gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
          <Campo label="Soglia straordinario (h)" value={String(st.sogliaStraordinario)} keyboardType="numeric"
            onChangeText={v => aggiornaImpostazioni({ sogliaStraordinario: parseFloat(v.replace(',', '.')) || 0 })} />
          <Campo label="Monte ore mensile (0 = auto)" value={String(st.oreMensiliFisse)} keyboardType="numeric"
            onChangeText={v => aggiornaImpostazioni({ oreMensiliFisse: parseFloat(v.replace(',', '.')) || 0 })} />
        </Riga>

        <Txt dim size={12} weight="700" style={{ marginTop: S.lg, marginBottom: 6 }}>ARROTONDAMENTO TIMBRATURA</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[1, 5, 10, 15, 30].map(m => (
            <Chip key={m} label={m === 1 ? 'Al minuto' : `${m} min`} on={st.arrotondamento === m}
              onPress={() => aggiornaImpostazioni({ arrotondamento: m })} />
          ))}
        </View>
      </Card>

      {/* ---------------- GPS ---------------- */}
      <Card>
        <Titolo>Timbratura automatica con GPS</Titolo>
        <Txt dim size={13} style={{ marginTop: 6 }}>
          Il sistema sorveglia l'area del lavoro e sveglia l'app quando entri o esci, anche se è chiusa.
          Un'uscita nella finestra della pausa pranzo viene registrata come pausa.
        </Txt>

        <View style={{ marginTop: S.md }}>
          <Interruttore label="Attiva il rilevamento" value={st.geo.attivo} onChange={attivaGeo} />
        </View>

        {st.geo.attivo && (
          <>
            <Riga gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
              <Btn title="Usa la posizione attuale" piccolo onPress={salvaPosizione} />
              {st.geo.lat !== null && <Btn title="Verifica distanza" piccolo variante="fantasma" onPress={verificaDistanza} />}
            </Riga>

            <Txt dim size={12} style={{ marginTop: S.sm }}>
              {st.geo.lat !== null
                ? `Posizione salvata: ${st.geo.lat.toFixed(5)}, ${st.geo.lng!.toFixed(5)}`
                : 'Nessuna posizione salvata: premi il pulsante mentre sei sul posto di lavoro.'}
            </Txt>

            <Riga gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
              <Campo label="Etichetta" value={st.geo.etichetta} onChangeText={v => setGeo({ etichetta: v })} placeholder="Ufficio" />
              <Campo label="Raggio (m)" value={String(st.geo.raggio)} keyboardType="numeric"
                onChangeText={v => setGeo({ raggio: Math.max(50, parseInt(v, 10) || 150) })} />
            </Riga>

            <View style={{ marginTop: S.md, gap: 2 }}>
              <Interruttore label="Timbra l'entrata automaticamente" value={st.geo.autoEntrata} onChange={v => setGeo({ autoEntrata: v })} />
              <Interruttore label="Timbra l'uscita automaticamente" value={st.geo.autoUscita} onChange={v => setGeo({ autoUscita: v })} />
              <Interruttore label="Uscite a pranzo registrate come pausa" value={st.geo.pausaAuto} onChange={v => setGeo({ pausaAuto: v })} />
              <Interruttore label="Notifica a ogni timbratura automatica" value={st.geo.notifiche} onChange={v => setGeo({ notifiche: v })} />
            </View>

            <View style={{ marginTop: S.md }}>
              <Riga gap={S.sm} style={{ flexWrap: 'wrap' }}>
                <Badge tone={permessi?.background ? 'ok' : 'warn'}>
                  {permessi?.background ? 'Posizione: sempre' : permessi?.primoPiano ? 'Posizione: solo in uso' : 'Posizione: negata'}
                </Badge>
                <Badge tone={geofenceAttivo ? 'ok' : 'neutro'}>
                  {geofenceAttivo ? 'Area sorvegliata' : 'Area non attiva'}
                </Badge>
              </Riga>
              {!permessi?.background && (
                <View style={{ marginTop: S.sm }}>
                  <Nota tone="warn">
                    Senza il permesso "Consenti sempre" il sistema non può avvisare l'app ad app chiusa:
                    la timbratura automatica scatterebbe solo con l'app aperta.
                  </Nota>
                </View>
              )}
            </View>
          </>
        )}
      </Card>

      {/* ---------------- economia e tema ---------------- */}
      <Card>
        <Titolo>Straordinari e paga (facoltativo)</Titolo>
        <Riga gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
          <Campo label="Paga oraria" value={String(st.pagaOraria)} keyboardType="numeric"
            onChangeText={v => aggiornaImpostazioni({ pagaOraria: parseFloat(v.replace(',', '.')) || 0 })} />
          <Campo label="Maggiorazione %" value={String(st.maggiorazione)} keyboardType="numeric"
            onChangeText={v => aggiornaImpostazioni({ maggiorazione: parseFloat(v.replace(',', '.')) || 0 })} />
        </Riga>
        <Txt dim size={11} style={{ marginTop: S.sm }}>
          Stima indicativa: non tiene conto di fasce orarie, festivi, contributi o trattenute.
        </Txt>
      </Card>

      <Card>
        <Titolo>Aspetto</Titolo>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: S.md }}>
          {(['dark', 'light', 'auto'] as const).map(t => (
            <Chip key={t} label={t === 'dark' ? 'Scuro' : t === 'light' ? 'Chiaro' : 'Sistema'}
              on={st.tema === t} onPress={() => aggiornaImpostazioni({ tema: t })} />
          ))}
        </View>
      </Card>

      <Txt dim size={11} style={{ textAlign: 'center', marginTop: S.sm }}>
        Percentage · i turni sono sul dispositivo e sul tuo account
      </Txt>
    </ScrollView>
  );
}
