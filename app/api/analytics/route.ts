import { NextResponse } from 'next/server';
import { buildAnalytics } from '@/lib/analytics';

export const runtime = 'nodejs';

// GET /api/analytics — engagement analytics per topic/platform, joined to each
// topic's initial GDELT Opportunity Score to produce a Signal Accuracy Rating.
export async function GET() {
  try {
    const summary = await buildAnalytics();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to build analytics.' },
      { status: 500 }
    );
  }
}
