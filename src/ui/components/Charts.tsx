// Dependency-free SVG charts.
import { confidenceLabel } from '../../core/scoring';

export function scoreColor(s: number | null): string {
  if (s === null) return '#64748b';
  return s >= 80 ? '#a78bfa' : s >= 60 ? '#60a5fa' : s >= 40 ? '#fbbf24' : '#f87171';
}

export function ScoreRing({ score, size = 132, stroke = 10, label }: { score: number | null; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = score === null ? 0 : score / 100;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ringGrad)" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-semibold tabular-nums">{score ?? '—'}</div>
        {label && <div className="text-[11px] text-slate-400">{label}</div>}
      </div>
    </div>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const l = confidenceLabel(value);
  const cls = l === 'High' ? 'bg-emerald-500/15 text-emerald-300' : l === 'Medium' ? 'bg-sky-500/15 text-sky-300' : l === 'Low' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300';
  return <span className={`chip ${cls}`} title={`Confidence ${(value * 100).toFixed(0)}%`}>{l} confidence</span>;
}

export function Bar({ value, color }: { value: number | null; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value ?? 0}%`, background: color ?? scoreColor(value) }} />
    </div>
  );
}

export function RadarChart({ items, size = 280 }: { items: { label: string; value: number | null }[]; size?: number }) {
  const n = items.length, cx = size / 2, cy = size / 2, R = size / 2 - 42;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
  };
  const poly = items.map((it, i) => pt(i, (it.value ?? 0) / 100).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px]">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={items.map((_, i) => pt(i, k).join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.07)" />
      ))}
      {items.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" />; })}
      <polygon points={poly} fill="rgba(139,92,246,0.25)" stroke="#a78bfa" strokeWidth={2} />
      {items.map((it, i) => {
        const [x, y] = pt(i, (it.value ?? 0) / 100);
        const [lx, ly] = pt(i, 1.2);
        return (
          <g key={i}>
            {it.value !== null && <circle cx={x} cy={y} r={3} fill="#c4b5fd" />}
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={it.value === null ? '#475569' : '#94a3b8'}>
              {it.label}{it.value === null ? ' (n/a)' : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ series, height = 180 }: { series: { name: string; color: string; points: { x: string; y: number | null }[] }[]; height?: number }) {
  const W = 600, H = height, pad = { l: 32, r: 12, t: 12, b: 26 };
  const xs = series[0]?.points.map((p) => p.x) ?? [];
  if (xs.length === 0) return <div className="py-8 text-center text-sm text-slate-500">No data yet.</div>;
  const X = (i: number) => pad.l + (xs.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (xs.length - 1));
  const Y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,0.05)" />
          <text x={pad.l - 6} y={Y(v)} fontSize={10} fill="#64748b" textAnchor="end" dominantBaseline="middle">{v}</text>
        </g>
      ))}
      {xs.map((x, i) => (xs.length <= 8 || i % Math.ceil(xs.length / 8) === 0) && (
        <text key={i} x={X(i)} y={H - 8} fontSize={10} fill="#64748b" textAnchor="middle">{new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>
      ))}
      {series.map((s) => {
        const pts = s.points.map((p, i) => (p.y === null ? null : [X(i), Y(p.y)] as const)).filter(Boolean) as [number, number][];
        return (
          <g key={s.name}>
            <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.5} fill={s.color} />)}
          </g>
        );
      })}
    </svg>
  );
}
