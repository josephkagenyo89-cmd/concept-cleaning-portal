import ProfileHeader from '@/components/ProfileHeader';
import NoticeManagement from '@/components/notices/NoticeManagement';

export default function AdminNotices() {
  return (
    <div className="space-y-6">
      <ProfileHeader />
      <h1 className="text-2xl font-bold">Notices</h1>
      <NoticeManagement />
    </div>
  );
}
