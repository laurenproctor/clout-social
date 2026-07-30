import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConnectLink } from '@/lib/zernio';

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const status = (code: number) => new Response('{}', { status: code });

describe('createConnectLink', () => {
  beforeEach(() => {
    process.env.ZERNIO_API_KEY = 'test-key';
    delete process.env.ZERNIO_CONNECT_URL;
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns { url, hosted:true } for a top-level { url }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ url: 'https://zernio.com/c/abc' })));
    const r = await createConnectLink('linkedin', 'https://app/content?connected=linkedin');
    expect(r).toEqual({ url: 'https://zernio.com/c/abc', hosted: true });
  });

  it('tolerates { connectUrl } and nested { data: { url } }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ connectUrl: 'https://z/1' })));
    expect((await createConnectLink('tiktok', 'r')).url).toBe('https://z/1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: { url: 'https://z/2' } })));
    expect((await createConnectLink('tiktok', 'r')).url).toBe('https://z/2');
  });

  it('falls back (hosted:false) when the endpoint is 404/501', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(status(404)));
    const r = await createConnectLink('instagram', 'r');
    expect(r.hosted).toBe(false);
    expect(r.url).toBe('https://zernio.com/dashboard/accounts');
  });

  it('falls back when a 200 response carries no usable URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ nope: true })));
    expect((await createConnectLink('twitter', 'r')).hosted).toBe(false);
  });

  it('honors ZERNIO_CONNECT_URL for the fallback', async () => {
    process.env.ZERNIO_CONNECT_URL = 'https://my.zernio/connect';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(status(501)));
    expect((await createConnectLink('linkedin', 'r')).url).toBe('https://my.zernio/connect');
  });

  it('throws on 401/5xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(status(401)));
    await expect(createConnectLink('linkedin', 'r')).rejects.toThrow();
  });
});
