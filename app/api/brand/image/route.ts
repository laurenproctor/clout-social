import { NextResponse } from 'next/server';
import { generateImage, gateway } from 'ai';
import { IMAGE_MODEL, gatewayConfigured, backgroundPrompt, BrandAssetInput } from '@/lib/aiAssets';

// Image generation can take 10–40s; give it headroom on Fluid Compute (Node).
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!gatewayConfigured()) {
    // Not an error the UI should crash on — the client falls back to a templated
    // brand gradient (no AI background) when the gateway isn't configured.
    return NextResponse.json(
      {
        error: 'AI Gateway is not configured. Add AI_GATEWAY_API_KEY or run `vercel env pull` for an OIDC token.',
        code: 'no_gateway',
      },
      { status: 200 }
    );
  }

  try {
    const body = (await req.json()) as Partial<BrandAssetInput> & { aspectRatio?: string };
    const { topic, network, style, primaryColor, accentColor, backgroundColor, aspectRatio } = body;

    if (!topic || !network) {
      return NextResponse.json({ error: 'topic and network are required.', code: 'bad_request' }, { status: 400 });
    }

    const prompt = backgroundPrompt({
      topic,
      network,
      style: style || 'bold',
      primaryColor: primaryColor || '#10B981',
      accentColor: accentColor || '#34D399',
      backgroundColor: backgroundColor || '#0F172A',
      angle: body.angle,
    });

    const { image } = await generateImage({
      model: gateway.imageModel(IMAGE_MODEL),
      prompt,
      aspectRatio: (aspectRatio as `${number}:${number}`) || '16:9',
    });

    return NextResponse.json({
      image: `data:${image.mediaType};base64,${image.base64}`,
      model: IMAGE_MODEL,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Image generation failed.', code: 'gateway_error' },
      { status: 200 }
    );
  }
}
