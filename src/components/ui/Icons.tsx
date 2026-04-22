"use client";

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
}

function Polygon({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M4 6L10 3L17 7L15 16L6 16L3 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <circle cx="4" cy="6" r="1.5" fill="currentColor" />
      <circle cx="10" cy="3" r="1.5" fill="currentColor" />
      <circle cx="17" cy="7" r="1.5" fill="currentColor" />
      <circle cx="15" cy="16" r="1.5" fill="currentColor" />
      <circle cx="6" cy="16" r="1.5" fill="currentColor" />
      <circle cx="3" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function Undo({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M5 10 L2 7 L5 4 M2 7 L12 7 A5 5 0 0 1 17 12 A5 5 0 0 1 12 17 L7 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Trash({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M4 6H16M8 6V4H12V6M5 6L6 17H14L15 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Search({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 13L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Plus({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 4 V16 M4 10 H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Check({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M4 10 L8 14 L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M4 10 H16 M11 5 L16 10 L11 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={style}>
      <path d="M3 5 L7 9 L11 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Drop({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 3 C 6 9 4 11 4 14 A 6 6 0 0 0 16 14 C 16 11 14 9 10 3 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function Layers({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 3 L2 7 L10 11 L18 7 Z M2 11 L10 15 L18 11 M2 15 L10 19 L18 15" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Settings({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2 V4 M10 16 V18 M18 10 H16 M4 10 H2 M15.6 4.4 L14.2 5.8 M5.8 14.2 L4.4 15.6 M15.6 15.6 L14.2 14.2 M5.8 5.8 L4.4 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Pencil({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M13 3 L17 7 L7 17 L3 17 L3 13 Z M12 4 L16 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const Icons = {
  polygon: Polygon,
  undo: Undo,
  trash: Trash,
  search: Search,
  plus: Plus,
  check: Check,
  arrowRight: ArrowRight,
  chevronDown: ChevronDown,
  drop: Drop,
  layers: Layers,
  settings: Settings,
  pencil: Pencil,
};
