'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SignalItem, SocialPlatform, LifecycleStage } from '@/types';
import {
  X,
  Bookmark,
  PenLine,
  Sparkles,
  Send,
  CalendarClock,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  Paperclip,
  Film,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  RefreshCw,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
  Music2,
  FileText,
} from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { useBrand } from '@/components/brand/BrandProvider';
import { useAccounts } from '@/components/accounts/AccountsProvider';
import { PostPreview, PreviewAuthor } from '@/components/dashboard/PostPreview';
import {
  getPlusHours,
  getTomorrowMorning,
  getOptimalTime,
  getOptimalLabel,
  toDatetimeLocalValue,
  localInputToUtcISO,
  isFutureLocal,
  formatLocalReadable,
} from '@/lib/schedule';

// Per-platform content character limits (Blog is effectively unlimited).
const CHAR_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
  blog: 100000,
};

// The six networks a post can be composed for, in display order.
const NETWORKS: { id: SocialPlatform; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { id: 'twitter', label: 'X', Icon: Twitter },
  { id: 'instagram', label: 'Instagram', Icon: Instagram },
  { id: 'tiktok', label: 'TikTok', Icon: Music2 },
  { id: 'youtube', label: 'YouTube', Icon: Youtube },
  { id: 'blog', label: 'Blog', Icon: FileText },
];
const NETWORK_LABEL: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  twitter: 'X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  blog: 'Blog',
};

interface Props {
  signal: SignalItem | null;
  onClose: () => void;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}

interface MediaItem {
  url: string;
  type: string;
  name: string;
  preview: string;
}

interface NetworkPost {
  content: string;
  hashtags: string;
  generating: boolean;
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const MOMENTUM_BOOST: Record<LifecycleStage, number> = {
  emerging: 9,
  rising: 6,
  peaking: 0,
  declining: -12,
};

function opportunityLabel(score: number): string {
  if (score >= 75) return 'High Opportunity';
  if (score >= 50) return 'Moderate Opportunity';
  return 'Early Opportunity';
}

function sentimentBadge(tone: number) {
  if (tone >= 3) return { label: 'Positive', value: 'text-emerald-400', chip: 'bg-emerald-500/15 text-emerald-300', Icon: ArrowUpRight };
  if (tone >= 0.5) return { label: 'Warming', value: 'text-emerald-400', chip: 'bg-emerald-500/15 text-emerald-300', Icon: ArrowUpRight };
  if (tone > -0.5) return { label: 'Neutral', value: 'text-slate-300', chip: 'bg-slate-700/60 text-slate-300', Icon: Minus };
  if (tone > -3) return { label: 'Cautious', value: 'text-amber-400', chip: 'bg-amber-500/15 text-amber-300', Icon: ArrowDownRight };
  return { label: 'Concerned', value: 'text-orange-400', chip: 'bg-orange-500/15 text-orange-300', Icon: ArrowDownRight };
}

const MetricCell: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 flex flex-col">
    <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold leading-tight min-h-[28px]">
      {label}
    </span>
    <div className="mt-auto pt-2 flex items-baseline gap-1">{children}</div>
  </div>
);

type PublishMode = 'now' | 'schedule';

export const SignalDetailModal: React.FC<Props> = ({ signal, onClose, isSaved = false, onToggleSave }) => {
  // Composer
  const [showCreation, setShowCreation] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);
  const [selectedNetworks, setSelectedNetworks] = useState<SocialPlatform[]>(['linkedin']);
  const [posts, setPosts] = useState<Partial<Record<SocialPlatform, NetworkPost>>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const developRef = useRef<HTMLDivElement>(null);

  // Publishing
  const [publishMode, setPublishMode] = useState<PublishMode>('now');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishReceipts, setPublishReceipts] = useState<string[] | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Media attachments (uploaded to storage; their CDN URLs go into Zernio mediaUrls).
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { brand } = useBrand();
  const { accounts, selectedAccounts } = useAccounts();

  // Close on Escape.
  useEffect(() => {
    if (!signal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signal, onClose]);

  // Bring the composer into view when it opens.
  useEffect(() => {
    if (showCreation) developRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showCreation]);

  // Reset composer state whenever a different signal is opened.
  useEffect(() => {
    setShowCreation(false);
    setSelectedAngle(null);
    setSelectedNetworks(['linkedin']);
    setPosts({});
    setPublishReceipts(null);
    setPublishError(null);
  }, [signal?.id]);

  if (!signal) return null;

  const marketMomentum = clampScore(signal.volumeShare + MOMENTUM_BOOST[signal.lifecycle]);
  const sentiment = sentimentBadge(signal.sentimentTone);
  const SentimentIcon = sentiment.Icon;
  const mediaUrls = media.map((m) => m.url);

  const connectedFor = (net: SocialPlatform) => accounts.filter((a) => a.platform === net && a.connected);

  const authorFor = (net: SocialPlatform): PreviewAuthor => {
    const acct = connectedFor(net)[0] ?? selectedAccounts.find((a) => a.platform === net) ?? selectedAccounts[0];
    const handle = acct?.handle ? (acct.handle.startsWith('@') ? acct.handle : `@${acct.handle}`) : '@yourbrand';
    return {
      name: acct?.displayName || acct?.handle?.replace(/^@/, '') || 'Your Brand',
      handle,
      avatarUrl: acct?.avatarUrl,
    };
  };

  /* ------------------------------ generation ------------------------------ */

  const generateFor = async (nets: SocialPlatform[], angle: string | null, force = false) => {
    const todo = nets.filter((n) => force || !posts[n]?.content);
    if (!todo.length) return;

    setPosts((prev) => {
      const next = { ...prev };
      todo.forEach((n) => {
        next[n] = { content: prev[n]?.content ?? '', hashtags: prev[n]?.hashtags ?? '', generating: true };
      });
      return next;
    });
    setIsGenerating(true);

    await Promise.all(
      todo.map(async (net) => {
        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // The angle steers the copy; fall back to the raw topic.
              topic: angle || signal.topic,
              platform: net,
              sentimentTone: signal.sentimentTone,
              authorityWindowDays: signal.authorityWindowDays,
              brand,
            }),
          });
          const data = await res.json();
          const draft: string = data?.content?.draft || `${angle || signal.topic}\n\n${signal.strategicWhy.matters}`;
          const hashtags: string = data?.content?.hashtags || '';
          setPosts((prev) => ({ ...prev, [net]: { content: draft, hashtags, generating: false } }));
        } catch {
          setPosts((prev) => ({
            ...prev,
            [net]: { content: angle || signal.topic, hashtags: '', generating: false },
          }));
        }
      })
    );
    setIsGenerating(false);
  };

  // Click a strongest angle → open the composer and auto-generate for the current networks.
  const composeFromAngle = (angle: string) => {
    setSelectedAngle(angle);
    setShowCreation(true);
    setPublishReceipts(null);
    const nets = selectedNetworks.length ? selectedNetworks : (['linkedin'] as SocialPlatform[]);
    if (!selectedNetworks.length) setSelectedNetworks(nets);
    void generateFor(nets, angle, true);
  };

  const toggleNetwork = (net: SocialPlatform) => {
    setSelectedNetworks((prev) => {
      const on = prev.includes(net);
      const next = on ? prev.filter((n) => n !== net) : [...prev, net];
      // Adding a network with an angle already chosen → generate its post now.
      if (!on && selectedAngle && !posts[net]?.content) void generateFor([net], selectedAngle, false);
      return next;
    });
  };

  const updatePost = (net: SocialPlatform, content: string) =>
    setPosts((prev) => ({
      ...prev,
      [net]: { content, hashtags: prev[net]?.hashtags ?? '', generating: false },
    }));

  /* -------------------------------- media --------------------------------- */

  const uploadOne = async (file: File): Promise<string> => {
    try {
      const blob = await upload(`clout/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        multipart: file.size > 8 * 1024 * 1024,
      });
      return blob.url;
    } catch {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed.');
      return data.url as string;
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => /^(image|video)\//.test(f.type));
    if (arr.length === 0) {
      setUploadError('Only image or video files are supported.');
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      for (const file of arr) {
        const preview = URL.createObjectURL(file);
        try {
          const url = await uploadOne(file);
          setMedia((prev) => [...prev, { url, type: file.type, name: file.name, preview }]);
        } catch (err) {
          URL.revokeObjectURL(preview);
          throw err;
        }
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
  };

  /* ------------------------------- publishing ----------------------------- */

  const primaryNet = selectedNetworks[0] ?? 'linkedin';

  const applyPreset = (date: Date) => {
    setScheduledLocal(toDatetimeLocalValue(date));
    setPublishError(null);
  };

  const fullContent = (net: SocialPlatform) => {
    const p = posts[net];
    if (!p) return '';
    return p.hashtags.trim() ? `${p.content}\n\n${p.hashtags}` : p.content;
  };

  const readyNetworks = selectedNetworks.filter((n) => posts[n]?.content?.trim());

  const handlePublishAll = async () => {
    setPublishError(null);
    setPublishReceipts(null);

    if (readyNetworks.length === 0) {
      setPublishError('Generate at least one post before publishing.');
      return;
    }

    // Resolve the schedule once for all networks.
    let scheduledAt: string | null = null;
    let scheduledLabel: string | undefined;
    if (publishMode === 'schedule') {
      if (!scheduledLocal || !isFutureLocal(scheduledLocal)) {
        setPublishError('Pick a schedule time in the future before queuing.');
        return;
      }
      scheduledAt = localInputToUtcISO(scheduledLocal);
      scheduledLabel = formatLocalReadable(scheduledLocal);
    }

    setIsPublishing(true);
    const receipts: string[] = [];
    const errors: string[] = [];

    for (const net of readyNetworks) {
      const label = NETWORK_LABEL[net];
      const ids = connectedFor(net).map((a) => a.id);
      if (ids.length === 0) {
        errors.push(`${label}: no connected account`);
        continue;
      }
      const content = fullContent(net);
      if (content.length > CHAR_LIMITS[net]) {
        errors.push(`${label}: over the ${CHAR_LIMITS[net]}-char limit`);
        continue;
      }
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountIds: ids,
            content,
            mediaUrls,
            scheduledAt,
            topic: signal.topic,
            opportunityScore: signal.opportunityScore,
            platform: net,
          }),
        });
        if (res.ok) {
          receipts.push(`${label}: ${scheduledAt ? `scheduled ${scheduledLabel}` : 'published'}`);
        } else {
          const data = await res.json().catch(() => ({}));
          errors.push(`${label}: ${data.error || 'rejected by Zernio'}`);
        }
      } catch {
        errors.push(`${label}: network error`);
      }
    }

    setIsPublishing(false);
    if (receipts.length) setPublishReceipts(receipts);
    setPublishError(errors.length ? errors.join(' · ') : null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Signal detail: ${signal.topic}`}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950/50">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold tracking-wide uppercase text-emerald-400 mb-1.5">
              <span>{signal.lifecycle}</span>
              <span className="text-slate-600">•</span>
              <span>{opportunityLabel(signal.opportunityScore)}</span>
              <span className="text-slate-600">•</span>
              <span>Authority Window: {signal.authorityWindowDays}</span>
            </div>
            <h2 className="text-2xl font-extrabold">{signal.topic}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleSave?.(signal.id)}
              aria-label={isSaved ? 'Remove from saved' : 'Save signal'}
              aria-pressed={isSaved}
              className={`p-2 rounded-lg bg-slate-800/60 hover:text-white transition ${
                isSaved ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Strategic overview */}
          <div className="p-6 space-y-6">
            {/* 6-item signal metric grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <MetricCell label="Opportunity score">
                <span className="text-xl font-bold text-emerald-400 tabular-nums">{signal.opportunityScore}</span>
                <span className="text-xs text-slate-500">/100</span>
              </MetricCell>
              <MetricCell label="Market momentum">
                <span className="text-xl font-bold text-emerald-400 tabular-nums">{marketMomentum}</span>
                <span className="text-xs text-slate-500">/100</span>
              </MetricCell>
              <MetricCell label="Sentiment">
                <div className="flex flex-col gap-1">
                  <span className={`text-xl font-bold tabular-nums ${sentiment.value}`}>
                    {signal.sentimentTone > 0 ? `+${signal.sentimentTone.toFixed(1)}` : signal.sentimentTone.toFixed(1)}
                  </span>
                  <span className={`inline-flex items-center gap-0.5 self-start text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${sentiment.chip}`}>
                    <SentimentIcon className="w-3 h-3" />
                    {sentiment.label}
                  </span>
                </div>
              </MetricCell>
              <MetricCell label="Predicted LinkedIn">
                <span className="text-xl font-bold text-slate-100 tabular-nums">{signal.predictions.linkedin}</span>
                <span className="text-xs text-slate-500">/100</span>
              </MetricCell>
              <MetricCell label="Predicted blog">
                <span className="text-xl font-bold text-slate-100 tabular-nums">{signal.predictions.blog}</span>
                <span className="text-xs text-slate-500">/100</span>
              </MetricCell>
              <MetricCell label="Confidence">
                <span className="text-xl font-bold text-sky-400 tabular-nums">{signal.confidenceRating}</span>
                <span className="text-xs text-slate-500">%</span>
              </MetricCell>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <h5 className="font-semibold text-emerald-400 mb-1">Why it moves</h5>
                <p className="text-slate-300 leading-relaxed">{signal.strategicWhy.moves}</p>
              </div>
              <div>
                <h5 className="font-semibold text-emerald-400 mb-1">Why it matters to you</h5>
                <p className="text-slate-300 leading-relaxed">{signal.strategicWhy.matters}</p>
              </div>
              <div>
                <h5 className="font-semibold text-emerald-400 mb-1">Strategic Whitespace</h5>
                <p className="text-slate-300 leading-relaxed">{signal.strategicWhy.whitespace}</p>
              </div>
            </div>

            {/* Strongest angles — click to compose */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Strongest Content Angles</h4>
                <span className="text-[11px] text-slate-500">Click an angle to compose posts</span>
              </div>
              <ul className="space-y-2 text-sm">
                {signal.strongestAngles.map((angle, idx) => {
                  const active = selectedAngle === angle;
                  return (
                    <li key={idx}>
                      <button
                        onClick={() => composeFromAngle(angle)}
                        aria-pressed={active}
                        className={`group w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition ${
                          active
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-100'
                            : 'bg-slate-800/30 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-emerald-400 font-bold tabular-nums">{idx + 1}.</span>
                        <span className="flex-1">{angle}</span>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition ${
                            active
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300 group-hover:bg-emerald-500 group-hover:text-slate-950'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Compose
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Composer + previews (revealed by an angle or "Develop content") */}
          {showCreation && (
            <div ref={developRef} className="p-6 space-y-5 border-t border-slate-800 bg-slate-900/30">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-emerald-400" />
                  Compose posts
                </h4>
                <span className="text-xs text-slate-500">Powered by Zernio</span>
              </div>

              {/* Angle seed */}
              <div className="text-[13px]">
                {selectedAngle ? (
                  <div className="flex items-start gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Angle</div>
                      <div className="text-slate-200">{selectedAngle}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">
                    Pick a network and generate, or click a strongest angle above to seed the copy.
                  </p>
                )}
              </div>

              {/* Network selector */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Networks</div>
                <div className="flex flex-wrap gap-2">
                  {NETWORKS.map(({ id, label, Icon }) => {
                    const on = selectedNetworks.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleNetwork(id)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          on
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate / regenerate */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => generateFor(selectedNetworks, selectedAngle, true)}
                  disabled={isGenerating || selectedNetworks.length === 0}
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isGenerating
                    ? 'Generating…'
                    : readyNetworks.length
                      ? 'Regenerate all'
                      : `Generate ${selectedNetworks.length} post${selectedNetworks.length === 1 ? '' : 's'}`}
                </button>
                <span className="text-[11px] text-slate-500">AI drafts one post per selected network.</span>
              </div>

              {/* Previews */}
              {selectedNetworks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedNetworks.map((net) => {
                    const post = posts[net];
                    const meta = NETWORKS.find((n) => n.id === net)!;
                    const Icon = meta.Icon;
                    const len = post ? fullContent(net).length : 0;
                    const over = len > CHAR_LIMITS[net];
                    const hasAccount = connectedFor(net).length > 0;
                    return (
                      <div key={net} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-300" />
                          <span className="text-xs font-bold text-slate-200">{meta.label}</span>
                          {!hasAccount && (
                            <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded">
                              no account
                            </span>
                          )}
                          <span
                            className={`ml-auto text-[11px] tabular-nums ${over ? 'text-red-400 font-semibold' : 'text-slate-500'}`}
                          >
                            {len.toLocaleString()}/{CHAR_LIMITS[net].toLocaleString()}
                          </span>
                        </div>

                        {post?.generating ? (
                          <div className="h-40 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Drafting {meta.label} post…
                          </div>
                        ) : post?.content ? (
                          <>
                            <PostPreview
                              platform={net}
                              content={post.content}
                              hashtags={post.hashtags}
                              media={media}
                              author={authorFor(net)}
                              topic={signal.topic}
                              title={selectedAngle ?? undefined}
                            />
                            <textarea
                              value={post.content}
                              onChange={(e) => updatePost(net, e.target.value)}
                              rows={3}
                              aria-label={`Edit ${meta.label} post`}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                            />
                          </>
                        ) : (
                          <div className="h-40 rounded-xl bg-slate-800/20 border border-dashed border-slate-800 flex items-center justify-center text-slate-500 text-xs text-center px-4">
                            Generate to preview the {meta.label} post.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Media attachments (shared across all previews) */}
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                  Media Attachments
                  <span className="text-slate-600 font-normal">· shared by every network</span>
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                  }}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                    dragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-950/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) uploadFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <UploadCloud className="w-6 h-6 mx-auto text-slate-500 mb-1" />
                  <p className="text-xs text-slate-300">
                    {isUploading ? 'Uploading…' : 'Drag & drop images or videos, or click to browse'}
                  </p>
                </div>

                {uploadError && (
                  <div className="p-2.5 bg-red-500/15 border border-red-500/40 rounded-lg text-red-300 text-[11px] flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {media.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {media.map((m, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-square">
                        {m.type.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.preview} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            <Film className="w-6 h-6" />
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMedia(i);
                          }}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-black rounded-full p-0.5 text-slate-200"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Publishing controls */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                {/* Target accounts per network */}
                <div className="flex items-start gap-2 text-[11px]">
                  <Users className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  {readyNetworks.length === 0 ? (
                    <span className="text-slate-500">Generate posts to see where they&apos;ll publish.</span>
                  ) : (
                    <span className="text-slate-400 flex flex-wrap gap-x-2 gap-y-1">
                      {readyNetworks.map((net) => {
                        const acct = connectedFor(net)[0];
                        return (
                          <span key={net} className={acct ? 'text-slate-300' : 'text-amber-300'}>
                            {NETWORK_LABEL[net]}
                            {acct ? ` → ${acct.handle}` : ' → no account'}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>
                {accounts.length === 0 && (
                  <p className="text-[11px] text-amber-300">
                    No connected accounts —{' '}
                    <Link href="/studio" className="underline hover:text-amber-200">
                      connect accounts in Content Studio
                    </Link>
                  </p>
                )}

                {/* Publish mode */}
                <div className="grid grid-cols-2 gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
                  <button
                    onClick={() => {
                      setPublishMode('now');
                      setPublishError(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                      publishMode === 'now' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publish Now
                  </button>
                  <button
                    onClick={() => {
                      setPublishMode('schedule');
                      setPublishError(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                      publishMode === 'schedule' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Schedule for Later
                  </button>
                </div>

                {publishMode === 'schedule' && (
                  <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => applyPreset(getPlusHours(2))}
                        className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg transition"
                      >
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        +2 Hours
                      </button>
                      <button
                        onClick={() => applyPreset(getTomorrowMorning(9))}
                        className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg transition"
                      >
                        <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                        Tomorrow 9 AM
                      </button>
                      <button
                        onClick={() => applyPreset(getOptimalTime(primaryNet))}
                        title={`Optimal for ${NETWORK_LABEL[primaryNet]}: ${getOptimalLabel(primaryNet)}`}
                        className="flex items-center gap-1.5 text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg transition"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Optimal · {getOptimalLabel(primaryNet)}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-medium">Schedule date &amp; time (your local time)</label>
                      <input
                        type="datetime-local"
                        value={scheduledLocal}
                        onChange={(e) => {
                          setScheduledLocal(e.target.value);
                          setPublishError(null);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                )}

                {publishReceipts && (
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Sent to Zernio
                    </div>
                    <ul className="pl-6 list-disc space-y-0.5 text-emerald-300/90">
                      {publishReceipts.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {publishError && (
                  <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{publishError}</span>
                  </div>
                )}

                <button
                  onClick={handlePublishAll}
                  disabled={isPublishing || readyNetworks.length === 0}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/10"
                >
                  {publishMode === 'schedule' ? <CalendarClock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {isPublishing
                    ? 'Sending to Zernio…'
                    : `${publishMode === 'schedule' ? 'Schedule' : 'Publish'} ${readyNetworks.length || ''} post${
                        readyNetworks.length === 1 ? '' : 's'
                      } via Zernio`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 p-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => onToggleSave?.(signal.id)}
            aria-pressed={isSaved}
            className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition ${
              isSaved
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800/60 text-slate-200 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            {isSaved ? 'Saved' : 'Save signal'}
          </button>
          <button
            onClick={() => setShowCreation((v) => !v)}
            aria-expanded={showCreation}
            className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <PenLine className="w-4 h-4" />
            {showCreation ? 'Hide composer' : 'Develop content'}
          </button>
        </footer>
      </div>
    </div>
  );
};
