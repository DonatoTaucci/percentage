/* Accesso con Clerk: email + codice di verifica, oppure Google, Apple e
   Facebook. Lo stesso account vale su telefono e su PC, così i turni sono
   gli stessi: chi entra dal sito con Google deve poter entrare con Google
   anche da qui, altrimenti si ritroverebbe due account distinti. */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable, Text } from 'react-native';
import { useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Btn, Campo, Card, Nota, Txt, usePalette, Riga } from '../src/ui/components';
import { LogoApple, LogoFacebook, LogoGoogle } from '../src/ui/loghi';
import { S, R } from '../src/ui/theme';

// Chiude la scheda del browser rimasta aperta quando si torna nell'app.
WebBrowser.maybeCompleteAuthSession();

type Fase = 'email' | 'codice';
type Provider = 'oauth_google' | 'oauth_apple' | 'oauth_facebook';

export default function Accedi() {
  const p = usePalette();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInPronto } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpPronto } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [fase, setFase] = useState<Fase>('email');
  const [email, setEmail] = useState('');
  const [codice, setCodice] = useState('');
  const [nuovoAccount, setNuovoAccount] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);
  const [ssoInCorso, setSsoInCorso] = useState<Provider | null>(null);

  const pronto = signInPronto && signUpPronto;

  // Su Android precaricare il browser rende l'apertura molto più rapida.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  async function accediCon(strategy: Provider) {
    if (ssoInCorso) return;
    setSsoInCorso(strategy);
    setErrore(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      // Senza sessione l'utente ha chiuso la finestra: non è un errore da mostrare.
      if (createdSessionId && setActive) await setActive({ session: createdSessionId });
    } catch (err: any) {
      setErrore(messaggio(err));
    }
    setSsoInCorso(null);
  }

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

              <Riga gap={S.sm}>
                <BottoneSSO
                  logo={<LogoGoogle />}
                  etichetta="Google"
                  onPress={() => accediCon('oauth_google')}
                  attesa={ssoInCorso === 'oauth_google'}
                  disabilitato={!pronto || (!!ssoInCorso && ssoInCorso !== 'oauth_google')}
                />
                <BottoneSSO
                  logo={<LogoApple colore={p.txt} />}
                  etichetta="Apple"
                  onPress={() => accediCon('oauth_apple')}
                  attesa={ssoInCorso === 'oauth_apple'}
                  disabilitato={!pronto || (!!ssoInCorso && ssoInCorso !== 'oauth_apple')}
                />
                <BottoneSSO
                  logo={<LogoFacebook />}
                  etichetta="Facebook"
                  onPress={() => accediCon('oauth_facebook')}
                  attesa={ssoInCorso === 'oauth_facebook'}
                  disabilitato={!pronto || (!!ssoInCorso && ssoInCorso !== 'oauth_facebook')}
                />
              </Riga>

              <Riga gap={S.sm} style={{ alignItems: 'center' }}>
                <View style={{ flex: 1, height: 1, backgroundColor: p.line }} />
                <Txt dim size={12}>oppure</Txt>
                <View style={{ flex: 1, height: 1, backgroundColor: p.line }} />
              </Riga>

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

/* Pulsante quadrato con il logo del provider. Occupano una riga in tre:
   il nome sotto il logo serve a chi non riconosce l'icona. */
function BottoneSSO({ logo, etichetta, onPress, attesa, disabilitato }: {
  logo: React.ReactNode;
  etichetta: string;
  onPress: () => void;
  attesa?: boolean;
  disabilitato?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabilitato || attesa}
      accessibilityRole="button"
      accessibilityLabel={`Accedi con ${etichetta}`}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 62,
        gap: 4,
        borderRadius: R.sm,
        borderWidth: 1,
        borderColor: p.line,
        backgroundColor: p.card2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabilitato ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {attesa ? <ActivityIndicator color={p.accent} /> : logo}
      <Text style={{ color: p.dim, fontSize: 11, fontWeight: '600' }}>{etichetta}</Text>
    </Pressable>
  );
}
