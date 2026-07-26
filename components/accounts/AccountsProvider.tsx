'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ZernioAccount } from '@/types';

const STORAGE_KEY = 'clout.selectedAccountIds';

interface AccountsContextValue {
  accounts: ZernioAccount[];
  selectedIds: string[];
  selectedAccounts: ZernioAccount[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggle: (id: string) => void;
  setSelected: (ids: string[]) => void;
}

const AccountsContext = createContext<AccountsContextValue | null>(null);

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<ZernioAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hydrate selection from localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSelectedIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts', { cache: 'no-store' });
      const data = await res.json();
      const list: ZernioAccount[] = Array.isArray(data.accounts) ? data.accounts : [];
      setAccounts(list);
      if (data.error) setError(data.error);
      // Drop any selected ids that no longer exist.
      setSelectedIds((prev) => {
        const valid = prev.filter((id) => list.some((a) => a.id === id));
        if (valid.length !== prev.length) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
          } catch {
            /* ignore */
          }
        }
        return valid;
      });
    } catch {
      setError('Could not reach the accounts service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    []
  );

  const selectedAccounts = accounts.filter((a) => selectedIds.includes(a.id));

  return (
    <AccountsContext.Provider
      value={{ accounts, selectedIds, selectedAccounts, loading, error, refresh, toggle, setSelected: persist }}
    >
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts(): AccountsContextValue {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error('useAccounts must be used within an <AccountsProvider>');
  return ctx;
}
