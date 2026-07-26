'use client';

import React, { useState } from 'react';
import { useBrand } from './BrandProvider';
import { Palette, X, Check, Trash2, Ban, User, MessageSquareQuote, Sparkles } from 'lucide-react';

const TONE_PRESETS = [
  'Architectural Minimalist',
  'Direct & Authoritative',
  'Warm & Consultative',
  'Playful & Bold',
];

const CTA_PRESETS = [
  'End with one sharp question',
  'Single clear CTA with a link',
  'Invite a comment or reply',
  'Soft CTA — no hard ask',
];

export const BrandSettings: React.FC = () => {
  const { brand, updateBrand, clearBrand, hasGuidelines, hydrated } = useBrand();
  const [wordInput, setWordInput] = useState('');

  const words = brand.forbiddenWords ?? [];

  const addWord = () => {
    const w = wordInput.trim();
    if (!w) return;
    if (!words.some((x) => x.toLowerCase() === w.toLowerCase())) {
      updateBrand({ forbiddenWords: [...words, w] });
    }
    setWordInput('');
  };

  const removeWord = (w: string) => {
    updateBrand({ forbiddenWords: words.filter((x) => x !== w) });
  };

  const onWordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addWord();
    }
  };

  return (
    <div className="border border-slate-800 rounded-2xl bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-100">
            <Palette className="w-4 h-4 text-emerald-400" />
            Brand Guidelines
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Injected into every AI hook &amp; script · {hydrated ? 'Auto-saved to this browser' : 'Loading…'}
          </p>
        </div>
        {hasGuidelines && (
          <button
            onClick={clearBrand}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Tone */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Brand voice &amp; tone
          </label>
          <input
            type="text"
            value={brand.tone ?? ''}
            onChange={(e) => updateBrand({ tone: e.target.value })}
            placeholder="e.g. Architectural Minimalist"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
          <div className="flex flex-wrap gap-1.5">
            {TONE_PRESETS.map((t) => (
              <button
                key={t}
                onClick={() => updateBrand({ tone: t })}
                className={`text-[11px] px-2 py-1 rounded-full border transition ${
                  brand.tone === t
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Target persona */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            Target persona
          </label>
          <textarea
            value={brand.targetPersona ?? ''}
            onChange={(e) => updateBrand({ targetPersona: e.target.value })}
            placeholder="e.g. VP of Marketing at a Series B SaaS, time-poor, skeptical of hype"
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Preferred CTA */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <MessageSquareQuote className="w-3.5 h-3.5 text-emerald-400" />
            Preferred CTA format
          </label>
          <input
            type="text"
            value={brand.ctaFormat ?? ''}
            onChange={(e) => updateBrand({ ctaFormat: e.target.value })}
            placeholder="e.g. End with one sharp question"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
          <div className="flex flex-wrap gap-1.5">
            {CTA_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => updateBrand({ ctaFormat: c })}
                className={`text-[11px] px-2 py-1 rounded-full border transition ${
                  brand.ctaFormat === c
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Forbidden words */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5 text-red-400" />
            Forbidden words
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value)}
              onKeyDown={onWordKeyDown}
              placeholder="Type a word, press Enter (e.g. leverage, synergy)"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={addWord}
              disabled={!wordInput.trim()}
              className="flex items-center gap-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 rounded-lg"
            >
              <Check className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          {words.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {words.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 text-[11px] bg-red-500/10 text-red-300 border border-red-500/30 px-2 py-1 rounded-full"
                >
                  {w}
                  <button onClick={() => removeWord(w)} className="hover:text-red-100">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandSettings;
