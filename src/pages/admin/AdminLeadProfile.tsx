// @ts-nocheck
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  UserRound,
  Calendar,
  CheckCircle2,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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

const statusLabel = (value: string) =>
  STATUS_OPTIONS.find(([key]) => key === value)?.[1] || value;

export default function AdminLeadProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<any>(null);

  const loadTransaction = async (bookingId: string | null) => {
    if (!bookingId) {
      setTransaction(null);
      return;
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_code, status, price, amount_paid, service_date, client_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) {
      setTransaction(null);
      return;
    }

    const [{ data: quotation }, { data: invoice }] = await Promise.all([
      supabase
        .from('quotations')
        .select('id, quotation_number, local_id, price, subtotal, discount_amount')
        .eq('local_id', booking.booking_code)
        .maybeSingle(),
      supabase
        .from('invoices')
        .select('id, invoice_number, amount, payment_status, mpesa_code, payment_date, booking_id')
        .eq('booking_id', booking.id)
        .maybeSingle(),
    ]);

    const invoiceAmount = Number(invoice?.amount || 0);
    const amountPaid = Number(booking.amount_paid || 0);

    setTransaction({
      booking,
      quotation,
      invoice,
      invoiceAmount,
      amountPaid,
      balance: Math.max(0, invoiceAmount - amountPaid),
    });
  };
  const [saving, setSaving] = useState(false);
  const [activityText, setActivityText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);

    const [leadResult, activitiesResult, tasksResult] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('crm_activities')
        .select('*')
        .eq('lead_id', id)
        .order('activity_date', { ascending: false }),
      supabase
        .from('crm_tasks')
        .select('*')
        .eq('lead_id', id)
        .order('due_at', { ascending: true }),
    ]);

    if (leadResult.error) {
      toast({
        title: 'Unable to load lead',
        description: leadResult.error.message,
        variant: 'destructive',
      });
    }

    setLead(leadResult.data);
    setActivities(activitiesResult.data || []);
    setTasks(tasksResult.data || []);

    if (leadResult.data?.booking_id) {
      await loadTransaction(leadResult.data.booking_id);
    } else {
      setTransaction(null);
    }

    setLoading(false);
  };

  const updateStatus = async (status: string) => {
    if (!id) return;

    const { error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Unable to update status',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setLead((current: any) => ({ ...current, status }));
    toast({ title: 'Lead status updated' });
  };

  const saveActivity = async () => {
    if (!id || !activityText.trim()) return;

    setSaving(true);

    const { error } = await supabase.from('crm_activities').insert({
      lead_id: id,
      activity_type: 'note',
      subject: 'CRM Note',
      description: activityText.trim(),
      activity_date: new Date().toISOString(),
      created_by: user?.id,
    });

    if (error) {
      toast({
        title: 'Unable to save activity',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setActivityText('');
      await loadData();
      toast({ title: 'Activity added' });
    }

    setSaving(false);
  };

  const addTask = async () => {
    if (!id || !taskTitle.trim()) return;

    setSaving(true);

    const { error } = await supabase.from('crm_tasks').insert({
      lead_id: id,
      title: taskTitle.trim(),
      task_type: 'follow_up',
      status: 'pending',
      priority: 'normal',
      assigned_to: user?.id,
      created_by: user?.id,
    });

    if (error) {
      toast({
        title: 'Unable to create task',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setTaskTitle('');
      await loadData();
      toast({ title: 'Follow-up task created' });
    }

    setSaving(false);
  };

  const completeTask = async (taskId: string) => {
    const { error } = await supabase
      .from('crm_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) {
      toast({
        title: 'Unable to complete task',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    await loadData();
  };

  const convertToClient = async () => {
    if (!lead || !user?.id) return;

    if (!lead.phone) {
      toast({
        title: 'Phone number required',
        description: 'Add a phone number to the lead before converting it.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { data: existingClient, error: lookupError } = await supabase
      .from('clients')
      .select('id, full_name, phone, client_code')
      .eq('phone', lead.phone)
      .maybeSingle();

    if (lookupError) {
      toast({
        title: 'Unable to check existing clients',
        description: lookupError.message,
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    let client = existingClient;

    if (!client) {
      const { data: createdClient, error: createError } = await supabase
        .from('clients')
        .insert({
          full_name: lead.full_name,
          phone: lead.phone,
          whatsapp_number: lead.whatsapp_number || null,
          location: lead.location || null,
          notes: lead.notes || null,
          status: 'new',
          created_by: user.id,
          created_by_role: 'admin',
        })
        .select('id, full_name, phone, client_code')
        .single();

      if (createError) {
        toast({
          title: 'Unable to create client',
          description: createError.message,
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      client = createdClient;
    }

    const { error: leadUpdateError } = await supabase
      .from('leads')
      .update({
        status: 'converted',
        converted_client_id: client.id,
        converted_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (leadUpdateError) {
      toast({
        title: 'Unable to convert lead',
        description: leadUpdateError.message,
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    await supabase.from('crm_activities').insert({
      lead_id: id,
      client_id: client.id,
      activity_type: 'other',
      subject: 'Lead converted to client',
      description: `Lead converted to existing client ${client.client_code || client.id}.`,
      activity_date: new Date().toISOString(),
      created_by: user.id,
    });

    toast({
      title: 'Lead converted',
      description: 'The existing Clients CRM record is now linked to this lead.',
    });

    setSaving(false);
    navigate(`/admin/clients/${client.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Lead not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/admin/leads')}
        >
          Back to Leads
        </Button>
      </div>
    );
  }

  const waNumber = ((lead.whatsapp_number || lead.phone || '') as string).replace(/\D/g, '');
  const waFormatted = waNumber.startsWith('0')
    ? `254${waNumber.slice(1)}`
    : waNumber;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/admin/leads')}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Leads
      </Button>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{lead.full_name}</h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {lead.lead_code}
                </span>
              </div>

              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                {lead.phone && <p>{lead.phone}</p>}
                {lead.email && <p>{lead.email}</p>}
                {lead.location && <p>{lead.location}</p>}
                {lead.service_interest && (
                  <p>Interested in: {lead.service_interest}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={statusClass(lead.status)}>
                {statusLabel(lead.status)}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {lead.priority}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {lead.phone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`tel:${lead.phone}`)}
              >
                <Phone className="h-3.5 w-3.5 mr-1" />
                Call
              </Button>
            )}

            {waNumber && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`https://wa.me/${waFormatted}`, '_blank')
                }
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                WhatsApp
              </Button>
            )}

            {!lead.converted_client_id && (
              <Button size="sm" onClick={convertToClient} disabled={saving}>
                <UserRound className="h-3.5 w-3.5 mr-1" />
                {saving ? 'Converting...' : 'Convert to Client'}
              </Button>
            )}

            {lead.converted_client_id && (
              <Button
                size="sm"
                onClick={() =>
                  navigate(`/admin/clients/${lead.converted_client_id}`)
                }
              >
                View Client
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium mb-2">Lead Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(([value, label]) => (
                <Button
                  key={value}
                  variant={lead.status === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStatus(value)}
                  disabled={lead.status === value}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {transaction && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Transaction 360</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Complete commercial lifecycle for this lead
                </p>
              </div>
              <Badge variant="secondary">
                {transaction.invoice?.payment_status === 'paid'
                  ? transaction.booking?.status === 'completed'
                    ? 'Completed · Paid'
                    : 'Paid'
                  : transaction.invoice
                    ? transaction.invoice.payment_status === 'partial'
                      ? 'Partially Paid'
                      : 'Invoiced'
                    : transaction.quotation
                      ? 'Quoted'
                      : 'Booked'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booking</p>
                <p className="font-semibold mt-1">{transaction.booking.booking_code || transaction.booking.id}</p>
                <p className="text-sm text-muted-foreground capitalize mt-1">
                  {String(transaction.booking.status || "").replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Service: {transaction.booking.service_date}
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(`/admin/bookings/${transaction.booking.id}`)}>
                  View Booking
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quotation</p>
                {transaction.quotation ? (
                  <>
                    <p className="font-semibold mt-1">{transaction.quotation.quotation_number}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      KSh {Number(transaction.quotation.price || 0).toLocaleString()}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">No quotation generated yet.</p>
                )}
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice & Payment</p>
                {transaction.invoice ? (
                  <>
                    <p className="font-semibold mt-1">{transaction.invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground mt-1">Amount: KSh {transaction.invoiceAmount.toLocaleString()}</p>
                    <p className="text-sm mt-1 capitalize">Status: {String(transaction.invoice.payment_status || "").replace(/_/g, " ")}</p>
                    <p className="text-sm text-muted-foreground mt-1">Paid: KSh {transaction.amountPaid.toLocaleString()}</p>
                    <p className="text-sm font-medium mt-1">Balance: KSh {transaction.balance.toLocaleString()}</p>
                    {transaction.invoice.mpesa_code && <p className="text-xs text-muted-foreground mt-2">M-Pesa: {transaction.invoice.mpesa_code}</p>}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">Invoice not generated yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {lead.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lead Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add CRM Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={activityText}
            onChange={(e) => setActivityText(e.target.value)}
            placeholder="Record a call, WhatsApp conversation, meeting, enquiry or other interaction..."
            rows={3}
          />
          <Button
            size="sm"
            onClick={saveActivity}
            disabled={saving || !activityText.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Activity
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Activity Timeline ({activities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No CRM activities yet.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="border-l-2 border-primary/20 pl-4"
                >
                  <p className="font-medium text-sm">
                    {activity.subject || activity.activity_type}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(activity.activity_date), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Follow-Up Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Call client tomorrow about sofa cleaning quotation"
              rows={2}
            />
            <Button
              size="sm"
              className="shrink-0"
              onClick={addTask}
              disabled={saving || !taskTitle.trim()}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No follow-up tasks yet.
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        task.status === 'completed'
                          ? 'line-through text-muted-foreground'
                          : ''
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {task.priority} · {task.status.replace('_', ' ')}
                    </p>
                  </div>

                  {task.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => completeTask(task.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Complete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Lead created{' '}
            {format(new Date(lead.created_at), 'dd MMM yyyy, HH:mm')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
