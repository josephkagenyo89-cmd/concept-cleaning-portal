import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import StatusBadge from '@/components/agent/StatusBadge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Download, FileText, Printer, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

export default function AdminBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [agents, setAgents] = useState<{ user_id: string; full_name: string }[]>([]);
  const [commissions, setCommissions] = useState<Record<string, { amount: number; bonus: number }>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    let q = supabase.from('bookings').select('*, services(name, category)').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter as any);
    if (agentFilter !== 'all') q = q.eq('agent_id', agentFilter);
    if (dateFrom) q = q.gte('created_at', dateFrom.toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59);
      q = q.lte('created_at', end.toISOString());
    }
    const { data } = await q;

    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone');
    const profileMap: Record<string, { name: string; phone: string }> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = { name: p.full_name, phone: p.phone }; });
    setAgents((profiles || []).map(p => ({ user_id: p.user_id, full_name: p.full_name })));

    // Load commissions
    const bookingIds = (data || []).map(b => b.id);
    if (bookingIds.length > 0) {
      const { data: comms } = await supabase.from('commissions').select('booking_id, amount, bonus_amount').in('booking_id', bookingIds);
      const commMap: Record<string, { amount: number; bonus: number }> = {};
      (comms || []).forEach(c => { commMap[c.booking_id] = { amount: Number(c.amount), bonus: Number(c.bonus_amount) }; });
      setCommissions(commMap);
    }

    setBookings((data || []).map(b => ({
      ...b,
      agent_name: profileMap[b.agent_id]?.name || 'Unknown',
      agent_phone: profileMap[b.agent_id]?.phone || '',
    })));
  };

  useEffect(() => { load(); }, [filter, agentFilter, dateFrom, dateTo]);

  const filtered = bookings.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return b.client_name?.toLowerCase().includes(s) || b.agent_name?.toLowerCase().includes(s) || b.id?.toLowerCase().includes(s);
  });

  const updateStatus = async (id: string, status: Database['public']['Enums']['booking_status'], agentId: string, price: number, commissionCreated: boolean) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    // Only create commission if completing AND commission hasn't been created yet
    if (status === 'completed' && user && !commissionCreated) {
      const { data: completed } = await supabase.from('bookings').select('price').eq('agent_id', agentId).eq('status', 'completed');
      const cumRev = (completed || []).reduce((s, b) => s + Number(b.price), 0);
      const { getTier, calculateCommission } = await import('@/lib/commission');
      const tier = getTier(cumRev);
      const comm = calculateCommission(price, tier);
      const { error: commError } = await supabase.from('commissions').insert({ booking_id: id, agent_id: agentId, amount: comm.commission, bonus_amount: comm.bonus, tier_at_time: tier });
      if (commError) {
        // Unique constraint violation means commission already exists — skip
        if (!commError.message.includes('duplicate') && !commError.code?.includes('23505')) {
          toast({ title: 'Commission error', description: commError.message, variant: 'destructive' });
        }
      } else {
        await supabase.from('wallet_ledger').insert({ agent_id: agentId, type: 'credit', amount: comm.total, description: `Commission for booking`, reference_id: id });
        // Mark booking as commission created
        await supabase.from('bookings').update({ commission_created: true } as any).eq('id', id);
      }
      await supabase.from('audit_logs').insert({ admin_id: user.id, action: 'booking_completed', target_type: 'booking', target_id: id, details: { commission: comm.total, tier } });
    }
    toast({ title: `Booking ${status}` });
    load();
  };

  const downloadCSV = () => {
    const headers = ['Booking ID', 'Date', 'Category', 'Service', 'Price', 'Commission', 'Bonus', 'Client', 'Phone', 'Location', 'Agent', 'Agent Phone', 'Status'];
    const rows = filtered.map(b => {
      const c = commissions[b.id];
      return [b.id, format(new Date(b.created_at), 'yyyy-MM-dd'), (b as any).services?.category || '', (b as any).services?.name || '', b.price, c?.amount || 0, c?.bonus || 0, b.client_name, b.client_phone, b.location, b.agent_name, b.agent_phone, b.status];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bookings-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async (single?: any) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Concept Cleaning Services - Bookings Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 22);

    const items = single ? [single] : filtered;
    const rows = items.map(b => {
      const c = commissions[b.id];
      return [b.id.slice(0, 8), format(new Date(b.created_at), 'dd/MM/yy'), (b as any).services?.category || '', (b as any).services?.name || '', `Ksh ${Number(b.price).toLocaleString()}`, c ? `Ksh ${c.amount.toLocaleString()}` : '-', c?.bonus ? `Ksh ${c.bonus.toLocaleString()}` : '-', b.client_name, b.client_phone, b.location, b.agent_name, b.agent_phone, b.status];
    });
    autoTable(doc, {
      startY: 28,
      head: [['ID', 'Date', 'Category', 'Service', 'Price', 'Commission', 'Bonus', 'Client', 'Phone', 'Location', 'Agent', 'Agent Ph.', 'Status']],
      body: rows,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [14, 119, 86] },
    });
    doc.save(single ? `booking-${single.id.slice(0, 8)}.pdf` : `bookings-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handlePrint = () => { window.print(); };

  return (
    <div ref={printRef}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => downloadPDF()}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />Print</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search client, agent, ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[120px] justify-start text-left text-xs", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3 w-3" />{dateFrom ? format(dateFrom, 'dd/MM/yy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="pointer-events-auto" /></PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[120px] justify-start text-left text-xs", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3 w-3" />{dateTo ? format(dateTo, 'dd/MM/yy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="pointer-events-auto" /></PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && <Button size="sm" variant="ghost" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Clear</Button>}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No bookings</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const c = commissions[b.id];
            return (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="space-y-0.5">
                      <p className="font-semibold">{b.client_name}</p>
                      <p className="text-xs text-muted-foreground">{b.client_phone} · {b.location}</p>
                      <p className="text-xs text-muted-foreground">Agent: {b.agent_name} · {b.agent_phone}</p>
                      <p className="text-xs text-muted-foreground">
                        {(b as any).services?.category} → {(b as any).services?.name || 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">Date: {format(new Date(b.service_date), 'PPP')}</p>
                      <p className="text-xs text-muted-foreground">ID: {b.id.slice(0, 8)}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="font-bold">Ksh {Number(b.price).toLocaleString()}</p>
                      {c && <p className="text-xs text-muted-foreground">Comm: Ksh {c.amount.toLocaleString()}{c.bonus > 0 ? ` +${c.bonus.toLocaleString()} bonus` : ''}</p>}
                      <StatusBadge status={b.status} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {b.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(b.id, 'confirmed', b.agent_id, Number(b.price))}>Confirm</Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(b.id, 'cancelled', b.agent_id, Number(b.price))}>Cancel</Button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(b.id, 'completed', b.agent_id, Number(b.price))}>Mark Completed</Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(b.id, 'cancelled', b.agent_id, Number(b.price))}>Cancel</Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => downloadPDF(b)}><FileText className="h-3 w-3 mr-1" />PDF</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
