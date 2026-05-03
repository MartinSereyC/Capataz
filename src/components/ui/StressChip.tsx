"use client";

export type StressLevel = 'ok' | 'mild' | 'warn' | 'high' | 'crit';

const map: Record<StressLevel, { bg: string; label: string; text: string }> = {
  ok:   { bg: '#4a8a52', label: 'Sin estrés', text: '#fff' },
  mild: { bg: '#b6c24a', label: 'Leve',       text: '#222' },
  warn: { bg: '#e4b53a', label: 'Moderado',   text: '#3a2a00' },
  high: { bg: '#d97a2a', label: 'Alto',       text: '#fff' },
  crit: { bg: '#c24231', label: 'Crítico',    text: '#fff' },
};

export function StressChip({ level }: { level: StressLevel }) {
  const { bg, label, text } = map[level];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 99,
        background: bg,
        color: text,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.2,
        lineHeight: '20px',
      }}
    >
      {label}
    </span>
  );
}
