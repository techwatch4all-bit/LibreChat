import React from 'react';

export type OrbVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'muted' | 'error';

interface OrbVisualizerProps {
  state: OrbVisualState;
  amplitude?: number;
  size?: number;
  className?: string;
}

const STATE_PALETTE: Record<OrbVisualState, { core: string; glow: string; ring: string }> = {
  idle: { core: '#6366f1', glow: 'rgba(99, 102, 241, 0.35)', ring: '#818cf8' },
  listening: { core: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', ring: '#34d399' },
  thinking: { core: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.45)', ring: '#a78bfa' },
  speaking: { core: '#d946ef', glow: 'rgba(217, 70, 239, 0.45)', ring: '#f472b6' },
  muted: { core: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)', ring: '#f87171' },
  error: { core: '#ef4444', glow: 'rgba(239, 68, 68, 0.45)', ring: '#fca5a5' },
};

export const OrbVisualizer: React.FC<OrbVisualizerProps> = ({
  state,
  amplitude = 0.25,
  size = 28,
  className = '',
}) => {
  const palette = STATE_PALETTE[state];
  const clamped = Math.max(0.05, Math.min(1, amplitude));
  const outerScale = 0.85 + clamped * 0.15;
  const midScale = 0.72 + clamped * 0.12;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ filter: `drop-shadow(0 0 ${Math.round(size * 0.22)}px ${palette.glow})` }}
    >
      <circle
        cx="40"
        cy="40"
        r={36 * outerScale}
        fill="none"
        stroke={palette.ring}
        strokeWidth="1.5"
        strokeOpacity={0.22 + clamped * 0.25}
        className={state === 'speaking' || state === 'thinking' ? 'animate-pulse' : ''}
      />
      <circle
        cx="40"
        cy="40"
        r={28 * midScale}
        fill="none"
        stroke={palette.ring}
        strokeWidth="2"
        strokeOpacity={0.4 + clamped * 0.3}
      />
      <circle cx="40" cy="40" r={16 + clamped * 4} fill={palette.core} fillOpacity="0.92" />
      <circle cx="35" cy="35" r="5" fill="#ffffff" fillOpacity="0.35" />
    </svg>
  );
};

export default OrbVisualizer;
