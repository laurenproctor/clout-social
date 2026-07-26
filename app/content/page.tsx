'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ScheduledPost, ScheduledPostStatus, SocialPlatform } from '@/types';
import { ZernioPublisher } from '@/components/studio/ZernioPublisher';
import { BrandSettings } from '@/components/brand/BrandSettings';
import { Sidebar } from '@/components/layout/Sidebar';
import type { PostStatusUpdate } from '@/lib/postStatusStore';
import {
  toDatetimeLocalValue,
  localInputToUtcISO,
  isFutureLocal,
  formatDateReadable,
} from '@/lib/schedule';
import {
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  Music2,
  FileText,
  CalendarClock,
  RefreshCw,
  X,
  Check,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

const PLATFORM_ICON: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  tiktok: Music2,
  instagram: Instagram,
  youtube: Youtube,
  blog: FileText,
  twitter: Twitter,
};

const STATUS_STYLE: Record<ScheduledPostStatus, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  scheduled: { label: 'Scheduled', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', Icon: CalendarClock },
  processing: { label: 'Processing', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', Icon: Loader2 },
  published: { label: 'Published', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40', Icon: CheckCircle2 },
  failed: { label: 'Failed', cls: 'bg-red-500/15 text-red-300 border-red-500/40', Icon: AlertTriangle },
  canceled: { label: 'Canceled', cls: 'bg-slate-700/40 text-slate-400 border-slate-600/40', Icon: X },
};

export default function StudioPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reschedule inline editor
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleLocal, setRescheduleLocal] = useState('');
  // Cancel confirmation
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Webhook-driven status updates (from /api/post-status), keyed by post id.
  const [statusMap, setStatusMap] = useState<Record<string, PostStatusUpdate>>({});
  const [reauth, setReauth] = useState<PostStatusUpdate[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/queue', { cache: 'no-store' });
      const data = await res.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      if (data.error) setLoadError(data.error);
    } catch {
      setLoadError('Could not reach the queue service.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/post-status', { cache: 'no-store' });
      const data = await res.json();
      const list: PostStatusUpdate[] = Array.isArray(data.statuses) ? data.statuses : [];
      const map: Record<string, PostStatusUpdate> = {};
      for (const s of list) map[s.postId] = s;
      setStatusMap(map);
      setReauth(Array.isArray(data.needsReauth) ? data.needsReauth : []);
    } catch {
      /* non-fatal — leave existing overlay in place */
    }
  }, []);

  useEffect(() => {
    load();
    loadStatuses();
    // Poll for async webhook updates so the queue + banner stay fresh.
    const t = setInterval(loadStatuses, 15000);
    return () => clearInterval(t);
  }, [load, loadStatuses]);

  const startReschedule = (post: ScheduledPost) => {
    setActionError(null);
    setConfirmingId(null);
    setReschedulingId(post.id);
    const base = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
    setRescheduleLocal(toDatetimeLocalValue(Number.isNaN(base.getTime()) ? new Date() : base));
  };

  const submitReschedule = async (id: string) => {
    setActionError(null);
    if (!rescheduleLocal || !isFutureLocal(rescheduleLocal)) {
      setActionError('Pick a future date and time to reschedule.');
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, scheduledAt: localInputToUtcISO(rescheduleLocal) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Reschedule failed.');
      setReschedulingId(null);
      await load();
    } catch (err: any) {
      setActionError(err?.message || 'Reschedule failed.');
    } finally {
      setBusyId(null);
    }
  };

  const submitCancel = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/queue?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Cancel failed.');
      setConfirmingId(null);
      await load();
    } catch (err: any) {
      setActionError(err?.message || 'Cancel failed.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = posts.filter((p) => p.status === 'scheduled').length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Title + actions */}
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Scheduled Posts Queue</h1>
            <p className="text-xs text-slate-400 mt-1">
              {pendingCount} scheduled · {posts.length} total in the Zernio pipeline. Times shown in your local zone.
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

        {/* Needs Re-authorization — a channel token expired / was revoked */}
        {reauth.length > 0 && (
          <div className="p-4 bg-red-500/15 border border-red-500/50 rounded-xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-200">Needs Re-authorization</h3>
                <p className="text-xs text-red-300/90 mt-0.5">
                  {reauth.length} post{reauth.length === 1 ? '' : 's'} failed because a channel
                  connection expired or was revoked. Reconnect the account in Zernio, then reschedule.
                </p>
                <ul className="mt-2 space-y-1">
                  {reauth.map((r) => {
                    const Icon = r.platform && PLATFORM_ICON[r.platform as SocialPlatform];
                    return (
                      <li
                        key={r.postId}
                        className="flex items-center gap-2 text-[11px] text-red-200/90 bg-red-500/10 rounded-lg px-2.5 py-1.5"
                      >
                        {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : null}
                        {r.platform && <span className="capitalize font-semibold">{r.platform}</span>}
                        <span className="font-mono text-red-300/70">#{r.postId}</span>
                        <span className="truncate">— {r.error}</span>
                      </li>
                    );
                  })}
                </ul>
                <a
                  href="https://zernio.com/settings/accounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Reconnect channels in Zernio
                </a>
              </div>
            </div>
          </div>
        )}

        {loadError && (
          <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Couldn&apos;t load the live Zernio queue ({loadError}). Showing whatever is available.</span>
          </div>
        )}
        {actionError && (
          <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Brand guidelines — injected into every AI generation */}
        <BrandSettings />

        {/* Multi-account publisher + peak-time auto-scheduler */}
        <ZernioPublisher />

        {/* Queue table */}
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/70 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-4 py-3">Channels</th>
                  <th className="text-left font-semibold px-4 py-3">Accounts</th>
                  <th className="text-left font-semibold px-4 py-3 min-w-[240px]">Post</th>
                  <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Scheduled (local)</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && posts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2 align-middle" />
                      Loading the queue…
                    </td>
                  </tr>
                )}

                {!loading && posts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <CalendarClock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-300 font-semibold">No scheduled posts yet</p>
                      <p className="text-slate-500 text-xs mt-1">
                        Schedule content from a signal on the{' '}
                        <Link href="/" className="text-emerald-400 hover:underline">Signals dashboard</Link>{' '}
                        and it will appear here.
                      </p>
                    </td>
                  </tr>
                )}

                {posts.map((post) => {
                  // Overlay any webhook-driven status update onto the live row.
                  const override = statusMap[post.id];
                  const effectiveStatus = override?.status ?? post.status;
                  const rowError = override?.error;
                  const status = STATUS_STYLE[effectiveStatus];
                  const when = post.scheduledAt ? new Date(post.scheduledAt) : null;
                  const canManage = effectiveStatus === 'scheduled';
                  const isEditing = reschedulingId === post.id;
                  const isConfirming = confirmingId === post.id;
                  const isBusy = busyId === post.id;

                  return (
                    <React.Fragment key={post.id}>
                      <tr className="hover:bg-slate-800/30 transition">
                        {/* Channels */}
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-1.5">
                            {post.platforms.length === 0 && (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                            {post.platforms.map((p) => {
                              const Icon = PLATFORM_ICON[p];
                              return (
                                <span
                                  key={p}
                                  title={p}
                                  className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        {/* Accounts */}
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {post.accountIds.map((a) => (
                              <span key={a} className="text-[11px] font-mono bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded">
                                {a}
                              </span>
                            ))}
                          </div>
                        </td>
                        {/* Snippet */}
                        <td className="px-4 py-3 align-top">
                          <p className="text-slate-300 line-clamp-2 max-w-md">
                            {post.content || <span className="text-slate-600 italic">No content</span>}
                          </p>
                          {rowError && (
                            <p className="text-[11px] text-red-300/90 mt-1 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{rowError}</span>
                            </p>
                          )}
                        </td>
                        {/* Scheduled local */}
                        <td className="px-4 py-3 align-top whitespace-nowrap text-slate-300">
                          {when && !Number.isNaN(when.getTime()) ? (
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {formatDateReadable(when)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border ${status.cls}`}>
                            <status.Icon className={`w-3 h-3 ${effectiveStatus === 'processing' ? 'animate-spin' : ''}`} />
                            {status.label}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3 align-top text-right">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => startReschedule(post)}
                                disabled={isBusy}
                                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 disabled:opacity-60"
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                                Reschedule
                              </button>
                              <button
                                onClick={() => { setConfirmingId(post.id); setReschedulingId(null); setActionError(null); }}
                                disabled={isBusy}
                                className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-60"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Inline reschedule editor */}
                      {isEditing && (
                        <tr className="bg-slate-950/60">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-xs text-slate-400 font-medium">New time (local):</span>
                              <input
                                type="datetime-local"
                                value={rescheduleLocal}
                                onChange={(e) => setRescheduleLocal(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                              />
                              {rescheduleLocal && localInputToUtcISO(rescheduleLocal) && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  → {localInputToUtcISO(rescheduleLocal)} (UTC)
                                </span>
                              )}
                              <button
                                onClick={() => submitReschedule(post.id)}
                                disabled={isBusy}
                                className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg disabled:opacity-60"
                              >
                                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Save
                              </button>
                              <button
                                onClick={() => setReschedulingId(null)}
                                className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-2 py-1.5"
                              >
                                Dismiss
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Inline cancel confirmation */}
                      {isConfirming && (
                        <tr className="bg-red-950/20">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-xs text-red-300 font-medium flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Cancel this scheduled post in Zernio? This can&apos;t be undone.
                              </span>
                              <button
                                onClick={() => submitCancel(post.id)}
                                disabled={isBusy}
                                className="flex items-center gap-1.5 text-xs font-bold bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
                              >
                                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Confirm Cancel
                              </button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-2 py-1.5"
                              >
                                Keep Scheduled
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
    </main>
  );
}
