/* Accesso con Clerk: email + codice di verifica.
   Lo stesso account vale su telefono e su PC, così i turni sono gli stessi. */

import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Btn, Campo, Card, Nota, Txt, usePalette, Riga } from '../src/ui/components';
import { S } from '../src/ui/theme';

type Fase = 'email' | 'codice';

export default function Accedi() {
  const p = usePalette();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInPronto } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpPronto } = useSignUp();

  const [fase, setFase] = useState<Fase>('email');
  const [email, setEmail] = useState('');
  const [codice, setCodice] = useState('');
  const [nuovoAccount, setNuovoAccount] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);

  const pronto = signInPronto && signUpPronto;

  function messaggio(err: any): string {
    return err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Qualcosa non ha funzionato.';
  }

  /* Prima si prova l'accesso; se l'indirizzo non esiste ancora si crea l'account.
     Per l'utente è un unico gesto: inserisce la mail e riceve un codice. */
  async function inviaCodice() {
    if (!pronto || !email.includes('@')) { setErrore('Inserisci un indirizzo email valido.'); return; }
    setAttesa(true);
    setErrore(null);
    try {
      const tentativo = await signIn!.create({ identifier: email.trim() });
      const fattore = tentativo.supportedFirstFactors?.find((f: any) => f.strategy === 'email_code') as any;
      if (!fattore) throw new Error('Per questo account il codice via email non è disponibile.');
      await signIn!.prepareFirstFactor({ strategy: 'email_code', emailAddressId: fattore.emailAddressId });
      setNuovoAccount(false);
      setFase('codice');
    } catch (err: any) {
      const nonTrovato = err?.errors?.[0]?.code === 'form_identifier_not_found';
      if (!nonTrovato) { setErrore(messaggio(err)); setAttesa(false); return; }
      try {
        await signUp!.create({ emailAddress: email.trim() });
        await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
        setNuovoAccount(true);
        setFase('codice');
      } catch (err2: any) {
        setErrore(messaggio(err2));
      }
    }
    setAttesa(false);
  }

  async function verifica() {
    if (!pronto || codice.trim().length < 4) { setErrore('Inserisci il codice ricevuto via email.'); return; }
    setAttesa(true);
    setErrore(null);
    try {
      if (nuovoAccount) {
        const res = await signUp!.attemptEmailAddressVerification({ code: codice.trim() });
        if (res.status === 'complete') await setActiveSignUp!({ session: res.createdSessionId });
        else setErrore('Verifica non completata. Controlla il codice.');
      } else {
        const res = await signIn!.attemptFirstFactor({ strategy: 'email_code', code: codice.trim() });
        if (res.status === 'complete') await setActiveSignIn!({ session: res.createdSessionId });
        else setErrore('Verifica non completata. Controlla il codice.');
      }
    } catch (err: any) {
      setErrore(messaggio(err));
    }
    setAttesa(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: S.lg }}>
        <View style={{ alignItems: 'center', marginBottom: S.xl }}>
          <View style={{ width: 66, height: 66, borderRadius: 18, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={34} weight="700" style={{ color: '#fff' }}>%</Txt>
          </View>
          <Txt size={23} weight="700" style={{ marginTop: S.md }}>Percentage</Txt>
          <Txt dim size={14} style={{ marginTop: 4, textAlign: 'center' }}>
            Turni, ore lavorate e benessere
          </Txt>
        </View>

        <Card>
          {fase === 'email' ? (
            <View style={{ gap: S.md }}>
              <Txt size={17} weight="700">Accedi</Txt>
              <Txt dim size={13}>
                Ti mandiamo un codice via email: nessuna password da ricordare.
                Con lo stesso indirizzo ritrovi i tuoi dati anche dal computer.
              </Txt>
              <Campo
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="nome@esempio.it"
              />
              {!!errore && <Nota tone="bad">{errore}</Nota>}
              <Btn title={attesa ? 'Invio…' : 'Ricevi il codice'} variante="primario" onPress={inviaCodice} disabled={attesa || !pronto} />
            </View>
          ) : (
            <View style={{ gap: S.md }}>
              <Txt size={17} weight="700">Controlla la posta</Txt>
              <Txt dim size={13}>
                {nuovoAccount
                  ? `Stiamo creando il tuo account. Abbiamo inviato un codice a ${email}.`
                  : `Abbiamo inviato un codice a ${email}.`}
              </Txt>
              <Campo label="Codice" value={codice} onChangeText={setCodice} keyboardType="numeric" placeholder="123456" />
              {!!errore && <Nota tone="bad">{errore}</Nota>}
              <Btn title={attesa ? 'Verifica…' : 'Entra'} variante="primario" onPress={verifica} disabled={attesa || !pronto} />
              <Riga gap={S.sm}>
                <Btn title="Cambia email" variante="fantasma" piccolo onPress={() => { setFase('email'); setCodice(''); setErrore(null); }} />
                <Btn title="Rimanda il codice" variante="fantasma" piccolo onPress={inviaCodice} disabled={attesa} />
              </Riga>
            </View>
          )}
        </Card>

        {!pronto && (
          <View style={{ alignItems: 'center', marginTop: S.md }}>
            <ActivityIndicator color={p.accent} />
          </View>
        )}

        <Txt dim size={12} style={{ textAlign: 'center', marginTop: S.lg, lineHeight: 18 }}>
          I turni restano sul dispositivo e vengono sincronizzati sul tuo account,
          così li ritrovi identici su telefono e computer.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
