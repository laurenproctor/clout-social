'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SignalItem, SocialPlatform, DripCampaign, LifecycleStage } from '@/types';
import { X, Sparkles, Send, Bookmark, CheckCircle2, Clock, CalendarClock, Zap, AlertTriangle, Layers, Rocket, Palette, UploadCloud, Paperclip, Film, Users, FileText, PenLine, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { useBrand } from '@/components/brand/BrandProvider';
import { useAccounts } from '@/components/accounts/AccountsProvider';

// Per-platform content character limits (Blog is effectively unlimited).
const CHAR_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
  blog: 100000,
};
import {
  getPlusHours,
  getPlusDays,
  getTomorrowMorning,
  getOptimalTime,
  getOptimalLabel,
  toDatetimeLocalValue,
  localInputToUtcISO,
  isFutureLocal,
  formatLocalReadable,
  formatDateReadable,
} from '@/lib/schedule';

interface Props {
  signal: SignalItem | null;
  onClose: () => void;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Market momentum = news-volume share nudged by how live the lifecycle stage is.
const MOMENTUM_BOOST: Record<LifecycleStage, number> = {
  emerging: 9,
  rising: 6,
  peaking: 0,
  declining: -12,
};

// Opportunity band label shown in the header tag strip.
function opportunityLabel(score: number): string {
  if (score >= 75) return 'High Opportunity';
  if (score >= 50) return 'Moderate Opportunity';
  return 'Early Opportunity';
}

// Qualitative sentiment badge derived from GDELT tone (-10 → +10). The numeric
// value is always shown alongside it, per the "never color-only" sentiment rule.
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

type PublishResult = { mode: PublishMode; scheduledLabel?: string } | null;

export const SignalDetailModal: React.FC<Props> = ({ signal, onClose, isSaved = false, onToggleSave }) => {
  const [activeTab, setActiveTab] = useState<SocialPlatform>('linkedin');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState('');
  const [publishMode, setPublishMode] = useState<PublishMode>('now');
  const [scheduledLocal, setScheduledLocal] = useState('');

  // The Zernio creation workspace stays collapsed until "Develop content" is used.
  const [showCreation, setShowCreation] = useState(false);
  const developRef = useRef<HTMLDivElement>(null);

  // 3-part drip campaign state
  const [campaign, setCampaign] = useState<DripCampaign | null>(null);
  const [campaignDrafts, setCampaignDrafts] = useState<string[]>([]);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);
  const [queueResult, setQueueResult] = useState<string[] | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  // Media attachments (uploaded to storage; their CDN URLs go into Zernio mediaUrls).
  const [media, setMedia] = useState<{ url: string; type: string; name: string; preview: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brand guidelines injected into every AI generation (set in Content Studio).
  const { brand, hasGuidelines } = useBrand();
  // Shared account selection (set in the Content Studio publisher).
  const { selectedAccounts, selectedIds } = useAccounts();

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!signal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signal, onClose]);

  // Bring the creation workspace into view when it's revealed.
  useEffect(() => {
    if (showCreation) developRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showCreation]);

  // Collapse the workspace whenever a different signal is opened.
  useEffect(() => {
    setShowCreation(false);
  }, [signal?.id]);

  if (!signal) return null;

  const accountIds = selectedIds;
  const marketMomentum = clampScore(signal.volumeShare + MOMENTUM_BOOST[signal.lifecycle]);
  const sentiment = sentimentBadge(signal.sentimentTone);
  const SentimentIcon = sentiment.Icon;
  const charLimit = CHAR_LIMITS[activeTab];
  const draftLength = postDraft.length;
  const overLimit = draftLength > charLimit;

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

  // Prefer Vercel Blob client upload (direct browser→CDN, handles large video up
  // to 5 TB). If Blob isn't configured, fall back to the multipart server route.
  const uploadOne = async (file: File): Promise<string> => {
    try {
      const blob = await upload(`clout/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        multipart: file.size > 8 * 1024 * 1024, // chunked upload for large files
      });
      return blob.url;
    } catch {
      // Fallback: multipart POST to the same route (small files / no Blob token).
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed.');
      return data.url as string;
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

  const mediaUrls = media.map((m) => m.url);

  const applyPreset = (date: Date) => {
    setScheduledLocal(toDatetimeLocalValue(date));
    setPublishError(null);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: signal.topic,
          platform: activeTab,
          sentimentTone: signal.sentimentTone,
          brand,
        }),
      });
      const data = await res.json();
      if (data.content?.draft) {
        setPostDraft(data.content.draft);
      } else {
        setPostDraft(`Concept: ${signal.strongestAngles[0]}\n\nHere is why ${signal.topic} matters for marketing teams right now...`);
      }
    } catch {
      setPostDraft(`Here is my analysis on ${signal.topic}: ${signal.strategicWhy.matters}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCampaign = async () => {
    setIsGeneratingCampaign(true);
    setQueueResult(null);
    setQueueError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: signal.topic,
          platform: activeTab,
          sentimentTone: signal.sentimentTone,
          // Drives the recommended schedule offsets for the 3-part drip.
          authorityWindowDays: signal.authorityWindowDays,
          // Brand guidelines injected into the system prompt.
          brand,
        }),
      });
      const data = await res.json();
      if (data.campaign?.posts?.length) {
        setCampaign(data.campaign);
        setCampaignDrafts(data.campaign.posts.map((p: { draft: string }) => p.draft));
      } else {
        setQueueError('Could not generate a campaign. Please try again.');
      }
    } catch {
      setQueueError('Network error generating the campaign.');
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  // Queue all 3 posts into Zernio in one click, each at its recommended offset.
  const handleQueueCampaign = async () => {
    if (!campaign) return;
    setQueueError(null);
    setQueueResult(null);
    if (accountIds.length === 0) {
      setQueueError('Select at least one account in Content Studio before queuing.');
      return;
    }
    setIsQueuing(true);
    try {
      const receipts: string[] = [];
      for (let i = 0; i < campaign.posts.length; i++) {
        const post = campaign.posts[i];
        const offset = post.recommendedScheduleOffsetDays;
        // Day 0 publishes immediately; later posts get a UTC scheduledAt.
        const when = offset > 0 ? getPlusDays(offset) : null;
        const scheduledAt = when ? when.toISOString() : null;

        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountIds,
            content: campaignDrafts[i] || post.draft,
            mediaUrls, // shared image/video attachments for the campaign
            scheduledAt,
            // Provenance for analytics: which signal this campaign came from.
            topic: signal.topic,
            opportunityScore: signal.opportunityScore,
            platform: activeTab,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Post ${post.order} was rejected by Zernio.`);
        }
        receipts.push(
          when
            ? `${post.stageLabel}: queued for ${formatDateReadable(when)}`
            : `${post.stageLabel}: published now`
        );
      }
      setQueueResult(receipts);
    } catch (err: any) {
      setQueueError(err?.message || 'Failed to queue the campaign in Zernio.');
    } finally {
      setIsQueuing(false);
    }
  };

  const handlePublish = async () => {
    setPublishError(null);
    setPublishResult(null);

    if (accountIds.length === 0) {
      setPublishError('Select at least one account in Content Studio before publishing.');
      return;
    }
    if (overLimit) {
      setPublishError(`Content exceeds the ${activeTab} limit (${draftLength}/${charLimit}).`);
      return;
    }

    // Convert the local picker value to a UTC ISO-8601 timestamp for Zernio.
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
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds,
          content: postDraft || signal.strongestAngles[0],
          mediaUrls, // public CDN URLs for image/video attachments
          scheduledAt, // UTC ISO-8601 when scheduling, null for immediate
          // Provenance for analytics: which signal this post came from.
          topic: signal.topic,
          opportunityScore: signal.opportunityScore,
          platform: activeTab,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPublishResult({ mode: publishMode, scheduledLabel });
        // Auto-dismiss the immediate-publish toast; keep the scheduled receipt visible.
        if (publishMode === 'now') {
          setTimeout(() => setPublishResult(null), 3000);
        }
      } else {
        setPublishError(data.error || 'Zernio rejected the request.');
      }
    } catch (err) {
      setPublishError('Network error reaching Zernio. Please retry.');
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
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
        
        {/* Header Bar */}
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

        {/* Content Body */}
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
                <h5 className="font-semibold text-emerald-400 flex items-center gap-2 mb-1">
                  Why it moves
                </h5>
                <p className="text-slate-300 leading-relaxed">{signal.strategicWhy.moves}</p>
              </div>

              <div>
                <h5 className="font-semibold text-emerald-400 flex items-center gap-2 mb-1">
                  Why it matters to you
                </h5>
                <p className="text-slate-300 leading-relaxed">{signal.strategicWhy.matters}</p>
              </div>

              <div>
                <h5 className="font-semibold text-emerald-400 flex items-center gap-2 mb-1">
                  Strategic Whitespace
                </h5>
                <p className="text-slate-300 leading-relaxed">{signal.strategicWhy.whitespace}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Strongest Content Angles
              </h4>
              <ul className="space-y-2 text-sm text-slate-300">
                {signal.strongestAngles.map((angle, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-slate-800/30 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-bold">{idx + 1}.</span>
                    <span>{angle}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Channel creation & Zernio publishing — revealed by "Develop content" */}
          {showCreation && (
          <div ref={developRef} className="p-6 space-y-6 border-t border-slate-800 bg-slate-900/30">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Creation Workflow
                </h4>
                <span className="text-xs text-slate-500">Powered by Zernio</span>
              </div>

              {/* Platform Selector Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(['linkedin', 'tiktok', 'instagram', 'youtube', 'blog'] as SocialPlatform[]).map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setActiveTab(plat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      activeTab === plat
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>

              {/* AI Draft Controls */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 font-medium">Post Script & Hook</label>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="text-xs flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGenerating ? 'Generating...' : 'AI Generate Draft'}
                  </button>
                </div>
                <textarea
                  value={postDraft}
                  onChange={(e) => setPostDraft(e.target.value)}
                  placeholder={`Write or generate your ${activeTab} content...`}
                  rows={6}
                  aria-label={`${activeTab} post content`}
                  className={`w-full bg-slate-950 border rounded-xl p-3 text-sm text-slate-200 focus:outline-none ${
                    overLimit ? 'border-red-500/60 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/50'
                  }`}
                />
                <div className="flex justify-end">
                  <span className={`text-[11px] tabular-nums ${overLimit ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
                    {draftLength.toLocaleString()} / {charLimit.toLocaleString()} · {activeTab}
                    {overLimit ? ' — over limit' : ''}
                  </span>
                </div>
              </div>

              {/* Media Attachments (drag & drop) */}
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                  Media Attachments
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
                    dragActive
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-950/40'
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
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Attached to the Zernio post as mediaUrls · images &amp; video
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
                      <div
                        key={i}
                        className="relative group rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-square"
                      >
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
                        {m.url.startsWith('/uploads/') && (
                          <span className="absolute bottom-0 inset-x-0 text-[9px] bg-amber-500/80 text-slate-950 text-center font-semibold">
                            local
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3-Part Drip Campaign */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      3-Part Drip Campaign
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Paced to the {signal.authorityWindowDays} authority window
                    </p>
                    <p className="text-[11px] mt-1 flex items-center gap-1">
                      <Palette className="w-3 h-3 text-emerald-400" />
                      {hasGuidelines ? (
                        <span className="text-emerald-300/90">
                          Brand voice: {brand.tone?.trim() || 'custom guidelines applied'}
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          No brand set — configure in Content Studio
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateCampaign}
                    disabled={isGeneratingCampaign}
                    className="text-xs flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold disabled:opacity-60"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingCampaign ? 'Building...' : campaign ? 'Regenerate' : 'Generate Campaign'}
                  </button>
                </div>

                {campaign && (
                  <div className="space-y-2">
                    {campaign.posts.map((post, i) => {
                      const offset = post.recommendedScheduleOffsetDays;
                      const when = offset > 0 ? getPlusDays(offset) : null;
                      return (
                        <div
                          key={post.stage}
                          className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-emerald-400">
                              {post.order}. {post.stageLabel}
                            </span>
                            <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {when ? `Day ${offset} · ${formatDateReadable(when)}` : 'Day 0 · now'}
                            </span>
                          </div>
                          <textarea
                            value={campaignDrafts[i] ?? post.draft}
                            onChange={(e) => {
                              const next = [...campaignDrafts];
                              next[i] = e.target.value;
                              setCampaignDrafts(next);
                            }}
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                          />
                          <div className="text-[11px] text-slate-500">{post.hashtags}</div>
                        </div>
                      );
                    })}

                    <button
                      onClick={handleQueueCampaign}
                      disabled={isQueuing}
                      className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-60 text-emerald-300 border border-emerald-500/40 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition"
                    >
                      <Rocket className="w-4 h-4" />
                      {isQueuing ? 'Queuing all 3 in Zernio...' : 'Queue all 3 in Zernio'}
                    </button>

                    {queueResult && (
                      <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs space-y-1">
                        <div className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Drip campaign queued in Zernio
                        </div>
                        <ul className="pl-6 list-disc space-y-0.5 text-emerald-300/90">
                          {queueResult.map((line, idx) => (
                            <li key={idx}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {queueError && (
                  <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{queueError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Zernio Publishing Controls */}
            <div className="pt-4 border-t border-slate-800 space-y-3">

              {/* Target accounts (selected in Content Studio) */}
              <div className="flex items-start gap-2 text-[11px]">
                <Users className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                {selectedAccounts.length > 0 ? (
                  <span className="text-slate-400">
                    Publishing to{' '}
                    <span className="text-slate-200 font-medium">
                      {selectedAccounts.map((a) => a.handle).join(', ')}
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-300">
                    No accounts selected —{' '}
                    <Link href="/studio" className="underline hover:text-amber-200">
                      choose accounts in Content Studio
                    </Link>
                  </span>
                )}
              </div>

              {/* Publish Mode Toggle */}
              <div className="grid grid-cols-2 gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
                <button
                  onClick={() => { setPublishMode('now'); setPublishError(null); }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                    publishMode === 'now'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish Now
                </button>
                <button
                  onClick={() => { setPublishMode('schedule'); setPublishError(null); }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                    publishMode === 'schedule'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  Schedule for Later
                </button>
              </div>

              {/* Scheduling Panel */}
              {publishMode === 'schedule' && (
                <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  {/* Quick Presets */}
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
                      onClick={() => applyPreset(getOptimalTime(activeTab))}
                      title={`Optimal for ${activeTab}: ${getOptimalLabel(activeTab)}`}
                      className="flex items-center gap-1.5 text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg transition"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Optimal Engagement Time
                      <span className="text-emerald-400/70">· {getOptimalLabel(activeTab)}</span>
                    </button>
                  </div>

                  {/* DateTime Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Schedule date &amp; time (your local time)</label>
                    <input
                      type="datetime-local"
                      value={scheduledLocal}
                      onChange={(e) => { setScheduledLocal(e.target.value); setPublishError(null); }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                    />
                    {scheduledLocal && localInputToUtcISO(scheduledLocal) && (
                      <p className="text-[11px] text-slate-500">
                        Sends to Zernio as <span className="font-mono text-slate-400">{localInputToUtcISO(scheduledLocal)}</span> (UTC)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Queued / Dispatched Confirmation */}
              {publishResult?.mode === 'schedule' && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
                  <CalendarClock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>
                    Queued in Zernio&apos;s scheduled pipeline — will publish{' '}
                    <strong className="text-emerald-200">{publishResult.scheduledLabel}</strong> (your local time).
                  </span>
                </div>
              )}
              {publishResult?.mode === 'now' && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Successfully dispatched post via Zernio Multi-Channel API!</span>
                </div>
              )}
              {publishError && (
                <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{publishError}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handlePublish}
                  disabled={isPublishing || overLimit || accountIds.length === 0}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/10"
                >
                  {publishMode === 'schedule' ? <CalendarClock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {isPublishing
                    ? (publishMode === 'schedule' ? 'Queuing in Zernio...' : 'Publishing via Zernio...')
                    : (publishMode === 'schedule' ? 'Schedule via Zernio' : 'Publish via Zernio')}
                </button>
              </div>
            </div>

          </div>
          )}
        </div>

        {/* Action Footer */}
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

          <Link
            href="/briefs"
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800 transition"
          >
            <FileText className="w-4 h-4" />
            Create brief
          </Link>

          <button
            onClick={() => setShowCreation((v) => !v)}
            aria-expanded={showCreation}
            className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <PenLine className="w-4 h-4" />
            {showCreation ? 'Hide workspace' : 'Develop content'}
          </button>
        </footer>

      </div>
    </div>
  );
};
