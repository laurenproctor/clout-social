import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';

type StubPageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

/**
 * Lightweight placeholder shell for routes that are wired into the nav but not
 * yet built out. Renders the persistent sidebar plus a titled empty state.
 */
export function StubPage({ title, description, icon: Icon }: StubPageProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      <Sidebar />

      <div className="flex-1 overflow-y-auto p-6 sm:p-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-slate-400">{description}</p>
            </div>
          </div>

          {/* Placeholder body */}
          <div className="mt-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8">
            <div className="space-y-3">
              <div className="h-3 w-1/3 rounded-full bg-slate-800" />
              <div className="h-3 w-2/3 rounded-full bg-slate-800/70" />
              <div className="h-3 w-1/2 rounded-full bg-slate-800/50" />
            </div>
            <p className="mt-6 text-xs font-medium uppercase tracking-wider text-slate-500">
              {title} is coming together — this section is a placeholder.
            </p>
          </div>

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to signals
          </Link>
        </div>
      </div>
    </main>
  );
}
