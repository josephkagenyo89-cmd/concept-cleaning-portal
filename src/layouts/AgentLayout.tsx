import { Outlet } from 'react-router-dom';
import AgentBottomNav from '@/components/agent/AgentBottomNav';

export default function AgentLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6">
        <Outlet />
      </div>
      <AgentBottomNav />
    </div>
  );
}
