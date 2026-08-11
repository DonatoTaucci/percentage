/* Benessere — check-in, indice di rischio e consigli.
   Strumento di auto-osservazione: non sostituisce un parere clinico. */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '../../src/data/store';
import * as Coach from '../../src/core/coach';
import * as C from '../../src/core/calc';
import { Donut, Spezzata } from '../../src/ui/charts';
import { Badge, Barra, Btn, Card, Nota, Riga, RigaTra, Stat, Titolo, Txt, usePalette } from '../../src/ui/components';
import { S, R } from '../../src/ui/theme';

export default function Benessere() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { data, aggiungiCheckin, aggiornaImpostazioni } = useApp();
  const st = data.settings;
  const larghezza = Math.max(220, width - S.lg * 2 - 34);

  const [quiz, setQuiz] = useState(false);
  const [risposte, setRisposte] = useState<Record<string, number>>({});

  const ultimo = data.checkins.length ? data.checkins[data.checkins.length - 1] : null;
  const val = useMemo(
    () => Coach.evaluate(ultimo ? ultimo.answers : null, data.shifts, st),
    [ultimo, data.shifts, st]
  );

  function salva() {
    const punteggi = Coach.scoreAnswers(risposte);
    const v = Coach.evaluate(risposte, data.shifts, st);
    aggiungiCheckin({ answers: risposte, dims: punteggi.dims, score: v.score ?? 0, level: v.level.label });
    setQuiz(false);
    setRisposte({});
  }

  /* Le risposte riguardano la salute: prima del consenso esplicito il
     questionario non si apre, così non esistono proprio dati da trattare. */
  if (quiz && !st.consensi.benessere) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 40 }}
      >
        <Card>
          <Titolo>Prima di cominciare serve il tuo consenso</Titolo>
          <Txt dim size={13.5} style={{ marginTop: S.md, lineHeight: 21 }}>
            Le domande riguardano sonno, energia, recupero e ansia legata al lavoro. Sono informazioni
            sulla tua salute, e per trattarle il Regolamento europeo chiede un consenso dato in modo esplicito.
          </Txt>
          {[
            'Le risposte e il punteggio restano su questo dispositivo e sul tuo account. Nessun altro utente li vede.',
            'Servono solo a calcolare il tuo indice di rischio e i consigli, che l\'app genera sul dispositivo con regole fisse, senza mandare niente a nessuno.',
            'Puoi revocare il consenso quando vuoi dalle impostazioni, e cancellare i check-in già salvati.',
          ].map((t, i) => (
            <Riga key={i} gap={6} style={{ marginTop: S.sm, alignItems: 'flex-start' }}>
              <Txt dim size={13.5} style={{ lineHeight: 21 }}>•</Txt>
              <Txt dim size={13.5} style={{ flex: 1, lineHeight: 21 }}>{t}</Txt>
            </Riga>
          ))}
          <Riga gap={S.sm} style={{ marginTop: S.lg, flexWrap: 'wrap' }}>
            <Btn
              title="Acconsento"
              variante="primario"
              onPress={() => aggiornaImpostazioni({ consensi: { ...st.consensi, benessere: new Date().toISOString() } })}
            />
            <Btn title="Non ora" variante="fantasma" onPress={() => setQuiz(false)} />
            <Btn title="Informativa" variante="fantasma" onPress={() => router.push('/privacy')} />
          </Riga>
        </Card>
      </ScrollView>
    );
  }

  if (quiz) {
    const fatte = Object.keys(risposte).length;
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 40 }}
      >
        <Card>
          <RigaTra>
            <Titolo>Check-in benessere</Titolo>
            <Txt dim size={12}>{`${fatte} / ${Coach.QUESTIONS.length}`}</Txt>
          </RigaTra>
          <View style={{ marginTop: S.sm }}>
            <Barra pct={(fatte / Coach.QUESTIONS.length) * 100} color={p.accent} />
          </View>
          <Txt dim size={13} style={{ marginTop: S.md }}>
            Pensa alle ultime due settimane. Non esistono risposte giuste: rispondi di getto.
          </Txt>
        </Card>

        {Coach.QUESTIONS.map((q, i) => (
          <Card key={q.id}>
            <Txt weight="600" style={{ marginBottom: S.md }}>{`${i + 1}. ${q.text}`}</Txt>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {Coach.SCALE.map((label, v) => {
                const on = risposte[q.id] === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setRisposte(r => ({ ...r, [q.id]: v }))}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: R.sm, borderWidth: 1,
                      borderColor: on ? p.accent : p.line,
                      backgroundColor: on ? p.accentSoft : p.card2,
                      alignItems: 'center',
                    }}
                  >
                    <Txt size={11} weight="700" style={{ color: on ? p.accent : p.dim, textAlign: 'center' }}>{label}</Txt>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ))}

        <Riga gap={S.sm}>
          <Btn title="Annulla" variante="fantasma" onPress={() => { setQuiz(false); setRisposte({}); }} style={{ flex: 1 }} />
          <Btn
            title={fatte < Coach.QUESTIONS.length ? `Mancano ${Coach.QUESTIONS.length - fatte}` : 'Salva check-in'}
            variante="primario"
            disabled={fatte < Coach.QUESTIONS.length}
            onPress={salva}
            style={{ flex: 1.4 }}
          />
        </Riga>
      </ScrollView>
    );
  }

  const m = val.metrics;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 40 }}
    >
      <Nota>
        Questa sezione incrocia i dati dei tuoi turni (ore, straordinari, giorni consecutivi, pause)
        con un questionario di 16 domande. È uno strumento di auto-osservazione: non sostituisce il
        parere di un medico o di uno psicologo.
      </Nota>

      {/* Distinzione che vale la pena fare esplicitamente: qui sotto non c'è
          nessun modello, ci sono formule. */}
      <Txt dim size={11.5} style={{ marginTop: S.sm, lineHeight: 18 }}>
        Punteggio e consigli sono calcolati sul dispositivo da regole fisse, non da un'intelligenza
        artificiale: a parità di dati il risultato è sempre lo stesso.
      </Txt>

      <Card style={{ marginTop: S.md }}>
        <RigaTra style={{ marginBottom: S.md }}>
          <Titolo>Profilo attuale</Titolo>
          <Btn title={ultimo ? 'Nuovo check-in' : 'Compila'} piccolo variante="primario" onPress={() => setQuiz(true)} />
        </RigaTra>

        {val.score === null ? (
          <Txt dim>Registra almeno tre giornate di lavoro oppure compila il check-in per ottenere una valutazione.</Txt>
        ) : (
          <Riga gap={S.lg}>
            <Donut
              pct={val.score}
              size={112}
              label={String(val.score)}
              sub="rischio"
              color={val.level.tone === 'ok' ? p.ok : val.level.tone === 'warn' ? p.warn : p.bad}
            />
            <View style={{ flex: 1, gap: S.sm }}>
              <Badge tone={val.level.tone}>{val.level.label}</Badge>
              <Txt size={13} dim>{val.level.msg}</Txt>
            </View>
          </Riga>
        )}
      </Card>

      {ultimo && (
        <Card>
          <Titolo>Aree del questionario</Titolo>
          <View style={{ gap: S.sm, marginTop: S.md }}>
            {(Object.keys(Coach.DIMENSIONS) as Coach.DimKey[]).map(k => {
              const v = ultimo.dims[k];
              if (v === null || v === undefined) return null;
              return (
                <View key={k} style={{ gap: 4 }}>
                  <RigaTra>
                    <Txt size={13}>{Coach.DIMENSIONS[k].label}</Txt>
                    <Txt size={12} dim>{v}</Txt>
                  </RigaTra>
                  <Barra pct={v} color={v >= 65 ? p.bad : v >= 40 ? p.warn : p.ok} />
                </View>
              );
            })}
          </View>
          <Txt dim size={11} style={{ marginTop: S.md }}>Valori più alti indicano maggiore criticità nell'area.</Txt>
        </Card>
      )}

      {m.datiSufficienti && (
        <Card>
          <Titolo>Indicatori dai turni — ultime 4 settimane</Titolo>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.md, marginTop: S.md }}>
            <Stat label="Media settim." value={`${m.mediaSettimanale.toFixed(1).replace('.', ',')} h`}
              sub={m.mediaSettimanale > 48 ? 'oltre le 48 h' : 'entro le 48 h'} size={19} />
            <Stat label="Straordinari" value={`${m.straordinari28.toFixed(1).replace('.', ',')} h`} sub="28 giorni" size={19} />
            <Stat label="Giorni riposo" value={String(m.giorniRiposo28)} sub="su 28" size={19} />
            <Stat label="Max di fila" value={String(m.streakMax)} sub={m.streakCorrente > 0 ? `ora ${m.streakCorrente}` : 'in pausa'} size={19} />
            <Stat label="Giornate ≥10 h" value={String(m.giorniLunghi)} size={19} />
            <Stat label="Senza pausa" value={String(m.giorniSenzaPausa)} size={19} />
          </View>
        </Card>
      )}

      {val.advice.length > 0 && (
        <Card>
          <Titolo>Consigli</Titolo>
          <View style={{ gap: S.lg, marginTop: S.md }}>
            {val.advice.map((a, i) => (
              <View key={i} style={{ borderLeftWidth: 3, paddingLeft: S.md, borderLeftColor: a.priority === 1 ? p.bad : a.priority === 2 ? p.warn : p.ok }}>
                <Txt weight="700" size={15}>{a.title}</Txt>
                <Txt dim size={13} style={{ marginTop: 4 }}>{a.text}</Txt>
                {a.actions.map((x, j) => (
                  <Txt key={j} dim size={13} style={{ marginTop: 6 }}>{`• ${x}`}</Txt>
                ))}
              </View>
            ))}
          </View>
          <Txt dim size={11} style={{ marginTop: S.lg, lineHeight: 17 }}>
            Se il malessere è intenso o dura da settimane, parlarne con il medico di base, uno psicologo
            o il medico competente aziendale è la mossa più efficace. Emergenze: 112. Telefono Amico: 02 2327 2327.
          </Txt>
        </Card>
      )}

      {data.checkins.length > 1 && (
        <Card>
          <Titolo>Andamento dei check-in</Titolo>
          <View style={{ marginTop: S.sm }}>
            <Spezzata
              dati={data.checkins.slice(-12).map(c => ({
                label: new Date(c.ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
                value: c.score,
              }))}
              larghezza={larghezza}
              altezza={160}
            />
          </View>
          <Txt dim size={11} style={{ marginTop: S.sm }}>Qui conta la direzione: verso il basso è meglio.</Txt>
        </Card>
      )}
    </ScrollView>
  );
}
