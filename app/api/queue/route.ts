import { NextResponse } from 'next/server';
import {
  listScheduledPosts,
  reschedulePost,
  cancelScheduledPost,
} from '@/lib/zernio';

// GET /api/queue — list scheduled / in-flight posts from Zernio.
// Returns 200 with { posts, error } even on upstream failure so the queue UI
// can render an empty/error state instead of crashing.
export async function GET() {
  try {
    const posts = await listScheduledPosts();
    return NextResponse.json({ posts });
  } catch (err: any) {
    return NextResponse.json(
      { posts: [], error: err.message || 'Failed to load the Zernio queue.' },
      { status: 200 }
    );
  }
}

// PATCH /api/queue — reschedule a post. Body: { id, scheduledAt (ISO) }.
export async function PATCH(req: Request) {
  try {
    const { id, scheduledAt } = await req.json();

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'A post id is required.' }, { status: 400 });
    }
    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required.' }, { status: 400 });
    }

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

    const result = await reschedulePost(id, when.toISOString());
    return NextResponse.json({ success: true, scheduledAt: when.toISOString(), data: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to reschedule via Zernio.' },
      { status: 500 }
    );
  }
}

// DELETE /api/queue?id=... (or body { id }) — cancel a scheduled post.
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get('id') || '';
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body?.id || '';
    }
    if (!id) {
      return NextResponse.json({ error: 'A post id is required.' }, { status: 400 });
    }

    const result = await cancelScheduledPost(id);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to cancel via Zernio.' },
      { status: 500 }
    );
  }
}
