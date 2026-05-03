"use client";

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: size, letterSpacing: -0.3 }}>
      <svg width={size * 1.1} height={size * 1.1} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 19 L12 4 L21 19 Z" fill="var(--accent)" />
        <path d="M8.5 19 L12 13 L15.5 19 Z" fill="#fff" />
        <circle cx="12" cy="9.5" r="1.4" fill="#fff" />
      </svg>
      <span>Capataz</span>
    </span>
  );
}
