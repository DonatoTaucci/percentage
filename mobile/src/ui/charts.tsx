/* charts.tsx — grafici disegnati con react-native-svg, senza librerie di charting. */

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Rect, Line, Polyline, Polygon, Text as SvgText, G } from 'react-native-svg';
import { usePalette } from './components';
import { colorForPct } from './theme';
import { fmtPct } from '../core/calc';

export function Donut({ pct, size = 128, stroke = 13, label, sub, color }: {
  pct: number; size?: number; stroke?: number; label?: string; sub?: string; color?: string;
}) {
  const p = usePalette();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const valore = Math.max(0, Math.min(pct || 0, 200));
  const mostrato = Math.min(valore, 100);
  const oltre = valore > 100 ? Math.min(valore - 100, 100) : 0;
  const col = color || colorForPct(p, valore);
  const rIn = r - stroke - 3;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.card2} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none"
            strokeDasharray={`${(c * mostrato) / 100} ${c}`} strokeLinecap="round"
          />
          {oltre > 0 && (
            <Circle
              cx={size / 2} cy={size / 2} r={rIn} stroke={p.violet} strokeWidth={4} fill="none"
              strokeDasharray={`${(2 * Math.PI * rIn * oltre) / 100} 9999`} strokeLinecap="round"
            />
          )}
        </G>
        <SvgText
          x={size / 2} y={size / 2 + (sub ? 0 : 6)} textAnchor="middle"
          fill={p.txt} fontSize={size / 5} fontWeight="700"
        >
          {label ?? fmtPct(pct)}
        </SvgText>
        {!!sub && (
          <SvgText x={size / 2} y={size / 2 + 19} textAnchor="middle" fill={p.dim} fontSize={11}>
            {sub}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

export type BarDato = { label: string; value: number; target?: number; color?: string };

export function Barre({ dati, altezza = 160, larghezza }: { dati: BarDato[]; altezza?: number; larghezza: number }) {
  const p = usePalette();
  const padB = 22, padT = 10;
  const innerH = altezza - padB - padT;
  const n = Math.max(dati.length, 1);
  const slot = larghezza / n;
  const bw = Math.max(6, Math.min(slot * 0.6, 30));
  const max = Math.max(1, ...dati.map(d => Math.max(d.value, d.target ?? 0))) * 1.12;

  return (
    <Svg width={larghezza} height={altezza}>
      {[0, 0.5, 1].map((f, i) => (
        <Line key={i} x1={0} x2={larghezza} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)}
          stroke={p.line} strokeWidth={1} />
      ))}
      {dati.map((d, i) => {
        const x = slot * i + (slot - bw) / 2;
        const v = Math.max(0, d.value);
        const bh = v > 0 ? Math.max(3, innerH * (v / max)) : 0;
        const y = padT + innerH - bh;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={bw} height={bh} rx={4} fill={d.color || p.accentSoft} />
            {!!d.target && d.target > 0 && (
              <Line
                x1={x - 3} x2={x + bw + 3}
                y1={padT + innerH - innerH * (d.target / max)}
                y2={padT + innerH - innerH * (d.target / max)}
                stroke={p.dim} strokeWidth={1.4} strokeDasharray="3 3" opacity={0.8}
              />
            )}
            <SvgText x={x + bw / 2} y={altezza - 6} textAnchor="middle" fill={p.dim} fontSize={10}>
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export function Spezzata({ dati, altezza = 170, larghezza }: {
  dati: { label: string; value: number }[]; altezza?: number; larghezza: number;
}) {
  const p = usePalette();
  const padB = 22, padT = 10;
  const innerH = altezza - padB - padT;
  const n = dati.length;
  if (n === 0) return null;

  const max = Math.max(120, ...dati.map(d => d.value)) * 1.1;
  const stepX = n > 1 ? larghezza / (n - 1) : 0;
  const px = (i: number) => stepX * i;
  const py = (v: number) => padT + innerH * (1 - Math.max(0, Math.min(v, max)) / max);
  const punti = dati.map((d, i) => `${px(i)},${py(d.value)}`).join(' ');
  const ogni = Math.ceil(n / 6);

  return (
    <Svg width={larghezza} height={altezza}>
      <Line x1={0} x2={larghezza} y1={py(100)} y2={py(100)} stroke={p.ok} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.75} />
      {n > 1 && (
        <>
          <Polygon points={`0,${padT + innerH} ${punti} ${px(n - 1)},${padT + innerH}`} fill={p.accentSoft} />
          <Polyline points={punti} fill="none" stroke={p.accent} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {dati.map((d, i) => (
        <G key={i}>
          <Circle cx={px(i)} cy={py(d.value)} r={3.4} fill={p.accent} />
          {(i % ogni === 0 || i === n - 1) && (
            <SvgText x={px(i)} y={altezza - 6} textAnchor="middle" fill={p.dim} fontSize={10}>{d.label}</SvgText>
          )}
        </G>
      ))}
    </Svg>
  );
}
