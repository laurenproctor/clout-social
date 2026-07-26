'use client';

import React, { useId, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SignalItem, LifecycleStage } from '@/types';
import { Eye, ChevronRight } from 'lucide-react';

interface Props {
  signals: SignalItem[];
  /** Open a signal's detail from a watch row. */
  onSelectSignal?: (signal: SignalItem) => void;
  /** Footer link — back to the full signal set. */
  onViewAll?: () => void;
  /** Max rows to show (default 4). */
  limit?: number;
}

/** Sparkline stroke color by lifecycle — green climbs, amber peaks, orange cools. */
const trendColor: Record<LifecycleStage, string> = {
  emerging: '#10B981',
  rising: '#34D399',
  peaking: '#F59E0B',
  declining: '#F97316',
};

/** One-line "why watch this" descriptor derived from lifecycle + sentiment. */
function describe(signal: SignalItem): string {
  const warm = signal.sentimentTone >= 0;
  switch (signal.lifecycle) {
    case 'emerging':
      return 'Breaking out — early authority window open';
    case 'rising':
      return warm ? 'Momentum building week over week' : 'Rising, but sentiment is turning';
    case 'peaking':
      return 'At peak volume — act inside the window';
    case 'declining':
      return 'Cooling off from its recent peak';
    default:
      return 'Movement detected';
  }
}

const W = 76;
const H = 30;
const PAD = 3;

/** Deterministic hash so a topic always renders the same sparkline. */
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) % 9973;
  return h + 1;
}

/** Build a normalized 0..1 series whose shape follows the lifecycle stage. */
function buildSeries(signal: SignalItem): number[] {
  const n = 16;
  const seed = hash(signal.topic);
  const raw: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    let base: number;
    switch (signal.lifecycle) {
      case 'emerging':
        base = Math.pow(t, 1.9); // accelerating climb
        break;
      case 'rising':
        base = 0.2 + 0.62 * t; // steady climb
        break;
      case 'peaking':
        base = t < 0.68 ? (t / 0.68) * 0.92 : 0.92 - ((t - 0.68) / 0.32) * 0.2; // up then slight roll-off
        break;
      case 'declining':
        base = 1 - Math.pow(t, 1.25) * 0.82; // decay
        break;
      default:
        base = t;
    }
    const wiggle = Math.sin(i * 1.7 + seed) * 0.06 + Math.sin(i * 0.63 + seed * 0.3) * 0.035;
    raw.push(base + wiggle);
  }
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const span = max - min || 1;
  return raw.map((v) => (v - min) / span);
}

const Sparkline: React.FC<{ signal: SignalItem; animate: boolean }> = ({ signal, animate }) => {
  const gradientId = useId();
  const color = trendColor[signal.lifecycle];

  const { line, area, last } = useMemo(() => {
    const series = buildSeries(signal);
    const n = series.length;
    const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = (v: number) => H - PAD - v * (H - PAD * 2);
    const points = series.map((v, i) => [x(i), y(v)] as const);
    const linePath = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
    return { line: linePath, area: areaPath, last: points[n - 1] };
  }, [signal]);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="overflow-visible shrink-0"
      role="img"
      aria-label={`${signal.topic} trend, ${signal.lifecycle}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${gradientId})`}
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.25 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r={2}
        fill={color}
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.85 }}
      />
    </svg>
  );
};

/** Rank by momentum: opportunity score weighted by how live the lifecycle is. */
const stageWeight: Record<LifecycleStage, number> = {
  peaking: 12,
  emerging: 10,
  rising: 8,
  declining: 0,
};

export const SignalsToWatchWidget: React.FC<Props> = ({
  signals,
  onSelectSignal,
  onViewAll,
  limit = 4,
}) => {
  const reduce = useReducedMotion();
  const animate = !reduce;

  const watch = useMemo(
    () =>
      [...signals]
        .sort(
          (a, b) =>
            b.opportunityScore + stageWeight[b.lifecycle] - (a.opportunityScore + stageWeight[a.lifecycle])
        )
        .slice(0, limit),
    [signals, limit]
  );

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
      aria-labelledby="watch-heading"
      className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
          <Eye className="w-4 h-4" />
        </span>
        <h2 id="watch-heading" className="text-sm font-bold text-white tracking-tight">
          Signals to watch
        </h2>
      </div>

      {watch.length === 0 ? (
        <p className="text-xs text-slate-500 py-4">No signals loaded yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800/70">
          {watch.map((signal) => (
            <li key={signal.id}>
              <button
                type="button"
                onClick={() => onSelectSignal?.(signal)}
                className="group w-full flex items-center gap-3 py-2.5 text-left transition"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-100 truncate group-hover:text-white">
                    {signal.topic}
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">{describe(signal)}</span>
                </span>
                <Sparkline signal={signal} animate={animate} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onViewAll}
        className="mt-3 w-full flex items-center justify-between text-[11px] font-medium text-emerald-400 hover:text-emerald-300 rounded-lg px-1 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
      >
        View all signals
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </motion.section>
  );
};
