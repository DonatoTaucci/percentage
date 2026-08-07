/* Barra di navigazione inferiore. */

import React from 'react';
import { Tabs } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { usePalette } from '../../src/ui/components';

type IconaProps = { color: string; size: number };

// expo-router passa ColorValue: qui i colori sono sempre stringhe della palette.
const str = (c: unknown) => String(c);

const base = (color: string, size: number) => ({
  width: size, height: size, fill: 'none' as const,
  stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

const Oggi = ({ color, size }: IconaProps) => (
  <Svg viewBox="0 0 24 24" {...base(color, size)}>
    <Circle cx={12} cy={12} r={8.5} />
    <Path d="M12 3.5a8.5 8.5 0 0 1 0 17" fill={color} stroke="none" opacity={0.5} />
  </Svg>
);

const Turni = ({ color, size }: IconaProps) => (
  <Svg viewBox="0 0 24 24" {...base(color, size)}>
    <Path d="M3.5 6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    <Path d="M3.5 9.5h17M8 3v3.5M16 3v3.5M7.5 13.5h4M7.5 17h7" />
  </Svg>
);

const Statistiche = ({ color, size }: IconaProps) => (
  <Svg viewBox="0 0 24 24" {...base(color, size)}>
    <Path d="M4 20V13M9.3 20V6M14.7 20v-9M20 20V9" />
  </Svg>
);

const Benessere = ({ color, size }: IconaProps) => (
  <Svg viewBox="0 0 24 24" {...base(color, size)}>
    <Path d="M20.3 6.7a4.6 4.6 0 0 0-6.6 0L12 8.4l-1.7-1.7a4.6 4.6 0 1 0-6.6 6.5l8.3 8.3 8.3-8.3a4.6 4.6 0 0 0 0-6.5Z" />
  </Svg>
);

const Impostazioni = ({ color, size }: IconaProps) => (
  <Svg viewBox="0 0 24 24" {...base(color, size)}>
    <Path d="M3 7h5M12.5 7H21M3 12.5h11M18 12.5h3M3 18h6M13.5 18H21" />
    <Circle cx={10} cy={7} r={2.2} />
    <Circle cx={16} cy={12.5} r={2.2} />
    <Circle cx={11.5} cy={18} r={2.2} />
  </Svg>
);

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.dim,
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Oggi', tabBarIcon: ({ color, size }) => <Oggi color={str(color)} size={size} /> }} />
      <Tabs.Screen name="turni" options={{ title: 'Turni', tabBarIcon: ({ color, size }) => <Turni color={str(color)} size={size} /> }} />
      <Tabs.Screen name="statistiche" options={{ title: 'Statistiche', tabBarIcon: ({ color, size }) => <Statistiche color={str(color)} size={size} /> }} />
      <Tabs.Screen name="benessere" options={{ title: 'Benessere', tabBarIcon: ({ color, size }) => <Benessere color={str(color)} size={size} /> }} />
      <Tabs.Screen name="impostazioni" options={{ title: 'Impostazioni', tabBarIcon: ({ color, size }) => <Impostazioni color={str(color)} size={size} /> }} />
    </Tabs>
  );
}
