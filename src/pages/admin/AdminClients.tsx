import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchListWithCache } from '@/lib/offlineRepo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Phone, MessageCircle, Eye, Users, UserPlus, Pencil } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import CreateClientDialog from '@/components/booking/CreateClientDialog';

type Client = {
  id: string;
  client_code: string | null;
  full_name: string;
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
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', location: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  // Auto-open create dialog if ?create=1
  useEffect(() => {
    if (params.get('create') === '1') {
      setCreateOpen(true);
      params.delete('create');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const loadClients = async () => {
    setLoading(true);
    const data = await fetchListWithCache<Client>('clients', () =>
      supabase.from('clients').select('*').order('created_at', { ascending: false })
    );
    setClients(data || []);
    setLoading(false);
  };

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
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
    setEditForm({ full_name: c.full_name, phone: c.phone, location: c.location || '' });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const phone = editForm.phone.trim();
    const name = editForm.full_name.trim();
    if (!name || !phone) {
      toast({ title: 'Missing fields', description: 'Name and phone are required.', variant: 'destructive' });
      return;
    }
    setEditSaving(true);

    // Duplicate phone check (other clients only)
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

      {/* Stats */}
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

      {/* Search & Filter */}
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

      {/* Client List */}
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
                      <p className="font-semibold truncate">{client.full_name}</p>
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

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client {editTarget?.client_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
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
