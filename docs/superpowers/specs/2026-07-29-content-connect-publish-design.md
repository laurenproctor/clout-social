# Connect accounts & publish from the `/content` dashboard

**Date:** 2026-07-29
**Status:** Approved design, pending spec review

## Problem

On `/content`, the **Multi-Account Publisher** shows "No connected accounts" and tells
the user to go connect them inside their Zernio workspace. Two gaps:

1. **Connection** — there is no way to connect a social account from within Clout.
2. **Publishing** — `<ZernioPublisher />` renders with no props on `/content`. It computes
   an auto-schedule *plan* and displays it, but nothing publishes it, and there is no
   composer to write a post. So "publish from Clout" is only half-wired on this page.

The publish *backend* already works: `POST /api/publish` → `sendToZernio` (used today by
the signal detail modal). The account *read* path works too: `GET /api/accounts` →
`listConnectedAccounts`.

## Goal

From `/content`, the user can (a) connect a LinkedIn / Twit-X / TikTok / Instagram account
via Zernio, and (b) write a post and publish now or schedule it to the connected accounts —
without leaving the page.

## Constraints & known unknowns

- Zernio owns each platform's OAuth. Clout uses one workspace-level `ZERNIO_API_KEY` and
  cannot drive a raw LinkedIn/TikTok login itself. The realistic pattern is a **hosted
  connect link**: Zernio returns a URL, Clout opens it, the user authorizes, Zernio
  redirects back, Clout re-reads its account list.
- The exact Zernio "create connect link" endpoint is **not documented** in this codebase
  (like the rest of the Zernio contract). We implement against a sensible assumed contract,
  tolerant of response shapes, with a **deep-link fallback** if the endpoint is absent.
- CLAUDE.md: character limits **must** be validated per platform before calling publish.

## Design

### 1. `lib/zernio.ts` — `createConnectLink`

```ts
export async function createConnectLink(
  platform: SocialPlatform,
  redirectUrl: string,
): Promise<{ url: string; hosted: boolean }>
```

- POST `${ZERNIO_API_URL}/accounts/connect` with `{ platform, redirectUrl }`, auth headers.
- Tolerate response shapes: `{ url }`, `{ connectUrl }`, `{ link }`, `{ data: { url } }`,
  `{ data: { connectUrl } }` — first non-empty string wins. Return `{ url, hosted: true }`.
- **Fallback:** on 404/501 (endpoint absent) or an empty/unparseable URL, return
  `{ url: ZERNIO_CONNECT_URL ?? 'https://zernio.com/dashboard/accounts', hosted: false }`.
  Do not throw for the not-implemented case — the UI needs a usable URL either way.
- Other non-OK statuses (401/403/5xx) throw, matching the file's existing error style.
- Not idempotent-sensitive (creating a link is safe to retry) → allow retry on 429 only,
  consistent with `sendToZernio`.

### 2. `app/api/accounts/connect/route.ts` — `POST`

- Body `{ platform }`; validate it against the `SocialPlatform` union (400 otherwise).
- Derive redirect-back URL from the request origin: `${origin}/content?connected=${platform}`.
- Call `createConnectLink`; return `{ url, hosted }`.
- On thrown error, return `{ url: null, error }` with **status 200** (same forgiving pattern
  as `GET /api/accounts`) so the UI shows a message instead of crashing.

### 3. `components/studio/ZernioPublisher.tsx` — connect UI

- **Empty state:** replace the "connect in your Zernio workspace" copy with four connect
  buttons (LinkedIn, Twitter/X, TikTok, Instagram).
- **Populated state:** a small "Connect" button in each platform group header.
- **Handshake (popup):** click → `POST /api/accounts/connect` → `window.open(url, ...)` as a
  centered popup. Poll `popup.closed` on an interval; on close, call `refresh()` from
  `useAccounts`. If `window.open` returns null (blocked), fall back to same-tab
  `window.location.assign(url)`.
- **Full-tab return:** on mount, if `?connected=<platform>` is present, call `refresh()` and
  strip the param via `history.replaceState`. Covers the fallback redirect path.
- When `hosted: false`, show a one-line hint that the user finishes connecting in the Zernio
  tab, then returns — the popup/refresh flow is identical.

### 4. Composer — close the publish loop

New compact composer rendered inside `ZernioPublisher` (below the platform groups):

- `textarea` for content; optional `datetime-local` for scheduling.
- **Publish now** and **Schedule** buttons. Disabled when no accounts selected or content empty.
- Reads `selectedAccounts` from `useAccounts`. **Character-limit validation** before calling
  the API: for each *selected* platform, block if `content.length > CHAR_LIMITS[platform]` and
  list the offending platforms.
- Calls `POST /api/publish` with `{ accountIds, content, scheduledAt? }`. Schedule uses the
  existing `localInputToUtcISO` helper; "Publish now" omits `scheduledAt`.
- On success: clear the textarea, show a success line, and (on `/content`) refresh the
  scheduled-posts list. Wire this via a new optional `onPublished?: () => void` prop that
  `/content` passes to trigger its existing posts reload.

### 5. Shared `CHAR_LIMITS`

`CHAR_LIMITS` currently lives inside `SignalDetailModal.tsx`. Extract it to
`lib/networkFormats.ts` (exported `CHAR_LIMITS`), and update `SignalDetailModal` to import it,
so the composer and the modal share one source of truth. No behavior change.

## Data flow

```
Connect:  ZernioPublisher → POST /api/accounts/connect → createConnectLink → Zernio
          → popup auth → Zernio redirect → popup closes → refresh() → GET /api/accounts
Publish:  Composer → validate CHAR_LIMITS → POST /api/publish → sendToZernio
          → onPublished() → /content reloads scheduled posts
```

## Error handling

- Connect endpoint absent → deep-link fallback + hint; never a hard crash.
- Popup blocked → same-tab redirect fallback.
- Publish over char limit → inline error naming the platform(s); no API call.
- Publish API error → surface `error` message inline; textarea content preserved.

## Testing

- **Unit** (`lib/zernio` `createConnectLink`, mocked fetch): each tolerated response shape
  yields the URL with `hosted: true`; 404/501 yields the fallback URL with `hosted: false`;
  401/5xx throws.
- **Manual:** connect flow opens popup and refreshes on close; `?connected=` return refreshes
  and clears; composer blocks over-limit content; a real publish to a connected account
  creates a scheduled/published post visible in the `/content` list.

## Out of scope

- Clout owning per-platform OAuth apps directly.
- Disconnecting accounts from Clout (Zernio workspace still owns removal).
- Media upload in the new composer (text-only for now; media stays in the signal modal).
