import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

const roleMeta: Record<string, { label: string; className: string }> = {
  super_admin: { label: 'Super Admin', className: 'bg-destructive text-destructive-foreground hover:bg-destructive/90' },
  admin: { label: 'Admin', className: 'bg-accent text-accent-foreground hover:bg-accent/90' },
  agent: { label: 'Agent', className: 'bg-info text-info-foreground hover:bg-info/90' },
};

export default function ProfileHeader() {
  const { profile, roles } = useAuth();
  if (!profile) return null;

  const topRole = roles.includes('super_admin')
    ? 'super_admin'
    : roles.includes('admin')
      ? 'admin'
      : 'agent';
  const meta = roleMeta[topRole];

  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
        {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Welcome,</p>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">{profile.full_name}</h2>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>
      </div>
    </div>
  );
}
