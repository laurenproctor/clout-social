import { Settings } from 'lucide-react';
import { StubPage } from '@/components/layout/StubPage';

export default function SettingsPage() {
  return (
    <StubPage
      title="Settings"
      description="Manage your brand kit, connected channels, API keys, and notification preferences."
      icon={Settings}
    />
  );
}
