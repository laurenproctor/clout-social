'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SignalItem, LifecycleStage } from '@/types';
import { MOCK_SIGNALS } from '@/lib/mockSignals';
import { Sidebar } from '@/components/layout/Sidebar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Radio, Zap, BarChart3, FileText, Bookmark, PenLine, ArrowUpRight, Compass } from 'lucide-react';
import { loadSavedIds } from '@/lib/savedSignals';

function opportunityLabel(score: number): string {
  if (score >= 75) return 'High Opportunity';
  if (score >= 50) return 'Moderate Opportunity';
  return 'Early Opportunity';
}

const MOMENTUM_BOOST: Record<LifecycleStage, number> = {
  emerging: 9,
  rising: 6,
  peaking: 0,
  declining: -12,
};
const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export default function BriefsPage() {
  const [signals, setSignals] = useState<SignalItem[]>(MOCK_SIGNALS);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load the same saved-signal bookmarks the dashboard writes (migrating legacy ids).
  useEffect(() => {
    setSavedIds(loadSavedIds());
    setHydrated(true);
  }, []);

  // Pull the current signal set so briefs reflect live GDELT data when available.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/signals', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.signals) && data.signals.length) {
          setSignals(data.signals);
        }
      } catch {
        /* keep the seeded set */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const briefs = useMemo(
    () => signals.filter((s) => savedIds.includes(s.id)),
    [signals, savedIds]
  );

  // ?signal=<id> (from the modal's "Create brief") scrolls to and highlights that brief.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('signal');
    if (id) setHighlightId(id);
  }, []);
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`brief-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightId(null), 2600); // let the highlight ring fade out
    return () => clearTimeout(t);
  }, [highlightId, briefs]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20">
            C
          </div>
          <span className="font-extrabold text-lg tracking-tight text-slate-100">Clout</span>
          <span className="hidden sm:inline-block text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            Briefs
          </span>
        </div>
        <nav className="lg:hidden flex items-center gap-2 text-sm">
          <Link href="/" aria-label="Signals" className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium transition">
            <Radio className="w-4 h-4" /> <span className="hidden sm:inline">Signals</span>
          </Link>
          <span className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
            <FileText className="w-4 h-4" /> <span className="hidden sm:inline">Briefs</span>
          </span>
          <Link href="/studio" aria-label="Content Studio" className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium transition">
            <Zap className="w-4 h-4" /> <span className="hidden sm:inline">Content Studio</span>
          </Link>
          <Link href="/analytics" aria-label="Analytics" className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium transition">
            <BarChart3 className="w-4 h-4" /> <span className="hidden sm:inline">Analytics</span>
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div className="flex flex-wrap justify-between items-end gap-4 border-b border-slate-800/60 pb-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Content Briefs</h1>
              <p className="text-xs text-slate-400 mt-1">
                Strategic briefs built from the signals you&apos;ve saved — the why, the whitespace, and the strongest angles.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg">
              {briefs.length} saved {briefs.length === 1 ? 'brief' : 'briefs'}
            </span>
          </div>

          {/* Empty state — before hydration we don't yet know what's saved */}
          {hydrated && briefs.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                <Compass className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-base font-bold text-slate-200">No briefs yet</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Save a signal from the heatmap to turn it into a content brief. Your saved signals show up here, ready to develop.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 mt-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition"
              >
                <Radio className="w-4 h-4" />
                Browse signals
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {briefs.map((s) => {
                const momentum = clampScore(s.volumeShare + MOMENTUM_BOOST[s.lifecycle]);
                return (
                  <article
                    key={s.id}
                    id={`brief-${s.id}`}
                    className={`bg-slate-900/50 border rounded-2xl p-5 flex flex-col gap-4 shadow-lg transition-shadow duration-500 ${
                      highlightId === s.id
                        ? 'border-emerald-500/60 ring-2 ring-emerald-500/50'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold tracking-wide uppercase text-emerald-400 mb-1.5">
                          <span>{s.lifecycle}</span>
                          <span className="text-slate-600">•</span>
                          <span>{opportunityLabel(s.opportunityScore)}</span>
                          <span className="text-slate-600">•</span>
                          <span>Authority Window: {s.authorityWindowDays}</span>
                        </div>
                        <h3 className="text-lg font-extrabold tracking-tight truncate">{s.topic}</h3>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-2xl font-extrabold text-emerald-400 tabular-nums leading-none">
                          {s.opportunityScore}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">Opportunity</div>
                      </div>
                    </div>

                    {/* Compact metric row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg py-2">
                        <div className="text-sm font-bold text-slate-100 tabular-nums">{momentum}</div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Momentum</div>
                      </div>
                      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg py-2">
                        <div className="text-sm font-bold text-slate-100 tabular-nums">
                          {s.sentimentTone > 0 ? `+${s.sentimentTone.toFixed(1)}` : s.sentimentTone.toFixed(1)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Sentiment</div>
                      </div>
                      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg py-2">
                        <div className="text-sm font-bold text-sky-400 tabular-nums">{s.confidenceRating}%</div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Confidence</div>
                      </div>
                    </div>

                    {/* Strategic why */}
                    <dl className="space-y-2.5 text-sm">
                      <div>
                        <dt className="text-xs font-semibold text-emerald-400">Why it moves</dt>
                        <dd className="text-slate-300 leading-relaxed">{s.strategicWhy.moves}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-emerald-400">Why it matters</dt>
                        <dd className="text-slate-300 leading-relaxed">{s.strategicWhy.matters}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-emerald-400">Strategic whitespace</dt>
                        <dd className="text-slate-300 leading-relaxed">{s.strategicWhy.whitespace}</dd>
                      </div>
                    </dl>

                    {/* Strongest angles */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Strongest angles</h4>
                      <ul className="space-y-1.5 text-sm text-slate-300">
                        {s.strongestAngles.map((angle, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold tabular-nums">{idx + 1}.</span>
                            <span>{angle}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-auto pt-1 flex items-center gap-3">
                      <Link
                        href={`/?signal=${s.id}`}
                        className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition"
                      >
                        <PenLine className="w-4 h-4" />
                        Develop content
                      </Link>
                      <Link
                        href="/studio"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white transition"
                      >
                        Open in Studio
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Hint about how briefs are sourced */}
          {hydrated && briefs.length > 0 && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
              <Bookmark className="w-3.5 h-3.5" />
              Briefs mirror your saved signals. Remove a bookmark on the heatmap to drop it here.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
