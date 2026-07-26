'use client';

import { SignInButton, UserButton, useUser } from '@clerk/nextjs';

// Clerk is enabled only when a publishable key is present. Otherwise show a
// neutral placeholder so the app runs open (no auth) locally / before setup.
const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function Placeholder() {
  return (
    <div
      title="Sign-in not configured"
      aria-label="Guest"
      className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400"
    >
      JS
    </div>
  );
}

// Rendered only when Clerk is configured, so useUser() always has a provider.
function ClerkAuth() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 animate-pulse" />;
  if (isSignedIn) return <UserButton />;
  return (
    <SignInButton mode="modal">
      <button className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30">
        Sign in
      </button>
    </SignInButton>
  );
}

export function AuthButton() {
  return clerkEnabled ? <ClerkAuth /> : <Placeholder />;
}
