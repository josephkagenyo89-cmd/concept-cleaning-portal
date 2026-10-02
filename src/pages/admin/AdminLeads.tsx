import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Plus,
  UserRound,
  Phone,
  MapPin,
  ArrowRight,
  Users,
  UserCheck,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

type Lead = {
  id: string;
  lead_code: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  location: string | null;
  service_interest: string | null;
  source: string;
  status: string;
  priority: string;
  estimated_value: number;
  notes: string | null;
  assigned_to: string | null;
  converted_client_id: string | null;
  converted_at: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['qualified', 'Qualified'],
  ['proposal', 'Proposal'],
  ['negotiation', 'Negotiation'],
  ['won', 'Won'],
  ['lost', 'Lost'],
  ['converted', 'Converted'],
];

const SOURCE_OPTIONS = [
  ['website', 'Website'],
  ['whatsapp', 'WhatsApp'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['google', 'Google'],
  ['referral', 'Referral'],
  ['agent', 'Agent'],
  ['walk_in', 'Walk-in'],
  ['phone', 'Phone'],
  ['other', 'Other'],
];

const PRIORITY_OPTIONS = [
  ['low', 'Low'],
  ['normal', 'Normal'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
];

const statusLabel = (value: string) =>
  STATUS_OPTIONS.find(([key]) => key === value)?.[1] || value;

const sourceLabel = (value: string) =>
  SOURCE_OPTIONS.find(([key]) => key === value)?.[1] || value;

const priorityLabel = (value: string) =>
  PRIORITY_OPTIONS.find(([key]) => key === value)?.[1] || value;

const statusClass = (status: string) => {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-700';
    case 'contacted':
      return 'bg-sky-100 text-sky-700';
    case 'qualified':
      return 'bg-emerald-100 text-emerald-700';
    case 'proposal':
      return 'bg-amber-100 text-amber-700';
    case 'negotiation':
      return 'bg-orange-100 text-orange-700';
    case 'won':
    case 'converted':
      return 'bg-green-100 text-green-700';
    case 'lost':
      return 'bg-red-100 text-red-700';
    default:
      return '';
  }
};

const priorityClass = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-700';
    case 'high':
      return 'bg-orange-100 text-orange-700';
    case 'low':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-blue-100 text-blue-700';
  }
};

export default function AdminLeads() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    whatsapp_number: '',
    email: '',
    location: '',
    service_interest: '',
    source: 'other',
    status: 'new',
    priority: 'normal',
    estimated_value: '',
    notes: '',
  });

  const loadLeads = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Unable to load leads',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setLeads((data || []) as Lead[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.lead_code.toLowerCase().includes(q) ||
        lead.full_name.toLowerCase().includes(q) ||
        (lead.phone || '').toLowerCase().includes(q) ||
        (lead.location || '').toLowerCase().includes(q) ||
        (lead.service_interest || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' || lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const stats = useMemo(() => ({
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    qualified: leads.filter((l) => l.status === 'qualified').length,
    converted: leads.filter((l) => l.status === 'converted').length,
    lost: leads.filter((l) => l.status === 'lost').length,
  }), [leads]);

  const resetForm = () => {
    setForm({
      full_name: '',
      phone: '',
      whatsapp_number: '',
      email: '',
      location: '',
      service_interest: '',
      source: 'other',
      status: 'new',
      priority: 'normal',
      estimated_value: '',
      notes: '',
    });
  };

  const createLead = async () => {
    if (!form.full_name.trim()) {
      toast({
        title: 'Name required',
        description: 'Enter the lead name before saving.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('leads').insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      whatsapp_number: form.whatsapp_number.trim() || null,
      email: form.email.trim() || null,
      location: form.location.trim() || null,
      service_interest: form.service_interest.trim() || null,
      source: form.source,
      status: form.status,
      priority: form.priority,
      estimated_value: Number(form.estimated_value) || 0,
      notes: form.notes.trim() || null,
      created_by: user?.id || null,
      assigned_to: user?.id || null,
    });

    if (error) {
      toast({
        title: 'Unable to create lead',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Lead created',
        description: 'The lead has been added to the CRM.',
      });

      resetForm();
      setDialogOpen(false);
      await loadLeads();
    }

    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm">Leads</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold">Sales Leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage prospects before they become clients.
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Lead
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Lead</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name *</label>
                <Input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  placeholder="Lead name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="07XXXXXXXX"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp</label>
                <Input
                  value={form.whatsapp_number}
                  onChange={(e) =>
                    setForm({ ...form, whatsapp_number: e.target.value })
                  }
                  placeholder="WhatsApp number"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="Area / estate"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Service Interest</label>
                <Input
                  value={form.service_interest}
                  onChange={(e) =>
                    setForm({ ...form, service_interest: e.target.value })
                  }
                  placeholder="e.g. Sofa cleaning"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lead Source</label>
                <Select
                  value={form.source}
                  onValueChange={(value) =>
                    setForm({ ...form, source: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm({ ...form, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Estimated Value (KSh)
                </label>
                <Input
                  type="number"
                  min="0"
                  value={form.estimated_value}
                  onChange={(e) =>
                    setForm({ ...form, estimated_value: e.target.value })
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder="Additional information about this lead..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={createLead} disabled={saving}>
                {saving ? 'Saving...' : 'Create Lead'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs">Total</span>
            </div>
            <div className="mt-1 text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs">New</span>
            </div>
            <div className="mt-1 text-2xl font-bold">{stats.new}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              <span className="text-xs">Qualified</span>
            </div>
            <div className="mt-1 text-2xl font-bold">{stats.qualified}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
              <span className="text-xs">Converted</span>
            </div>
            <div className="mt-1 text-2xl font-bold">{stats.converted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span className="text-xs">Lost</span>
            </div>
            <div className="mt-1 text-2xl font-bold">{stats.lost}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Pipeline</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lead name, phone, location or service..."
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading leads...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <UserRound className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 font-semibold">No leads found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first sales lead to start building the pipeline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((lead) => (
            <Card
              key={lead.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/admin/leads/${lead.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserRound className="h-5 w-5 text-primary" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{lead.full_name}</h3>
                        <span className="text-xs text-muted-foreground">
                          {lead.lead_code}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </span>
                        )}

                        {lead.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.location}
                          </span>
                        )}

                        {lead.service_interest && (
                          <span>{lead.service_interest}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={priorityClass(lead.priority)}>
                      {priorityLabel(lead.priority)}
                    </Badge>

                    <Badge className={statusClass(lead.status)}>
                      {statusLabel(lead.status)}
                    </Badge>

                    <Badge variant="outline">
                      {sourceLabel(lead.source)}
                    </Badge>

                    {lead.estimated_value > 0 && (
                      <span className="text-sm font-semibold">
                        KSh {lead.estimated_value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
