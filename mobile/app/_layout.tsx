/* Radice dell'app: sessione Clerk, stato condiviso, tema. */

import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';

import { AppProvider, useApp } from '../src/data/store';
import { ThemeProvider, usePalette } from '../src/ui/components';
import { CLERK_PUBLISHABLE_KEY, CLERK_CONFIGURATO } from '../src/config';
import '../src/services/geofencing';   // registra il task di sistema all'avvio

/* Porta a "accedi" chi non ha una sessione, e dentro l'app chi ce l'ha. */
function Rotte() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuth = segments[0] === 'accedi';
    // L'informativa resta aperta anche senza sessione: chi sta decidendo se
    // registrarsi deve poterla leggere prima, non dopo aver dato i suoi dati.
    const pubblica = inAuth || segments[0] === 'privacy';
    if (!isSignedIn && !pubblica) router.replace('/accedi');
    else if (isSignedIn && inAuth) router.replace('/');
  }, [isSignedIn, isLoaded, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="accedi" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}

function ConTema({ children }: { children: React.ReactNode }) {
  const { data, pronto } = useApp();
  const p = usePalette();
  if (!pronto) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }
  return <ThemeProvider tema={data.settings.tema}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  if (!CLERK_CONFIGURATO) {
    // Senza chiave Clerk l'app non parte: meglio dirlo subito e con chiarezza.
    return <ConfigurazioneMancante />;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <AppProvider>
            <ConTema>
              <StatusBar style="auto" />
              <Rotte />
            </ConTema>
          </AppProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

/* Compare prima che esistano tema e sessione: colori scritti a mano di proposito. */
function ConfigurazioneMancante() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0e1116', padding: 24, justifyContent: 'center' }}>
      <View style={{ backgroundColor: '#161b22', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#262e3a', gap: 12 }}>
        <Text style={{ color: '#e7edf5', fontSize: 19, fontWeight: '700' }}>Manca la chiave di Clerk</Text>
        <Text style={{ color: '#97a3b4', fontSize: 14, lineHeight: 21 }}>
          Crea l'applicazione su dashboard.clerk.com, copia la publishable key (pk_test_… o pk_live_…)
          e incollala nel file mobile/.env alla voce EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.
        </Text>
        <Text style={{ color: '#97a3b4', fontSize: 14, lineHeight: 21 }}>
          Poi riavvia il bundler con: npx expo start -c
        </Text>
      </View>
    </View>
  );
}
