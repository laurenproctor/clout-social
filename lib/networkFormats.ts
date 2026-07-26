import { SocialPlatform } from '@/types';

export type FormatKind = 'landscape' | 'square' | 'portrait';

export interface NetworkFormat {
  id: SocialPlatform;
  label: string;
  /** The asset this format targets, e.g. "Feed image", "Thumbnail". */
  slot: string;
  width: number;
  height: number;
  kind: FormatKind;
  /** Aspect ratio string for image generation ("{w}:{h}"). */
  imageAspect: string;
  /** Aspect ratio for video generation — providers reliably support 16:9 / 9:16. */
  videoAspect: '16:9' | '9:16';
}

// Platform-accurate canvas dimensions per network.
export const NETWORK_FORMATS: Record<SocialPlatform, NetworkFormat> = {
  linkedin: { id: 'linkedin', label: 'LinkedIn', slot: 'Feed image', width: 1200, height: 627, kind: 'landscape', imageAspect: '16:9', videoAspect: '16:9' },
  twitter: { id: 'twitter', label: 'X', slot: 'Feed image', width: 1600, height: 900, kind: 'landscape', imageAspect: '16:9', videoAspect: '16:9' },
  instagram: { id: 'instagram', label: 'Instagram', slot: 'Feed post', width: 1080, height: 1080, kind: 'square', imageAspect: '1:1', videoAspect: '9:16' },
  tiktok: { id: 'tiktok', label: 'TikTok', slot: 'Vertical cover', width: 1080, height: 1920, kind: 'portrait', imageAspect: '9:16', videoAspect: '9:16' },
  youtube: { id: 'youtube', label: 'YouTube', slot: 'Thumbnail', width: 1280, height: 720, kind: 'landscape', imageAspect: '16:9', videoAspect: '16:9' },
  blog: { id: 'blog', label: 'Blog', slot: 'Hero image', width: 1200, height: 630, kind: 'landscape', imageAspect: '16:9', videoAspect: '16:9' },
};

export const NETWORK_ORDER: SocialPlatform[] = ['linkedin', 'twitter', 'instagram', 'tiktok', 'youtube', 'blog'];
