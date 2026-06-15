import { useAuth } from '@/contexts/AuthContext';
import DraftBookingsList from '@/components/booking/DraftBookingsList';

export default function AgentDraftBookings() {
  const { user } = useAuth();
  return <DraftBookingsList basePath="/agent/book" scopeAgentId={user?.id} title="My Draft Bookings" />;
}
