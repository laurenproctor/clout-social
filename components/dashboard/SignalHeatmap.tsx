'use client';

import React from 'react';
import { SignalItem, LifecycleStage } from '@/types';
import { Bookmark, TrendingUp, Smile, AlertCircle } from 'lucide-react';

interface Props {
  signals: SignalItem[];
  onSelectSignal: (signal: SignalItem) => void;
  savedIds?: string[];
  onToggleSave?: (id: string) => void;
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

export const SignalHeatmap: React.FC<Props> = ({ signals, onSelectSignal, savedIds = [], onToggleSave }) => {
  return (
    <div className="space-y-4">
      {/* Grid Heatmap Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[160px]">
        {signals.map((signal) => {
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
              className={`relative rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between shadow-lg backdrop-blur-sm ${spanClass} ${lifecycleColors[signal.lifecycle]}`}
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
                <span className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full">
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

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" /> Emerging
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/50 inline-block" /> Rising
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500/50 inline-block" /> Peaking
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-orange-600/50 inline-block" /> Declining
          </span>
        </div>
        <div>
          <span>Tile Size = News Volume Share. Color = Lifecycle Stage.</span>
        </div>
      </div>
    </div>
  );
};
