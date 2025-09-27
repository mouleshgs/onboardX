import { useMemo } from 'react';

interface Props {
  value: number; // 0-100
  size?: number; // px
  strokeWidth?: number;
  durationMs?: number;
  showPercentage?: boolean;
  className?: string;
}

// SVG-based circular progress that animates stroke-dashoffset when value changes.
export default function CircularProgress({ value, size = 72, strokeWidth = 3.5, durationMs = 600, showPercentage = true, className }: Props) {
  const normalized = Math.max(0, Math.min(100, Math.round(value || 0)));

  // Use viewBox 0 0 36 36 convention where r = 15.9155 gives circumference ~= 100
  const viewSize = 36;
  const radius = 15.9155; // popular value to make circumference ~100
  const circumference = 2 * Math.PI * radius;

  const dashOffset = useMemo(() => {
    return ((100 - normalized) / 100) * circumference;
  }, [normalized, circumference]);

  // unique id for gradient to avoid conflicts when multiple instances exist
  const gid = useMemo(() => 'grad-' + Math.random().toString(36).slice(2, 9), []);

  const sizePx = typeof size === 'number' ? `${size}px` : size;

  return (
    <div className={className} style={{ width: sizePx, height: sizePx, display: 'inline-block' }}>
      <svg viewBox={`0 0 ${viewSize} ${viewSize}`} width={size} height={size}>
        <defs>
          <linearGradient id={gid} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>

        {/* background ring */}
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />

        {/* progress ring */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          style={{ transition: `stroke-dashoffset ${durationMs}ms ease-out, stroke ${durationMs}ms` }}
          transform="rotate(-90 18 18)"
        />

        {showPercentage && (
          <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={10} fontWeight={700} fill="#0f172a">
            {normalized}%
          </text>
        )}
      </svg>
    </div>
  );
}
