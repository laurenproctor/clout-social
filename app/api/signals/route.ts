import { NextResponse } from 'next/server';
import { buildEnrichedDefaults, buildLiveSignals } from '@/lib/signals';
import { MOCK_SIGNALS } from '@/lib/mockSignals';

export const runtime = 'nodejs';

// GET /api/signals?q=<keyword>
//  - with q: live GDELT signals for the keyword + related facets
//  - without q: the curated topics enriched with live GDELT metrics
// Degrades to the curated mock set if signal building throws unexpectedly.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  try {
    const { signals, live } = q ? await buildLiveSignals(q) : await buildEnrichedDefaults();
    return NextResponse.json({
      signals,
      keyword: q || null,
      // 'gdelt' only when GDELT actually responded; 'fallback' when every
      // topic used the offline default (e.g. GDELT unreachable / rate-limited).
      source: live ? 'gdelt' : 'fallback',
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    // fetchGdeltSignal already falls back internally, so this is a last resort.
    return NextResponse.json({
      signals: MOCK_SIGNALS,
      keyword: q || null,
      source: 'mock',
      error: err.message || 'Signal service degraded — showing curated topics.',
      generatedAt: new Date().toISOString(),
    });
  }
}
