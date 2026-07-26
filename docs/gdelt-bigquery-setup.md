# Activating live GDELT data via BigQuery

Clout fetches live trend volume + sentiment from **GDELT's public dataset in
Google BigQuery** rather than GDELT's HTTP API. Reason: the free GDELT DOC API
returns **HTTP 429** to Vercel's shared serverless IPs (confirmed), so it can't
be called from production. BigQuery is a Google API call not subject to that
throttle, and it keeps GDELT's sentiment-tone data intact.

The code path is already built and deployed (`lib/bigquery.ts`,
`lib/gdeltBigquery.ts`, `app/api/cron/refresh-signals`). It stays dormant —
falling back to the curated dataset — until the GCP credentials below are set.

## What activates what

| You configure | What goes live |
|---|---|
| **GCP service account** (below) | **Search** (`?q=`) returns live BigQuery data immediately — no other setup needed |
| GCP **+ Supabase** | The **default heatmap** goes live too (the daily cron writes metrics to the shared `signal_metrics` table; the dashboard reads it) |
| **CRON_SECRET** | Locks the refresh endpoint so only Vercel Cron can trigger it |

Search works with just GCP because it queries BigQuery per request. The default
heatmap needs Supabase because the cron (writer) and the page (reader) run in
separate serverless instances and must share state.

## One-time GCP setup (~10 min)

1. **Create/pick a GCP project** at <https://console.cloud.google.com> — note the **Project ID**.
2. **Enable the BigQuery API**: APIs & Services → Enable APIs → search "BigQuery API" → Enable.
3. **Attach a billing account** (IAM & Admin → Billing). BigQuery requires one even for free-tier use. Querying the GDELT public dataset is free up to **1 TB scanned/month**; Clout's daily 3-day-window query scans far less, so expect **$0**.
4. **Create a service account**: IAM & Admin → Service Accounts → Create. Grant role **BigQuery Job User** (required to run queries). Adding **BigQuery Data Viewer** is harmless.
5. **Create a JSON key**: open the service account → Keys → Add Key → JSON → download.
6. **Base64-encode it** (robust for env vars):
   ```bash
   base64 -i ~/Downloads/your-service-account.json | pbcopy   # macOS — now in clipboard
   ```

## Add the credentials to Vercel

```bash
# from the project dir
vercel env add GCP_SERVICE_ACCOUNT_KEY_BASE64 production   # paste the base64 blob
vercel env add GCP_PROJECT_ID production                   # your Project ID (optional; defaults to the key's)
# then redeploy so the new env vars take effect:
vercel deploy --prod --yes
```

(Repeat for `preview`/`development` scopes if you want live data there too.)

## Verify

```bash
# Search path — should show "source": "gdelt" with real tone values:
curl "https://clout-social.vercel.app/api/signals?q=climate"

# Refresh job — should report "via": "bigquery" and a non-zero "live" count:
curl "https://clout-social.vercel.app/api/cron/refresh-signals"
```

If `live` is 0 or the job errors, the GKG query likely needs a tweak — see below.

## Tuning / troubleshooting (`lib/gdeltBigquery.ts`)

- **Table name**: uses `gdelt-bq.gdeltv2.gkg_partitioned` (partitioned → cheap).
  If that table isn't available, switch to `gdelt-bq.gdeltv2.gkg` and filter on
  the `DATE` column instead (scans more — watch cost).
- **`LOOKBACK_DAYS`** (default 3): widen for more coverage on niche topics, at
  higher bytes-scanned.
- **Matching**: a topic matches when its lowercased phrase appears in the
  article's `AllNames` or `V2Themes`. Broad conceptual phrases (e.g. "Retail
  Media") may under-match; tune the `hay` expression or topic strings if a topic
  reads low.
- **`MAX_BYTES_BILLED`** (25 GB) caps per-query cost — a mis-scoped query fails
  loudly instead of running up a bill.

## Then: Supabase + CRON_SECRET (to make the default heatmap live)

1. Run `supabase/migrations/0001_stores.sql` **and** `0002_signal_metrics.sql`
   in your Supabase SQL editor.
2. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on Vercel.
3. Set `CRON_SECRET` on Vercel (Vercel Cron sends it automatically).
4. Redeploy. The daily cron (`0 8 * * *`, UTC — Hobby plan allows one/day) will
   populate `signal_metrics`; trigger it once by hand to seed immediately.
