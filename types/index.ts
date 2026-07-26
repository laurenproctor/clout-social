export type LifecycleStage = 'emerging' | 'rising' | 'peaking' | 'declining';

export type SocialPlatform = 'linkedin' | 'twitter' | 'tiktok' | 'instagram' | 'youtube' | 'blog';

export interface ChannelPredictions {
  linkedin: number;
  blog: number;
  tiktok: number;
  instagram: number;
  youtube: number;
}

export interface StrategicWhy {
  moves: string;
  matters: string;
  whitespace: string;
}

export interface SignalItem {
  id: string;
  topic: string;
  volumeShare: number; // 0 - 100
  sentimentTone: number; // -10.0 to +10.0
  lifecycle: LifecycleStage;
  opportunityScore: number; // 0 - 100
  authorityWindowDays: string; // e.g. "5-9 days"
  confidenceRating: number; // percentage e.g. 82
  predictions: ChannelPredictions;
  strategicWhy: StrategicWhy;
  strongestAngles: string[];
}

export interface BrandGuidelines {
  /** Brand voice/tone, e.g. "Architectural Minimalist", "Direct & Authoritative". */
  tone?: string;
  /** Words/phrases the brand must never use. */
  forbiddenWords?: string[];
  /** Target reader, e.g. "VP of Marketing at a Series B SaaS". */
  targetPersona?: string;
  /** Preferred call-to-action format, e.g. "End with one sharp question". */
  ctaFormat?: string;
}

export type DripStage = 'breaking' | 'deepdive' | 'playbook';

export interface DripPost {
  stage: DripStage;
  stageLabel: string; // e.g. "Breaking Analysis"
  order: number; // 1, 2, 3
  /** Days after "now" this post should be scheduled — feeds Zernio scheduledAt. */
  recommendedScheduleOffsetDays: number;
  hook: string;
  draft: string;
  hashtags: string;
}

export interface DripCampaign {
  topic: string;
  platform: string;
  authorityWindowDays: string; // echoed source metric, e.g. "4-7 days"
  posts: DripPost[]; // always 3, ordered Day 0 → Deep Dive → Playbook
}

export interface PostAnalytics {
  postId: string;
  impressions: number;
  clicks: number;
  shares: number;
  engagementRate: number; // percentage, e.g. 4.2
}

export interface TopicAnalytics {
  topic: string;
  platform: SocialPlatform;
  opportunityScore: number; // initial GDELT Opportunity Score (0-100)
  impressions: number;
  clicks: number;
  shares: number;
  engagementRate: number; // percentage
  engagementIndex: number; // engagement normalized to 0-100
  signalAccuracy: number; // 0-100 — how well the score predicted actual engagement
}

export interface PlatformLeaderboard {
  platform: SocialPlatform;
  rows: TopicAnalytics[]; // this platform's topics, best engagement first
}

export interface AnalyticsSummary {
  source: 'zernio' | 'sample';
  generatedAt: string;
  livePostsFound: number;
  totals: { impressions: number; clicks: number; shares: number };
  overallSignalAccuracy: number; // 0-100 average across topic/platform rows
  topics: TopicAnalytics[]; // all rows
  leaderboards: PlatformLeaderboard[];
}

export interface ZernioAccount {
  id: string;
  platform: SocialPlatform;
  handle: string; // @handle or account name
  displayName?: string;
  avatarUrl?: string;
  connected: boolean;
}

export type ScheduledPostStatus =
  | 'scheduled'
  | 'processing'
  | 'published'
  | 'failed'
  | 'canceled';

export interface ScheduledPost {
  id: string;
  content: string;
  accountIds: string[];
  platforms: SocialPlatform[]; // derived from accountIds / Zernio metadata
  scheduledAt: string; // ISO-8601 UTC
  status: ScheduledPostStatus;
  createdAt?: string; // ISO-8601 UTC
}

export interface ZernioPostPayload {
  accountIds: string[];
  content: string;
  mediaUrls?: string[];
  scheduledAt?: string; // ISO String
  firstComment?: string;
}
