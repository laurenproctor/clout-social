'use client';

import { BrandKit, BrandStyle } from '@/types';
import { NetworkFormat } from '@/lib/networkFormats';
import { resolveFont, cssFamily, ensureFontLoaded } from '@/lib/brandFonts';

export interface RenderInput {
  format: NetworkFormat;
  kit: BrandKit;
  headline: string;
  eyebrow?: string;
  /** AI-generated background as a data URL (hybrid). Omit for a templated brand gradient. */
  backgroundSrc?: string | null;
}

/* ------------------------------- utilities -------------------------------- */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.padEnd(6, '0');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size (<= start) that wraps `text` into <= maxLines within maxWidth. */
function fitHeadline(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  family: string,
  weight: number,
  start: number,
  min: number
): { size: number; lines: string[] } {
  for (let size = start; size >= min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return { size: min, lines: wrapText(ctx, text, maxWidth).slice(0, maxLines) };
}

/* ----------------------------- style presets ------------------------------ */

interface StyleConfig {
  /** Bottom scrim opacity applied over the background image for legibility. */
  scrim: number;
  headlineWeight: number;
  /** Accent shape drawn with the headline. */
  accent: 'underline' | 'bar' | 'highlight' | 'rule' | 'none';
  uppercaseEyebrow: boolean;
}

const STYLE: Record<BrandStyle, StyleConfig> = {
  bold: { scrim: 0.82, headlineWeight: 800, accent: 'bar', uppercaseEyebrow: true },
  minimal: { scrim: 0.55, headlineWeight: 600, accent: 'none', uppercaseEyebrow: true },
  gradient: { scrim: 0.35, headlineWeight: 800, accent: 'underline', uppercaseEyebrow: true },
  editorial: { scrim: 0.7, headlineWeight: 700, accent: 'rule', uppercaseEyebrow: true },
  playful: { scrim: 0.6, headlineWeight: 800, accent: 'highlight', uppercaseEyebrow: false },
};

/* ------------------------------- renderer --------------------------------- */

export async function renderBrandCard(input: RenderInput): Promise<string> {
  const { format, kit, headline, eyebrow, backgroundSrc } = input;
  const { width: W, height: H } = format;
  const cfg = STYLE[kit.style];

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');

  const margin = Math.round(Math.min(W, H) * 0.07);
  const contentW = W - margin * 2;

  // Resolve display/body fonts (built-in, Google, or custom) and make sure their
  // glyphs are loaded before we draw, so the canvas doesn't fall back silently.
  const displayFontDef = resolveFont(kit.displayFont, kit.fonts);
  const bodyFontDef = resolveFont(kit.bodyFont, kit.fonts);
  await Promise.all([ensureFontLoaded(displayFontDef), ensureFontLoaded(bodyFontDef)]);
  const display = cssFamily(displayFontDef);
  const body = cssFamily(bodyFontDef);

  /* --- background --- */
  if (backgroundSrc) {
    const bg = await loadImage(backgroundSrc);
    drawCover(ctx, bg, W, H);
    // Bottom-anchored scrim so text stays legible over any image.
    const scrim = ctx.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, rgba(kit.backgroundColor, cfg.scrim * 0.15));
    scrim.addColorStop(0.5, rgba(kit.backgroundColor, cfg.scrim * 0.5));
    scrim.addColorStop(1, rgba(kit.backgroundColor, cfg.scrim));
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);
  } else if (kit.style === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, kit.primaryColor);
    g.addColorStop(0.55, kit.accentColor);
    g.addColorStop(1, kit.backgroundColor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = kit.backgroundColor;
    ctx.fillRect(0, 0, W, H);
    // Soft accent glow bottom-right.
    const glow = ctx.createRadialGradient(W * 0.82, H * 0.85, 0, W * 0.82, H * 0.85, Math.max(W, H) * 0.7);
    glow.addColorStop(0, rgba(kit.primaryColor, 0.35));
    glow.addColorStop(1, rgba(kit.primaryColor, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  /* --- logo or wordmark top-left --- */
  let topY = margin;
  if (kit.logoDataUrl) {
    try {
      const logo = await loadImage(kit.logoDataUrl);
      const lh = Math.round(H * 0.09);
      const lw = (logo.width / logo.height) * lh;
      ctx.drawImage(logo, margin, topY, lw, lh);
    } catch {
      /* ignore a bad logo — fall through to the wordmark */
    }
  } else if (kit.brandName) {
    const size = Math.round(H * 0.045);
    ctx.font = `700 ${size}px ${display}`;
    ctx.fillStyle = kit.textColor;
    ctx.textBaseline = 'top';
    ctx.fillText(kit.brandName, margin, topY);
  }
  void topY;

  /* --- bottom text block (eyebrow → headline → tagline) --- */
  const maxLines = format.kind === 'portrait' ? 5 : format.kind === 'square' ? 4 : 3;
  const startSize = Math.round((format.kind === 'portrait' ? W : H) * 0.12);
  const minSize = Math.round(startSize * 0.4);
  const { size: hSize, lines } = fitHeadline(ctx, headline, contentW, maxLines, display, cfg.headlineWeight, startSize, minSize);
  const lineHeight = Math.round(hSize * 1.08);

  const eyebrowSize = Math.round(hSize * 0.28);
  const taglineSize = Math.round(hSize * 0.3);
  const eyebrowGap = eyebrow ? Math.round(eyebrowSize * 2) : 0;
  const taglineGap = kit.tagline ? Math.round(taglineSize * 2) : 0;
  const accentGap = cfg.accent === 'none' ? 0 : Math.round(hSize * 0.5);

  const blockH = eyebrowGap + lines.length * lineHeight + accentGap + taglineGap;
  let y = H - margin - blockH;

  ctx.textBaseline = 'top';

  // Eyebrow
  if (eyebrow) {
    ctx.font = `700 ${eyebrowSize}px ${body}`;
    ctx.fillStyle = kit.accentColor;
    const text = cfg.uppercaseEyebrow ? eyebrow.toUpperCase() : eyebrow;
    const prevSpacing = (ctx as unknown as { letterSpacing?: string }).letterSpacing;
    try {
      (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${Math.round(eyebrowSize * 0.08)}px`;
    } catch {
      /* letterSpacing unsupported — ignore */
    }
    ctx.fillText(text, margin, y);
    try {
      (ctx as unknown as { letterSpacing?: string }).letterSpacing = prevSpacing ?? '0px';
    } catch {
      /* ignore */
    }
    y += eyebrowGap;
  }

  // Accent bar / rule above the headline
  if (cfg.accent === 'bar' || cfg.accent === 'rule') {
    const barW = cfg.accent === 'bar' ? Math.round(contentW * 0.12) : contentW;
    const barH = cfg.accent === 'bar' ? Math.round(hSize * 0.12) : Math.max(2, Math.round(hSize * 0.03));
    ctx.fillStyle = kit.primaryColor;
    ctx.fillRect(margin, y, barW, barH);
    y += accentGap;
  }

  // Headline
  ctx.font = `${cfg.headlineWeight} ${hSize}px ${display}`;
  for (const line of lines) {
    if (cfg.accent === 'highlight') {
      const w = ctx.measureText(line).width;
      ctx.fillStyle = rgba(kit.primaryColor, 0.9);
      ctx.fillRect(margin - hSize * 0.06, y + lineHeight * 0.08, w + hSize * 0.12, hSize * 0.98);
    }
    ctx.fillStyle = kit.textColor;
    ctx.fillText(line, margin, y);
    y += lineHeight;
  }

  // Underline accent
  if (cfg.accent === 'underline') {
    const w = ctx.measureText(lines[lines.length - 1] ?? '').width;
    ctx.fillStyle = kit.primaryColor;
    ctx.fillRect(margin, y + Math.round(hSize * 0.06), Math.min(w, contentW), Math.max(3, Math.round(hSize * 0.06)));
  }

  // Tagline
  if (kit.tagline) {
    y += taglineGap * 0.25;
    ctx.font = `500 ${taglineSize}px ${body}`;
    ctx.fillStyle = rgba(kit.textColor, 0.8);
    const tagLines = wrapText(ctx, kit.tagline, contentW);
    ctx.fillText(tagLines[0], margin, y + accentGap * 0.2);
  }

  return canvas.toDataURL('image/png');
}
