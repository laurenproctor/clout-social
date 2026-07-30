'use client';

import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SignalItem } from '@/types';
import { Star, TrendingUp, TrendingDown, Clock, ChevronRight } from 'lucide-react';

interface Props {
  signals: SignalItem[];
  /** Open a single signal's detail (row + CTA drill-in). */
  onSelectSignal?: (signal: SignalItem) => void;
  /** CTA — jump into the full briefing (defaults to the top opportunity). */
  onViewBriefing?: () => void;
}

interface BriefingRow {
  key: string;
  icon: React.ReactNode;
  /** Tailwind text color for the row icon. */
  color: string;
  count: number;
  label: string;
  /** Representative signal this row drills into, if any. */
  pick: SignalItem | null;
}

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
        icon: <Star className="w-4 h-4" />,
        color: 'text-emerald-400',
        count: asymmetric.length,
        label: 'asymmetric opportunities',
        pick: asymmetric[0] ?? null,
      },
      {
        key: 'rising',
        icon: <TrendingUp className="w-4 h-4" />,
        color: 'text-emerald-400',
        count: rising.length,
        label: 'rising topics',
        pick: rising[0] ?? null,
      },
      {
        key: 'losing',
        icon: <TrendingDown className="w-4 h-4" />,
        color: 'text-amber-400',
        count: losing.length,
        label: 'topics losing momentum',
        pick: losing[0] ?? null,
      },
      {
        key: 'closing',
        icon: <Clock className="w-4 h-4" />,
        color: 'text-orange-400',
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
      className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <span className="text-amber-400 text-sm" aria-hidden="true">
          💡
        </span>
        <h2 id="briefing-heading" className="font-bold text-sm text-slate-100 tracking-tight">
          Today&apos;s Briefing
        </h2>
      </div>

      <ul className="space-y-2 text-xs font-medium">
        {rows.map((row) => {
          const interactive = Boolean(row.pick);
          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => handleRow(row)}
                disabled={!interactive}
                className={`group w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800/40 text-left transition ${
                  interactive ? 'hover:bg-slate-800/80 cursor-pointer' : 'cursor-default opacity-60'
                }`}
              >
                <span className="flex items-center gap-2.5 text-slate-200">
                  <span className={`shrink-0 ${row.color}`}>{row.icon}</span>
                  <span>
                    <span className="tabular-nums font-semibold">{row.count}</span> {row.label}
                  </span>
                </span>
                <ChevronRight
                  className={`w-4 h-4 text-slate-500 shrink-0 transition ${
                    interactive ? 'group-hover:text-slate-300 group-hover:translate-x-0.5' : ''
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={handleCta}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        View briefing
      </button>
    </motion.section>
  );
};
