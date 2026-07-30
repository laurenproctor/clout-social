import { NextResponse } from 'next/server';
import { createConnectLink } from '@/lib/zernio';
import { SocialPlatform } from '@/types';

const PLATFORMS: SocialPlatform[] = ['linkedin', 'twitter', 'tiktok', 'instagram', 'youtube', 'blog'];

// POST /api/accounts/connect — returns a hosted Zernio connect URL for a platform.
// The user opens it, authorizes, and Zernio redirects back to /content?connected=<platform>.
// 200-with-error on failure so the publisher UI can message instead of crashing.
export async function POST(req: Request) {
  try {
    const { platform } = await req.json().catch(() => ({}));
    if (!PLATFORMS.includes(platform)) {
      return NextResponse.json({ url: null, error: 'A valid platform is required.' }, { status: 400 });
    }
    const origin = new URL(req.url).origin;
    const redirectUrl = `${origin}/content?connected=${platform}`;
    const { url, hosted } = await createConnectLink(platform, redirectUrl);
    return NextResponse.json({ url, hosted });
  } catch (err: any) {
    return NextResponse.json(
      { url: null, error: err.message || 'Failed to create a connect link.' },
      { status: 200 },
    );
  }
}
