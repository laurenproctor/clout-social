import { MOCK_SIGNALS } from '@/lib/mockSignals';

export const SAVED_KEY = 'clout.savedSignalIds';

// Legacy dev bookmarks stored the curated signals by their old numeric ids
// ('1'..'6', in curated order). Map those to today's stable slug ids so existing
// saved signals survive the switch to topic-derived ids. Idempotent: slug ids
// already present pass through untouched.
const LEGACY_ID_MAP: Record<string, string> = Object.fromEntries(
  MOCK_SIGNALS.map((s, i) => [String(i + 1), s.id])
);

/**
 * Read saved signal ids from localStorage, migrating any legacy numeric ids in
 * place and persisting the result once. Returns [] on the server or bad data.
 */
export function loadSavedIds(): string[] {
  if (typeof window === 'undefined') return [];

  let raw: unknown;
  try {
    const stored = localStorage.getItem(SAVED_KEY);
    raw = stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  let changed = false;
  const migrated: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string') {
      changed = true;
      continue;
    }
    const next = LEGACY_ID_MAP[id] ?? id;
    if (next !== id) changed = true;
    if (migrated.includes(next)) {
      changed = true; // drop a duplicate (e.g. both old and new id were saved)
    } else {
      migrated.push(next);
    }
  }

  if (changed) {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(migrated));
    } catch {
      /* ignore */
    }
  }
  return migrated;
}
