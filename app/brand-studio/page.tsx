import { redirect } from 'next/navigation';

// Brand Studio moved into /settings — keep the old URL working.
export default function BrandStudioRedirect() {
  redirect('/settings');
}
