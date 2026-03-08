import { Outlet } from 'react-router-dom';
import AgentBottomNav from '@/components/agent/AgentBottomNav';
import WhatsAppButton from '@/components/WhatsAppButton';
import AiChatAssistant from '@/components/AiChatAssistant';
import BlockingNoticeModal from '@/components/notices/BlockingNoticeModal';
import { useBlockingNotices } from '@/components/notices/useBlockingNotices';

export default function AgentLayout() {
  const { blockingNotices, refresh } = useBlockingNotices();

  return (
    <div className="min-h-screen bg-background">
      <BlockingNoticeModal notices={blockingNotices} onAcknowledged={refresh} />
      <div className="mx-auto max-w-lg px-4 py-6">
        <Outlet />
      </div>
      <WhatsAppButton />
      <AiChatAssistant />
      <AgentBottomNav />
    </div>
  );
}
