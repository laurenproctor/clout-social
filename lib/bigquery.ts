import { BigQuery } from '@google-cloud/bigquery';

/**
 * Server-only BigQuery client, authenticated with a GCP service account.
 *
 * We query GDELT's public dataset (gdelt-bq.gdeltv2) directly in BigQuery
 * instead of hitting GDELT's DOC API over HTTP — GDELT hard-throttles Vercel's
 * shared serverless IPs (429), but BigQuery is a Google API call that isn't
 * subject to that limit and keeps GDELT's tone data intact.
 *
 * Credentials come from env (never checked in):
 *   - GCP_SERVICE_ACCOUNT_KEY_BASE64 : base64 of the service-account JSON (preferred)
 *   - GCP_SERVICE_ACCOUNT_JSON       : the raw service-account JSON (alternative)
 *   - GCP_PROJECT_ID                 : optional override; defaults to the key's project_id
 * The service account only needs BigQuery Job User + Data Viewer.
 */

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

function loadKey(): ServiceAccountKey | null {
  const b64 = process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64;
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  const json = b64 ? Buffer.from(b64, 'base64').toString('utf8') : raw;
  if (!json) return null;
  try {
    const key = JSON.parse(json) as ServiceAccountKey;
    if (!key.client_email || !key.private_key) return null;
    return key;
  } catch {
    console.warn('[bigquery] GCP service-account key is set but not valid JSON.');
    return null;
  }
}

/** True when a usable BigQuery service account is configured. */
export function isBigQueryConfigured(): boolean {
  return loadKey() !== null;
}

let client: BigQuery | null = null;

export function getBigQuery(): BigQuery {
  const key = loadKey();
  if (!key) {
    throw new Error('BigQuery is not configured (GCP service-account key missing/invalid).');
  }
  if (!client) {
    client = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID || key.project_id,
      credentials: { client_email: key.client_email, private_key: key.private_key },
    });
  }
  return client;
}
