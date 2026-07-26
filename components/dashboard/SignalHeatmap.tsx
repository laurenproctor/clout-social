'use client';

import React from 'react';
import { SignalItem, LifecycleStage } from '@/types';
import { Bookmark, TrendingUp, Smile, AlertCircle } from 'lucide-react';

// The dimension the top sub-nav is currently focused on. Drives tile ordering,
// tile color, badge emphasis, and the footer legend.
export type HeatmapDimension = 'market-heat' | 'content-opportunity' | 'sentiment' | 'lifecycle';

interface Props {
  signals: SignalItem[];
  onSelectSignal: (signal: SignalItem) => void;
  savedIds?: string[];
  onToggleSave?: (id: string) => void;
  dimension?: HeatmapDimension;
}

// Base classes are tuned for LIGHT (solid, saturated so white text is legible);
// dark: variants restore the original translucent look on dark backgrounds.
const lifecycleColors: Record<LifecycleStage, string> = {
  emerging:
    'bg-emerald-600 hover:bg-emerald-600 border-emerald-500/30 text-white dark:bg-emerald-700/80 dark:hover:bg-emerald-600/90',
  rising:
    'bg-emerald-500 hover:bg-emerald-500 border-emerald-400/30 text-white dark:bg-emerald-600/50 dark:hover:bg-emerald-500/60 dark:text-emerald-100',
  peaking:
    'bg-amber-500 hover:bg-amber-500 border-amber-400/40 text-white dark:bg-amber-500/40 dark:hover:bg-amber-400/50 dark:text-amber-100',
  declining:
    'bg-orange-500 hover:bg-orange-500 border-orange-400/40 text-white dark:bg-orange-600/40 dark:hover:bg-orange-500/50 dark:text-orange-100',
};

const lifecycleOrder: Record<LifecycleStage, number> = {
  emerging: 0,
  rising: 1,
  peaking: 2,
  declining: 3,
};

// 0–100 value → one of four buckets (cool/low → hot/high).
const bucket = (v: number): 0 | 1 | 2 | 3 => (v >= 80 ? 3 : v >= 70 ? 2 : v >= 60 ? 1 : 0);

// Market-heat ramp: cool green (low volume) → red-hot (high volume).
const heatTiers = [
  'bg-emerald-700 hover:bg-emerald-700 border-emerald-500/30 text-white dark:bg-emerald-800/70 dark:hover:bg-emerald-700/80',
  'bg-amber-500 hover:bg-amber-500 border-amber-400/40 text-white dark:bg-amber-500/40 dark:hover:bg-amber-400/50 dark:text-amber-100',
  'bg-orange-500 hover:bg-orange-500 border-orange-400/40 text-white dark:bg-orange-600/50 dark:hover:bg-orange-500/60 dark:text-orange-100',
  'bg-rose-600 hover:bg-rose-600 border-rose-400/40 text-white dark:bg-rose-600/50 dark:hover:bg-rose-500/60 dark:text-rose-100',
];

// Content-opportunity ramp: dim mint (weak score) → bright mint (strong score).
const oppTiers = [
  'bg-emerald-900 hover:bg-emerald-900 border-emerald-700/40 text-emerald-50 dark:bg-emerald-900/60 dark:hover:bg-emerald-800/70',
  'bg-emerald-700 hover:bg-emerald-700 border-emerald-500/30 text-white dark:bg-emerald-800/70 dark:hover:bg-emerald-700/80',
  'bg-emerald-600 hover:bg-emerald-600 border-emerald-500/30 text-white dark:bg-emerald-700/70 dark:hover:bg-emerald-600/80',
  'bg-emerald-500 hover:bg-emerald-500 border-emerald-400/40 text-white dark:bg-emerald-600/60 dark:hover:bg-emerald-500/70',
];

// Order tiles by the active dimension. Sentiment runs +tone → −tone so the most
// positive stories lead; lifecycle groups by stage, breaking ties on volume.
function sortByDimension(signals: SignalItem[], dimension: HeatmapDimension): SignalItem[] {
  const arr = [...signals];
  switch (dimension) {
    case 'market-heat':
      return arr.sort((a, b) => b.volumeShare - a.volumeShare);
    case 'content-opportunity':
      return arr.sort((a, b) => b.opportunityScore - a.opportunityScore);
    case 'sentiment':
      return arr.sort((a, b) => b.sentimentTone - a.sentimentTone);
    case 'lifecycle':
    default:
      return arr.sort(
        (a, b) => lifecycleOrder[a.lifecycle] - lifecycleOrder[b.lifecycle] || b.volumeShare - a.volumeShare
      );
  }
}

// Tile color for the active dimension. Per the sentiment rule, tone is NEVER a
// tile background — the Sentiment tab keeps lifecycle color and leans on the badge.
function tileColor(signal: SignalItem, dimension: HeatmapDimension): string {
  switch (dimension) {
    case 'market-heat':
      return heatTiers[bucket(signal.volumeShare)];
    case 'content-opportunity':
      return oppTiers[bucket(signal.opportunityScore)];
    case 'sentiment':
    case 'lifecycle':
    default:
      return lifecycleColors[signal.lifecycle];
  }
}

// Dynamic footer legend: swatches + caption swap to describe the active dimension.
type LegendSwatch = { color: string; label: string };
const legendConfig: Record<HeatmapDimension, { swatches: LegendSwatch[]; caption: string }> = {
  lifecycle: {
    swatches: [
      { color: 'bg-emerald-600', label: 'Emerging' },
      { color: 'bg-emerald-500/60', label: 'Rising' },
      { color: 'bg-amber-500/60', label: 'Peaking' },
      { color: 'bg-orange-600/60', label: 'Declining' },
    ],
    caption: 'Tile Size = News Volume Share · Color = Lifecycle Stage.',
  },
  'market-heat': {
    swatches: [
      { color: 'bg-emerald-700', label: 'Low' },
      { color: 'bg-amber-500', label: 'Warm' },
      { color: 'bg-orange-500', label: 'Hot' },
      { color: 'bg-rose-600', label: 'Peak' },
    ],
    caption: 'Tile Size & Color = News Volume Share · larger + hotter = more global attention.',
  },
  'content-opportunity': {
    swatches: [
      { color: 'bg-emerald-900', label: '0–59' },
      { color: 'bg-emerald-700', label: '60–69' },
      { color: 'bg-emerald-600', label: '70–79' },
      { color: 'bg-emerald-500', label: '80+' },
    ],
    caption: 'Tile Size = News Volume Share · Color = Opportunity Score.',
  },
  sentiment: {
    swatches: [
      { color: 'bg-orange-500', label: 'Negative' },
      { color: 'bg-slate-500', label: 'Neutral' },
      { color: 'bg-emerald-500', label: 'Positive' },
    ],
    caption: 'Sorted by GDELT tone (−10 to +10) · badge = sentiment · Color = Lifecycle Stage.',
  },
};

export const SignalHeatmap: React.FC<Props> = ({
  signals,
  onSelectSignal,
  savedIds = [],
  onToggleSave,
  dimension = 'lifecycle',
}) => {
  const orderedSignals = sortByDimension(signals, dimension);
  const legend = legendConfig[dimension];
  const emphasizeSentiment = dimension === 'sentiment';

  return (
    <div className="space-y-4">
      {/* Grid Heatmap Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[160px]">
        {orderedSignals.map((signal) => {
          // Calculate span based on volumeShare
          const isLarge = signal.volumeShare > 80;
          const isMedium = signal.volumeShare > 70 && !isLarge;

          const spanClass = isLarge
            ? 'md:col-span-2 md:row-span-2'
            : isMedium
            ? 'md:col-span-2 md:row-span-1'
            : 'col-span-1 row-span-1';

          return (
            <div
              key={signal.id}
              onClick={() => onSelectSignal(signal)}
              className={`relative rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between shadow-lg backdrop-blur-sm ${spanClass} ${tileColor(signal, dimension)}`}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className={`font-bold tracking-tight ${isLarge ? 'text-2xl' : 'text-lg'}`}>
                    {signal.topic}
                  </h3>
                  <div className={`font-mono font-extrabold ${isLarge ? 'text-5xl' : 'text-3xl'} text-white`}>
                    {signal.opportunityScore}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave?.(signal.id);
                  }}
                  aria-label={savedIds.includes(signal.id) ? `Unsave ${signal.topic}` : `Save ${signal.topic}`}
                  aria-pressed={savedIds.includes(signal.id)}
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 transition"
                >
                  <Bookmark
                    className={`w-4 h-4 ${savedIds.includes(signal.id) ? 'fill-current text-white' : ''}`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs font-medium text-white/90">
                <span className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {signal.lifecycle.charAt(0).toUpperCase() + signal.lifecycle.slice(1)}
                </span>
                <span
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition ${
                    emphasizeSentiment
                      ? 'bg-black/30 font-bold ring-2 ring-white/70 scale-105'
                      : 'bg-black/20'
                  }`}
                >
                  {signal.sentimentTone >= 0 ? (
                    <Smile className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-orange-300" />
                  )}
                  {signal.sentimentTone > 0 ? `+${signal.sentimentTone}` : signal.sentimentTone}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend Bar — swatches + caption track the active sub-nav dimension */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          {legend.swatches.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm inline-block ${s.color}`} /> {s.label}
            </span>
          ))}
        </div>
        <div>
          <span>{legend.caption}</span>
        </div>
      </div>
    </div>
  );
};
