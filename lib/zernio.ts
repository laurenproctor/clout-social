import {
  PostAnalytics,
  ScheduledPost,
  ScheduledPostStatus,
  SocialPlatform,
  ZernioAccount,
  ZernioPostPayload,
} from '@/types';
import { fetchWithRetry } from '@/lib/http';

const ZERNIO_API_URL = 'https://zernio.com/api/v1';

function authHeaders() {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error('ZERNIO_API_KEY environment variable is missing.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

const VALID_STATUSES: ScheduledPostStatus[] = [
  'scheduled',
  'processing',
  'published',
  'failed',
  'canceled',
];

/** Normalize a platform/network string from Zernio into our SocialPlatform union. */
function normalizePlatform(value: string): SocialPlatform | null {
  const v = (value || '').toLowerCase();
  if (v === 'x' || v.includes('twitter')) return 'twitter';
  if (v.includes('linkedin')) return 'linkedin';
  if (v.includes('tiktok')) return 'tiktok';
  if (v.includes('instagram') || v.includes('insta')) return 'instagram';
  if (v.includes('youtube') || v === 'yt') return 'youtube';
  if (v.includes('blog')) return 'blog';
  return null;
}

/** Best-effort mapping of a Zernio account id / handle to a platform. */
function platformFromAccount(account: string): SocialPlatform | null {
  const a = account.toLowerCase();
  if (a.includes('linkedin')) return 'linkedin';
  if (a.includes('tiktok')) return 'tiktok';
  if (a.includes('instagram') || a.includes('insta')) return 'instagram';
  if (a.includes('youtube') || a.includes('yt')) return 'youtube';
  if (a.includes('blog')) return 'blog';
  if (a.includes('twitter') || a.includes('x_')) return 'twitter';
  return null;
}

/**
 * Normalize a raw Zernio post object into our ScheduledPost shape. Zernio's
 * exact field names aren't formally documented here, so this tolerates the
 * common variants (id/postId, scheduledAt/scheduled_at, accountIds/accounts).
 */
function normalizeZernioPost(raw: any): ScheduledPost {
  const accountIds: string[] = Array.isArray(raw?.accountIds)
    ? raw.accountIds
    : Array.isArray(raw?.accounts)
      ? raw.accounts.map((a: any) => (typeof a === 'string' ? a : a?.id ?? '')).filter(Boolean)
      : [];

  const explicitPlatforms: SocialPlatform[] = Array.isArray(raw?.platforms) ? raw.platforms : [];
  const derived = accountIds
    .map(platformFromAccount)
    .filter((p): p is SocialPlatform => p !== null);
  const platforms = Array.from(new Set([...explicitPlatforms, ...derived]));

  const rawStatus = String(raw?.status ?? 'scheduled').toLowerCase();
  const status: ScheduledPostStatus = VALID_STATUSES.includes(rawStatus as ScheduledPostStatus)
    ? (rawStatus as ScheduledPostStatus)
    : 'scheduled';

  return {
    id: String(raw?.id ?? raw?.postId ?? raw?._id ?? ''),
    content: String(raw?.content ?? raw?.text ?? ''),
    accountIds,
    platforms,
    scheduledAt: String(raw?.scheduledAt ?? raw?.scheduled_at ?? ''),
    status,
    createdAt: raw?.createdAt ?? raw?.created_at ?? undefined,
  };
}

export async function sendToZernio(payload: ZernioPostPayload) {
  const apiKey = process.env.ZERNIO_API_KEY;

  if (!apiKey) {
    throw new Error('ZERNIO_API_KEY environment variable is missing.');
  }

  // Creating a post is NOT idempotent — only retry on 429 (request was rejected,
  // so a retry is safe). Do not retry 5xx/network errors here, which could
  // publish the same post twice.
  const response = await fetchWithRetry(
    `${ZERNIO_API_URL}/posts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        accountIds: payload.accountIds,
        content: payload.content,
        mediaUrls: payload.mediaUrls || [],
        scheduledAt: payload.scheduledAt || null,
        firstComment: payload.firstComment || '',
      }),
    },
    { retryOn5xx: false, retryOnNetworkError: false }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Zernio API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Extract created post id(s) from a Zernio publish response. Tolerates the
 * common shapes: {id}, {postId}, {post:{id}}, {posts:[{id}]}, {data:[{id}]}, or
 * a bare array. Zernio may create one post per account, hence the array return.
 */
export function extractCreatedPostIds(response: any): string[] {
  const ids: string[] = [];
  const push = (v: any) => {
    const id = typeof v === 'string' ? v : v?.id ?? v?.postId ?? v?._id;
    if (id) ids.push(String(id));
  };
  if (!response) return ids;
  if (Array.isArray(response)) response.forEach(push);
  else if (Array.isArray(response.posts)) response.posts.forEach(push);
  else if (Array.isArray(response.data)) response.data.forEach(push);
  else if (response.post) push(response.post);
  else push(response);
  return Array.from(new Set(ids.filter(Boolean)));
}

/**
 * List scheduled / in-flight posts from Zernio.
 * Assumed contract: GET /posts?status=scheduled,processing,published
 * (adjust the path/params here if the Zernio account uses a different shape).
 */
export async function listConnectedAccounts(): Promise<ZernioAccount[]> {
  const res = await fetchWithRetry(`${ZERNIO_API_URL}/accounts`, {
    headers: authHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Zernio accounts fetch failed: ${res.status}`);
  }

  const data = await res.json().catch(() => ({}));
  const rawList: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.accounts)
      ? data.accounts
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return rawList
    .map(normalizeAccount)
    .filter((a): a is ZernioAccount => a !== null);
}

/** Normalize a raw Zernio account object into our ZernioAccount shape. */
function normalizeAccount(raw: any): ZernioAccount | null {
  const id = String(raw?.id ?? raw?.accountId ?? raw?._id ?? '');
  if (!id) return null;

  const platform =
    normalizePlatform(String(raw?.platform ?? raw?.network ?? raw?.provider ?? '')) ??
    platformFromAccount(id);
  if (!platform) return null;

  const handle = String(
    raw?.handle ?? raw?.username ?? raw?.screenName ?? raw?.name ?? raw?.displayName ?? id
  );

  return {
    id,
    platform,
    handle,
    displayName: raw?.displayName ?? raw?.name ?? undefined,
    avatarUrl: raw?.avatarUrl ?? raw?.avatar ?? raw?.profileImageUrl ?? undefined,
    connected: raw?.connected !== false && raw?.status !== 'disconnected',
  };
}

export async function listScheduledPosts(): Promise<ScheduledPost[]> {
  const res = await fetchWithRetry(
    `${ZERNIO_API_URL}/posts?status=scheduled,processing,published`,
    { headers: authHeaders(), cache: 'no-store' }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Zernio list failed: ${res.status}`);
  }

  const data = await res.json().catch(() => ({}));
  // Tolerate {posts:[...]} , {data:[...]} , or a bare array.
  const rawList: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.posts)
      ? data.posts
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return rawList
    .map(normalizeZernioPost)
    .filter((p) => p.id)
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
}

/**
 * Fetch engagement analytics for a published post.
 * Contract: GET /posts/:id/analytics → { impressions, clicks, shares, engagementRate }.
 */
export async function getPostAnalytics(id: string): Promise<PostAnalytics> {
  const res = await fetchWithRetry(`${ZERNIO_API_URL}/posts/${encodeURIComponent(id)}/analytics`, {
    headers: authHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Zernio analytics failed: ${res.status}`);
  }

  const raw = await res.json().catch(() => ({}));
  const data = raw?.analytics ?? raw?.data ?? raw ?? {};
  const impressions = Number(data.impressions ?? data.views ?? 0) || 0;
  const clicks = Number(data.clicks ?? data.linkClicks ?? 0) || 0;
  const shares = Number(data.shares ?? data.reposts ?? 0) || 0;
  const engagements = Number(data.engagements ?? clicks + shares) || clicks + shares;
  const engagementRate =
    data.engagementRate != null
      ? Number(data.engagementRate)
      : impressions > 0
        ? Number(((engagements / impressions) * 100).toFixed(2))
        : 0;

  return { postId: id, impressions, clicks, shares, engagementRate };
}

/** Reschedule a post. Assumed contract: PATCH /posts/:id { scheduledAt }. */
export async function reschedulePost(id: string, scheduledAt: string) {
  // PATCH with a fixed scheduledAt is idempotent → safe to retry on 429/5xx.
  const res = await fetchWithRetry(`${ZERNIO_API_URL}/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ scheduledAt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Zernio reschedule failed: ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

/** Cancel a scheduled post. Assumed contract: DELETE /posts/:id. */
export async function cancelScheduledPost(id: string) {
  // DELETE is idempotent → safe to retry on 429/5xx.
  const res = await fetchWithRetry(`${ZERNIO_API_URL}/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Zernio cancel failed: ${res.status}`);
  }
  return res.json().catch(() => ({}));
}
