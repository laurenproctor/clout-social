import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Clerk activates only when configured. Without CLERK_SECRET_KEY (e.g. local dev
// or before auth is provisioned), this is a pass-through so the app runs open.
const authConfigured = Boolean(process.env.CLERK_SECRET_KEY);

export default authConfigured ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next internals and static files; run on app routes + API.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
