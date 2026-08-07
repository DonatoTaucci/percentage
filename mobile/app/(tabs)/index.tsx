/* Oggi — timbratura, giornata corrente, riepiloghi di settimana e mese. */

import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../src/data/store';
import * as C from '../../src/core/calc';
import { Donut, Barre } from '../../src/ui/charts';
import {
  Badge, Barra, Btn, Card, Nota, Riga, RigaTra, Stat, Titolo, Txt, usePalette, Vuoto,
} from '../../src/ui/components';
import { S } from '../../src/ui/theme';
import { RangeSummary } from '../../src/core/calc';
import { Punch } from '../../src/core/types';

/** Aggiunge a un riepilogo le ore della timbratura ancora aperta. */
function conTimbratura(sum: RangeSummary, punch: Punch | null, lavoro: number): RangeSummary {
  if (!punch || punch.date < sum.from || punch.date > sum.to) return sum;
  const credited = sum.credited + lavoro;
  const creditedToDate = sum.creditedToDate + lavoro;
  return {
    ...sum,
    worked: sum.worked + lavoro,
    credited,
    creditedToDate,
    pct: sum.target > 0 ? (credited / sum.target) * 100 : 0,
    pctToDate: sum.targetToDate > 0 ? (creditedToDate / sum.targetToDate) * 100 : 0,
    saldo: credited - sum.target,
    saldoToDate: creditedToDate - sum.targetToDate,
    live: true,
  };
}

function Periodo({ titolo, dettaglio, sum, larghezza, barre }: {
  titolo: string; dettaglio: string; sum: RangeSummary; larghezza: number;
  barre: { label: string; value: number; target?: number; color?: string }[];
}) {
  const p = usePalette();
  const inCorso = sum.inCorso && sum.targetToDate < sum.target;
  const pct = inCorso ? sum.pctToDate : sum.pct;
  const saldo = inCorso ? sum.saldoToDate : sum.saldo;

  return (
    <Card>
      <RigaTra style={{ marginBottom: S.md }}>
        <Titolo>{titolo}</Titolo>
        <Txt dim size={12}>{dettaglio}</Txt>
      </RigaTra>
      <Riga gap={S.lg}>
        <Donut pct={pct} size={96} stroke={11} sub={inCorso ? 'a oggi' : undefined} />
        <View style={{ flex: 1, gap: S.sm }}>
          <Stat
            label="Lavorate"
            value={C.fmtDuration(sum.worked)}
            sub={`su ${C.fmtDuration(inCorso ? sum.targetToDate : sum.target)} previste${inCorso ? ' finora' : ''}`}
            size={19}
          />
          <Riga gap={S.sm}>
            <Badge tone={Math.abs(saldo) < 1 ? 'neutro' : saldo > 0 ? 'warn' : 'bad'}>
              {Math.abs(saldo) < 1 ? 'In pari' : (saldo > 0 ? '+' : '−') + C.fmtDuration(Math.abs(saldo))}
            </Badge>
            {sum.overtime > 0 && <Badge tone="warn">{`Straord. ${C.fmtDuration(sum.overtime)}`}</Badge>}
          </Riga>
          {inCorso && (
            <Txt dim size={11}>
              {`${C.fmtPct(sum.pct)} del periodo completo${sum.live ? ' · timbratura inclusa' : ''}`}
            </Txt>
          )}
        </View>
      </Riga>
      <View style={{ marginTop: S.md }}>
        <Barre dati={barre} larghezza={larghezza} altezza={140} />
      </View>
    </Card>
  );
}

export default function Oggi() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, sincronizza, sincronizzando, entrata, pausa, uscita, annullaTimbratura, salvaTurno } = useApp();
  const [ora, setOra] = useState(Date.now());

  const st = data.settings;
  const oggi = C.today();
  const larghezza = Math.max(220, width - S.lg * 2 - 34);

  // Il cronometro si aggiorna al secondo solo quando serve davvero.
  useEffect(() => {
    if (!data.punch) return;
    const id = setInterval(() => setOra(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data.punch]);

  const giorno = useMemo(() => C.daySummary(oggi, data.shifts, st), [oggi, data.shifts, st]);
  const t = data.punch ? C.punchTotals(data.punch, ora) : null;

  const settimana = useMemo(() => {
    const a = C.weekStart(oggi, st.inizioSettimana);
    return C.rangeSummary(a, C.addDays(a, 6), data.shifts, st);
  }, [oggi, data.shifts, st]);

  const mese = useMemo(() => C.rangeSummary(
    C.monthStart(oggi), C.monthEnd(oggi), data.shifts, st,
    { targetOverrideMinutes: st.oreMensiliFisse > 0 ? Math.round(st.oreMensiliFisse * 60) : 0 }
  ), [oggi, data.shifts, st]);

  const settimanaLive = conTimbratura(settimana, data.punch, t?.lavoro ?? 0);
  const meseLive = conTimbratura(mese, data.punch, t?.lavoro ?? 0);

  const barreSettimana = settimana.days.map(d => ({
    label: C.GIORNI_BREVI[C.dow(d.date)].charAt(0).toUpperCase(),
    value: (d.worked + (data.punch?.date === d.date ? (t?.lavoro ?? 0) : 0)) / 60,
    target: d.target / 60,
    color: d.date === oggi ? p.accent : p.accentSoft,
  }));

  const barreMese = useMemo(() => {
    const out: { label: string; value: number; target: number; color: string }[] = [];
    let cur = C.weekStart(C.monthStart(oggi), st.inizioSettimana);
    const fine = C.monthEnd(oggi);
    let i = 0;
    while (cur <= fine && i < 8) {
      const a = cur < C.monthStart(oggi) ? C.monthStart(oggi) : cur;
      const b = C.addDays(cur, 6) > fine ? fine : C.addDays(cur, 6);
      const s = C.rangeSummary(a, b, data.shifts, st);
      out.push({ label: `S${i + 1}`, value: s.worked / 60, target: s.target / 60, color: p.accentSoft });
      cur = C.addDays(cur, 7);
      i++;
    }
    return out;
  }, [oggi, data.shifts, st, p]);

  /* --- azioni --- */

  function timbraUscita() {
    const turno = uscita();
    if (turno) {
      const min = C.shiftMinutes(turno, st);
      Alert.alert('Uscita registrata', `Giornata di ${C.fmtDuration(min)} (${turno.start}–${turno.end}).`);
    }
  }

  function annulla() {
    Alert.alert('Annullare la timbratura?', 'La giornata in corso non verrà registrata.', [
      { text: 'No', style: 'cancel' },
      { text: 'Annulla timbratura', style: 'destructive', onPress: annullaTimbratura },
    ]);
  }

  function giornataStandard() {
    const o = st.orario;
    if (!o.inizio || !o.fine) { Alert.alert('Imposta prima l\'orario standard.'); return; }
    salvaTurno({ date: oggi, start: o.inizio, end: o.fine, breakMin: st.pausaPredefinita, tipo: 'lavoro' });
  }

  const targetGiorno = giorno.target > 0 ? giorno.target : Math.round(st.oreGiornaliere * 60);
  const lavoroTot = giorno.worked + (t?.lavoro ?? 0);
  const pctLive = targetGiorno > 0 ? (lavoroTot / targetGiorno) * 100 : 0;
  const uscitaPrevista = data.punch
    ? C.expectedEnd(data.punch, st, Math.max(0, targetGiorno - giorno.worked), ora)
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={sincronizzando} onRefresh={() => sincronizza()} tintColor={p.accent} />}
    >
      <Card>
        <RigaTra style={{ marginBottom: S.md }}>
          <View>
            <Titolo>Oggi</Titolo>
            <Txt size={17} weight="700">{C.fmtDate(oggi, 'long')}</Txt>
          </View>
        </RigaTra>
        <Txt dim size={12} style={{ marginBottom: S.md }}>
          {`Standard ${st.orario.inizio}–${st.orario.fine}${st.orario.pausaInizio ? ` · pausa ${st.orario.pausaInizio}–${st.orario.pausaFine}` : ''}`}
        </Txt>

        {data.punch && t ? (
          <View style={{ gap: S.md }}>
            {t.giorniFa >= 1 && (
              <Nota tone="warn">
                {`Timbratura aperta dal ${C.fmtDate(data.punch.date, 'medium')}. Se hai dimenticato di uscire, timbra adesso e correggi l'orario dal turno salvato.`}
              </Nota>
            )}
            <Badge tone={t.inPausa ? 'warn' : 'ok'}>{t.inPausa ? 'In pausa' : 'In turno'}</Badge>
            <Txt size={48} weight="700" style={{ fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
              {C.fmtClock(t.lavoroSec)}
            </Txt>
            <Txt dim size={12}>
              {`Entrata ${C.timeFromMs(data.punch.startedAt)}`}
              {t.pausa > 0 ? ` · pausa ${C.fmtDuration(t.pausa)}` : ''}
              {t.inPausa
                ? ` · in pausa da ${C.timeFromMs(t.pausaCorrenteDa!)}`
                : uscitaPrevista ? ` · uscita prevista ${C.timeFromMs(uscitaPrevista)}` : ''}
            </Txt>
            <View style={{ gap: 6 }}>
              <Txt dim size={12}>{`${C.fmtPct(pctLive)} di ${C.fmtDuration(targetGiorno)}`}</Txt>
              <Barra pct={pctLive} color={p.accent} />
            </View>
            <Riga gap={S.sm}>
              <Btn title={t.inPausa ? 'Riprendi' : 'Vai in pausa'} variante={t.inPausa ? 'primario' : 'normale'} onPress={pausa} style={{ flex: 1 }} />
              <Btn title="Timbra uscita" variante={t.inPausa ? 'normale' : 'primario'} onPress={timbraUscita} style={{ flex: 1 }} />
            </Riga>
            <Btn title="Annulla timbratura" variante="fantasma" piccolo onPress={annulla} />
          </View>
        ) : (
          <View style={{ gap: S.md }}>
            <Riga gap={S.lg}>
              <Donut pct={giorno.pct} size={112} sub={giorno.target > 0 ? 'del previsto' : 'non lavorativo'} />
              <View style={{ flex: 1, gap: S.sm }}>
                <Stat label="Lavorate" value={C.fmtDuration(giorno.worked)} sub={giorno.pausa ? `pausa ${C.fmtDuration(giorno.pausa)}` : undefined} size={19} />
                <Stat label="Previste" value={giorno.target > 0 ? C.fmtDuration(giorno.target) : '—'} size={19} />
                {giorno.overtime > 0 && <Badge tone="warn">{`Straord. ${C.fmtDuration(giorno.overtime)}`}</Badge>}
              </View>
            </Riga>
            <Btn title="Timbra entrata" variante="primario" onPress={entrata} style={{ minHeight: 54 }} />
            {!giorno.entries.length && (
              <Btn title="Registra giornata standard" variante="fantasma" piccolo onPress={giornataStandard} />
            )}
          </View>
        )}

        {giorno.entries.length > 0 && (
          <View style={{ marginTop: S.md, gap: S.sm }}>
            {giorno.entries.map(s => (
              <View key={s.id} style={{ borderTopWidth: 1, borderTopColor: p.line, paddingTop: S.sm }}>
                <Txt weight="600">
                  {s.tipo === 'lavoro' ? C.fmtDuration(C.shiftMinutes(s, st)) : s.tipo}
                </Txt>
                <Txt dim size={12}>
                  {s.tipo === 'lavoro' ? `${s.start} – ${s.end}${s.breakMin ? ` · pausa ${s.breakMin}m` : ''}` : ''}
                </Txt>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Periodo
        titolo={`Settimana ${C.isoWeekNumber(oggi)}`}
        dettaglio={`${C.fmtDate(settimana.from)} – ${C.fmtDate(settimana.to)}`}
        sum={settimanaLive}
        larghezza={larghezza}
        barre={barreSettimana}
      />

      <Periodo
        titolo={C.fmtMonth(oggi)}
        dettaglio={`${mese.workedDays} giorni lavorati`}
        sum={meseLive}
        larghezza={larghezza}
        barre={barreMese}
      />

      {data.shifts.length === 0 && !data.punch && (
        <Vuoto testo="Nessun turno registrato. Timbra l'entrata quando inizi a lavorare: l'app calcola tutto il resto." />
      )}
    </ScrollView>
  );
}
