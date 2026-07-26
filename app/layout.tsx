import type { Metadata } from 'next';
import './globals.css';
import { BrandProvider } from '@/components/brand/BrandProvider';
import { AccountsProvider } from '@/components/accounts/AccountsProvider';
import { ClerkProvider } from '@clerk/nextjs';

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const metadata: Metadata = {
  title: 'Clout — Signal Intelligence & Social Publishing',
  description: 'AI-driven trend intelligence and multi-channel content publishing platform powered by GDELT and Zernio.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tree = (
    <BrandProvider>
      <AccountsProvider>{children}</AccountsProvider>
    </BrandProvider>
  );
  // Apply the saved theme before paint (default dark) to avoid a flash.
  const themeScript = `(function(){try{var t=localStorage.getItem('clout.theme');document.documentElement.classList.toggle('dark',t!=='light');}catch(e){document.documentElement.classList.add('dark');}})();`;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased">
        {clerkEnabled ? <ClerkProvider>{tree}</ClerkProvider> : tree}
      </body>
    </html>
  );
}
