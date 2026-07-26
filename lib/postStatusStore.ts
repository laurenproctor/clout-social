import { ScheduledPostStatus } from '@/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export interface PostStatusUpdate {
  postId: string;
  status: ScheduledPostStatus;
  platform?: string;
  error?: string;
  needsReauth?: boolean;
  updatedAt: string; // ISO-8601
}

/**
 * Webhook-driven post status updates.
 *
 * Durable via Supabase (table `post_status`) when configured, so the webhook
 * receiver and the queue UI's status endpoint share state across serverless
 * instances. Falls back to an in-memory map for local dev / when Supabase
 * isn't configured.
 */
const TABLE = 'post_status';

const globalStore = globalThis as unknown as { __cloutPostStatus?: Map<string, PostStatusUpdate> };
const mem: Map<string, PostStatusUpdate> = globalStore.__cloutPostStatus ?? new Map();
globalStore.__cloutPostStatus = mem;

function fromRow(row: any): PostStatusUpdate {
  return {
    postId: row.post_id,
    status: row.status,
    platform: row.platform ?? undefined,
    error: row.error ?? undefined,
    needsReauth: row.needs_reauth ?? false,
    updatedAt: row.updated_at,
  };
}

export async function recordPostStatus(update: PostStatusUpdate): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await getSupabase().from(TABLE).upsert({
        post_id: update.postId,
        status: update.status,
        platform: update.platform ?? null,
        error: update.error ?? null,
        needs_reauth: Boolean(update.needsReauth),
        updated_at: update.updatedAt,
      });
      if (error) throw error;
      return;
    } catch (e) {
      console.warn('[postStatusStore] Supabase upsert failed, using memory:', (e as Error).message);
    }
  }
  mem.set(update.postId, update);
}

export async function getPostStatus(postId: string): Promise<PostStatusUpdate | undefined> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabase().from(TABLE).select('*').eq('post_id', postId).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data) : undefined;
    } catch (e) {
      console.warn('[postStatusStore] Supabase read failed, using memory:', (e as Error).message);
    }
  }
  return mem.get(postId);
}

/** Newest-first list of all recorded status updates. */
export async function getPostStatuses(): Promise<PostStatusUpdate[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabase()
        .from(TABLE)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(fromRow);
    } catch (e) {
      console.warn('[postStatusStore] Supabase list failed, using memory:', (e as Error).message);
    }
  }
  return [...mem.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
