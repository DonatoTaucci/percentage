/* Turni — registro mensile con inserimento e correzione manuale. */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, Modal, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../src/data/store';
import * as C from '../../src/core/calc';
import { Shift, TipoGiornata, TIPI } from '../../src/core/types';
import {
  Badge, Barra, Btn, Campo, Card, Chip, Nota, Riga, RigaTra, Stat, Titolo, Txt, usePalette, Vuoto,
} from '../../src/ui/components';
import { S, R } from '../../src/ui/theme';

const vuoto = (date: string, st: any): Partial<Shift> & { date: string } => ({
  date,
  start: st.orario.inizio,
  end: st.orario.fine,
  breakMin: st.pausaPredefinita,
  tipo: 'lavoro',
  note: '',
});

export default function Turni() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { data, salvaTurno, eliminaTurno } = useApp();
  const st = data.settings;

  const [mese, setMese] = useState(C.today());
  const [bozza, setBozza] = useState<(Partial<Shift> & { date: string }) | null>(null);

  const sum = useMemo(() => C.rangeSummary(
    C.monthStart(mese), C.monthEnd(mese), data.shifts, st,
    { targetOverrideMinutes: st.oreMensiliFisse > 0 ? Math.round(st.oreMensiliFisse * 60) : 0 }
  ), [mese, data.shifts, st]);

  const inCorso = sum.inCorso && sum.targetToDate < sum.target;
  const giorniConTurni = sum.days.filter(d => d.entries.length > 0).reverse();

  function conferma(t: Shift) {
    Alert.alert('Eliminare il turno?', C.fmtDate(t.date, 'medium'), [
      { text: 'No', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => eliminaTurno(t.id) },
    ]);
  }

  function salva() {
    if (!bozza) return;
    const tipo = (bozza.tipo || 'lavoro') as TipoGiornata;
    if (TIPI[tipo].conteggia === 'ore') {
      const a = C.parseTime(bozza.start || '');
      const b = C.parseTime(bozza.end || '');
      // Basta uno dei due: chi ha dimenticato di timbrare registra quello che
      // ha e completa più avanti. Finché manca l'altro, il turno vale zero.
      if (a === null && b === null) {
        Alert.alert('Orario mancante', 'Inserisci almeno l\'orario di entrata o quello di uscita, nel formato 24 ore (per esempio 09:00).');
        return;
      }
      if ((bozza.start || '').trim() !== '' && a === null) {
        Alert.alert('Orario non valido', 'Usa il formato 24 ore, per esempio 09:00.');
        return;
      }
      if ((bozza.end || '').trim() !== '' && b === null) {
        Alert.alert('Orario non valido', 'Usa il formato 24 ore, per esempio 09:00.');
        return;
      }
    }
    salvaTurno(bozza);
    setBozza(null);
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 40 }}
      >
        <Card>
          <RigaTra>
            <Riga gap={S.sm}>
              <Btn title="‹" piccolo variante="fantasma" onPress={() => setMese(C.addMonths(mese, -1))} />
              <Txt weight="700" style={{ minWidth: 130, textAlign: 'center' }}>{C.fmtMonth(mese)}</Txt>
              <Btn title="›" piccolo variante="fantasma" onPress={() => setMese(C.addMonths(mese, 1))} />
            </Riga>
            <Btn title="+ Turno" piccolo variante="primario" onPress={() => setBozza(vuoto(C.today(), st))} />
          </RigaTra>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.md, marginTop: S.lg }}>
            <Stat
              label="Percentuale"
              value={C.fmtPct(inCorso ? sum.pctToDate : sum.pct)}
              sub={inCorso
                ? `${C.fmtDuration(sum.creditedToDate)} / ${C.fmtDuration(sum.targetToDate)} a oggi`
                : `${C.fmtDuration(sum.credited)} / ${C.fmtDuration(sum.target)}`}
            />
            <Stat label="Lavorate" value={C.fmtHours(sum.worked)} sub={`${sum.workedDays} giorni`} />
            <Stat label="Straordinari" value={sum.overtime ? C.fmtHours(sum.overtime) : '0 h'}
              sub={st.pagaOraria > 0 && sum.overtime > 0 ? `≈ ${C.fmtMoney(C.overtimePay(sum.overtime, st), st)}` : undefined} />
            <Stat
              label="Saldo"
              value={((inCorso ? sum.saldoToDate : sum.saldo) >= 0 ? '+' : '−') + C.fmtDuration(Math.abs(inCorso ? sum.saldoToDate : sum.saldo))}
            />
          </View>

          <View style={{ marginTop: S.md }}>
            <Barra pct={inCorso ? sum.pctToDate : sum.pct} />
          </View>

          {inCorso && (
            <Txt dim size={11} style={{ marginTop: S.sm }}>
              {`Mese in corso: percentuale sulle ore previste fino a oggi. Sull'intero mese sarebbe ${C.fmtPct(sum.pct)} di ${C.fmtDuration(sum.target)}.`}
            </Txt>
          )}
        </Card>

        {giorniConTurni.length === 0 ? (
          <Vuoto testo={`Nessun turno in ${C.fmtMonth(mese)}.`} />
        ) : (
          giorniConTurni.map(d => (
            <View key={d.date}>
              <Txt dim size={12} weight="700" style={{ marginTop: S.md, marginBottom: 6, textTransform: 'uppercase' }}>
                {`${C.fmtDate(d.date, 'medium')} · ${C.fmtDuration(d.worked)}${d.target ? ` · ${C.fmtPct(d.pct)}` : ''}`}
              </Txt>
              {d.entries.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => setBozza({ ...s })}
                  onLongPress={() => conferma(s)}
                  style={{
                    backgroundColor: p.card, borderColor: p.line, borderWidth: 1,
                    borderRadius: R.sm, padding: S.md, marginBottom: 6,
                  }}
                >
                  <RigaTra>
                    <View style={{ flex: 1 }}>
                      {TIPI[s.tipo].conteggia === 'ore' ? (
                        <>
                          {C.turnoIncompleto(s)
                            ? <Badge tone="warn">Da completare</Badge>
                            : <Txt weight="700">{C.fmtDuration(C.shiftMinutes(s, st))}</Txt>}
                          <Txt dim size={12}>
                            {`${s.start || '?'} – ${s.end || '?'}${s.breakMin ? ` · pausa ${s.breakMin}m` : ' · nessuna pausa'}${C.isNightShift(s) ? ' · serale' : ''}${C.turnoIncompleto(s) ? ' · da completare' : ''}`}
                          </Txt>
                        </>
                      ) : (
                        <Badge tone={s.tipo === 'malattia' ? 'bad' : 'info'}>{TIPI[s.tipo].label}</Badge>
                      )}
                      {!!s.note && <Txt dim size={12}>{s.note}</Txt>}
                    </View>
                    <Btn title="Elimina" piccolo variante="fantasma" onPress={() => conferma(s)} />
                  </RigaTra>
                </Pressable>
              ))}
            </View>
          ))
        )}

        <Nota>Tocca un turno per modificarlo. La maggior parte delle giornate si registra da sola con la timbratura.</Nota>
      </ScrollView>

      <Modal visible={!!bozza} animationType="slide" transparent onRequestClose={() => setBozza(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.card, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: S.lg, paddingBottom: insets.bottom + S.lg, gap: S.md }}>
            <Txt size={18} weight="700">{bozza?.id ? 'Modifica turno' : 'Nuovo turno'}</Txt>

            <Campo label="Data (AAAA-MM-GG)" value={bozza?.date ?? ''} onChangeText={v => setBozza(b => b && ({ ...b, date: v }))} />

            <View style={{ gap: 6 }}>
              <Txt dim size={12} weight="700">Tipo di giornata</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(TIPI) as TipoGiornata[]).map(k => (
                  <Chip key={k} label={TIPI[k].label} on={(bozza?.tipo ?? 'lavoro') === k}
                    onPress={() => setBozza(b => b && ({ ...b, tipo: k }))} />
                ))}
              </View>
            </View>

            {TIPI[(bozza?.tipo ?? 'lavoro') as TipoGiornata].conteggia === 'ore' && (
              <>
                <Riga gap={S.sm}>
                  <Campo label="Inizio" value={bozza?.start ?? ''} onChangeText={v => setBozza(b => b && ({ ...b, start: v }))} placeholder="09:00" />
                  <Campo label="Fine" value={bozza?.end ?? ''} onChangeText={v => setBozza(b => b && ({ ...b, end: v }))} placeholder="18:00" />
                  <Campo label="Pausa (min)" value={String(bozza?.breakMin ?? 0)} keyboardType="numeric"
                    onChangeText={v => setBozza(b => b && ({ ...b, breakMin: parseInt(v, 10) || 0 }))} />
                </Riga>
                {!!bozza && C.turnoIncompleto({ start: bozza.start ?? '', end: bozza.end ?? '', tipo: 'lavoro' }) && (
                  <Txt dim size={12}>
                    {bozza.start
                      ? 'Manca l\'orario di uscita: il turno resta da completare e non conta ore.'
                      : 'Manca l\'orario di entrata: il turno resta da completare e non conta ore.'}
                  </Txt>
                )}
                {!!bozza && C.parseTime(bozza.start || '') !== null && C.parseTime(bozza.end || '') !== null && (
                  <Txt dim size={12}>
                    {`Ore lavorate: ${C.fmtDuration(C.shiftMinutes({ start: bozza.start!, end: bozza.end!, breakMin: bozza.breakMin ?? 0, tipo: 'lavoro' }, st))}`}
                    {C.parseTime(bozza.end!)! < C.parseTime(bozza.start!)! ? ' · a cavallo di mezzanotte' : ''}
                  </Txt>
                )}
                {/* Il turno parziale va spiegato qui, dove serve: chi si accorge
                    ora di non aver timbrato deve sapere che può salvare a metà. */}
                <Nota>
                  Ti sei dimenticato di timbrare? Puoi inserire anche un orario solo: scrivi quello
                  che ricordi con certezza e lascia vuoto l'altro. Il turno viene salvato lo stesso,
                  resta segnato «Da completare» e vale zero ore — l'orario mancante non viene
                  inventato, altrimenti le percentuali racconterebbero una giornata che non hai
                  fatto. Quando lo ricordi, riapri il turno e aggiungi l'orario che manca.
                </Nota>
              </>
            )}

            <Campo label="Note" value={bozza?.note ?? ''} onChangeText={v => setBozza(b => b && ({ ...b, note: v }))} placeholder="facoltative" />

            <Riga gap={S.sm}>
              <Btn title="Annulla" variante="fantasma" onPress={() => setBozza(null)} style={{ flex: 1 }} />
              <Btn title="Salva" variante="primario" onPress={salva} style={{ flex: 1 }} />
            </Riga>
          </View>
        </View>
      </Modal>
    </>
  );
}
