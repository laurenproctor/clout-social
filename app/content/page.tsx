import { PenSquare } from 'lucide-react';
import { StubPage } from '@/components/layout/StubPage';

export default function ContentPage() {
  return (
    <StubPage
      title="Content"
      description="Draft, schedule, and distribute platform-optimized posts across your channels via Zernio."
      icon={PenSquare}
    />
  );
}
