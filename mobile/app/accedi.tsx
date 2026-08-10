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

type Fase = 'email' | 'codice' | 'username';
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
  const [username, setUsername] = useState('');
  // setActive del flusso social: serve per chiudere la registrazione dopo
  // aver raccolto lo username, e non è quello di useSignUp().
  const [chiudiSSO, setChiudiSSO] = useState<null | ((o: { session: string }) => Promise<unknown>)>(null);

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
      // Rinominato: qui "signUp" ombreggerebbe quello di useSignUp().
      const { createdSessionId, setActive, signUp: iscrizione } = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else if (iscrizione?.status === 'missing_requirements') {
        // Google ha dato l'identità, ma Clerk vuole ancora qualcosa: di
        // norma lo username. Lo chiediamo qui invece di mandare l'utente
        // sul portale di Clerk a finire la registrazione altrove.
        if (iscrizione.missingFields.includes('username')) {
          setChiudiSSO(() => setActive ?? null);
          setUsername('');
          setFase('username');
        } else {
          setErrore(mancanti(iscrizione.missingFields));
        }
      }
      // Senza sessione e senza campi mancanti l'utente ha semplicemente
      // chiuso la finestra: non è un errore da mostrare.
    } catch (err: any) {
      setErrore(messaggio(err));
    }
    setSsoInCorso(null);
  }

  /* Quando Clerk richiede campi che questa schermata non raccoglie (per
     esempio lo username, se è attivo nel pannello), la registrazione resta
     a metà. Dirlo con precisione: il messaggio generico faceva sospettare
     un codice sbagliato, mandando a ricontrollare la cosa giusta nel posto
     sbagliato. */
  function mancanti(campi?: string[]): string {
    if (!campi || campi.length === 0) return 'Verifica non completata. Controlla il codice.';
    const nomi: Record<string, string> = {
      username: 'nome utente',
      first_name: 'nome',
      last_name: 'cognome',
      password: 'password',
      phone_number: 'numero di telefono',
    };
    const elenco = campi.map((c) => nomi[c] || c).join(', ');
    return `Per completare la registrazione Clerk richiede: ${elenco}. ` +
      'Disattiva quei campi nel pannello Clerk, oppure completala dal sito.';
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
        else if (res.missingFields.includes('username')) { setUsername(''); setFase('username'); }
        else setErrore(mancanti(res.missingFields));
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

  /* Ultimo passo della registrazione. Clerk tiene aperto il tentativo:
     basta completarlo con il campo mancante. */
  async function salvaUsername() {
    const scelto = username.trim();
    if (scelto.length < 3) { setErrore('Scegli un nome utente di almeno 3 caratteri.'); return; }
    setAttesa(true);
    setErrore(null);
    try {
      const res = await signUp!.update({ username: scelto });
      if (res.status === 'complete') {
        const chiudi = chiudiSSO ?? setActiveSignUp!;
        await chiudi({ session: res.createdSessionId! });
      } else {
        setErrore(mancanti(res.missingFields));
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
          {fase === 'username' ? (
            <View style={{ gap: S.md }}>
              <Txt size={17} weight="700">Scegli un nome utente</Txt>
              <Txt dim size={13}>
                Manca solo questo. È il nome con cui il tuo account viene identificato:
                puoi cambiarlo in seguito dal tuo profilo.
              </Txt>
              <Campo
                label="Nome utente"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="mario.rossi"
              />
              {!!errore && <Nota tone="bad">{errore}</Nota>}
              <Btn title={attesa ? 'Salvo…' : 'Completa la registrazione'} variante="primario" onPress={salvaUsername} disabled={attesa || !pronto} />
            </View>
          ) : fase === 'email' ? (
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
