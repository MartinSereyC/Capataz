"use client";

import React from "react";

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg' | 'xl';

interface BtnProps {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  style?: React.CSSProperties;
  type?: 'button' | 'submit' | 'reset';
}

const heights: Record<BtnSize, number> = { sm: 36, md: 44, lg: 56, xl: 72 };
const fontSizes: Record<BtnSize, number> = { sm: 13, md: 14, lg: 16, xl: 18 };
const paddings: Record<BtnSize, string> = { sm: '0 14px', md: '0 18px', lg: '0 24px', xl: '0 32px' };

const variantStyles: Record<BtnVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: '#fff',
    color: 'var(--c-text)',
    border: '1.5px solid var(--c-line-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--c-text-muted)',
    border: 'none',
  },
  danger: {
    background: '#fff',
    color: '#c24231',
    border: '1.5px solid #e8c5c1',
  },
};

export function Btn({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  onClick,
  disabled,
  full,
  style,
  type = 'button',
}: BtnProps) {
  const h = heights[size];
  const fs = fontSizes[size];
  const pad = paddings[size];
  const vs = variantStyles[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: h,
        padding: pad,
        borderRadius: 'var(--r-lg)',
        fontSize: fs,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.15s, background 0.15s',
        width: full ? '100%' : undefined,
        fontFamily: 'inherit',
        letterSpacing: -0.1,
        ...vs,
        ...style,
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
}
