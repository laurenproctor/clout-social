'use client';

import React, { useRef, useState } from 'react';
import { BrandFont } from '@/types';
import { useBrand } from '@/components/brand/BrandProvider';
import {
  GOOGLE_PRESETS,
  googleFont,
  customFontKey,
  cssFamily,
  ensureFontLoaded,
} from '@/lib/brandFonts';
import { Type, Upload, Trash2, Plus, Loader2, AlertTriangle, Check } from 'lucide-react';

const MAX_FONT_BYTES = 2 * 1024 * 1024; // keep localStorage within budget

// "MyBrand-Bold.woff2" → "MyBrand Bold"
function fileToFamily(name: string): string {
  return name
    .replace(/\.(ttf|otf|woff2?|)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the font file.'));
    r.readAsDataURL(file);
  });

export function FontManager() {
  const { kit, addFont, removeFont, updateKit } = useBrand();
  const custom = kit.fonts ?? [];

  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const has = (key: string) => custom.some((f) => f.key === key);

  const addGoogle = async (family: string) => {
    const fam = family.trim();
    if (!fam) return;
    const font = googleFont(fam);
    if (has(font.key)) {
      setError(`${fam} is already added.`);
      return;
    }
    setError(null);
    setBusy(font.key);
    await ensureFontLoaded(font);
    addFont(font);
    setBusy(null);
    setName('');
  };

  const onUpload = async (file: File) => {
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) {
      setError('Use a .ttf, .otf, .woff, or .woff2 file.');
      return;
    }
    if (file.size > MAX_FONT_BYTES) {
      setError('Font is over 2 MB — pick a smaller file or a single weight.');
      return;
    }
    setError(null);
    const family = fileToFamily(file.name) || 'Custom font';
    const key = customFontKey(family);
    setBusy(key);
    try {
      const dataUrl = await readAsDataUrl(file);
      const font: BrandFont = { key, label: `${family} (custom)`, family, source: 'custom', dataUrl };
      await ensureFontLoaded(font);
      addFont(font);
    } catch (e: any) {
      setError(e?.message || 'Could not load that font.');
    } finally {
      setBusy(null);
    }
  };

  const assignedAs = (key: string): string | null =>
    kit.displayFont === key && kit.bodyFont === key
      ? 'Display + Body'
      : kit.displayFont === key
        ? 'Display'
        : kit.bodyFont === key
          ? 'Body'
          : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4 text-emerald-400" />
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Add fonts</span>
      </div>

      {/* Google Fonts */}
      <div className="space-y-2">
        <span className="text-[11px] text-slate-500 font-medium">Google Fonts</span>
        <div className="flex flex-wrap gap-1.5">
          {GOOGLE_PRESETS.map((p) => {
            const key = googleFont(p.family).key;
            const added = has(key);
            return (
              <button
                key={p.family}
                onClick={() => addGoogle(p.family)}
                disabled={added || busy === key}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                  added
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {busy === key ? <Loader2 className="w-3 h-3 animate-spin" /> : added ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addGoogle(name);
              }
            }}
            placeholder="Add any Google Font by name…"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            onClick={() => addGoogle(name)}
            disabled={!name.trim() || busy !== null}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800/60 border border-slate-700 hover:bg-slate-800 disabled:opacity-50 text-slate-200 px-3 py-2 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Custom upload */}
      <div className="space-y-1.5">
        <span className="text-[11px] text-slate-500 font-medium">Custom upload</span>
        <input
          ref={fileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) onUpload(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 text-xs font-semibold bg-slate-800/60 border border-slate-700 hover:bg-slate-800 text-slate-200 px-3 py-2 rounded-lg transition"
        >
          <Upload className="w-3.5 h-3.5" /> Upload font file
        </button>
        <p className="text-[10px] text-slate-600">.ttf, .otf, .woff, .woff2 · up to 2 MB · stored in this browser</p>
      </div>

      {error && (
        <div className="p-2 bg-red-500/15 border border-red-500/40 rounded-lg text-red-300 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {/* Added fonts */}
      {custom.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {custom.map((f) => {
            const role = assignedAs(f.key);
            return (
              <li key={f.key} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-tight truncate text-slate-100" style={{ fontFamily: cssFamily(f) }}>
                    {f.family}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                    {f.source === 'google' ? 'Google Font' : 'Custom upload'}
                    {role ? ` · ${role}` : ''}
                  </span>
                </span>
                <button
                  onClick={() => updateKit({ displayFont: f.key })}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition ${
                    kit.displayFont === f.key
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Display
                </button>
                <button
                  onClick={() => updateKit({ bodyFont: f.key })}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition ${
                    kit.bodyFont === f.key
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Body
                </button>
                <button
                  onClick={() => removeFont(f.key)}
                  aria-label={`Remove ${f.family}`}
                  className="text-slate-500 hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
