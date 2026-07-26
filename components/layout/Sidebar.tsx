'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, Zap, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Signals', icon: Radio },
  { href: '/studio', label: 'Content Studio', icon: Zap },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

/**
 * Persistent left navigation shown on every screen (lg and up).
 * Highlights the active route via the current pathname.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-900/30 p-4 hidden lg:flex lg:flex-col">
      <nav className="space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                active
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-slate-800/60 flex items-center justify-between px-1">
        <span className="text-xs text-slate-500 font-medium">Theme</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
