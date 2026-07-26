import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB ceiling for client uploads
const ALLOWED = /^(image|video)\//;

function safeExt(name: string): string {
  const ext = (name.split('.').pop() || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return ext ? `.${ext}` : '';
}

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';

  // ── A) Client-upload flow (JSON body from @vercel/blob/client `upload()`) ──
  // The browser uploads bytes DIRECTLY to Vercel Blob (up to 5 TB, bypassing the
  // ~4.5MB serverless body limit). This route only mints scoped client tokens.
  if (contentType.includes('application/json')) {
    if (!hasBlob()) {
      // No Blob configured → tell the client to use the multipart fallback.
      return NextResponse.json(
        { error: 'Vercel Blob is not configured; use the multipart fallback.' },
        { status: 400 }
      );
    }
    try {
      const body = (await req.json()) as HandleUploadBody;
      const json = await handleUpload({
        request: req,
        body,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: ['image/*', 'video/*'],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        }),
        // Fires via Vercel webhook after the upload finishes (not in local dev).
        onUploadCompleted: async () => {},
      });
      return NextResponse.json(json);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Token generation failed.' }, { status: 400 });
    }
  }

  // ── B) Multipart fallback (small files / no client SDK / no Blob token) ──
  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided (form field "file").' }, { status: 400 });
    }
    if (!ALLOWED.test(file.type)) {
      return NextResponse.json({ error: 'Only image or video files are allowed.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds the size limit.' }, { status: 400 });
    }

    const ext = safeExt(file.name);

    // Blob configured → real public CDN URL (still limited to ~4.5MB on Vercel;
    // large files go through path A above).
    if (hasBlob()) {
      const blob = await put(`clout/${randomUUID()}${ext}`, file, {
        access: 'public',
        contentType: file.type,
      });
      return NextResponse.json({ url: blob.url, provider: 'vercel-blob', contentType: file.type });
    }

    // Local dev fallback: persist under /public/uploads.
    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(dir, { recursive: true });
    const fname = `${randomUUID()}${ext}`;
    await writeFile(path.join(dir, fname), buf);

    return NextResponse.json({
      url: `/uploads/${fname}`,
      provider: 'local-dev',
      contentType: file.type,
      warning:
        'Stored locally (no BLOB_READ_WRITE_TOKEN). Configure Vercel Blob to return a public CDN URL Zernio can fetch.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Upload failed.' }, { status: 500 });
  }
}
