import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onCreated: () => void;
}

export default function CreateNoticeDialog({ onCreated }: Props) {
  const { user, isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    target_role: 'agent' as 'agent' | 'admin' | 'all',
    priority: 'normal' as 'normal' | 'important' | 'urgent',
    is_pinned: false,
    requires_acknowledgement: false,
    is_blocking: false,
    acknowledgement_deadline: '',
    expires_at: '',
    link_url: '',
    link_label: '',
    open_in_new_tab: true,
  });

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim() || !user) return;
    setSaving(true);
    try {
      // Validate link URL if provided
      if (form.link_url.trim()) {
        const allowedPrefixes = ['https://', 'http://', 'mailto:', 'tel:', 'https://wa.me/'];
        const blocked = ['javascript:', 'data:'];
        const url = form.link_url.trim();
        if (blocked.some(b => url.toLowerCase().startsWith(b))) {
          toast.error('Invalid link URL');
          setSaving(false);
          return;
        }
        if (!allowedPrefixes.some(p => url.toLowerCase().startsWith(p))) {
          toast.error('Link must start with https://, http://, mailto:, tel:, or https://wa.me/');
          setSaving(false);
          return;
        }
      }
      const { error } = await supabase.from('notices').insert({
        title: form.title,
        message: form.message,
        target_role: form.target_role,
        priority: form.priority,
        is_pinned: form.is_pinned,
        requires_acknowledgement: form.requires_acknowledgement,
        is_blocking: form.is_blocking,
        acknowledgement_deadline: form.acknowledgement_deadline || null,
        expires_at: form.expires_at || null,
        created_by: user.id,
        link_url: form.link_url.trim() || null,
        link_label: form.link_label.trim() || null,
        open_in_new_tab: form.open_in_new_tab,
      });
      if (error) throw error;
      toast.success('Notice created');
      setOpen(false);
      setForm({ title: '', message: '', target_role: 'agent', priority: 'normal', is_pinned: false, requires_acknowledgement: false, is_blocking: false, acknowledgement_deadline: '', expires_at: '' });
      onCreated();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create notice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><PlusCircle className="mr-2 h-4 w-4" /> Create Notice</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Notice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Target Role</Label>
              <Select value={form.target_role} onValueChange={v => setForm(f => ({ ...f, target_role: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agents</SelectItem>
                  {isSuperAdmin && <SelectItem value="admin">Admins</SelectItem>}
                  {isSuperAdmin && <SelectItem value="all">All</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Pinned</Label>
              <Switch checked={form.is_pinned} onCheckedChange={v => setForm(f => ({ ...f, is_pinned: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Requires Acknowledgement</Label>
              <Switch checked={form.requires_acknowledgement} onCheckedChange={v => setForm(f => ({ ...f, requires_acknowledgement: v, is_blocking: v ? f.is_blocking : false }))} />
            </div>
            {form.requires_acknowledgement && (
              <>
                <div className="flex items-center justify-between">
                  <Label>Blocking (prevents dashboard access)</Label>
                  <Switch checked={form.is_blocking} onCheckedChange={v => setForm(f => ({ ...f, is_blocking: v }))} />
                </div>
                <div>
                  <Label>Acknowledgement Deadline (optional)</Label>
                  <Input type="datetime-local" value={form.acknowledgement_deadline} onChange={e => setForm(f => ({ ...f, acknowledgement_deadline: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <Label>Expires At (optional)</Label>
              <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={saving || !form.title.trim()} className="w-full">
            {saving ? 'Creating...' : 'Create Notice'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
