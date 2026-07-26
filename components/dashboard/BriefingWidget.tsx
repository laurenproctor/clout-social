'use client';

import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SignalItem } from '@/types';
import { Sunrise, Sparkles, TrendingUp, TrendingDown, Clock, ChevronRight } from 'lucide-react';

interface Props {
  signals: SignalItem[];
  /** Open a single signal's detail (row + CTA drill-in). */
  onSelectSignal?: (signal: SignalItem) => void;
  /** CTA — jump into the full briefing (defaults to the top opportunity). */
  onViewBriefing?: () => void;
}

type Tone = 'emerald' | 'amber' | 'orange';

interface BriefingRow {
  key: string;
  icon: React.ReactNode;
  tone: Tone;
  count: number;
  label: string;
  /** Representative signal this row drills into, if any. */
  pick: SignalItem | null;
}

const toneStyles: Record<Tone, { chip: string; count: string }> = {
  emerald: { chip: 'bg-emerald-500/15 text-emerald-400', count: 'text-emerald-300' },
  amber: { chip: 'bg-amber-500/15 text-amber-400', count: 'text-amber-300' },
  orange: { chip: 'bg-orange-500/15 text-orange-400', count: 'text-orange-300' },
};

/** Upper bound of an authority window string like "5-9 days" → 9. */
function windowUpperDays(window: string): number {
  const nums = window.match(/\d+/g);
  return nums && nums.length ? Math.max(...nums.map(Number)) : 99;
}

const byScoreDesc = (a: SignalItem, b: SignalItem) => b.opportunityScore - a.opportunityScore;

export const BriefingWidget: React.FC<Props> = ({ signals, onSelectSignal, onViewBriefing }) => {
  const reduce = useReducedMotion();

  const rows = useMemo<BriefingRow[]>(() => {
    // Asymmetric = high opportunity score with strategic whitespace still open.
    const asymmetric = signals.filter((s) => s.opportunityScore >= 75).sort(byScoreDesc);
    const rising = signals
      .filter((s) => s.lifecycle === 'emerging' || s.lifecycle === 'rising')
      .sort(byScoreDesc);
    const losing = signals.filter((s) => s.lifecycle === 'declining').sort(byScoreDesc);
    const closing = signals
      .filter((s) => windowUpperDays(s.authorityWindowDays) <= 4)
      .sort((a, b) => windowUpperDays(a.authorityWindowDays) - windowUpperDays(b.authorityWindowDays));

    return [
      {
        key: 'asymmetric',
        icon: <Sparkles className="w-4 h-4" />,
        tone: 'emerald',
        count: asymmetric.length,
        label: 'asymmetric opportunities',
        pick: asymmetric[0] ?? null,
      },
      {
        key: 'rising',
        icon: <TrendingUp className="w-4 h-4" />,
        tone: 'emerald',
        count: rising.length,
        label: 'rising topics',
        pick: rising[0] ?? null,
      },
      {
        key: 'losing',
        icon: <TrendingDown className="w-4 h-4" />,
        tone: 'orange',
        count: losing.length,
        label: 'topics losing momentum',
        pick: losing[0] ?? null,
      },
      {
        key: 'closing',
        icon: <Clock className="w-4 h-4" />,
        tone: 'amber',
        count: closing.length,
        label: 'authority windows closing',
        pick: closing[0] ?? null,
      },
    ];
  }, [signals]);

  const handleRow = (row: BriefingRow) => {
    if (row.pick) onSelectSignal?.(row.pick);
  };

  const handleCta = () => {
    if (onViewBriefing) return onViewBriefing();
    const top = [...signals].sort(byScoreDesc)[0];
    if (top) onSelectSignal?.(top);
  };

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      aria-labelledby="briefing-heading"
      className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
          <Sunrise className="w-4 h-4" />
        </span>
        <h2 id="briefing-heading" className="text-sm font-bold text-slate-100 tracking-tight">
          Today&apos;s Briefing
        </h2>
      </div>

      <ul className="space-y-1">
        {rows.map((row) => {
          const tone = toneStyles[row.tone];
          const interactive = Boolean(row.pick);
          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => handleRow(row)}
                disabled={!interactive}
                className={`group w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                  interactive ? 'hover:bg-slate-800/60 cursor-pointer' : 'cursor-default opacity-70'
                }`}
              >
                <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${tone.chip}`}>
                  {row.icon}
                </span>
                <span className="flex-1 min-w-0 text-[13px] text-slate-300">
                  <span className={`font-bold tabular-nums ${tone.count}`}>{row.count}</span>{' '}
                  {row.label}
                </span>
                {interactive && (
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={handleCta}
        className="mt-4 inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-emerald-500/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        View briefing
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </motion.section>
  );
};
