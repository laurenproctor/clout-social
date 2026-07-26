// Curated font stacks that render reliably on <canvas> without loading webfonts
// (the browser picks the first installed family in each stack).

export interface FontOption {
  key: string;
  label: string;
  stack: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { key: 'grotesk', label: 'Grotesk (Helvetica)', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { key: 'humanist', label: 'Humanist (Segoe / Roboto)', stack: '"Segoe UI", Roboto, system-ui, sans-serif' },
  { key: 'geometric', label: 'Geometric (Futura)', stack: 'Futura, "Century Gothic", "Trebuchet MS", sans-serif' },
  { key: 'impact', label: 'Impact (Heavy Display)', stack: 'Impact, "Arial Black", "Helvetica Neue", sans-serif' },
  { key: 'serif', label: 'Serif (Georgia)', stack: 'Georgia, "Times New Roman", serif' },
  { key: 'editorial', label: 'Editorial (Baskerville)', stack: 'Baskerville, "Palatino Linotype", Georgia, serif' },
  { key: 'slab', label: 'Slab (Rockwell)', stack: 'Rockwell, "Courier New", Georgia, serif' },
  { key: 'mono', label: 'Mono (Courier)', stack: '"SF Mono", "Courier New", ui-monospace, monospace' },
];

export function fontStack(key: string): string {
  return FONT_OPTIONS.find((f) => f.key === key)?.stack ?? FONT_OPTIONS[0].stack;
}
