/**
 * Stable, topic-derived id used to key every SignalItem.
 *
 * The same topic must always produce the same id no matter which path built the
 * signal — curated defaults, GDELT-enriched defaults, or a live keyword rebuild —
 * so saved bookmarks and ?signal=<id> deep links resolve across all of them.
 */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
