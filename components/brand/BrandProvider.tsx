'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BrandGuidelines, BrandKit, DEFAULT_BRAND_KIT } from '@/types';

const STORAGE_KEY = 'clout.brandGuidelines';
const KIT_KEY = 'clout.brandKit';

const EMPTY: BrandGuidelines = {
  tone: '',
  forbiddenWords: [],
  targetPersona: '',
  ctaFormat: '',
};

interface BrandContextValue {
  brand: BrandGuidelines;
  /** Visual brand kit (colors, fonts, logo, style) used for asset generation. */
  kit: BrandKit;
  /** True once localStorage has been read (avoids SSR/first-paint flip). */
  hydrated: boolean;
  /** True when at least one guideline field is set. */
  hasGuidelines: boolean;
  setBrand: (brand: BrandGuidelines) => void;
  updateBrand: (patch: Partial<BrandGuidelines>) => void;
  clearBrand: () => void;
  updateKit: (patch: Partial<BrandKit>) => void;
  resetKit: () => void;
}

const BrandContext = createContext<BrandContextValue | null>(null);

function isMeaningful(b: BrandGuidelines): boolean {
  return Boolean(
    b.tone?.trim() ||
      b.targetPersona?.trim() ||
      b.ctaFormat?.trim() ||
      (b.forbiddenWords && b.forbiddenWords.length > 0)
  );
}

function persist(b: BrandGuidelines) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrandState] = useState<BrandGuidelines>(EMPTY);
  const [kit, setKitState] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setBrandState({
          ...EMPTY,
          ...parsed,
          forbiddenWords: Array.isArray(parsed.forbiddenWords) ? parsed.forbiddenWords : [],
        });
      }
    } catch {
      /* ignore malformed storage */
    }
    try {
      const rawKit = localStorage.getItem(KIT_KEY);
      if (rawKit) setKitState({ ...DEFAULT_BRAND_KIT, ...JSON.parse(rawKit) });
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  const updateKit = useCallback((patch: Partial<BrandKit>) => {
    setKitState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KIT_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in-memory only */
      }
      return next;
    });
  }, []);

  const resetKit = useCallback(() => {
    setKitState(DEFAULT_BRAND_KIT);
    try {
      localStorage.removeItem(KIT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setBrand = useCallback((next: BrandGuidelines) => {
    setBrandState(next);
    persist(next);
  }, []);

  const updateBrand = useCallback((patch: Partial<BrandGuidelines>) => {
    setBrandState((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const clearBrand = useCallback(() => {
    setBrandState(EMPTY);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <BrandContext.Provider
      value={{ brand, kit, hydrated, hasGuidelines: isMeaningful(brand), setBrand, updateBrand, clearBrand, updateKit, resetKit }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within a <BrandProvider>');
  return ctx;
}
