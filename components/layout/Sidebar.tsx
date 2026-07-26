'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Radio, FileText, PenSquare, Swords, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: Radio },
  { href: '/briefs', label: 'Briefs', icon: FileText },
  { href: '/content', label: 'Content', icon: PenSquare },
  { href: '/competitors', label: 'Competitors', icon: Swords },
  { href: '/settings', label: 'Settings', icon: Settings },
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
          const active = pathname === href || pathname.startsWith(`${href}/`);
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

      {/* Footer: live data-freshness card + theme toggle */}
      <div className="mt-auto pt-4 space-y-3">
        <DataFreshnessCard />
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-slate-500 font-medium">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/**
 * Bottom-of-sidebar status card: a live "Updated N min ago" badge that ticks
 * upward while the tab is open, plus a mini sparkline of recent signal volume.
 */
function DataFreshnessCard() {
  // Seed at 2 minutes so it reads "Updated 2 min ago" on first paint, then ticks.
  const [minutesAgo, setMinutesAgo] = useState(2);

  useEffect(() => {
    const t = setInterval(() => setMinutesAgo((m) => m + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Data freshness
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Updated {minutesAgo} min ago
        </span>
      </div>
      <Sparkline className="mt-2.5" />
      <p className="mt-1.5 text-[10px] text-slate-500">Signal volume · last 12h</p>
    </div>
  );
}

// Recent signal-volume buckets (most recent last). Static, decorative trend.
const SPARK_DATA = [4, 6, 5, 8, 6, 9, 7, 10, 9, 12, 11, 14];

/** Single-series sparkline — thin 2px mint line, rounded end, soft area fill. */
function Sparkline({ className = '' }: { className?: string }) {
  const width = 208;
  const height = 32;
  const pad = 3; // keep the stroke + end dot inside the viewBox
  const min = Math.min(...SPARK_DATA);
  const max = Math.max(...SPARK_DATA);
  const span = max - min || 1;

  const points = SPARK_DATA.map((v, i) => {
    const x = pad + (i / (SPARK_DATA.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return { x, y };
  });

  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const last = points[points.length - 1];
  const trend = SPARK_DATA[SPARK_DATA.length - 1] >= SPARK_DATA[0] ? 'up' : 'down';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full h-8 ${className}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Signal volume over the last 12 hours, trending ${trend}`}
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkFill)" />
      <polyline
        points={line}
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill="#10B981" />
    </svg>
  );
}
