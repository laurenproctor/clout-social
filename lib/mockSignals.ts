import { SignalItem } from '@/types';
import { slug } from '@/lib/slug';

// Curated topics without ids — the id is derived from the topic below so it
// stays identical to what buildSignal() produces for the same topic.
// Curated topics chosen for strong GDELT news coverage AND brand/creator
// relevance, so the daily BigQuery refresh overlays each with real live volume
// + sentiment. The metrics below are realistic seeds used as the fallback when
// the live refresh is unavailable; narrative fields stay curated year-round.
const CURATED: Omit<SignalItem, 'id'>[] = [
  {
    topic: 'Artificial Intelligence',
    volumeShare: 77,
    sentimentTone: 0.6,
    lifecycle: 'rising',
    opportunityScore: 48,
    authorityWindowDays: '5-9 days',
    confidenceRating: 83,
    predictions: { linkedin: 88, blog: 90, tiktok: 70, instagram: 62, youtube: 80 },
    strategicWhy: {
      moves: 'Generative AI is moving from novelty to infrastructure across every marketing and content workflow.',
      matters: 'Brands that operationalize AI now set the cost and speed baseline competitors get measured against.',
      whitespace: 'Few brands publish an honest point of view on where AI helps versus where human judgment still wins.'
    },
    strongestAngles: [
      'The AI workflows quietly reshaping marketing team headcount',
      "Where AI content still fails — and why that's your opening",
      'A 2026 AI adoption playbook for lean brand teams'
    ]
  },
  {
    topic: 'Advertising',
    volumeShare: 81,
    sentimentTone: -1.3,
    lifecycle: 'peaking',
    opportunityScore: 52,
    authorityWindowDays: '2-4 days',
    confidenceRating: 84,
    predictions: { linkedin: 86, blog: 84, tiktok: 58, instagram: 60, youtube: 68 },
    strategicWhy: {
      moves: 'Ad budgets are consolidating into fewer, measurable channels as economic pressure tightens spend.',
      matters: 'Every wasted impression is now scrutinized; efficiency has become the creative brief.',
      whitespace: 'Little practical guidance exists on proving incremental lift without a big data-science team.'
    },
    strongestAngles: [
      "Why 'brand vs. performance' is the wrong 2026 debate",
      'Cutting ad waste without cutting reach',
      'The efficiency metrics CFOs actually trust now'
    ]
  },
  {
    topic: 'Sustainability',
    volumeShare: 82,
    sentimentTone: 1.1,
    lifecycle: 'peaking',
    opportunityScore: 52,
    authorityWindowDays: '2-4 days',
    confidenceRating: 85,
    predictions: { linkedin: 82, blog: 85, tiktok: 66, instagram: 74, youtube: 72 },
    strategicWhy: {
      moves: 'Sustainability claims are shifting from marketing garnish to regulated, auditable disclosure.',
      matters: 'Greenwashing is now a legal and reputational liability, not just a PR risk.',
      whitespace: 'Few brands show the receipts — verifiable impact data told as a story audiences believe.'
    },
    strongestAngles: [
      'From green claims to green proof: the disclosure shift',
      'How to talk sustainability without triggering skeptics',
      'Turning ESG data into content people actually share'
    ]
  },
  {
    topic: 'Social Media',
    volumeShare: 64,
    sentimentTone: -0.9,
    lifecycle: 'rising',
    opportunityScore: 40,
    authorityWindowDays: '5-9 days',
    confidenceRating: 79,
    predictions: { linkedin: 80, blog: 78, tiktok: 84, instagram: 82, youtube: 79 },
    strategicWhy: {
      moves: 'Platform algorithms increasingly reward native, interest-based content over follower-based reach.',
      matters: 'Audience graphs matter less than content quality — anyone can go viral, anyone can vanish.',
      whitespace: 'Brands rarely document a repeatable system built for the interest-graph era.'
    },
    strongestAngles: [
      'Why your follower count stopped mattering',
      'Building for the interest graph, not the social graph',
      'A posting system that survives algorithm changes'
    ]
  },
  {
    topic: 'TikTok',
    volumeShare: 50,
    sentimentTone: -0.9,
    lifecycle: 'emerging',
    opportunityScore: 31,
    authorityWindowDays: '6-10 days',
    confidenceRating: 75,
    predictions: { linkedin: 70, blog: 66, tiktok: 94, instagram: 88, youtube: 82 },
    strategicWhy: {
      moves: "TikTok's regulatory uncertainty is pushing brands to diversify while its commerce engine accelerates.",
      matters: 'Concentrating creator spend on a single platform is now a strategic risk worth hedging.',
      whitespace: 'Few brands share a concrete multi-platform contingency and repurposing workflow.'
    },
    strongestAngles: [
      'Your TikTok contingency plan (before you need it)',
      'Repurposing short-form across 4 platforms without burning out',
      'What TikTok Shop teaches every brand about social commerce'
    ]
  },
  {
    topic: 'Streaming',
    volumeShare: 56,
    sentimentTone: 0.8,
    lifecycle: 'emerging',
    opportunityScore: 35,
    authorityWindowDays: '6-10 days',
    confidenceRating: 77,
    predictions: { linkedin: 74, blog: 72, tiktok: 76, instagram: 78, youtube: 90 },
    strategicWhy: {
      moves: 'Ad-supported streaming tiers are opening premium video inventory to mid-market brands.',
      matters: 'TV-quality reach is now buyable and measurable without TV-scale budgets.',
      whitespace: 'Creative specs and measurement for connected TV remain poorly documented for smaller teams.'
    },
    strongestAngles: [
      "CTV advertising is finally affordable — here's the entry point",
      'Creative that works on the living-room screen',
      'Measuring streaming ad lift on a startup budget'
    ]
  }
];

export const MOCK_SIGNALS: SignalItem[] = CURATED.map((signal) => ({
  id: slug(signal.topic),
  ...signal,
}));
