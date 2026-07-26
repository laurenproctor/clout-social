import { NextResponse } from 'next/server';
import { experimental_generateVideo as generateVideo, gateway } from 'ai';
import { put } from '@vercel/blob';
import { VIDEO_MODEL, gatewayConfigured, videoPrompt, BrandAssetInput } from '@/lib/aiAssets';

// Text/image-to-video is the slowest step — allow the full function budget.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!gatewayConfigured()) {
    return NextResponse.json(
      {
        error: 'AI Gateway is not configured. Add AI_GATEWAY_API_KEY or run `vercel env pull` for an OIDC token.',
        code: 'no_gateway',
      },
      { status: 200 }
    );
  }

  try {
    const body = (await req.json()) as Partial<BrandAssetInput> & {
      videoAspect?: '16:9' | '9:16';
      /** Optional brand image (data URL) to drive image-to-video for on-brand motion. */
      seedImage?: string;
    };
    const { topic, network, style, primaryColor, accentColor, backgroundColor, videoAspect, seedImage } = body;

    if (!topic || !network) {
      return NextResponse.json({ error: 'topic and network are required.', code: 'bad_request' }, { status: 400 });
    }

    const text = videoPrompt({
      topic,
      network,
      style: style || 'bold',
      primaryColor: primaryColor || '#10B981',
      accentColor: accentColor || '#34D399',
      backgroundColor: backgroundColor || '#0F172A',
      angle: body.angle,
    });

    const { video } = await generateVideo({
      model: gateway.videoModel(VIDEO_MODEL),
      // Seed with the brand image (image-to-video) when supplied, else text-to-video.
      prompt: seedImage ? { text, image: seedImage } : text,
      aspectRatio: videoAspect || '16:9',
    });

    // Videos are large — store to Blob and hand back a URL when possible so the
    // response stays light and the clip can flow into a Zernio post later.
    const ext = video.mediaType?.split('/')[1] || 'mp4';
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(`clout/brand-video-${network}.${ext}`, Buffer.from(video.uint8Array), {
          access: 'public',
          contentType: video.mediaType || 'video/mp4',
          addRandomSuffix: true,
        });
        return NextResponse.json({ video: blob.url, mediaType: video.mediaType, model: VIDEO_MODEL, stored: true });
      } catch {
        /* fall through to an inline data URL */
      }
    }

    return NextResponse.json({
      video: `data:${video.mediaType};base64,${video.base64}`,
      mediaType: video.mediaType,
      model: VIDEO_MODEL,
      stored: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Video generation failed.', code: 'gateway_error' },
      { status: 200 }
    );
  }
}
