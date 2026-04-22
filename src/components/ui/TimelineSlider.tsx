"use client";

interface TimelineSliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

export function TimelineSlider({ value, onChange, min = 0, max = 90 }: TimelineSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const ticks = [];
  for (let i = min; i <= max; i += 5) {
    ticks.push(i);
  }

  return (
    <div style={{ position: 'relative', width: '100%', padding: '8px 0' }}>
      {/* Track background with fill */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 4,
          borderRadius: 2,
          background: 'var(--c-line-strong)',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: 'var(--accent)',
            borderRadius: 2,
          }}
        />
      </div>

      {/* Tick marks */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(50% + 10px)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        {ticks.map((t) => (
          <div
            key={t}
            style={{
              width: 1,
              height: 4,
              background: 'var(--c-line-strong)',
              opacity: t % 10 === 0 ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Range input */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="capataz-range"
        style={{ position: 'relative', zIndex: 1 }}
      />
    </div>
  );
}
