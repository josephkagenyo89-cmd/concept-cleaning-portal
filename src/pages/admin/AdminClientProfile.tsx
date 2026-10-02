import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { readRecordById, fetchListWithCache } from '@/lib/offlineRepo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Plus,
  Calendar,
  DollarSign,
  BookOpen,
  FileText,
  Clock,
  CheckCircle2,
  ListTodo,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  returning: 'bg-green-100 text-green-800',
  vip: 'bg-amber-100 text-amber-800',
  inactive: 'bg-gray-100 text-gray-600',
};

export default function AdminClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [client, setClient] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [activityText, setActivityText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);

    const [clientRow, bookingsRows, invoicesRows, incomeRows, quotationsResult, activitiesResult, tasksResult] =
      await Promise.all([
        readRecordById('clients', id as string),
        fetchListWithCache<any>(
          'bookings',
          async () =>
            await supabase
              .from('bookings')
              .select('*, services(name)')
              .eq('client_id', id as string)
              .order('created_at', { ascending: false }),
          (b) => b.client_id === id,
        ),
        fetchListWithCache<any>(
          'invoices',
          async () =>
            await supabase
              .from('invoices')
              .select('*')
              .eq('client_id', id as string)
              .order('created_at', { ascending: false }),
          (i) => i.client_id === id,
        ),
        (async () => {
          try {
            const { data } = await (supabase.from('income_records').select('*') as any)
              .eq('client_id', id as string)
              .order('date', { ascending: false });
            return (data as any[]) || [];
          } catch {
            return [];
          }
        })(),
        supabase
          .from('quotations' as any)
          .select('*')
          .eq('client_id', id as string)
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_activities')
          .select('*')
          .eq('client_id', id as string)
          .order('activity_date', { ascending: false }),
        supabase
          .from('crm_tasks')
          .select('*')
          .eq('client_id', id as string)
          .order('due_at', { ascending: true }),
      ]);

    if (clientRow) {
      setClient(clientRow);
      setNotes((clientRow as any).notes || '');
    }

    setBookings(bookingsRows);
    setInvoices(invoicesRows);
    setIncome(incomeRows);
    setQuotations((quotationsResult.data as any[]) || []);
    setActivities((activitiesResult.data as any[]) || []);
    setTasks((tasksResult.data as any[]) || []);
    setLoading(false);
  };

  const saveNotes = async () => {
    if (!id) return;

    setSaving(true);

    const { error } = await supabase
      .from('clients')
      .update({ notes } as any)
      .eq('id', id);

    setSaving(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Notes saved' });
    }
  };

  const saveActivity = async () => {
    if (!id || !activityText.trim()) return;

    setSaving(true);

    const { error } = await supabase.from('crm_activities').insert({
      client_id: id,
      activity_type: 'note',
      subject: 'Customer Note',
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
      client_id: id,
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/admin/clients')}
        >
          Go Back
        </Button>
      </div>
    );
  }

  const waNumber = ((client.whatsapp_number || client.phone) as string).replace(/\D/g, '');
  const waFormatted = waNumber.startsWith('0')
    ? `254${waNumber.slice(1)}`
    : waNumber;

  const pendingTasks = tasks.filter((task) => task.status !== 'completed');

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/admin/clients')}
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Clients
      </Button>

      {/* Customer Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{client.full_name}</h1>

                {client.client_code && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {client.client_code}
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground">{client.phone}</p>

              {client.location && (
                <p className="text-sm text-muted-foreground">{client.location}</p>
              )}
            </div>

            <Badge className={`capitalize ${statusColors[client.status] || ''}`}>
              {client.status}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="font-bold text-sm">
                Ksh {Number(client.total_spend).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">Total Spend</p>
            </div>

            <div className="text-center p-3 rounded-lg bg-muted/50">
              <BookOpen className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="font-bold text-sm">{client.booking_count}</p>
              <p className="text-[10px] text-muted-foreground">Bookings</p>
            </div>

            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Calendar className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="font-bold text-sm">
                {client.last_booking_date
                  ? format(new Date(client.last_booking_date), 'dd MMM')
                  : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">Last Booking</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`tel:${client.phone}`)}
            >
              <Phone className="h-3.5 w-3.5 mr-1" /> Call
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`https://wa.me/${waFormatted}`, '_blank')
              }
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
            </Button>

            <Button
              size="sm"
              onClick={() => navigate('/admin/book-service')}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> New Booking
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CRM Activities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            CRM Activity
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <Textarea
            value={activityText}
            onChange={(e) => setActivityText(e.target.value)}
            placeholder="Record a call, WhatsApp conversation, customer request or follow-up note..."
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

          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No CRM activity recorded yet
            </p>
          ) : (
            <div className="space-y-2 pt-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-3 rounded-lg bg-muted/30 text-sm"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{activity.subject}</p>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {format(
                        new Date(activity.activity_date),
                        'dd MMM yyyy, HH:mm',
                      )}
                    </span>
                  </div>

                  {activity.description && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {activity.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Tasks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Follow-Up Tasks
            {pendingTasks.length > 0 && (
              <Badge variant="secondary">{pendingTasks.length} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Add a follow-up task..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask();
              }}
            />

            <Button
              onClick={addTask}
              disabled={saving || !taskTitle.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No follow-up tasks yet
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 text-sm"
                >
                  <div className="min-w-0">
                    <p
                      className={`font-medium ${
                        task.status === 'completed'
                          ? 'line-through text-muted-foreground'
                          : ''
                      }`}
                    >
                      {task.title}
                    </p>

                    <p className="text-[11px] text-muted-foreground capitalize">
                      {task.priority} · {task.status.replace(/_/g, ' ')}
                    </p>
                  </div>

                  {task.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completeTask(task.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Done
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quotations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Quotations ({quotations.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No quotations yet
            </p>
          ) : (
            <div className="space-y-2">
              {quotations.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm"
                >
                  <div>
                    <p className="font-medium">{q.quotation_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.service_name || 'Service'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(q.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">
                      Ksh {Number(q.price || q.subtotal || 0).toLocaleString()}
                    </p>
                    {q.service_date && (
                      <p className="text-[10px] text-muted-foreground">
                        Service: {format(new Date(q.service_date), 'dd MMM yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discount History */}
      {(() => {
        const discounted = bookings.filter(
          (b: any) => Number(b.discount_amount || 0) > 0,
        );

        const totalDiscount = discounted.reduce(
          (s, b) => s + Number(b.discount_amount || 0),
          0,
        );

        if (discounted.length === 0) return null;

        const last = discounted[0];

        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Discount History</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Total Saved</p>
                  <p className="font-semibold">
                    Ksh {totalDiscount.toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Discounts</p>
                  <p className="font-semibold">{discounted.length}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Last</p>
                  <p className="font-semibold">
                    {format(new Date(last.created_at), 'dd MMM')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Customer Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Customer Notes</CardTitle>
        </CardHeader>

        <CardContent className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add permanent notes about this customer..."
            rows={3}
          />

          <Button size="sm" onClick={saveNotes} disabled={saving}>
            {saving ? 'Saving...' : 'Save Notes'}
          </Button>
        </CardContent>
      </Card>

      {/* Booking History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Booking History ({bookings.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No bookings yet
            </p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {b.services?.name || 'Service'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(b.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">
                      Ksh {Number(b.price).toLocaleString()}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                    >
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Invoices ({invoices.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No invoices yet
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm"
                >
                  <div>
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.service}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">
                      Ksh {Number(inv.amount).toLocaleString()}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                    >
                      {inv.payment_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Payment History ({income.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {income.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No payments recorded yet
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {income.map((rec: any) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {(rec.payment_method || '').replace(/_/g, ' ')}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {format(new Date(rec.date), 'dd MMM yyyy')}
                        {rec.mpesa_code ? ` · ${rec.mpesa_code}` : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        Ksh {Number(rec.amount).toLocaleString()}
                      </p>

                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {(rec.status || '').replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t flex justify-between text-sm font-semibold">
                <span>Total Income</span>
                <span className="text-green-600">
                  Ksh{' '}
                  {income
                    .reduce((s, r) => s + Number(r.amount || 0), 0)
                    .toLocaleString()}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
