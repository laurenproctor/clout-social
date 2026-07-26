import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { recordPostStatus, type PostStatusUpdate } from '@/lib/postStatusStore';
import { ScheduledPostStatus } from '@/types';

export const runtime = 'nodejs';

// Zernio event type → our internal status.
const EVENT_STATUS: Record<string, ScheduledPostStatus> = {
  'post.published': 'published',
  'post.failed': 'failed',
  'post.scheduled': 'scheduled',
  'post.processing': 'processing',
};

/**
 * Verify the HMAC-SHA256 signature Zernio sends over the raw request body.
 * Assumed header: `x-zernio-signature` (hex, optionally `sha256=`-prefixed).
 * Adjust here if the Zernio workspace uses a different scheme/header.
 */
function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.replace(/^sha256=/i, '').trim();
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  let a: Buffer;
  try {
    a = Buffer.from(provided, 'hex');
  } catch {
    return false;
  }
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Heuristic: does a failure message indicate the channel needs re-authorization?
function looksLikeReauth(msg: string): boolean {
  return /token|auth|expired|revoked|reconnect|permission|credential|unauthor|disconnect/i.test(msg);
}

export async function POST(req: Request) {
  // Read the RAW body first — signature verification must run over exact bytes.
  const raw = await req.text();

  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  const signature = req.headers.get('x-zernio-signature');

  if (secret) {
    if (!verifySignature(raw, signature, secret)) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }
  } else {
    console.warn(
      '[zernio webhook] ZERNIO_WEBHOOK_SECRET not set — skipping signature verification (dev only).'
    );
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const type = String(event?.type ?? event?.event ?? '');
  const status = EVENT_STATUS[type];

  // Acknowledge unrecognized events with 200 so Zernio doesn't retry them.
  if (!status) {
    return NextResponse.json({ received: true, ignored: type || 'unknown' });
  }

  const data = event?.data ?? event?.post ?? event ?? {};
  const postId = String(data?.postId ?? data?.id ?? data?.post_id ?? '');
  if (!postId) {
    return NextResponse.json({ error: 'Webhook missing a post id.' }, { status: 400 });
  }

  const error =
    status === 'failed'
      ? String(data?.error ?? data?.message ?? data?.reason ?? 'Publishing failed.')
      : undefined;

  const update: PostStatusUpdate = {
    postId,
    status,
    platform: data?.platform ?? data?.network ?? undefined,
    error,
    needsReauth: status === 'failed' && looksLikeReauth(error ?? ''),
    updatedAt: new Date().toISOString(),
  };

  await recordPostStatus(update);

  return NextResponse.json({
    received: true,
    postId,
    status: update.status,
    needsReauth: Boolean(update.needsReauth),
  });
}
