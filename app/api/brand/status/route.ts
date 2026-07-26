import { NextResponse } from 'next/server';
import { gatewayConfigured, IMAGE_MODEL, VIDEO_MODEL } from '@/lib/aiAssets';

// Lets the Brand Studio show whether live AI generation is available before the
// user tries — without exposing any secret values.
export async function GET() {
  return NextResponse.json({
    gateway: gatewayConfigured(),
    imageModel: IMAGE_MODEL,
    videoModel: VIDEO_MODEL,
  });
}
