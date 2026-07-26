import { NextResponse } from 'next/server';
import { listConnectedAccounts } from '@/lib/zernio';

// GET /api/accounts — connected social accounts from Zernio (GET /api/v1/accounts).
// Returns 200 with { accounts, error } even on upstream failure so the publisher
// UI can render an empty/error state instead of crashing.
export async function GET() {
  try {
    const accounts = await listConnectedAccounts();
    return NextResponse.json({ accounts });
  } catch (err: any) {
    return NextResponse.json(
      { accounts: [], error: err.message || 'Failed to load connected accounts.' },
      { status: 200 }
    );
  }
}
