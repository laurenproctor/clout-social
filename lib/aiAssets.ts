// Shared helpers for AI asset generation via the Vercel AI Gateway.
// Models are overridable by env so they can be tuned without a code change.

export const IMAGE_MODEL = process.env.BRAND_IMAGE_MODEL || 'openai/gpt-image-2';
export const VIDEO_MODEL = process.env.BRAND_VIDEO_MODEL || 'google/veo-3.1-fast-generate-001';

/** The gateway authenticates via an API key or a Vercel OIDC token. */
export function gatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export interface BrandAssetInput {
  topic: string;
  angle?: string;
  network: string;
  style: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

/**
 * Prompt for an abstract, on-brand BACKGROUND — deliberately text-free because
 * the headline, logo, and brand type are composited on top by the Canvas layer.
 */
export function backgroundPrompt(b: BrandAssetInput): string {
  return [
    `Abstract ${b.style} background artwork for a premium ${b.network} social graphic`,
    `about "${b.topic}".`,
    `Brand palette — primary ${b.primaryColor}, accent ${b.accentColor}, base ${b.backgroundColor}.`,
    `High-end and editorial: soft gradients, subtle geometric texture, depth, and directional lighting.`,
    `Keep the lower half calm and uncluttered so text can sit on top.`,
    `Absolutely no text, no words, no letters, no logos, and no watermarks.`,
  ].join(' ');
}

/** Prompt for a short branded motion clip tailored to the topic + brand mood. */
export function videoPrompt(b: BrandAssetInput): string {
  const focus = b.angle ? `${b.topic} — ${b.angle}` : b.topic;
  return [
    `A short, premium ${b.style} brand motion clip for ${b.network} about "${focus}".`,
    `Cinematic, smooth camera motion, abstract on-brand visuals in ${b.primaryColor} and ${b.accentColor}`,
    `over a ${b.backgroundColor} base. Modern, high-end, editorial tech aesthetic.`,
    `Leave calm negative space for a text overlay. No on-screen text or logos.`,
  ].join(' ');
}
