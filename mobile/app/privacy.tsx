/* Informativa privacy e nota sull'IA.

   Raggiungibile anche senza sessione, di proposito: la decisione di creare
   un account si prende sapendo che fine fanno i propri dati, quindi il
   documento dev'essere leggibile prima, non dopo. */

import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { INFORMATIVA, NOTA_IA, Documento, dataLeggibile } from '../src/core/legale';
import { Btn, Card, Chip, Nota, Riga, Titolo, Txt, usePalette } from '../src/ui/components';
import { S } from '../src/ui/theme';

export default function Privacy() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const [quale, setQuale] = useState<'privacy' | 'ia'>(doc === 'ia' ? 'ia' : 'privacy');

  const documento: Documento = quale === 'ia' ? NOTA_IA : INFORMATIVA;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 60 }}
    >
      <Riga gap={S.sm} style={{ flexWrap: 'wrap', marginBottom: S.md }}>
        <Btn title="Indietro" piccolo variante="fantasma" onPress={() => router.back()} />
        <Chip label="Privacy" on={quale === 'privacy'} onPress={() => setQuale('privacy')} />
        <Chip label="Intelligenza artificiale" on={quale === 'ia'} onPress={() => setQuale('ia')} />
      </Riga>

      <Txt size={20} weight="700">{documento.titolo}</Txt>
      <Txt dim size={12} style={{ marginTop: 4 }}>{`Ultimo aggiornamento: ${dataLeggibile()}`}</Txt>

      <View style={{ marginTop: S.md, marginBottom: S.md }}>
        <Nota>{documento.intro.join('\n\n')}</Nota>
      </View>

      {documento.sezioni.map((s, i) => (
        <Card key={i}>
          <Titolo>{s.titolo}</Titolo>
          {(s.paragrafi || []).map((t, j) => (
            <Txt key={'p' + j} dim size={13.5} style={{ marginTop: S.sm, lineHeight: 21 }}>{t}</Txt>
          ))}
          {(s.voci || []).map((t, j) => (
            <Riga key={'v' + j} gap={6} style={{ marginTop: S.sm, alignItems: 'flex-start' }}>
              <Txt dim size={13.5} style={{ lineHeight: 21 }}>•</Txt>
              <Txt dim size={13.5} style={{ flex: 1, lineHeight: 21 }}>{t}</Txt>
            </Riga>
          ))}
          {(s.coda || []).map((t, j) => (
            <Txt key={'c' + j} dim size={13.5} style={{ marginTop: S.sm, lineHeight: 21 }}>{t}</Txt>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}
