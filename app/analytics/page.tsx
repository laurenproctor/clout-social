'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnalyticsSummary, SocialPlatform } from '@/types';
import { Sidebar } from '@/components/layout/Sidebar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import {
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  Music2,
  FileText,
  Radio,
  Zap,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Eye,
  MousePointerClick,
  Share2,
  Target,
  Loader2,
} from 'lucide-react';

const PLATFORM_ICON: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  tiktok: Music2,
  instagram: Instagram,
  youtube: Youtube,
  blog: FileText,
  twitter: Twitter,
};
const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  blog: 'Blog',
  twitter: 'Twitter / X',
};

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`
      : String(n);

// Signal Accuracy → status color (always paired with the number, never color-alone).
function accuracyStyle(v: number): { cls: string; label: string } {
  if (v >= 80) return { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', label: 'Strong' };
  if (v >= 60) return { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', label: 'Fair' };
  return { cls: 'bg-red-500/15 text-red-300 border-red-500/40', label: 'Weak' };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics.');
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const acc = data ? accuracyStyle(data.overallSignalAccuracy) : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20">
            C
          </div>
          <span className="font-extrabold text-lg tracking-tight text-slate-100">Clout</span>
          <span className="hidden sm:inline-block text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">Analytics</span>
        </div>
        <nav className="lg:hidden flex items-center gap-2 text-sm">
          <Link href="/" aria-label="Signals" className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium transition">
            <Radio className="w-4 h-4" /> <span className="hidden sm:inline">Signals</span>
          </Link>
          <Link href="/studio" aria-label="Content Studio" className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium transition">
            <Zap className="w-4 h-4" /> <span className="hidden sm:inline">Content Studio</span>
          </Link>
          <span className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
            <BarChart3 className="w-4 h-4" /> <span className="hidden sm:inline">Analytics</span>
          </span>
          <ThemeToggle />
        </nav>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Signal Performance Analytics</h1>
            <p className="text-xs text-slate-400 mt-1">
              Post engagement from Zernio, scored against each topic&apos;s initial GDELT Opportunity Score.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && !data && (
          <div className="py-20 text-center text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2 align-middle" />
            Loading analytics…
          </div>
        )}

        {data && (
          <>
            {data.source === 'sample' && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Modeled sample analytics — no live Zernio post analytics available yet
                  ({data.livePostsFound} published post{data.livePostsFound === 1 ? '' : 's'} found).
                  Engagement figures are illustrative; Signal Accuracy is computed the same way against live data.
                </span>
              </div>
            )}

            {/* KPI stat tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Target className="w-3.5 h-3.5 text-emerald-400" /> Signal Accuracy
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-100">{data.overallSignalAccuracy}</span>
                  <span className="text-slate-500 text-sm">/100</span>
                </div>
                {acc && (
                  <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${acc.cls}`}>
                    {acc.label}
                  </span>
                )}
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Eye className="w-3.5 h-3.5 text-blue-400" /> Impressions
                </div>
                <div className="mt-2 text-3xl font-extrabold text-slate-100">{fmt(data.totals.impressions)}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MousePointerClick className="w-3.5 h-3.5 text-emerald-400" /> Clicks
                </div>
                <div className="mt-2 text-3xl font-extrabold text-slate-100">{fmt(data.totals.clicks)}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Share2 className="w-3.5 h-3.5 text-amber-400" /> Shares
                </div>
                <div className="mt-2 text-3xl font-extrabold text-slate-100">{fmt(data.totals.shares)}</div>
              </div>
            </div>

            {/* Highest engagement per platform */}
            <div>
              <h2 className="text-sm font-bold text-slate-200 mb-3">Highest Engagement per Platform</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.leaderboards.map((lb) => {
                  const Icon = PLATFORM_ICON[lb.platform];
                  const top = lb.rows.slice(0, 5);
                  const max = Math.max(...top.map((r) => r.engagementRate), 0.01);
                  return (
                    <div key={lb.platform} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="text-sm font-semibold text-slate-200">{PLATFORM_LABEL[lb.platform]}</span>
                      </div>
                      <ul className="space-y-2.5">
                        {top.map((r) => (
                          <li key={r.topic}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-300 truncate pr-2">{r.topic}</span>
                              <span className="text-emerald-300 font-semibold tabular-nums shrink-0">
                                {r.engagementRate.toFixed(1)}%
                              </span>
                            </div>
                            {/* magnitude bar — single hue, 4px rounded end, recessive track */}
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${Math.max(4, (r.engagementRate / max) * 100)}%` }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signal Accuracy by topic/platform */}
            <div>
              <h2 className="text-sm font-bold text-slate-200 mb-3">Signal Accuracy by Topic</h2>
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900/70 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="text-left font-semibold px-4 py-3">Topic</th>
                        <th className="text-left font-semibold px-4 py-3">Platform</th>
                        <th className="text-right font-semibold px-4 py-3">Opp. Score</th>
                        <th className="text-right font-semibold px-4 py-3">Impressions</th>
                        <th className="text-right font-semibold px-4 py-3">Eng. Rate</th>
                        <th className="text-right font-semibold px-4 py-3">Signal Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.topics.map((r, i) => {
                        const Icon = PLATFORM_ICON[r.platform];
                        const a = accuracyStyle(r.signalAccuracy);
                        return (
                          <tr key={`${r.topic}-${r.platform}-${i}`} className="hover:bg-slate-800/30 transition">
                            <td className="px-4 py-2.5 text-slate-200">{r.topic}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1.5 text-slate-300 text-xs">
                                <Icon className="w-3.5 h-3.5 text-slate-400" />
                                {PLATFORM_LABEL[r.platform]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{r.opportunityScore}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{fmt(r.impressions)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-emerald-300 font-medium">
                              {r.engagementRate.toFixed(1)}%
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border tabular-nums ${a.cls}`}>
                                {r.signalAccuracy}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </main>
  );
}
