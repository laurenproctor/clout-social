import { redirect } from 'next/navigation';

// Content Studio moved to /content — keep the old URL working.
export default function StudioRedirect() {
  redirect('/content');
}
