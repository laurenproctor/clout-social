import { SocialPlatform } from '@/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export interface PostTag {
  postId: string;
  topic: string;
  opportunityScore: number; // the signal's initial GDELT Opportunity Score
  platform?: SocialPlatform;
  createdAt: string; // ISO-8601
}

/**
 * Provenance map recorded at publish time: which Zernio post came from which
 * trend signal (topic + initial Opportunity Score). Analytics joins engagement
 * back to these tags to compute the Signal Accuracy Rating on real data.
 *
 * Durable via Supabase (table `post_tags`) when configured, so the publish and
 * analytics routes share one source of truth across serverless instances.
 * Falls back to an in-memory map (per-process) for local dev / when Supabase
 * isn't configured.
 */
const TABLE = 'post_tags';

const globalStore = globalThis as unknown as { __cloutPostTags?: Map<string, PostTag> };
const mem: Map<string, PostTag> = globalStore.__cloutPostTags ?? new Map();
globalStore.__cloutPostTags = mem;

function fromRow(row: any): PostTag {
  return {
    postId: row.post_id,
    topic: row.topic,
    opportunityScore: row.opportunity_score,
    platform: row.platform ?? undefined,
    createdAt: row.created_at,
  };
}

export async function recordPostTag(tag: PostTag): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await getSupabase().from(TABLE).upsert({
        post_id: tag.postId,
        topic: tag.topic,
        opportunity_score: tag.opportunityScore,
        platform: tag.platform ?? null,
        created_at: tag.createdAt,
      });
      if (error) throw error;
      return;
    } catch (e) {
      console.warn('[postTagStore] Supabase upsert failed, using memory:', (e as Error).message);
    }
  }
  mem.set(tag.postId, tag);
}

export async function getPostTag(postId: string): Promise<PostTag | undefined> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabase().from(TABLE).select('*').eq('post_id', postId).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data) : undefined;
    } catch (e) {
      console.warn('[postTagStore] Supabase read failed, using memory:', (e as Error).message);
    }
  }
  return mem.get(postId);
}

/** Newest-first list of all tagged (published) posts. */
export async function getPostTags(): Promise<PostTag[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabase()
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(fromRow);
    } catch (e) {
      console.warn('[postTagStore] Supabase list failed, using memory:', (e as Error).message);
    }
  }
  return [...mem.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
