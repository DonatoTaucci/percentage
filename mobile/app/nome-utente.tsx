/* Scelta del nome utente, dopo l'accesso.

   Lo chiedeva Clerk durante l'iscrizione. Sul sito quella schermata la serve
   il portale ospitato di Clerk, su un indirizzo che non è il nostro: qui non
   si vedrebbe la differenza, ma il nome dev'essere lo stesso sui due client,
   quindi la domanda si sposta di qua anche nell'app. */

import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '../src/data/store';
import { Btn, Campo, Card, Nota, Riga, Titolo, Txt, usePalette } from '../src/ui/components';
import { S } from '../src/ui/theme';

const MOTIVI: Record<string, string> = {
  lunghezza: 'Il nome utente deve essere lungo da 3 a 20 caratteri.',
  caratteri: 'Sono ammessi solo lettere, cifre, punto, trattino e trattino basso.',
  occupato: 'Questo nome utente è già di qualcun altro. Provane un altro.',
};

export default function NomeUtente() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { impostaUsername } = useApp();

  const [nome, setNome] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);

  async function salva() {
    const scelto = nome.trim();
    if (scelto.length < 3) { setErrore(MOTIVI.lunghezza); return; }
    setAttesa(true);
    setErrore(null);
    const esito = await impostaUsername(scelto);
    setAttesa(false);
    if (esito.ok) { router.replace('/'); return; }
    setErrore(MOTIVI[esito.motivo ?? ''] ?? 'Non è stato possibile salvare il nome utente. Riprova fra poco.');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: S.lg, paddingTop: insets.top + S.md }}>
        <Card>
          <Titolo>Scegli un nome utente</Titolo>
          <Txt dim size={13.5} style={{ marginTop: S.sm, lineHeight: 21 }}>
            Manca solo questo. È il nome con cui il tuo account viene identificato: puoi cambiarlo
            quando vuoi dalle impostazioni.
          </Txt>
          <View style={{ marginTop: S.md }}>
            <Campo
              label="Nome utente"
              value={nome}
              onChangeText={setNome}
              autoCapitalize="none"
              placeholder="mario.rossi"
            />
          </View>
          <Txt dim size={11.5} style={{ marginTop: 6 }}>
            Da 3 a 20 caratteri: lettere, cifre, punto, trattino e trattino basso.
          </Txt>
          {!!errore && <View style={{ marginTop: S.sm }}><Nota tone="bad">{errore}</Nota></View>}
          <Riga gap={S.sm} style={{ marginTop: S.lg, flexWrap: 'wrap' }}>
            <Btn title={attesa ? '…' : 'Continua'} variante="primario" disabled={attesa} onPress={salva} />
            {/* Una via d'uscita c'è: se il server non risponde, restare chiusi
                fuori dalla propria applicazione sarebbe peggio che non avere
                un nome. Alla prossima apertura la domanda torna. */}
            <Btn title="Lo faccio dopo" variante="fantasma" onPress={() => router.replace('/')} />
          </Riga>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
