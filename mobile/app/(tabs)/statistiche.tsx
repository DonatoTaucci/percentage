/* Statistiche — andamento settimanale, riepilogo annuo, distribuzione per giorno. */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../src/data/store';
import * as C from '../../src/core/calc';
import { Barre, Spezzata } from '../../src/ui/charts';
import { Btn, Card, Nota, Riga, RigaTra, Stat, Titolo, Txt, usePalette } from '../../src/ui/components';
import { S, colorForPct } from '../../src/ui/theme';

export default function Statistiche() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data } = useApp();
  const st = data.settings;
  const oggi = C.today();
  const larghezza = Math.max(220, width - S.lg * 2 - 34);

  const [anno, setAnno] = useState(C.fromISO(oggi).getFullYear());

  const serie = useMemo(() => {
    const out: { label: string; value: number; sum: C.RangeSummary }[] = [];
    for (let i = 11; i >= 0; i--) {
      const ws = C.addDays(C.weekStart(oggi, st.inizioSettimana), -7 * i);
      const s = C.rangeSummary(ws, C.addDays(ws, 6), data.shifts, st);
      out.push({ label: `S${C.isoWeekNumber(ws)}`, value: s.pct, sum: s });
    }
    return out;
  }, [oggi, data.shifts, st]);

  const mediaPct = serie.reduce((a, b) => a + b.value, 0) / (serie.length || 1);
  const oreTot = serie.reduce((a, b) => a + b.sum.worked, 0);
  const strTot = serie.reduce((a, b) => a + b.sum.overtime, 0);

  const mesi = useMemo(() => {
    const out: { nome: string; sum: C.RangeSummary; parziale: boolean }[] = [];
    for (let m = 0; m < 12; m++) {
      const iso = `${anno}-${C.pad(m + 1)}-01`;
      const sum = C.rangeSummary(C.monthStart(iso), C.monthEnd(iso), data.shifts, st, {
        targetOverrideMinutes: st.oreMensiliFisse > 0 ? Math.round(st.oreMensiliFisse * 60) : 0,
      });
      if (sum.worked === 0 && sum.absence === 0) continue;
      out.push({ nome: C.MESI[m], sum, parziale: sum.inCorso && sum.targetToDate < sum.target });
    }
    return out;
  }, [anno, data.shifts, st]);

  const totali = mesi.reduce((acc, r) => {
    const tgt = r.parziale ? r.sum.targetToDate : r.sum.target;
    return {
      worked: acc.worked + r.sum.worked,
      target: acc.target + tgt,
      overtime: acc.overtime + r.sum.overtime,
    };
  }, { worked: 0, target: 0, overtime: 0 });

  const perGiorno = useMemo(() => {
    const somma = [0, 0, 0, 0, 0, 0, 0];
    const conta = [0, 0, 0, 0, 0, 0, 0];
    C.rangeSummary(C.addDays(oggi, -83), oggi, data.shifts, st).days.forEach(d => {
      const g = C.dow(d.date);
      somma[g] += d.worked;
      if (d.worked > 0) conta[g]++;
    });
    return [1, 2, 3, 4, 5, 6, 0].map(g => ({
      label: C.GIORNI_BREVI[g],
      value: conta[g] > 0 ? somma[g] / conta[g] / 60 : 0,
      color: st.giorniLavorativi.includes(g) ? p.accent : p.violet,
    }));
  }, [oggi, data.shifts, st, p]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 40 }}
    >
      <Card>
        <Titolo>Percentuale settimanale — ultime 12 settimane</Titolo>
        <View style={{ marginTop: S.sm }}>
          <Spezzata dati={serie.map(s => ({ label: s.label, value: s.value }))} larghezza={larghezza} altezza={170} />
        </View>
        <Riga gap={S.lg} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
          <Stat label="Media" value={C.fmtPct(mediaPct)} sub="delle ore previste" size={19} />
          <Stat label="Ore totali" value={C.fmtHours(oreTot, 0)} sub="12 settimane" size={19} />
          <Stat label="Straordinari" value={C.fmtHours(strTot)} size={19}
            sub={st.pagaOraria > 0 && strTot > 0 ? `≈ ${C.fmtMoney(C.overtimePay(strTot, st), st)}` : undefined} />
        </Riga>
      </Card>

      <Card>
        <RigaTra>
          <Titolo>{`Riepilogo ${anno}`}</Titolo>
          <Riga gap={6}>
            <Btn title="‹" piccolo variante="fantasma" onPress={() => setAnno(a => a - 1)} />
            <Btn title="›" piccolo variante="fantasma" onPress={() => setAnno(a => a + 1)} />
          </Riga>
        </RigaTra>

        {mesi.length === 0 ? (
          <Txt dim style={{ marginTop: S.md }}>{`Nessun dato per il ${anno}.`}</Txt>
        ) : (
          <View style={{ marginTop: S.md }}>
            <RigaTra style={{ paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: p.line }}>
              <Txt dim size={11} weight="700" style={{ flex: 1.4 }}>MESE</Txt>
              <Txt dim size={11} weight="700" style={{ flex: 1, textAlign: 'right' }}>ORE</Txt>
              <Txt dim size={11} weight="700" style={{ flex: 1, textAlign: 'right' }}>PREVISTE</Txt>
              <Txt dim size={11} weight="700" style={{ flex: 0.8, textAlign: 'right' }}>%</Txt>
            </RigaTra>
            {mesi.map(r => {
              const tgt = r.parziale ? r.sum.targetToDate : r.sum.target;
              const pct = r.parziale ? r.sum.pctToDate : r.sum.pct;
              return (
                <RigaTra key={r.nome} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.line }}>
                  <View style={{ flex: 1.4 }}>
                    <Txt size={14}>{r.nome}</Txt>
                    {r.parziale && <Txt dim size={10}>in corso</Txt>}
                  </View>
                  <Txt size={14} style={{ flex: 1, textAlign: 'right' }}>{C.fmtHours(r.sum.worked)}</Txt>
                  <Txt size={14} dim style={{ flex: 1, textAlign: 'right' }}>{C.fmtHours(tgt)}</Txt>
                  <Txt size={14} weight="700" style={{ flex: 0.8, textAlign: 'right', color: colorForPct(p, pct) }}>
                    {C.fmtPct(pct)}
                  </Txt>
                </RigaTra>
              );
            })}
            <RigaTra style={{ paddingTop: 10 }}>
              <Txt weight="700" style={{ flex: 1.4 }}>Totale</Txt>
              <Txt weight="700" style={{ flex: 1, textAlign: 'right' }}>{C.fmtHours(totali.worked, 0)}</Txt>
              <Txt weight="700" dim style={{ flex: 1, textAlign: 'right' }}>{C.fmtHours(totali.target, 0)}</Txt>
              <Txt weight="700" style={{ flex: 0.8, textAlign: 'right' }}>
                {C.fmtPct(totali.target > 0 ? (totali.worked / totali.target) * 100 : 0)}
              </Txt>
            </RigaTra>
          </View>
        )}
      </Card>

      <Card>
        <Titolo>Ore medie per giorno — ultime 12 settimane</Titolo>
        <View style={{ marginTop: S.sm }}>
          <Barre dati={perGiorno} larghezza={larghezza} altezza={160} />
        </View>
        <Nota>In viola i giorni fuori dal tuo calendario contrattuale: quelle ore contano tutte come straordinario.</Nota>
      </Card>
    </ScrollView>
  );
}
