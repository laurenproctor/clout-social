import { Radio } from 'lucide-react';
import { StubPage } from '@/components/layout/StubPage';

export default function SignalsPage() {
  return (
    <StubPage
      title="Signals"
      description="Live GDELT trend signals with opportunity scores, sentiment, and lifecycle stage."
      icon={Radio}
    />
  );
}
