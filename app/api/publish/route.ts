import { NextResponse } from 'next/server';
import { extractCreatedPostIds, sendToZernio } from '@/lib/zernio';
import { recordPostTag } from '@/lib/postTagStore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      accountIds,
      content,
      mediaUrls,
      scheduledAt,
      firstComment,
      // Signal provenance (for analytics): the topic + its initial GDELT score.
      topic,
      opportunityScore,
      platform,
    } = body;

    if (!accountIds || accountIds.length === 0 || !content) {
      return NextResponse.json(
        { error: 'accountIds and content are required fields.' },
        { status: 400 }
      );
    }

    // Validate scheduledAt: must be a well-formed ISO-8601 timestamp in the future.
    // A null/undefined value means "publish immediately" and is allowed.
    let normalizedScheduledAt: string | undefined;
    if (scheduledAt !== undefined && scheduledAt !== null) {
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        return NextResponse.json(
          { error: 'scheduledAt must be a valid ISO-8601 timestamp.' },
          { status: 400 }
        );
      }
      if (when.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'scheduledAt must be a future time.' },
          { status: 400 }
        );
      }
      // Re-serialize to a canonical UTC ISO string before handing off to Zernio.
      normalizedScheduledAt = when.toISOString();
    }

    const result = await sendToZernio({
      accountIds,
      content,
      mediaUrls,
      scheduledAt: normalizedScheduledAt,
      firstComment,
    });

    // Tag each created post with its signal provenance so Analytics can join
    // real engagement back to the topic's initial Opportunity Score.
    if (topic && typeof opportunityScore === 'number') {
      const now = new Date().toISOString();
      await Promise.all(
        extractCreatedPostIds(result).map((postId) =>
          recordPostTag({ postId, topic, opportunityScore, platform, createdAt: now })
        )
      );
    }

    return NextResponse.json({
      success: true,
      scheduled: Boolean(normalizedScheduledAt),
      scheduledAt: normalizedScheduledAt ?? null,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to publish via Zernio.' },
      { status: 500 }
    );
  }
}
