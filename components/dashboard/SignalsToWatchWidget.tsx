'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, ChevronRight, Eye } from 'lucide-react';
import { SignalItem, LifecycleStage } from '@/types';

interface Props {
  signals: SignalItem[];
  onSelectSignal?: (signal: SignalItem) => void;
  onViewAll?: () => void;
  /** How many rows to surface (default 3). */
  limit?: number;
}

// Rank by momentum: opportunity score weighted by how live the lifecycle is.
const STAGE_WEIGHT: Record<LifecycleStage, number> = {
  peaking: 12,
  emerging: 10,
  rising: 8,
  declining: 0,
};

// One-line "why watch this" derived from lifecycle + sentiment.
function describe(s: SignalItem): string {
  const warm = s.sentimentTone >= 0;
  switch (s.lifecycle) {
    case 'emerging':
      return 'Breaking out — early momentum';
    case 'rising':
      return warm ? 'Momentum building week over week' : 'Rising, but sentiment softening';
    case 'peaking':
      return 'At peak volume — watch for cooling';
    case 'declining':
      return 'Cooling from its recent peak';
    default:
      return 'Movement detected';
  }
}

// 'up' = climbing with healthy sentiment; 'warning' = peaking/declining or negative tone.
function status(s: SignalItem): 'up' | 'warning' | 'down' {
  if (s.lifecycle === 'declining') return 'down';
  if (s.lifecycle === 'peaking' || s.sentimentTone < 0) return 'warning';
  return 'up';
}

export const SignalsToWatchWidget: React.FC<Props> = ({ signals, onSelectSignal, onViewAll, limit = 3 }) => {
  const watch = useMemo(
    () =>
      [...signals]
        .sort(
          (a, b) =>
            b.opportunityScore + STAGE_WEIGHT[b.lifecycle] - (a.opportunityScore + STAGE_WEIGHT[a.lifecycle])
        )
        .slice(0, limit),
    [signals, limit]
  );

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-slate-400" />
        <h3 className="font-bold text-sm text-slate-100">Signals to watch</h3>
      </div>

      {watch.length === 0 ? (
        <p className="text-[11px] text-slate-500 py-2">No signals loaded yet.</p>
      ) : (
        <div className="space-y-2.5">
          {watch.map((sig) => {
            const s = status(sig);
            const Icon = s === 'down' ? TrendingDown : TrendingUp;
            const color = s === 'up' ? 'text-emerald-400' : s === 'warning' ? 'text-amber-400' : 'text-orange-400';
            return (
              <button
                key={sig.id}
                onClick={() => onSelectSignal?.(sig)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-800/40 hover:border-slate-700 text-left transition focus:outline-none focus-visible:border-emerald-500/50"
              >
                <div className="min-w-0 space-y-0.5">
                  <h4 className="font-bold text-xs text-slate-200 truncate">{sig.topic}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{describe(sig)}</p>
                </div>
                <Icon className={`w-4 h-4 shrink-0 ${color}`} />
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={onViewAll}
        className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-200 pt-1 font-medium transition"
      >
        <span>View all signals</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
