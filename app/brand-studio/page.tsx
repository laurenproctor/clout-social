'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SocialPlatform, BrandStyle } from '@/types';
import { Sidebar } from '@/components/layout/Sidebar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useBrand } from '@/components/brand/BrandProvider';
import { FONT_OPTIONS } from '@/lib/brandFonts';
import { NETWORK_FORMATS, NETWORK_ORDER } from '@/lib/networkFormats';
import { renderBrandCard } from '@/lib/brandCanvas';
import {
  Radio,
  Zap,
  BarChart3,
  Palette,
  ImageIcon,
  Clapperboard,
  Upload,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
  Sparkles,
  Check,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
  Music2,
  FileText,
} from 'lucide-react';

const NET_ICON: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  blog: FileText,
};

const STYLE_OPTIONS: { key: BrandStyle; label: string }[] = [
  { key: 'bold', label: 'Bold' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'gradient', label: 'Gradient' },
  { key: 'editorial', label: 'Editorial' },
  { key: 'playful', label: 'Playful' },
];

interface ImageState {
  url: string;
  bg?: string;
  ai: boolean;
  loading: boolean;
  note?: string;
}
interface VideoState {
  url: string;
  loading: boolean;
  error?: string;
  stored?: boolean;
}

/* --------------------------- small field helpers -------------------------- */

const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-3">
    <span className="text-xs text-slate-400">{label}</span>
    <span className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-md bg-transparent border border-slate-700 cursor-pointer"
        aria-label={label}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50"
      />
    </span>
  </label>
);

export default function BrandStudioPage() {
  const { kit, updateKit, resetKit } = useBrand();

  const [topic, setTopic] = useState('AI Search');
  const [angle, setAngle] = useState('Why website traffic metrics are lying to you in 2026');
  const [nets, setNets] = useState<SocialPlatform[]>(['linkedin', 'instagram', 'tiktok']);

  const [images, setImages] = useState<Partial<Record<SocialPlatform, ImageState>>>({});
  const [videos, setVideos] = useState<Partial<Record<SocialPlatform, VideoState>>>({});
  const [imgBusy, setImgBusy] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [gateway, setGateway] = useState<boolean | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string>('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const headline = angle.trim() || topic.trim() || kit.tagline || 'Your headline here';

  // Is live AI generation available?
  useEffect(() => {
    fetch('/api/brand/status')
      .then((r) => r.json())
      .then((d) => setGateway(Boolean(d.gateway)))
      .catch(() => setGateway(false));
  }, []);

  // Live brand sample — recomposites (templated, no network call) as the kit changes.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const url = await renderBrandCard({
          format: NETWORK_FORMATS.linkedin,
          kit,
          headline,
          eyebrow: topic || 'Brand preview',
        });
        if (!cancelled) setSampleUrl(url);
      } catch {
        /* ignore transient render errors */
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kit, headline, topic]);

  const onLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => updateKit({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const toggleNet = (net: SocialPlatform) =>
    setNets((prev) => (prev.includes(net) ? prev.filter((n) => n !== net) : [...prev, net]));

  const generateImages = useCallback(async () => {
    if (!topic.trim()) {
      setFormError('Add a topic before generating.');
      return;
    }
    if (nets.length === 0) {
      setFormError('Pick at least one network.');
      return;
    }
    setFormError(null);
    setImgBusy(true);

    await Promise.all(
      nets.map(async (net) => {
        const format = NETWORK_FORMATS[net];
        setImages((p) => ({ ...p, [net]: { url: p[net]?.url ?? '', ai: false, loading: true } }));

        let bg: string | undefined;
        let ai = false;
        let note: string | undefined;
        try {
          const res = await fetch('/api/brand/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic,
              angle,
              network: format.label,
              style: kit.style,
              primaryColor: kit.primaryColor,
              accentColor: kit.accentColor,
              backgroundColor: kit.backgroundColor,
              aspectRatio: format.imageAspect,
            }),
          });
          const data = await res.json();
          if (data.image) {
            bg = data.image;
            ai = true;
          } else if (data.code === 'no_gateway') {
            note = 'Templated — connect AI Gateway for backgrounds';
          } else if (data.error) {
            note = 'Templated — AI background unavailable';
          }
        } catch {
          note = 'Templated — AI background unavailable';
        }

        try {
          const url = await renderBrandCard({ format, kit, headline, eyebrow: topic, backgroundSrc: bg });
          setImages((p) => ({ ...p, [net]: { url, bg, ai, loading: false, note } }));
        } catch {
          setImages((p) => ({ ...p, [net]: { url: '', ai: false, loading: false, note: 'Render failed' } }));
        }
      })
    );
    setImgBusy(false);
  }, [nets, topic, angle, kit, headline]);

  const generateVideos = useCallback(async () => {
    if (!topic.trim()) {
      setFormError('Add a topic before generating.');
      return;
    }
    if (nets.length === 0) {
      setFormError('Pick at least one network.');
      return;
    }
    setFormError(null);
    setVidBusy(true);

    await Promise.all(
      nets.map(async (net) => {
        const format = NETWORK_FORMATS[net];
        setVideos((p) => ({ ...p, [net]: { url: p[net]?.url ?? '', loading: true, error: undefined } }));
        try {
          const res = await fetch('/api/brand/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic,
              angle,
              network: format.label,
              style: kit.style,
              primaryColor: kit.primaryColor,
              accentColor: kit.accentColor,
              backgroundColor: kit.backgroundColor,
              videoAspect: format.videoAspect,
              // Seed with this network's branded image (image-to-video) for on-brand motion.
              seedImage: images[net]?.bg,
            }),
          });
          const data = await res.json();
          if (data.video) {
            setVideos((p) => ({ ...p, [net]: { url: data.video, loading: false, stored: data.stored } }));
          } else {
            setVideos((p) => ({ ...p, [net]: { url: '', loading: false, error: data.error || 'Generation failed' } }));
          }
        } catch {
          setVideos((p) => ({ ...p, [net]: { url: '', loading: false, error: 'Network error' } }));
        }
      })
    );
    setVidBusy(false);
  }, [nets, topic, angle, kit, images]);

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
            Brand Studio
          </span>
        </div>
        <nav className="lg:hidden flex items-center gap-2 text-sm">
          <Link href="/" aria-label="Signals" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium transition">
            <Radio className="w-4 h-4" />
          </Link>
          <Link href="/studio" aria-label="Content Studio" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium transition">
            <Zap className="w-4 h-4" />
          </Link>
          <Link href="/analytics" aria-label="Analytics" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium transition">
            <BarChart3 className="w-4 h-4" />
          </Link>
          <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
            <Palette className="w-4 h-4" />
          </span>
          <ThemeToggle />
        </nav>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="border-b border-slate-800/60 pb-4">
            <h1 className="text-2xl font-extrabold tracking-tight">Brand Studio</h1>
            <p className="text-xs text-slate-400 mt-1">
              Set your visual identity once, then generate on-brand images and video tailored to each social network.
            </p>
          </div>

          {gateway === false && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                AI Gateway isn&apos;t connected, so images render from your brand template only and video is unavailable.
                Add <span className="font-mono">AI_GATEWAY_API_KEY</span> or run <span className="font-mono">vercel env pull</span> for
                an OIDC token to enable AI backgrounds and video.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,360px)_1fr] gap-6 items-start">
            {/* Brand kit editor */}
            <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-emerald-400" /> Brand Kit
                </h2>
                <button onClick={resetKit} className="text-[11px] text-slate-400 hover:text-slate-200 underline">
                  Reset
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-medium">Brand name</label>
                <input
                  value={kit.brandName}
                  onChange={(e) => updateKit({ brandName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
                <label className="text-xs text-slate-400 font-medium">Tagline</label>
                <input
                  value={kit.tagline}
                  onChange={(e) => updateKit({ tagline: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-2.5">
                <span className="text-xs text-slate-400 font-medium">Colors</span>
                <ColorField label="Primary" value={kit.primaryColor} onChange={(v) => updateKit({ primaryColor: v })} />
                <ColorField label="Accent" value={kit.accentColor} onChange={(v) => updateKit({ accentColor: v })} />
                <ColorField label="Background" value={kit.backgroundColor} onChange={(v) => updateKit({ backgroundColor: v })} />
                <ColorField label="Text" value={kit.textColor} onChange={(v) => updateKit({ textColor: v })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Display font</label>
                  <select
                    value={kit.displayFont}
                    onChange={(e) => updateKit({ displayFont: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Body font</label>
                  <select
                    value={kit.bodyFont}
                    onChange={(e) => updateKit({ bodyFont: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-slate-400 font-medium">Style</span>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => updateKit({ style: s.key })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        kit.style === s.key
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-slate-400 font-medium">Logo</span>
                <div className="flex items-center gap-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) onLogo(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                  {kit.logoDataUrl ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={kit.logoDataUrl} alt="Brand logo" className="h-9 w-auto rounded bg-slate-800 p-1" />
                      <button
                        onClick={() => updateKit({ logoDataUrl: undefined })}
                        className="text-slate-400 hover:text-red-300"
                        aria-label="Remove logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 text-xs font-semibold bg-slate-800/60 border border-slate-700 hover:bg-slate-800 text-slate-200 px-3 py-2 rounded-lg transition"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload logo
                    </button>
                  )}
                </div>
              </div>

              {/* Live sample */}
              <div className="space-y-1.5">
                <span className="text-xs text-slate-400 font-medium">Live preview</span>
                {sampleUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sampleUrl} alt="Brand sample" className="w-full rounded-xl border border-slate-800" />
                ) : (
                  <div className="w-full aspect-[1200/627] rounded-xl border border-slate-800 bg-slate-800/40" />
                )}
              </div>
            </section>

            {/* Generator */}
            <section className="space-y-5">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Generate assets
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Topic</label>
                    <input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. AI Search"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Headline / angle</label>
                    <input
                      value={angle}
                      onChange={(e) => setAngle(e.target.value)}
                      placeholder="The line on the graphic"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400 font-medium">Networks</span>
                  <div className="flex flex-wrap gap-2">
                    {NETWORK_ORDER.map((net) => {
                      const Icon = NET_ICON[net];
                      const on = nets.includes(net);
                      const f = NETWORK_FORMATS[net];
                      return (
                        <button
                          key={net}
                          onClick={() => toggleNet(net)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            on
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                          title={`${f.slot} · ${f.width}×${f.height}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formError && (
                  <div className="p-2.5 bg-red-500/15 border border-red-500/40 rounded-lg text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    {formError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={generateImages}
                    disabled={imgBusy}
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition"
                  >
                    {imgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    {imgBusy ? 'Generating images…' : 'Generate images'}
                  </button>
                  <button
                    onClick={generateVideos}
                    disabled={vidBusy || gateway === false}
                    title={gateway === false ? 'Connect AI Gateway to generate video' : undefined}
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition"
                  >
                    {vidBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}
                    {vidBusy ? 'Generating video…' : 'Generate video'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Images composite an AI-generated on-brand background with your template. Video seeds from each image for
                  matching motion — it can take up to a minute per network.
                </p>
              </div>

              {/* Results */}
              {nets.length > 0 && (Object.keys(images).length > 0 || Object.keys(videos).length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nets.map((net) => {
                    const f = NETWORK_FORMATS[net];
                    const Icon = NET_ICON[net];
                    const img = images[net];
                    const vid = videos[net];
                    if (!img && !vid) return null;
                    return (
                      <div key={net} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-300" />
                          <span className="text-sm font-bold text-slate-100">{f.label}</span>
                          <span className="text-[11px] text-slate-500">
                            {f.slot} · {f.width}×{f.height}
                          </span>
                          {img?.ai && (
                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                              <Check className="w-3 h-3" /> AI background
                            </span>
                          )}
                        </div>

                        {/* Image */}
                        {img?.loading ? (
                          <div className="w-full aspect-video rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Composing…
                          </div>
                        ) : img?.url ? (
                          <div className="space-y-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={`${f.label} branded graphic`} className="w-full rounded-xl border border-slate-800" />
                            <div className="flex items-center justify-between">
                              {img.note ? (
                                <span className="text-[10px] text-amber-300">{img.note}</span>
                              ) : (
                                <span className="text-[10px] text-slate-500">Branded template applied</span>
                              )}
                              <a
                                href={img.url}
                                download={`clout-${net}-image.png`}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                              >
                                <Download className="w-3.5 h-3.5" /> PNG
                              </a>
                            </div>
                          </div>
                        ) : img ? (
                          <div className="text-xs text-red-300">{img.note || 'Could not render this image.'}</div>
                        ) : null}

                        {/* Video */}
                        {vid?.loading ? (
                          <div className="w-full aspect-video rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Rendering video…
                          </div>
                        ) : vid?.url ? (
                          <div className="space-y-2">
                            <video src={vid.url} controls loop muted className="w-full rounded-xl border border-slate-800 bg-black" />
                            <div className="flex justify-end">
                              <a
                                href={vid.url}
                                download={`clout-${net}-video.mp4`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                              >
                                <Download className="w-3.5 h-3.5" /> Video
                              </a>
                            </div>
                          </div>
                        ) : vid?.error ? (
                          <div className="text-[11px] text-red-300 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {vid.error}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
