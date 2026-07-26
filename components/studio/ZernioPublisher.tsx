'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ZernioAccount, SocialPlatform } from '@/types';
import { useAccounts } from '@/components/accounts/AccountsProvider';
import { getPeakTimes, getOptimalTime, getOptimalLabel, formatDateReadable } from '@/lib/schedule';
import {
  Linkedin,
  Twitter,
  Music2,
  Instagram,
  Check,
  Zap,
  RefreshCw,
  AlertTriangle,
  CalendarClock,
  Users,
} from 'lucide-react';

/** One resolved auto-schedule slot for a selected account. */
export interface AutoScheduleSlot {
  accountId: string;
  platform: SocialPlatform;
  handle: string;
  scheduledAt: string; // UTC ISO-8601
  localLabel: string; // friendly local time
}

interface Props {
  /** Fires whenever the set of checked account ids changes. */
  onSelectionChange?: (accountIds: string[]) => void;
  /** Fires when "Auto-Schedule at Peak Times" computes a plan. */
  onAutoSchedule?: (plan: AutoScheduleSlot[]) => void;
}

// The four publishable networks this component manages.
const PLATFORMS: { key: SocialPlatform; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'twitter', label: 'Twitter / X', Icon: Twitter },
  { key: 'tiktok', label: 'TikTok', Icon: Music2 },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
];

export const ZernioPublisher: React.FC<Props> = ({ onSelectionChange, onAutoSchedule }) => {
  // Shared selection so the dashboard modal publishes to the same accounts.
  const { accounts, loading, error, selectedIds, toggle: toggleAccount, setSelected, refresh } = useAccounts();
  const [autoPlan, setAutoPlan] = useState<AutoScheduleSlot[] | null>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const load = refresh;

  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);

  // Group connected accounts under the four managed platforms.
  const grouped = useMemo(() => {
    const map: Record<SocialPlatform, ZernioAccount[]> = {
      linkedin: [], twitter: [], tiktok: [], instagram: [], youtube: [], blog: [],
    };
    for (const a of accounts) {
      if (map[a.platform]) map[a.platform].push(a);
    }
    return map;
  }, [accounts]);

  const toggle = (id: string) => {
    setAutoPlan(null);
    toggleAccount(id);
  };

  const togglePlatform = (platform: SocialPlatform, on: boolean) => {
    const next = new Set(selectedIds);
    for (const a of grouped[platform]) {
      on ? next.add(a.id) : next.delete(a.id);
    }
    setAutoPlan(null);
    setSelected([...next]);
  };

  const handleAutoSchedule = () => {
    const chosen = accounts.filter((a) => selected.has(a.id));
    if (chosen.length === 0) return;

    const byPlatform = new Map<SocialPlatform, ZernioAccount[]>();
    for (const a of chosen) {
      const arr = byPlatform.get(a.platform) ?? [];
      arr.push(a);
      byPlatform.set(a.platform, arr);
    }

    const plan: AutoScheduleSlot[] = [];
    byPlatform.forEach((accts, platform) => {
      const peaks = getPeakTimes(platform, accts.length, 7);
      accts.forEach((a, i) => {
        const when = peaks[i] ?? peaks[peaks.length - 1] ?? getOptimalTime(platform);
        plan.push({
          accountId: a.id,
          platform,
          handle: a.handle,
          scheduledAt: when.toISOString(),
          localLabel: formatDateReadable(when),
        });
      });
    });

    plan.sort((x, y) => (x.scheduledAt < y.scheduledAt ? -1 : 1));
    setAutoPlan(plan);
    onAutoSchedule?.(plan);
  };

  const selectedCount = selected.size;

  return (
    <div className="border border-slate-800 rounded-2xl bg-slate-900/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-100">
            <Users className="w-4 h-4 text-emerald-400" />
            Multi-Account Publisher
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedCount} of {accounts.length} account{accounts.length === 1 ? '' : 's'} selected · Powered by Zernio
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

      <div className="p-5 space-y-4">
        {error && (
          <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Couldn&apos;t load connected accounts ({error}).</span>
          </div>
        )}

        {loading && accounts.length === 0 && (
          <p className="text-sm text-slate-500 py-6 text-center">Loading connected accounts…</p>
        )}

        {!loading && accounts.length === 0 && (
          <div className="py-8 text-center">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-semibold">No connected accounts</p>
            <p className="text-slate-500 text-xs mt-1">
              Connect LinkedIn, Twitter/X, TikTok, or Instagram in your Zernio workspace to publish here.
            </p>
          </div>
        )}

        {/* Platform groups */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLATFORMS.map(({ key, label, Icon }) => {
              const accts = grouped[key];
              const allOn = accts.length > 0 && accts.every((a) => selected.has(a.id));
              return (
                <div key={key} className="border border-slate-800 rounded-xl bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Icon className="w-4 h-4 text-slate-400" />
                      {label}
                      <span className="text-[11px] text-slate-500 font-normal">({accts.length})</span>
                    </span>
                    {accts.length > 0 && (
                      <button
                        onClick={() => togglePlatform(key, !allOn)}
                        className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                      >
                        {allOn ? 'Clear' : 'Select all'}
                      </button>
                    )}
                  </div>

                  {accts.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">No {label} accounts connected</p>
                  ) : (
                    <ul className="space-y-1">
                      {accts.map((a) => {
                        const checked = selected.has(a.id);
                        return (
                          <li key={a.id}>
                            <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                                  checked
                                    ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                    : 'border-slate-600 bg-slate-900'
                                }`}
                              >
                                {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(a.id)}
                                className="sr-only"
                              />
                              <span className="text-sm text-slate-200 truncate">{a.handle}</span>
                              {a.displayName && a.displayName !== a.handle && (
                                <span className="text-[11px] text-slate-500 truncate">{a.displayName}</span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-schedule */}
        {accounts.length > 0 && (
          <div className="pt-1">
            <button
              onClick={handleAutoSchedule}
              disabled={selectedCount === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-500/10"
            >
              <Zap className="w-4 h-4" />
              Auto-Schedule at Peak Times
            </button>
            <p className="text-[11px] text-slate-500 mt-2">
              Calculates each platform&apos;s best posting time over the next 7 days
              {PLATFORMS.filter((p) => grouped[p.key].some((a) => selected.has(a.id)))
                .map((p) => ` · ${p.label} ${getOptimalLabel(p.key)}`)
                .join('')}
            </p>
          </div>
        )}

        {/* Computed plan */}
        {autoPlan && autoPlan.length > 0 && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
              <CalendarClock className="w-4 h-4 text-emerald-400" />
              Peak-time schedule ({autoPlan.length} post{autoPlan.length === 1 ? '' : 's'})
            </div>
            <ul className="space-y-1">
              {autoPlan.map((slot) => {
                const meta = PLATFORMS.find((p) => p.key === slot.platform);
                const Icon = meta?.Icon ?? Users;
                return (
                  <li
                    key={slot.accountId}
                    className="flex items-center justify-between gap-3 text-xs text-slate-200 bg-slate-950/40 rounded-lg px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{slot.handle}</span>
                    </span>
                    <span className="text-emerald-300 font-medium whitespace-nowrap">{slot.localLabel}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-slate-500">
              Times shown in your local zone; sent to Zernio as UTC. Attach content and publish to queue these.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZernioPublisher;
