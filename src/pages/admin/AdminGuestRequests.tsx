// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { waLink } from '@/components/public/PublicShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Search,
  RefreshCw,
  MessageCircle,
  CalendarDays,
  MapPin,
  ClipboardList,
  Save,
  UserCheck,
} from 'lucide-react';

const STATUS_OPTIONS = [
  ["pending", "Pending"],
  ["under_review", "Under review"],
  ["contacted", "Contacted"],
  ["converted_to_lead", "Converted to lead"],
  ["rejected", "Rejected"],
  ["closed", "Closed"],
];

const statusStyle = {
  pending: "bg-blue-100 text-blue-800",
  under_review: "bg-amber-100 text-amber-800",
  contacted: "bg-sky-100 text-sky-800",
  converted_to_lead: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  closed: "bg-slate-100 text-slate-700",
};

const money = (value) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-KE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

const preferredTime = (value) => (value ? String(value).slice(0, 5) : '—');

export default function AdminGuestRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [notesDraft, setNotesDraft] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError('');
    const { data, error: queryError } = await supabase
      .from('guest_service_requests')
      .select(
        'id, request_reference, request_type, service_id, service_name, service_category, customer_name, customer_phone, customer_notes, location, preferred_date, preferred_time, size_sqm, estimated_amount, discount_amount, status, lead_id, converted_at, converted_by, internal_notes, created_at, updated_at, lead:leads(lead_code)'
      )
      .order('created_at', { ascending: false })
      .limit(300);

    if (queryError) {
      setError(queryError.message || 'Unable to load guest requests.');
      setRequests([]);
    } else {
      setRequests(data || []);
      setNotesDraft(
        Object.fromEntries((data || []).map((item) => [item.id, item.internal_notes || '']))
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' || item.status === statusFilter;

      const searchable = [
        item.request_reference,
        item.customer_name,
        item.customer_phone,
        item.customer_notes,
        item.service_name,
        item.location,
        item.request_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [requests, search, statusFilter]);

  const updateRequest = async (id, updates, successMessage) => {
    setSavingId(id);
    setError('');
    setNotice('');

    const { data, error: updateError } = await supabase
      .from('guest_service_requests')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status, internal_notes, updated_at')
      .single();

    if (updateError) {
      setError(updateError.message || 'Could not update this request.');
    } else {
      setRequests((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...data } : item
        )
      );
      setNotice(successMessage);
    }

    setSavingId('');
  };

  const openWhatsApp = (item) => {
    const message = [
      `Hello ${item.customer_name || 'there'}, this is Concept Cleaning Services.`,
      `We are following up on your ${item.request_type} request ${item.request_reference} for ${item.service_name}.`,
      'Please let us know if you would like us to assist further.',
    ].join('\n');

    window.open(waLink(item.customer_phone, message), '_blank', 'noopener,noreferrer');
  };

  const convertToLead = async (item) => {
    if (item.lead_id) {
      navigate(`/admin/leads/${item.lead_id}`);
      return;
    }

    if (['rejected', 'closed'].includes(item.status)) {
      setError('Rejected or closed requests cannot be converted.');
      return;
    }

    setSavingId(item.id);
    setError('');
    setNotice('');

    try {
      const { data, error: conversionError } = await supabase.rpc(
        'convert_guest_service_request_to_lead',
        { p_request_id: item.id }
      );

      if (conversionError) throw conversionError;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.lead_id) {
        throw new Error('The conversion did not return a CRM lead.');
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === item.id
            ? {
                ...request,
                status: 'converted_to_lead',
                lead_id: result.lead_id,
                converted_at: new Date().toISOString(),
                lead: { lead_code: result.lead_code },
              }
            : request
        )
      );

      setNotice(
        result.already_converted
          ? 'This request was already converted. The existing CRM lead is linked.'
          : result.reused_existing_lead
            ? `Guest request linked to existing CRM lead ${result.lead_code || ''}.`
            : `Guest request converted successfully. New CRM lead: ${result.lead_code || result.lead_id}.`
      );
    } catch (conversionError) {
      setError(
        conversionError?.message ||
        'Unable to convert this guest request into a CRM lead.'
      );
    } finally {
      setSavingId('');
    }
  };

  const counts = useMemo(
    () =>
      STATUS_OPTIONS.reduce((result, [key]) => {
        result[key] = requests.filter((item) => item.status === key).length;
        return result;
      }, {}),
    [requests]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            <h1 className="text-2xl font-bold tracking-tight">Guest Requests</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Public landing-page booking and quotation enquiries. These are requests, not confirmed ERP bookings.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadRequests(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">All requests</p>
            <p className="mt-1 text-2xl font-bold">{requests.length}</p>
          </CardContent>
        </Card>
        {STATUS_OPTIONS.map(([key, label]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{counts[key] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, guest, phone, service or location..."
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-52"
          aria-label="Filter guest requests by status"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading guest requests…</div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <ClipboardList className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 font-semibold">No guest requests found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New public booking and quotation enquiries will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{item.request_reference}</CardTitle>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[item.status] || ''}`}>
                        {STATUS_OPTIONS.find(([key]) => key === item.status)?.[1] || item.status}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {item.request_type === 'booking' ? 'Booking request' : 'Quotation request'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Received {dateTime(item.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={item.status}
                      disabled={savingId === item.id || item.status === "converted_to_lead"}
                      onChange={(event) =>
                        updateRequest(item.id, { status: event.target.value }, 'Request status updated.')
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      aria-label={`Update status for ${item.request_reference}`}
                    >
                      {STATUS_OPTIONS.filter(([key]) => key !== 'converted_to_lead' || item.status === key).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    {item.lead_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/admin/leads/${item.lead_id}`)}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        View CRM lead {item.lead?.lead_code ? `(${item.lead.lead_code})` : ''}
                      </Button>
                    ) : !['rejected', 'closed'].includes(item.status) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => convertToLead(item)}
                        disabled={savingId === item.id}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        {savingId === item.id ? 'Converting…' : 'Convert to CRM lead'}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={() => openWhatsApp(item)}
                      disabled={!item.customer_phone}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Guest</p>
                    <p className="font-semibold">{item.customer_name || 'Name not provided'}</p>
                    <p className="text-sm">{item.customer_phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Requested service</p>
                    <p className="font-semibold">{item.service_name}</p>
                    {item.service_category && (
                      <p className="text-sm text-muted-foreground">{item.service_category}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preferred schedule</p>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {item.preferred_date || '—'} at {preferredTime(item.preferred_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {item.location}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimate</p>
                    <p className="font-semibold">{money(item.estimated_amount)}</p>
                    {Number(item.discount_amount) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Includes discount of {money(item.discount_amount)}
                      </p>
                    )}
                  </div>
                  {item.size_sqm && (
                    <div>
                      <p className="text-xs text-muted-foreground">Area size</p>
                      <p className="font-medium">{item.size_sqm} sq m</p>
                    </div>
                  )}
                </div>

                {item.customer_notes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      Message from customer
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{item.customer_notes}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <label className="mb-2 block text-sm font-semibold" htmlFor={`notes-${item.id}`}>
                    Internal notes
                  </label>
                  <Textarea
                    id={`notes-${item.id}`}
                    value={notesDraft[item.id] ?? ''}
                    onChange={(event) =>
                      setNotesDraft((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    placeholder="Add follow-up notes for the team..."
                    rows={2}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingId === item.id}
                      onClick={() =>
                        updateRequest(
                          item.id,
                          { internal_notes: notesDraft[item.id] ?? '' },
                          'Internal notes saved.'
                        )
                      }
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {savingId === item.id ? 'Saving…' : 'Save notes'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Showing up to 300 most recent requests. Converted enquiries are linked to CRM leads; bookings and quotations continue through the existing ERP workflows.
      </p>
    </div>
  );
}
