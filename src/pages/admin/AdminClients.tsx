import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchListWithCache } from '@/lib/offlineRepo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Phone, MessageCircle, Eye, Users, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import CreateClientDialog from '@/components/booking/CreateClientDialog';

type Client = {
  id: string;
  client_code: string | null;
  full_name: string;
  client_type: 'individual' | 'company';
  company_name: string | null;
  contact_person: string | null;
  kra_pin: string | null;
  email: string | null;
  phone: string;
  whatsapp_number: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  total_spend: number;
  booking_count: number;
  last_booking_date: string | null;
  created_at: string;
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  returning: 'bg-green-100 text-green-800',
  vip: 'bg-amber-100 text-amber-800',
  inactive: 'bg-gray-100 text-gray-600',
};

export default function AdminClients() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', client_type: 'individual' as 'individual' | 'company', company_name: '', contact_person: '', kra_pin: '', email: '', phone: '', location: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadClients();
    checkAdminRole();
  }, []);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (data && (data.role === 'admin' || data.role === 'super_admin')) {
        setIsAdmin(true);
      }
    }
  };

  useEffect(() => {
    if (params.get('create') === '1') {
      setCreateOpen(true);
      params.delete('create');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const loadClients = async () => {
    setLoading(true);
    const data = await fetchListWithCache<Client>('clients', async () =>
      await supabase.from('clients').select('*').order('created_at', { ascending: false })
    );
    setClients(data || []);
    setLoading(false);
  };

  const deleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${clientName}" and ALL associated records?`)) return;
    try {
      // Delete related records
      await supabase.from('bookings').delete().eq('client_id', clientId);
      await supabase.from('customer_notifications').delete().eq('client_id', clientId);
      await supabase.from('documents').delete().eq('client_id', clientId);
      await supabase.from('invoices').delete().eq('client_id', clientId);
      // Then delete the client
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      toast({ title: 'Client deleted successfully' });
      loadClients();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.client_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.location || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: clients.length,
    vip: clients.filter(c => c.status === 'vip').length,
    returning: clients.filter(c => c.status === 'returning').length,
    inactive: clients.filter(c => c.status === 'inactive').length,
  };

  const openEdit = (c: Client) => {
    setEditTarget(c);
    setEditForm({ full_name: c.full_name, client_type: c.client_type || 'individual', company_name: c.company_name || '', contact_person: c.contact_person || '', kra_pin: c.kra_pin || '', email: c.email || '', phone: c.phone, location: c.location || '' });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const phone = editForm.phone.trim();
    const name = editForm.client_type === 'company' ? editForm.company_name.trim() : editForm.full_name.trim();
    if (!name || !phone || (editForm.client_type === 'company' && !editForm.contact_person.trim())) {
      toast({ title: 'Missing fields', description: editForm.client_type === 'company' ? 'Company name, contact person and phone are required.' : 'Name and phone are required.', variant: 'destructive' });
      return;
    }
    setEditSaving(true);

    if (phone !== editTarget.phone) {
      const { data: dup } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', phone)
        .neq('id', editTarget.id)
        .maybeSingle();
      if (dup) {
        setEditSaving(false);
        toast({ title: 'Duplicate phone', description: 'Another client already uses this phone.', variant: 'destructive' });
        return;
      }
    }

    const { error } = await supabase.from('clients').update({
      full_name: name,
      client_type: editForm.client_type,
      company_name: editForm.client_type === 'company' ? name : null,
      contact_person: editForm.client_type === 'company' ? editForm.contact_person.trim() : null,
      kra_pin: editForm.client_type === 'company' ? (editForm.kra_pin.trim() || null) : null,
      email: editForm.email.trim() || null,
      phone,
      whatsapp_number: phone,
      location: editForm.location.trim() || null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', editTarget.id);
    setEditSaving(false);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Client updated' });
    setEditTarget(null);
    loadClients();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Clients (CRM)</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            <Users className="h-3.5 w-3.5 mr-1" />
            {stats.total}
          </Badge>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> New Client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'VIP', value: stats.vip, color: 'text-amber-600' },
          { label: 'Returning', value: stats.returning, color: 'text-green-600' },
          { label: 'Inactive', value: stats.inactive, color: 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID (CL-0001), name, phone, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="returning">Returning</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No clients found</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => (
            <Card key={client.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/admin/clients/${client.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{client.company_name || client.full_name}</p>
                      {client.client_type === 'company' && <Badge variant="outline" className="text-[10px]">Company</Badge>}
                      {client.client_code && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {client.client_code}
                        </span>
                      )}
                      <Badge className={`text-[10px] px-1.5 py-0 capitalize ${statusColors[client.status] || ''}`}>
                        {client.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                    {client.location && <p className="text-xs text-muted-foreground">{client.location}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">Ksh {Number(client.total_spend).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{client.booking_count} booking{client.booking_count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); window.open(`tel:${client.phone}`); }}>
                    <Phone className="h-3 w-3 mr-1" /> Call
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={e => {
                      e.stopPropagation();
                      const num = (client.whatsapp_number || client.phone).replace(/\D/g, '');
                      const wa = num.startsWith('0') ? `254${num.slice(1)}` : num;
                      window.open(`https://wa.me/${wa}`, '_blank');
                    }}>
                    <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); openEdit(client); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {isAdmin && (
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); deleteClient(client.id, client.full_name); }}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={e => { e.stopPropagation(); navigate(`/admin/clients/${client.id}`); }}>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => loadClients()}
      />

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.client_type === 'company' ? 'Company' : 'Client'} {editTarget?.client_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2"><Button type="button" variant={editForm.client_type === 'individual' ? 'default' : 'outline'} onClick={() => setEditForm(f => ({ ...f, client_type: 'individual' }))}>Individual</Button><Button type="button" variant={editForm.client_type === 'company' ? 'default' : 'outline'} onClick={() => setEditForm(f => ({ ...f, client_type: 'company' }))}>Company</Button></div>
            {editForm.client_type === 'company' ? <>
              <div className="space-y-1.5"><Label>Company Name</Label><Input value={editForm.company_name} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Contact Person</Label><Input value={editForm.contact_person} onChange={e => setEditForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>KRA PIN</Label><Input value={editForm.kra_pin} onChange={e => setEditForm(f => ({ ...f, kra_pin: e.target.value.toUpperCase() }))} /></div>
            </> : <div className="space-y-1.5"><Label>Full Name</Label><Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} /></div>}
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              <p className="text-[10px] text-muted-foreground">Phone must be unique across all clients.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
