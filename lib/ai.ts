import Anthropic from '@anthropic-ai/sdk';
import { BrandGuidelines, DripCampaign, DripPost, DripStage } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Current default model (see project AI guidelines). The installed SDK passes
// the model id straight through, so a newer id works regardless of SDK version.
const MODEL = 'claude-opus-4-8';

interface StageMeta {
  stage: DripStage;
  label: string;
  brief: string;
}

// The 3-part drip sequence, released as the authority window closes.
const STAGES: StageMeta[] = [
  {
    stage: 'breaking',
    label: 'Breaking Analysis',
    brief:
      'Immediate breaking analysis / hot take. A punchy, timely reaction that stakes a clear position on the trend right now.',
  },
  {
    stage: 'deepdive',
    label: 'Deep-Dive Framework',
    brief:
      'Deep-dive framework and strategic breakdown. Give the reader a mental model, framework, or structured analysis of why this matters.',
  },
  {
    stage: 'playbook',
    label: 'Playbook & Steps',
    brief:
      'Playbook with practical, actionable steps the reader can execute before the authority window closes.',
  },
];

const BASE_SYSTEM =
  'You are an elite B2B social media strategist and copywriter. You craft platform-native hooks and scripts that build authority and drive engagement.';

/** Trim brand fields, dropping empties; returns null when nothing usable is set. */
function normalizeBrand(brand?: BrandGuidelines | null): BrandGuidelines | null {
  if (!brand || typeof brand !== 'object') return null;
  const tone = typeof brand.tone === 'string' ? brand.tone.trim() : '';
  const targetPersona = typeof brand.targetPersona === 'string' ? brand.targetPersona.trim() : '';
  const ctaFormat = typeof brand.ctaFormat === 'string' ? brand.ctaFormat.trim() : '';
  const forbiddenWords = Array.isArray(brand.forbiddenWords)
    ? brand.forbiddenWords.map((w) => String(w).trim()).filter(Boolean)
    : [];
  if (!tone && !targetPersona && !ctaFormat && forbiddenWords.length === 0) return null;
  return { tone, targetPersona, ctaFormat, forbiddenWords };
}

/**
 * Compose the Claude system prompt, injecting brand guidelines when provided so
 * every hook and script honors the brand's voice, persona, CTA, and word bans.
 */
export function buildBrandSystemPrompt(brand?: BrandGuidelines | null): string {
  const b = normalizeBrand(brand);
  if (!b) return BASE_SYSTEM;

  const lines: string[] = [];
  if (b.tone) {
    lines.push(`- Brand voice & tone: ${b.tone}. Write every hook and script in this exact voice.`);
  }
  if (b.targetPersona) {
    lines.push(
      `- Target persona: ${b.targetPersona}. Speak directly to this reader's priorities, context, and vocabulary.`
    );
  }
  if (b.ctaFormat) {
    lines.push(`- Preferred CTA format: ${b.ctaFormat}. Every post's call-to-action must follow this format.`);
  }
  if (b.forbiddenWords && b.forbiddenWords.length > 0) {
    lines.push(
      `- Forbidden words/phrases — NEVER use any of these, or obvious variants: ${b.forbiddenWords
        .map((w) => `"${w}"`)
        .join(', ')}. If one would naturally fit, rephrase to avoid it.`
    );
  }

  return `${BASE_SYSTEM}

BRAND GUIDELINES (strictly follow for all output):
${lines.join('\n')}`;
}

/** Parse an authority-window label like "4-7 days" into {min, max} day counts. */
function parseAuthorityWindow(label: string): { min: number; max: number } {
  const nums = (label || '').match(/\d+/g)?.map(Number) ?? [];
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: 5, max: 9 }; // sensible default when the metric is missing
}

/**
 * Deterministically derive the recommended schedule offset (in days) for each
 * of the 3 posts from the authority window. Targets the Day 0 / Day 2-3 /
 * Day 5-7 cadence, but compresses so the final "playbook" post always lands
 * BEFORE the window closes (windowMax). Guaranteed strictly increasing.
 */
function computeOffsets(windowMax: number): [number, number, number] {
  const close = Math.max(2, windowMax); // window closes at windowMax days

  const post1 = 0; // Day 0 — breaking
  // Deep dive: aim for Day 2-3, but never past the window.
  const post2 = Math.min(3, Math.max(2, Math.floor(close / 2)));
  // Playbook: target the Day 5-7 range, but always fire BEFORE the window
  // closes (close - 1), and cap at day 7 for long windows.
  let post3 = Math.min(7, close - 1);
  if (post3 <= post2) post3 = post2 + 1; // keep the cadence monotonic on short windows

  return [post1, post2, post3];
}

/** Pull the first JSON object out of a model response (tolerates code fences / prose). */
function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model output');
  return JSON.parse(raw.slice(start, end + 1));
}

/** A fully offline / no-key fallback campaign so the workflow never dead-ends. */
function fallbackCampaign(
  topic: string,
  platform: string,
  authorityWindowDays: string,
  offsets: [number, number, number]
): DripCampaign {
  const tag = `#${topic.replace(/\s+/g, '')}`;
  const posts: DripPost[] = STAGES.map((meta, i) => ({
    stage: meta.stage,
    stageLabel: meta.label,
    order: i + 1,
    recommendedScheduleOffsetDays: offsets[i],
    hook:
      i === 0
        ? `${topic} is moving fast — here's the take most teams are missing.`
        : i === 1
          ? `A simple framework for making sense of ${topic}.`
          : `Your ${topic} action plan: do these 3 things this week.`,
    draft:
      i === 0
        ? `Breaking: ${topic} is reshaping the ${platform} conversation. Here's what actually matters for marketing teams today...`
        : i === 1
          ? `Let's go deeper on ${topic}. Here is the framework I use to separate signal from noise...`
          : `Enough theory on ${topic} — here is the practical playbook to capture the opportunity before the window closes...`,
    hashtags: `${tag} #MarketingStrategy #ContentStrategy`,
  }));

  return { topic, platform, authorityWindowDays, posts };
}

/**
 * Generate a 3-part scheduled drip campaign for a trend signal. The content is
 * AI-generated; the `recommendedScheduleOffsetDays` for each post are derived
 * deterministically from the signal's authorityWindowDays so all 3 can be
 * queued into Zernio in one click.
 */
export async function generateDripCampaign(
  topic: string,
  platform: string,
  sentimentTone: number,
  authorityWindowDays: string,
  brand?: BrandGuidelines | null
): Promise<DripCampaign> {
  const { max } = parseAuthorityWindow(authorityWindowDays);
  const offsets = computeOffsets(max);

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackCampaign(topic, platform, authorityWindowDays, offsets);
  }

  const stageInstructions = STAGES.map(
    (m, i) => `${i + 1}. stage "${m.stage}" — scheduled Day ${offsets[i]}: ${m.brief}`
  ).join('\n');

  const prompt = `Build a 3-part "drip campaign" for ${platform}.

Topic: "${topic}"
GDELT Sentiment Tone: ${sentimentTone} (-10 is extremely negative, +10 is extremely positive).
Authority Window: ${authorityWindowDays} — the window of opportunity before this trend saturates.

Create THREE sequentially released posts that compound authority as the window closes:
${stageInstructions}

Each post must be optimized for ${platform} best practices and length limits, should reference the sentiment where relevant, and must strictly follow the brand guidelines in your system instructions.

Respond with ONLY valid JSON (no markdown, no commentary) in exactly this shape:
{"posts":[{"stage":"breaking","hook":"...","draft":"...","hashtags":"#a #b #c"},{"stage":"deepdive","hook":"...","draft":"...","hashtags":"#a #b #c"},{"stage":"playbook","hook":"...","draft":"...","hashtags":"#a #b #c"}]}`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: buildBrandSystemPrompt(brand),
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    const parsed = extractJson(text);
    const modelPosts: any[] = Array.isArray(parsed?.posts) ? parsed.posts : [];

    // Assemble in canonical stage order, attaching the deterministic offsets.
    const posts: DripPost[] = STAGES.map((meta, i) => {
      const match = modelPosts.find((p) => p?.stage === meta.stage) ?? modelPosts[i] ?? {};
      return {
        stage: meta.stage,
        stageLabel: meta.label,
        order: i + 1,
        recommendedScheduleOffsetDays: offsets[i],
        hook: String(match.hook || '').trim() || `${topic} — the ${meta.label.toLowerCase()}.`,
        draft:
          String(match.draft || '').trim() ||
          `Here is the ${meta.label.toLowerCase()} on ${topic} for ${platform}...`,
        hashtags:
          String(match.hashtags || '').trim() ||
          `#${topic.replace(/\s+/g, '')} #MarketingStrategy`,
      };
    });

    return { topic, platform, authorityWindowDays, posts };
  } catch {
    return fallbackCampaign(topic, platform, authorityWindowDays, offsets);
  }
}
