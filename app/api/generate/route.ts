import { NextResponse } from 'next/server';
import { generateDripCampaign } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, platform, sentimentTone, authorityWindowDays, brand } = body;

    if (!topic || !platform) {
      return NextResponse.json(
        { error: 'Topic and platform are required.' },
        { status: 400 }
      );
    }

    const campaign = await generateDripCampaign(
      topic,
      platform,
      sentimentTone || 0,
      authorityWindowDays || '5-9 days',
      // Optional per-request brand guidelines (tone, forbidden words, persona, CTA).
      brand ?? null
    );

    const first = campaign.posts[0];

    return NextResponse.json({
      success: true,
      // Full 3-part drip campaign, each post carrying recommendedScheduleOffsetDays
      // so the client can queue all 3 into Zernio in one click.
      campaign,
      // Backward-compatible single-draft shape (post 1) for existing callers.
      content: {
        hook: first.hook,
        concept: first.stageLabel,
        draft: first.draft,
        hashtags: first.hashtags,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
