'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MOCK_SIGNALS } from '@/lib/mockSignals';
import { SignalItem } from '@/types';
import { SignalHeatmap, HeatmapDimension } from '@/components/dashboard/SignalHeatmap';
import { SignalDetailModal } from '@/components/dashboard/SignalDetailModal';
import { BriefingWidget } from '@/components/dashboard/BriefingWidget';
import { SignalsToWatchWidget } from '@/components/dashboard/SignalsToWatchWidget';
import { AuthButton } from '@/components/auth/AuthButton';
import { Sidebar } from '@/components/layout/Sidebar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import Link from 'next/link';
import { Search, Radio, Bell, Zap, BarChart3, Loader2, AlertTriangle, Bookmark, ShieldAlert, Menu, X, Flame, Target, Smile, Activity } from 'lucide-react';
import { SAVED_KEY, loadSavedIds } from '@/lib/savedSignals';

// Top sub-navigation dimensions — each re-sorts + re-colors the heatmap.
const DIMENSION_TABS: { key: HeatmapDimension; label: string; icon: typeof Flame }[] = [
  { key: 'market-heat', label: 'Market heat', icon: Flame },
  { key: 'content-opportunity', label: 'Content opportunity', icon: Target },
  { key: 'sentiment', label: 'Sentiment', icon: Smile },
  { key: 'lifecycle', label: 'Lifecycle', icon: Activity },
];

export default function Home() {
  // Seed with curated topics for instant first paint; replaced by live GDELT data.
  const [signals, setSignals] = useState<SignalItem[]>(MOCK_SIGNALS);
  const [selectedSignal, setSelectedSignal] = useState<SignalItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  // Saved signals (bookmarks), persisted to this browser.
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  // Notifications (re-auth alerts from webhooks) + mobile nav.
  const [reauthAlerts, setReauthAlerts] = useState<{ postId: string; platform?: string; error?: string }[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Active heatmap dimension driving tile sort/color + the footer legend.
  const [dimension, setDimension] = useState<HeatmapDimension>('lifecycle');

  useEffect(() => {
    setSavedIds(loadSavedIds());
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Poll webhook-driven re-auth alerts for the notifications bell.
  useEffect(() => {
    let cancelled = false;
    const loadAlerts = async () => {
      try {
        const res = await fetch('/api/post-status', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setReauthAlerts(Array.isArray(data.needsReauth) ? data.needsReauth : []);
      } catch {
        /* non-fatal */
      }
    };
    loadAlerts();
    const t = setInterval(loadAlerts, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Load signals from the API: default set (no keyword) or live GDELT facets
  // for an explicit keyword. Called on mount and on Enter — NOT per keystroke.
  const loadSignals = useCallback(async (keyword?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/signals${keyword ? `?q=${encodeURIComponent(keyword)}` : ''}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (Array.isArray(data.signals) && data.signals.length) setSignals(data.signals);
      setDegraded(data.source !== 'gdelt' || Boolean(data.error));
      setActiveKeyword(keyword || null);
    } catch {
      setError('Could not reach the signal service. Showing the last results.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial default load.
  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  // Instant, offline client-side filter of the currently loaded tiles.
  const filteredSignals = signals.filter(
    (s) =>
      s.topic.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
      (!savedOnly || savedIds.includes(s.id))
  );

  // Enter → run a live GDELT query for the keyword (empty resets to defaults).
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadSignals(searchQuery.trim() || undefined);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20">
            C
          </div>
          <span className="font-extrabold text-lg tracking-tight text-slate-100">Clout</span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            Signal Intelligence v2
          </span>
        </div>

        {/* Universal Search */}
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Filter topics — press Enter to search GDELT live…"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition"
          />
        </div>

        {/* User Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme toggle (also available in the sidebar on desktop) */}
          <span className="lg:hidden">
            <ThemeToggle />
          </span>
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              aria-label={`Notifications${reauthAlerts.length ? ` (${reauthAlerts.length})` : ''}`}
              aria-expanded={notifOpen}
              className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60"
            >
              <Bell className="w-4 h-4" />
              {reauthAlerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {reauthAlerts.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 text-left">
                <div className="text-xs font-bold text-slate-200 mb-2">Notifications</div>
                {reauthAlerts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">You&apos;re all caught up.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {reauthAlerts.map((a) => (
                      <li key={a.postId} className="flex items-start gap-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          {a.platform && <span className="capitalize font-semibold">{a.platform} </span>}
                          needs re-authorization — {a.error}
                        </span>
                      </li>
                    ))}
                    <li className="pt-1">
                      <Link href="/content" className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium">
                        Manage in Content Studio →
                      </Link>
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>
          <AuthButton />
          {/* Mobile nav toggle */}
          <button
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavOpen}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60"
          >
            {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <nav className="lg:hidden border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-4 py-3 space-y-1">
          <span className="flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 font-semibold text-sm border border-emerald-500/20">
            <Radio className="w-4 h-4" /> Signals
          </span>
          <Link href="/content" className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800/50 text-sm font-medium">
            <Zap className="w-4 h-4" /> Content Studio
          </Link>
          <Link href="/analytics" className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800/50 text-sm font-medium">
            <BarChart3 className="w-4 h-4" /> Analytics
          </Link>
          {/* Mobile search */}
          <div className="relative pt-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 translate-y-0.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Filter topics — Enter for live GDELT…"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </nav>
      )}

      {/* Main Body Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Nav */}
        <Sidebar />

        {/* Dashboard Main Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Context strip (read-only) + real Saved filter */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="uppercase tracking-wider text-slate-500 font-semibold">Context</span>
              <span className="bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-lg">Source: GDELT DOC 2.0</span>
              <span className="bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-lg">Region: Global</span>
              <span className="bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-lg">Publishing: Zernio</span>
            </div>

            <button
              onClick={() => setSavedOnly((v) => !v)}
              aria-pressed={savedOnly}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                savedOnly
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${savedOnly ? 'fill-current' : ''}`} />
              {savedOnly ? 'Saved only' : `Saved (${savedIds.length})`}
            </button>
          </div>

          {/* Title Header */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Content Opportunity Heatmap</h1>
              <p className="text-xs text-slate-400 mt-1">
                {activeKeyword
                  ? `Live GDELT signals for “${activeKeyword}” and related facets.`
                  : 'Real-time GDELT news volume, sentiment analysis, and multi-channel virality scores.'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {loading ? (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying GDELT…
                </span>
              ) : degraded ? (
                <span className="flex items-center gap-1.5 text-amber-300" title="GDELT unreachable — showing curated topics">
                  <AlertTriangle className="w-3.5 h-3.5" /> Degraded — curated data
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live GDELT
                </span>
              )}
            </div>
          </div>

          {/* Sub-navigation — switch the heatmap's active dimension */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800/60 -mt-2">
            {DIMENSION_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = dimension === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setDimension(tab.key)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition ${
                    active
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Content + desktop right rail (briefing / signals to watch) */}
          <div className="flex flex-col xl:flex-row gap-6 items-start">
            {/* Interactive Heatmap — instant client-filtered tiles */}
            <div className="flex-1 min-w-0 w-full">
              {filteredSignals.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm">
                  {savedOnly ? (
                    <>No saved signals yet. Tap the bookmark on a tile to save it.</>
                  ) : (
                    <>
                      No topics match “{searchQuery.trim()}”.
                      <button
                        onClick={() => loadSignals(searchQuery.trim() || undefined)}
                        className="ml-1 text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Search GDELT live →
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <SignalHeatmap
                  signals={filteredSignals}
                  onSelectSignal={(s) => setSelectedSignal(s)}
                  savedIds={savedIds}
                  onToggleSave={toggleSaved}
                  dimension={dimension}
                />
              )}
            </div>

            {/* Right rail — desktop only */}
            <aside className="hidden xl:flex xl:flex-col gap-5 w-80 shrink-0">
              <BriefingWidget
                signals={signals}
                onSelectSignal={(s) => setSelectedSignal(s)}
                onViewBriefing={() => {
                  const top = [...signals].sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
                  if (top) setSelectedSignal(top);
                }}
              />
              <SignalsToWatchWidget
                signals={signals}
                onSelectSignal={(s) => setSelectedSignal(s)}
                onViewAll={() => {
                  setSavedOnly(false);
                  setSearchQuery('');
                }}
              />
            </aside>
          </div>

        </div>
      </div>

      {/* Signal Detail Modal Drawer */}
      <SignalDetailModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
        isSaved={selectedSignal ? savedIds.includes(selectedSignal.id) : false}
        onToggleSave={toggleSaved}
      />

    </main>
  );
}
