/* components.tsx — mattoni dell'interfaccia. */

import React, { createContext, useContext } from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet, ViewStyle, TextStyle, useColorScheme,
} from 'react-native';
import { DARK, LIGHT, Palette, R, S } from './theme';

const PaletteCtx = createContext<Palette>(DARK);
export const usePalette = () => useContext(PaletteCtx);

export function ThemeProvider({ tema, children }: { tema: 'dark' | 'light' | 'auto'; children: React.ReactNode }) {
  const sistema = useColorScheme();
  const scelta = tema === 'auto' ? (sistema === 'light' ? LIGHT : DARK) : (tema === 'light' ? LIGHT : DARK);
  return <PaletteCtx.Provider value={scelta}>{children}</PaletteCtx.Provider>;
}

/* ---------------- testi ---------------- */

export function Titolo({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const p = usePalette();
  return <Text style={[{ color: p.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export function Txt({ children, dim, size = 15, weight = '400', style, numberOfLines }: {
  children: React.ReactNode; dim?: boolean; size?: number;
  weight?: TextStyle['fontWeight']; style?: TextStyle | TextStyle[]; numberOfLines?: number;
}) {
  const p = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: dim ? p.dim : p.txt, fontSize: size, fontWeight: weight }, style]}>
      {children}
    </Text>
  );
}

/* ---------------- contenitori ---------------- */

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return (
    <View style={[{
      backgroundColor: p.card, borderColor: p.line, borderWidth: 1,
      borderRadius: R.md, padding: S.lg, marginBottom: S.md,
    }, style]}>
      {children}
    </View>
  );
}

export function Riga({ children, style, gap = S.md }: { children: React.ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function RigaTra({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm }, style]}>{children}</View>;
}

/* ---------------- indicatori ---------------- */

export function Stat({ label, value, sub, size = 22 }: { label: string; value: string; sub?: string; size?: number }) {
  const p = usePalette();
  return (
    <View style={{ gap: 2, minWidth: 96 }}>
      <Text style={{ color: p.dim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: p.txt, fontSize: size, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {!!sub && <Text style={{ color: p.dim, fontSize: 12 }}>{sub}</Text>}
    </View>
  );
}

export function Badge({ children, tone = 'neutro' }: { children: React.ReactNode; tone?: 'neutro' | 'ok' | 'warn' | 'bad' | 'info' }) {
  const p = usePalette();
  const map = { neutro: p.dim, ok: p.ok, warn: p.warn, bad: p.bad, info: p.accent };
  const c = map[tone];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill,
      borderWidth: 1, borderColor: tone === 'neutro' ? p.line : c + '66',
      backgroundColor: tone === 'neutro' ? p.card2 : c + '1f',
    }}>
      <Text style={{ color: tone === 'neutro' ? p.dim : c, fontSize: 12, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function Barra({ pct, color }: { pct: number; color?: string }) {
  const p = usePalette();
  const v = Math.max(0, Math.min(pct, 100));
  return (
    <View style={{ height: 9, borderRadius: R.pill, backgroundColor: p.card2, overflow: 'hidden' }}>
      <View style={{ width: `${v}%`, height: '100%', borderRadius: R.pill, backgroundColor: color || p.accent }} />
    </View>
  );
}

/* ---------------- controlli ---------------- */

export function Btn({ title, onPress, variante = 'normale', disabled, style, piccolo }: {
  title: string; onPress?: () => void;
  variante?: 'normale' | 'primario' | 'fantasma' | 'pericolo';
  disabled?: boolean; style?: ViewStyle; piccolo?: boolean;
}) {
  const p = usePalette();
  const bg = variante === 'primario' ? p.accent : variante === 'fantasma' ? 'transparent' : p.card2;
  const bordo = variante === 'primario' ? p.accent : variante === 'pericolo' ? p.bad + '66' : p.line;
  const testo = variante === 'primario' ? '#fff' : variante === 'pericolo' ? p.bad : p.txt;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{
        minHeight: piccolo ? 36 : 48,
        paddingHorizontal: piccolo ? 12 : 18,
        borderRadius: R.sm, borderWidth: 1, borderColor: bordo, backgroundColor: bg,
        alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      }, style]}
    >
      <Text style={{ color: testo, fontSize: piccolo ? 13 : 15, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1,
      borderColor: on ? p.accent : p.line,
      backgroundColor: on ? p.accentSoft : p.card2,
    }}>
      <Text style={{ color: on ? p.accent : p.dim, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function Campo({ label, value, onChangeText, keyboardType, placeholder, secureTextEntry, autoCapitalize }: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  placeholder?: string; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences';
}) {
  const p = usePalette();
  return (
    <View style={{ gap: 6, flex: 1, minWidth: 120 }}>
      <Text style={{ color: p.dim, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={p.dim}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={{
          backgroundColor: p.card2, borderColor: p.line, borderWidth: 1,
          borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 11,
          color: p.txt, fontSize: 15,
        }}
      />
    </View>
  );
}

export function Interruttore({ label, value, onChange, descrizione }: {
  label: string; value: boolean; onChange: (v: boolean) => void; descrizione?: string;
}) {
  const p = usePalette();
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 6 }}>
      <View style={{
        width: 46, height: 27, borderRadius: R.pill, padding: 3,
        backgroundColor: value ? p.accent : p.card2,
        borderWidth: 1, borderColor: value ? p.accent : p.line,
        justifyContent: 'center', alignItems: value ? 'flex-end' : 'flex-start',
      }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: value ? '#fff' : p.dim }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.txt, fontSize: 14 }}>{label}</Text>
        {!!descrizione && <Text style={{ color: p.dim, fontSize: 12, marginTop: 2 }}>{descrizione}</Text>}
      </View>
    </Pressable>
  );
}

export function Nota({ children, tone = 'neutro' }: { children: React.ReactNode; tone?: 'neutro' | 'warn' | 'bad' }) {
  const p = usePalette();
  const bordo = tone === 'warn' ? p.warn : tone === 'bad' ? p.bad : p.line;
  return (
    <View style={{ backgroundColor: p.card2, borderColor: bordo, borderWidth: 1, borderRadius: R.sm, padding: 12 }}>
      <Text style={{ color: p.dim, fontSize: 13, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Vuoto({ testo }: { testo: string }) {
  const p = usePalette();
  return (
    <View style={{ padding: 30, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: p.line, borderRadius: R.md }}>
      <Text style={{ color: p.dim, textAlign: 'center', fontSize: 14 }}>{testo}</Text>
    </View>
  );
}

export const stili = StyleSheet.create({
  schermata: { flex: 1 },
  contenuto: { padding: S.lg, paddingBottom: 40 },
});
