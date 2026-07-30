# Connect Accounts & Publish from `/content` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user connect a social account via Zernio and publish/schedule a post entirely from the `/content` dashboard.

**Architecture:** A new `createConnectLink` in `lib/zernio.ts` returns a hosted Zernio connect URL (tolerant of response shapes, with a deep-link fallback). A `POST /api/accounts/connect` route exposes it. `ZernioPublisher` gains connect buttons that open the URL in a popup and refresh the account list on close, plus a composer that publishes selected accounts through the existing `POST /api/publish`. Char limits are extracted to a shared module.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, Tailwind, lucide-react. Tests via Vitest (introduced in Task 1; the repo currently has none).

## Global Constraints

- Zernio auth is a single workspace `ZERNIO_API_KEY` via `Authorization: Bearer` (see `lib/zernio.ts`). Do not invent per-user OAuth.
- Zernio contract is undocumented — implement tolerantly and never hard-crash the UI on Zernio failure (match the 200-with-`error` pattern in `app/api/accounts/route.ts`).
- Character limits MUST be validated per platform before calling publish (CLAUDE.md Zernio rule).
- `SocialPlatform` union: `'linkedin' | 'twitter' | 'tiktok' | 'instagram' | 'youtube' | 'blog'`.
- Publishable networks in the publisher UI: LinkedIn, Twitter/X, TikTok, Instagram (the four in `ZernioPublisher`'s `PLATFORMS`).
- Commit after every task.

---

### Task 1: `createConnectLink` in `lib/zernio.ts` (+ Vitest setup)

**Files:**
- Modify: `package.json` (add `vitest` devDep + `test` script)
- Create: `vitest.config.ts`
- Modify: `lib/zernio.ts` (add `extractConnectUrl` + `createConnectLink`)
- Test: `lib/zernio.test.ts`

**Interfaces:**
- Consumes: `fetchWithRetry(url, init, options)` from `@/lib/http`; `authHeaders()` and `ZERNIO_API_URL` (module-private in `lib/zernio.ts`); `SocialPlatform` from `@/types`.
- Produces: `createConnectLink(platform: SocialPlatform, redirectUrl: string): Promise<{ url: string; hosted: boolean }>`.

- [ ] **Step 1: Add Vitest to `package.json`**

Add to `devDependencies`: `"vitest": "^2.1.9"`. Add to `scripts`: `"test": "vitest run"`. Then run `npm install`.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: { environment: 'node' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `lib/zernio.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run lib/zernio.test.ts`
Expected: FAIL — `createConnectLink` is not exported.

- [ ] **Step 5: Implement `createConnectLink`**

In `lib/zernio.ts`, add near the top (after `ZERNIO_API_URL`):

```ts
const ZERNIO_CONNECT_FALLBACK = 'https://zernio.com/dashboard/accounts';
```

Add these exports (place after `sendToZernio`):

```ts
/** First non-empty hosted-connect URL out of a tolerated Zernio response shape. */
function extractConnectUrl(raw: any): string | null {
  const candidates = [
    raw?.url, raw?.connectUrl, raw?.link,
    raw?.data?.url, raw?.data?.connectUrl, raw?.data?.link,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

/**
 * Create a hosted Zernio connect link for a platform. The user opens `url`,
 * authorizes on the network, and Zernio redirects back to `redirectUrl`.
 *
 * Assumed contract: POST /accounts/connect { platform, redirectUrl } → { url }.
 * Tolerates {url|connectUrl|link} at the top level or under `data`. If the
 * endpoint is absent (404/501) or returns no URL, falls back to a deep-link to
 * the Zernio dashboard (hosted:false) so the UI always has a usable URL.
 */
export async function createConnectLink(
  platform: SocialPlatform,
  redirectUrl: string,
): Promise<{ url: string; hosted: boolean }> {
  const fallback = process.env.ZERNIO_CONNECT_URL || ZERNIO_CONNECT_FALLBACK;

  // Creating a link is a POST but has no publish side effect; still, keep retries
  // off for 5xx/network to stay consistent with the other write in this file.
  const res = await fetchWithRetry(
    `${ZERNIO_API_URL}/accounts/connect`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ platform, redirectUrl }),
    },
    { retryOn5xx: false, retryOnNetworkError: false },
  );

  // Endpoint not implemented on this Zernio account → deep-link fallback.
  if (res.status === 404 || res.status === 501) {
    return { url: fallback, hosted: false };
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Zernio connect link failed: ${res.status}`);
  }

  const data = await res.json().catch(() => ({}));
  const url = extractConnectUrl(data);
  return url ? { url, hosted: true } : { url: fallback, hosted: false };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/zernio.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/zernio.ts lib/zernio.test.ts
git commit -m "feat(zernio): createConnectLink with tolerant parsing + deep-link fallback"
```

---

### Task 2: `POST /api/accounts/connect` route

**Files:**
- Create: `app/api/accounts/connect/route.ts`

**Interfaces:**
- Consumes: `createConnectLink` from `@/lib/zernio`; `SocialPlatform` from `@/types`.
- Produces: `POST /api/accounts/connect` accepting `{ platform }`, returning `{ url: string | null, hosted?: boolean, error?: string }`.

- [ ] **Step 1: Create the route**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, then:
`curl -s -X POST localhost:3000/api/accounts/connect -H 'Content-Type: application/json' -d '{"platform":"linkedin"}'`
Expected: JSON with a `url` (either a real Zernio URL or the fallback `https://zernio.com/dashboard/accounts`) and `hosted` boolean. A bad platform (`{"platform":"nope"}`) returns 400 with an `error`.

- [ ] **Step 4: Commit**

```bash
git add app/api/accounts/connect/route.ts
git commit -m "feat(api): POST /api/accounts/connect returns a Zernio connect link"
```

---

### Task 3: Extract `CHAR_LIMITS` into `lib/networkFormats.ts`

**Files:**
- Modify: `lib/networkFormats.ts` (add exported `CHAR_LIMITS`)
- Modify: `components/dashboard/SignalDetailModal.tsx` (remove local const, import shared)

**Interfaces:**
- Produces: `export const CHAR_LIMITS: Record<SocialPlatform, number>` from `@/lib/networkFormats`.

- [ ] **Step 1: Add `CHAR_LIMITS` to `lib/networkFormats.ts`**

Append (after `NETWORK_ORDER`):

```ts
// Per-platform content character limits (Blog is effectively unlimited).
export const CHAR_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
  blog: 100000,
};
```

- [ ] **Step 2: Update `SignalDetailModal.tsx` to import it**

Change line 43 from:

```ts
import { NETWORK_FORMATS } from '@/lib/networkFormats';
```

to:

```ts
import { NETWORK_FORMATS, CHAR_LIMITS } from '@/lib/networkFormats';
```

Then delete the local block (lines ~55–63):

```ts
// Per-platform content character limits (Blog is effectively unlimited).
const CHAR_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
  blog: 100000,
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (all existing `CHAR_LIMITS[...]` uses in the modal now resolve to the import).

- [ ] **Step 4: Commit**

```bash
git add lib/networkFormats.ts components/dashboard/SignalDetailModal.tsx
git commit -m "refactor: share CHAR_LIMITS from lib/networkFormats"
```

---

### Task 4: Connect UI in `ZernioPublisher`

**Files:**
- Modify: `components/studio/ZernioPublisher.tsx`

**Interfaces:**
- Consumes: `POST /api/accounts/connect` (`{ platform }` → `{ url, hosted, error }`); `refresh` from `useAccounts`.
- Produces: connect buttons (empty-state + per-group), popup handshake, `?connected=` return handling. No new exported symbols.

- [ ] **Step 1: Add connect state + handlers**

In `ZernioPublisher`, after the existing `const load = refresh;` line, add:

```ts
const [connecting, setConnecting] = useState<SocialPlatform | null>(null);
const [connectError, setConnectError] = useState<string | null>(null);

// Open Zernio's hosted connect page in a popup; refresh the account list on close.
const openConnectPopup = (url: string) => {
  const w = 600, h = 720;
  const x = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
  const y = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
  const popup = window.open(url, 'zernio-connect', `width=${w},height=${h},left=${x},top=${y}`);
  if (!popup) {
    // Popups blocked → fall back to a same-tab redirect (Zernio returns to /content?connected=).
    window.location.assign(url);
    return;
  }
  const timer = window.setInterval(() => {
    if (popup.closed) {
      window.clearInterval(timer);
      setConnecting(null);
      refresh();
    }
  }, 800);
};

const handleConnect = async (platform: SocialPlatform) => {
  setConnecting(platform);
  setConnectError(null);
  try {
    const res = await fetch('/api/accounts/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    });
    const data = await res.json();
    if (!data.url) throw new Error(data.error || 'Could not start the connect flow.');
    openConnectPopup(data.url);
  } catch (e) {
    setConnectError((e as Error).message);
    setConnecting(null);
  }
};
```

- [ ] **Step 2: Handle the full-tab return (`?connected=`)**

Add this effect alongside the other `useEffect`s:

```ts
// If Zernio returned to /content?connected=<platform> (popup blocked / same-tab),
// refresh the account list and strip the param.
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('connected')) {
    refresh();
    params.delete('connected');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }
}, [refresh]);
```

- [ ] **Step 3: Add a `Plus` import**

In the `lucide-react` import, add `Plus` to the existing named imports.

- [ ] **Step 4: Replace the empty state with connect buttons**

Replace the empty-state block (currently the `!loading && accounts.length === 0` `<div>` containing the "Connect … in your Zernio workspace" copy) with:

```tsx
{!loading && accounts.length === 0 && (
  <div className="py-8 text-center">
    <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
    <p className="text-slate-300 font-semibold">No connected accounts</p>
    <p className="text-slate-500 text-xs mt-1 mb-4">
      Connect an account to publish from Clout. You&apos;ll authorize in a Zernio window, then return here.
    </p>
    <div className="flex flex-wrap justify-center gap-2">
      {PLATFORMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => handleConnect(key)}
          disabled={connecting !== null}
          className="flex items-center gap-2 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-60"
        >
          <Icon className="w-3.5 h-3.5 text-slate-400" />
          {connecting === key ? 'Opening…' : `Connect ${label}`}
        </button>
      ))}
    </div>
    {connectError && <p className="text-[11px] text-amber-300 mt-3">{connectError}</p>}
  </div>
)}
```

- [ ] **Step 5: Add a per-group Connect button**

In the platform-group header (the `<div className="flex items-center justify-between mb-2">` block), replace the existing `{accts.length > 0 && (...Select all...)}` conditional with a fragment that keeps Select-all and adds Connect:

```tsx
<span className="flex items-center gap-2">
  {accts.length > 0 && (
    <button
      onClick={() => togglePlatform(key, !allOn)}
      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
    >
      {allOn ? 'Clear' : 'Select all'}
    </button>
  )}
  <button
    onClick={() => handleConnect(key)}
    disabled={connecting !== null}
    className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-60"
  >
    <Plus className="w-3 h-3" />
    {connecting === key ? 'Opening…' : 'Connect'}
  </button>
</span>
```

- [ ] **Step 6: Surface connect errors in the populated state**

Directly under the existing `{error && (...)}` block, add:

```tsx
{connectError && accounts.length > 0 && (
  <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2">
    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
    <span>{connectError}</span>
  </div>
)}
```

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 8: Manual verification**

`npm run dev` → open `/content`. With zero accounts, the empty state shows four Connect buttons. Clicking one opens a popup to the returned URL (real Zernio link or the fallback dashboard). Closing the popup triggers a refresh (network tab shows `GET /api/accounts`). Visiting `/content?connected=linkedin` directly refreshes and strips the param from the URL bar.

- [ ] **Step 9: Commit**

```bash
git add components/studio/ZernioPublisher.tsx
git commit -m "feat(publisher): connect accounts via Zernio popup handshake"
```

---

### Task 5: Composer — publish/schedule from `/content`

**Files:**
- Modify: `components/studio/ZernioPublisher.tsx` (add composer + `onPublished` prop)
- Modify: `app/content/page.tsx` (pass `onPublished`)

**Interfaces:**
- Consumes: `selectedAccounts` from `useAccounts`; `POST /api/publish` (`{ accountIds, content, scheduledAt? }`); `CHAR_LIMITS` from `@/lib/networkFormats`; `localInputToUtcISO`, `isFutureLocal` from `@/lib/schedule`.
- Produces: `Props.onPublished?: () => void`; a composer UI that publishes to selected connected accounts.

- [ ] **Step 1: Extend `Props` and imports**

In the `Props` interface add:

```ts
  /** Fires after a successful publish/schedule so the host can refresh its list. */
  onPublished?: () => void;
```

Destructure it in the component signature: `({ onSelectionChange, onAutoSchedule, onPublished })`.

Add imports at the top of the file:

```ts
import { CHAR_LIMITS } from '@/lib/networkFormats';
import { localInputToUtcISO, isFutureLocal } from '@/lib/schedule';
```

Add `Send` to the `lucide-react` named imports.

- [ ] **Step 2: Add composer state + `selectedAccounts`**

Add `selectedAccounts` to the `useAccounts()` destructure. Then add state:

```ts
const [composerText, setComposerText] = useState('');
const [scheduleLocal, setScheduleLocal] = useState('');
const [publishing, setPublishing] = useState(false);
const [publishError, setPublishError] = useState<string | null>(null);
const [publishOk, setPublishOk] = useState<string | null>(null);
```

- [ ] **Step 3: Add the publish handler**

```ts
const doPublish = async (schedule: boolean) => {
  const accountIds = selectedAccounts.map((a) => a.id);
  if (accountIds.length === 0 || !composerText.trim()) return;

  // Per-platform character-limit validation before hitting the API (CLAUDE.md rule).
  const overs = Array.from(new Set(selectedAccounts.map((a) => a.platform)))
    .filter((p) => composerText.length > CHAR_LIMITS[p]);
  if (overs.length > 0) {
    setPublishError(`Over the character limit for: ${overs.join(', ')}.`);
    return;
  }

  let scheduledAt: string | undefined;
  if (schedule) {
    if (!scheduleLocal || !isFutureLocal(scheduleLocal)) {
      setPublishError('Pick a future date and time to schedule.');
      return;
    }
    scheduledAt = localInputToUtcISO(scheduleLocal) ?? undefined;
  }

  setPublishing(true);
  setPublishError(null);
  setPublishOk(null);
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountIds, content: composerText, scheduledAt }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Publish failed.');
    setComposerText('');
    setScheduleLocal('');
    setPublishOk(scheduledAt ? 'Scheduled.' : 'Published.');
    onPublished?.();
  } catch (e) {
    setPublishError((e as Error).message);
  } finally {
    setPublishing(false);
  }
};
```

- [ ] **Step 4: Render the composer**

Insert this block after the platform-groups grid and before the Auto-schedule block (both guarded by `accounts.length > 0`):

```tsx
{accounts.length > 0 && (
  <div className="border border-slate-800 rounded-xl bg-slate-950/40 p-4 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-200">Compose &amp; publish</span>
      <span className="text-[11px] text-slate-500">{selectedCount} account{selectedCount === 1 ? '' : 's'} selected</span>
    </div>
    <textarea
      value={composerText}
      onChange={(e) => setComposerText(e.target.value)}
      placeholder="Write your post…"
      rows={4}
      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-y"
    />
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="datetime-local"
        value={scheduleLocal}
        onChange={(e) => setScheduleLocal(e.target.value)}
        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
      />
      <button
        onClick={() => doPublish(false)}
        disabled={publishing || selectedCount === 0 || !composerText.trim()}
        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-2 px-4 rounded-lg text-sm transition"
      >
        <Send className="w-4 h-4" />
        {publishing ? 'Publishing…' : 'Publish now'}
      </button>
      <button
        onClick={() => doPublish(true)}
        disabled={publishing || selectedCount === 0 || !composerText.trim()}
        className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-semibold py-2 px-4 rounded-lg text-sm transition"
      >
        <CalendarClock className="w-4 h-4" />
        Schedule
      </button>
    </div>
    {selectedCount === 0 && (
      <p className="text-[11px] text-slate-500">Select at least one connected account above to publish.</p>
    )}
    {publishError && <p className="text-[11px] text-amber-300">{publishError}</p>}
    {publishOk && <p className="text-[11px] text-emerald-400">{publishOk}</p>}
  </div>
)}
```

(`CalendarClock` is already imported in this file; `Send` was added in Step 1.)

- [ ] **Step 5: Wire `onPublished` on `/content`**

In `app/content/page.tsx`, change `<ZernioPublisher />` (line ~237) to:

```tsx
<ZernioPublisher onPublished={load} />
```

(`load` is the existing `useCallback` at line ~69 that refetches the scheduled-posts list.)

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 7: Manual verification**

`npm run dev` → `/content`. With a connected account selected, type a post and click **Publish now**: `POST /api/publish` fires, the textarea clears, a "Published." line shows, and the scheduled-posts list below refreshes. Typing >280 chars with a Twitter account selected and clicking Publish shows the over-limit error and makes no API call. **Schedule** with a future time sends `scheduledAt`; a past/empty time shows the future-time error.

- [ ] **Step 8: Commit**

```bash
git add components/studio/ZernioPublisher.tsx app/content/page.tsx
git commit -m "feat(publisher): composer to publish/schedule from /content"
```

---

## Self-Review

**Spec coverage:**
- Spec §1 `createConnectLink` (tolerant + fallback) → Task 1. ✅
- Spec §2 `POST /api/accounts/connect` → Task 2. ✅
- Spec §3 connect UI (empty-state + per-group buttons, popup, `?connected=`) → Task 4. ✅
- Spec §4 composer (char-limit validated → `/api/publish`, `onPublished`) → Task 5. ✅
- Spec §5 shared `CHAR_LIMITS` → Task 3. ✅
- Spec testing (unit for `createConnectLink`; manual for UI/route) → Task 1 unit tests; Tasks 2/4/5 manual steps. ✅

**Placeholder scan:** No TBD/TODO; every code step has concrete code. ✅

**Type consistency:** `createConnectLink(platform, redirectUrl) → { url, hosted }` used identically in Task 1 (def), Task 2 (route). `CHAR_LIMITS: Record<SocialPlatform, number>` defined in Task 3, consumed in Tasks 3 (modal) and 5 (composer). `onPublished?: () => void` defined and consumed in Task 5. `refresh`/`selectedAccounts` come from the existing `useAccounts` context. ✅
