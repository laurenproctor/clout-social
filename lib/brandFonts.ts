import { BrandFont } from '@/types';
import { slug } from '@/lib/slug';

// Built-in font stacks that render reliably on <canvas> with no network load
// (the browser picks the first installed family in each stack).
export const SYSTEM_FONTS: BrandFont[] = [
  { key: 'grotesk', label: 'Grotesk (Helvetica)', family: '"Helvetica Neue", Helvetica, Arial, sans-serif', source: 'system' },
  { key: 'humanist', label: 'Humanist (Segoe / Roboto)', family: '"Segoe UI", Roboto, system-ui, sans-serif', source: 'system' },
  { key: 'geometric', label: 'Geometric (Futura)', family: 'Futura, "Century Gothic", "Trebuchet MS", sans-serif', source: 'system' },
  { key: 'impact', label: 'Impact (Heavy Display)', family: 'Impact, "Arial Black", "Helvetica Neue", sans-serif', source: 'system' },
  { key: 'serif', label: 'Serif (Georgia)', family: 'Georgia, "Times New Roman", serif', source: 'system' },
  { key: 'editorial', label: 'Editorial (Baskerville)', family: 'Baskerville, "Palatino Linotype", Georgia, serif', source: 'system' },
  { key: 'slab', label: 'Slab (Rockwell)', family: 'Rockwell, "Courier New", Georgia, serif', source: 'system' },
  { key: 'mono', label: 'Mono (Courier)', family: '"SF Mono", "Courier New", ui-monospace, monospace', source: 'system' },
];

// Backwards-compatible alias for existing imports.
export const FONT_OPTIONS = SYSTEM_FONTS;

// One-click Google Fonts; any other family can still be added by name.
export const GOOGLE_PRESETS: { label: string; family: string; serif?: boolean }[] = [
  { label: 'Inter', family: 'Inter' },
  { label: 'Poppins', family: 'Poppins' },
  { label: 'Montserrat', family: 'Montserrat' },
  { label: 'Space Grotesk', family: 'Space Grotesk' },
  { label: 'DM Sans', family: 'DM Sans' },
  { label: 'Archivo', family: 'Archivo' },
  { label: 'Bebas Neue', family: 'Bebas Neue' },
  { label: 'Playfair Display', family: 'Playfair Display', serif: true },
  { label: 'Lora', family: 'Lora', serif: true },
  { label: 'Fraunces', family: 'Fraunces', serif: true },
];

const DEFAULT_WEIGHTS = [400, 600, 700, 800];

export function googleFont(family: string): BrandFont {
  return { key: `g-${slug(family)}`, label: family, family, source: 'google', weights: DEFAULT_WEIGHTS };
}

export function customFontKey(family: string): string {
  return `c-${slug(family)}`;
}

/** All fonts available to the kit: built-ins plus the user's added fonts. */
export function mergedFonts(custom?: BrandFont[]): BrandFont[] {
  return [...SYSTEM_FONTS, ...(custom ?? [])];
}

/** Resolve a font key to its BrandFont, falling back to the first system font. */
export function resolveFont(key: string, custom?: BrandFont[]): BrandFont {
  return mergedFonts(custom).find((f) => f.key === key) ?? SYSTEM_FONTS[0];
}

/** CSS font-family value for a font — a ready stack for system, a quoted name + fallback otherwise. */
export function cssFamily(font: BrandFont): string {
  if (font.source === 'system') return font.family;
  const fallback = /serif|playfair|lora|fraunces|baskerville/i.test(font.label) ? 'serif' : 'sans-serif';
  return `"${font.family}", ${fallback}`;
}

/** Backwards-compatible helper (system fonts only). */
export function fontStack(key: string): string {
  return resolveFont(key).family;
}

/* ------------------------------ font loading ------------------------------ */

const injected = new Set<string>();

function injectGoogleStylesheet(family: string, weights: number[]) {
  if (typeof document === 'undefined') return;
  const id = `gf-${slug(family)}`;
  if (document.getElementById(id)) return;
  const spec = `${family.replace(/\s+/g, '+')}:wght@${[...new Set(weights)].sort((a, b) => a - b).join(';')}`;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
}

function fontFaceExists(family: string): boolean {
  if (typeof document === 'undefined') return false;
  let found = false;
  document.fonts.forEach((f) => {
    if (f.family.replace(/["']/g, '') === family) found = true;
  });
  return found;
}

/**
 * Ensure a font's glyphs are ready to render (in the DOM and on canvas).
 * System fonts resolve immediately; Google fonts inject a stylesheet; uploads
 * register a FontFace from their data URL. Failures degrade to the fallback family.
 */
export async function ensureFontLoaded(font: BrandFont): Promise<void> {
  if (typeof document === 'undefined' || font.source === 'system') return;
  const family = font.family;
  try {
    if (font.source === 'google') {
      injectGoogleStylesheet(family, font.weights ?? DEFAULT_WEIGHTS);
    } else if (font.source === 'custom' && font.dataUrl) {
      if (!injected.has(family) && !fontFaceExists(family)) {
        const face = new FontFace(family, `url(${font.dataUrl})`);
        await face.load();
        document.fonts.add(face);
      }
    }
    injected.add(family);
    // Prime the weights the canvas draws with.
    await Promise.all([
      document.fonts.load(`400 24px "${family}"`),
      document.fonts.load(`700 24px "${family}"`),
    ]).catch(() => {});
    await document.fonts.ready;
  } catch {
    /* fall back to the CSS fallback family */
  }
}
