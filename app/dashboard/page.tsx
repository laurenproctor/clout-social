import { LayoutDashboard } from 'lucide-react';
import { StubPage } from '@/components/layout/StubPage';

export default function DashboardPage() {
  return (
    <StubPage
      title="Dashboard"
      description="Your at-a-glance command center — top opportunities, publishing queue, and performance in one view."
      icon={LayoutDashboard}
    />
  );
}
