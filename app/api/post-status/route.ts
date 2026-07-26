import { NextResponse } from 'next/server';
import { getPostStatuses } from '@/lib/postStatusStore';

// GET /api/post-status — webhook-driven status updates for the queue UI to
// overlay onto rows and to surface "Needs Re-authorization" alerts.
export async function GET() {
  const statuses = await getPostStatuses();
  const needsReauth = statuses.filter((s) => s.needsReauth);
  return NextResponse.json({ statuses, needsReauth });
}
