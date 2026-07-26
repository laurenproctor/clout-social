import { SignalItem } from '@/types';
import { slug } from '@/lib/slug';

// Curated topics without ids — the id is derived from the topic below so it
// stays identical to what buildSignal() produces for the same topic.
const CURATED: Omit<SignalItem, 'id'>[] = [
  {
    topic: 'AI Search',
    volumeShare: 87,
    sentimentTone: 4.2,
    lifecycle: 'emerging',
    opportunityScore: 87,
    authorityWindowDays: '4-7 days',
    confidenceRating: 84,
    predictions: { linkedin: 85, blog: 91, tiktok: 68, instagram: 60, youtube: 82 },
    strategicWhy: {
      moves: 'AI Overviews and conversational engines are replacing standard organic queries.',
      matters: 'Brand visibility is moving from link clicks to direct AI model citation.',
      whitespace: 'Few brands publish structured answer frameworks for AI crawlers.'
    },
    strongestAngles: [
      'What AI Search changes in B2B attribution models',
      'Why website traffic metrics are lying to you in 2026',
      'A practical response plan for marketing teams'
    ]
  },
  {
    topic: 'Zero-click Search',
    volumeShare: 82,
    sentimentTone: 2.1,
    lifecycle: 'emerging',
    opportunityScore: 82,
    authorityWindowDays: '5-9 days',
    confidenceRating: 79,
    predictions: { linkedin: 74, blog: 88, tiktok: 61, instagram: 55, youtube: 76 },
    strategicWhy: {
      moves: 'Zero-click experiences expand in search as snippet answers fulfill user intent.',
      matters: 'Visibility shifts from website visits to on-platform exposure.',
      whitespace: 'Few brands publish practical frameworks for measuring zero-click impact.'
    },
    strongestAngles: [
      'What zero-click search changes in the attribution model',
      'Why visibility must be measured beyond website traffic',
      'A practical response plan for marketing teams'
    ]
  },
  {
    topic: 'Retail Media',
    volumeShare: 73,
    sentimentTone: 1.2,
    lifecycle: 'peaking',
    opportunityScore: 73,
    authorityWindowDays: '2-4 days',
    confidenceRating: 88,
    predictions: { linkedin: 79, blog: 70, tiktok: 82, instagram: 78, youtube: 74 },
    strategicWhy: {
      moves: 'First-party network ad spend peaks across retail ecosystems.',
      matters: 'Ad budget reallocation from social to retail media networks.',
      whitespace: 'Cross-network attribution frameworks remain fragmented.'
    },
    strongestAngles: [
      'The rise of Retail Media Networks beyond Amazon',
      'How B2B brands leverage retail data partnerships',
      'Unified ad measurement frameworks for 2026'
    ]
  },
  {
    topic: 'Creator AI',
    volumeShare: 64,
    sentimentTone: 3.8,
    lifecycle: 'rising',
    opportunityScore: 64,
    authorityWindowDays: '7-12 days',
    confidenceRating: 81,
    predictions: { linkedin: 72, blog: 76, tiktok: 90, instagram: 86, youtube: 88 },
    strategicWhy: {
      moves: 'AI avatar & automated studio tools reduce content production costs.',
      matters: 'Creators can scale multi-platform video without large production crews.',
      whitespace: 'Authenticity disclosure guidelines and audience trust frameworks.'
    },
    strongestAngles: [
      'How AI workflows cut video production time by 80%',
      'The line between authentic creator content and AI spam',
      'Scaling personalized video across 5 social channels'
    ]
  },
  {
    topic: 'Attribution',
    volumeShare: 71,
    sentimentTone: -1.5,
    lifecycle: 'rising',
    opportunityScore: 71,
    authorityWindowDays: '6-10 days',
    confidenceRating: 75,
    predictions: { linkedin: 88, blog: 82, tiktok: 45, instagram: 50, youtube: 65 },
    strategicWhy: {
      moves: 'Privacy changes and cookieless tracking break old multi-touch models.',
      matters: 'CMOs struggle to prove return on dark social and podcast spend.',
      whitespace: 'Hybrid marketing mix modeling (MMM) combined with self-reported attribution.'
    },
    strongestAngles: [
      'Why classic last-click attribution is completely dead',
      'Building a modern Marketing Mix Model without complex data science',
      'How to measure dark social impact'
    ]
  },
  {
    topic: 'Influencer Spend',
    volumeShare: 58,
    sentimentTone: 0.8,
    lifecycle: 'peaking',
    opportunityScore: 58,
    authorityWindowDays: '3-5 days',
    confidenceRating: 70,
    predictions: { linkedin: 65, blog: 60, tiktok: 88, instagram: 92, youtube: 80 },
    strategicWhy: {
      moves: 'Micro-creator budgets surge while mega-influencer ROI declines.',
      matters: 'Brands shift from reach metrics to engagement and conversion quality.',
      whitespace: 'Long-term creator ambassador contract frameworks.'
    },
    strongestAngles: [
      'Why micro-influencers generate 3x higher ROI than celebrities',
      'Structuring creator performance deals in 2026',
      'Measuring creator sales lift with custom promo links'
    ]
  }
];

export const MOCK_SIGNALS: SignalItem[] = CURATED.map((signal) => ({
  id: slug(signal.topic),
  ...signal,
}));
