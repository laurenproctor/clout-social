import { redirect } from 'next/navigation';

// The signals heatmap now lives at /signals; the root path forwards to it.
export default function Home() {
  redirect('/signals');
}
