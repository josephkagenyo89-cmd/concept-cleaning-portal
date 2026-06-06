import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchListWithCache } from '@/lib/offlineRepo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Award, Download, Share2, Search, CalendarIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { CertificateRecord, downloadCertificate, shareCertificateWhatsApp } from '@/lib/serviceCertificates';
import { cn } from '@/lib/utils';

export default function AdminCertificates() {
  const [certs, setCerts] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  const load = async () => {
    setLoading(true);
    const data = await fetchListWithCache<CertificateRecord>('service_certificates', async () =>
      await (supabase as any)
        .from('service_certificates')
        .select('*')
        .order('date_created', { ascending: false })
    );
    setCerts(data);

    const generators = Array.from(
      new Map(((data || []) as CertificateRecord[]).map(c => [c.generated_by, c.generated_by_name || 'Unknown'])).entries()
    ).map(([id, name]) => ({ id, name }));
    setAgents(generators);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return certs.filter(c => {
      if (agentFilter !== 'all' && c.generated_by !== agentFilter) return false;
      if (dateFrom && new Date(c.date_created) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59);
        if (new Date(c.date_created) > end) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [c.certificate_number, c.client_name, c.client_phone, c.invoice_number, c.mpesa_code, c.client_location, c.services]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [certs, search, agentFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="h-6 w-6 text-primary" /> Service Completion Certificates</h1>
          <p className="text-sm text-muted-foreground">All issued certificates. Re-download or share at any time — data is permanently stored.</p>
        </div>
        <Badge variant="outline" className="text-sm">{filtered.length} certificate{filtered.length === 1 ? '' : 's'}</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by client, cert #, phone, M-Pesa…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
          >
            <option value="all">All issuers</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(!dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {dateFrom ? format(dateFrom, 'PP') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus /></PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(!dateTo && 'text-muted-foreground')}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {dateTo ? format(dateTo, 'PP') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus /></PopoverContent>
          </Popover>
          {(dateFrom || dateTo || search || agentFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setSearch(''); setAgentFilter('all'); }}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading certificates…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Award className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-medium">No certificates yet</p>
              <p className="text-sm text-muted-foreground">Generate a certificate from a paid, signed booking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cert #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>M-Pesa</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.certificate_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{c.client_name}</div>
                        {c.client_location && <div className="text-xs text-muted-foreground">{c.client_location}</div>}
                      </TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate" title={c.services || ''}>
                        {c.services || '—'}
                      </TableCell>
                      <TableCell className="font-medium">Ksh {Number(c.amount_paid).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{c.mpesa_code}</TableCell>
                      <TableCell className="text-xs">
                        <div>{format(new Date(c.date_created), 'PP')}</div>
                        <div className="text-muted-foreground">by {c.generated_by_name}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => downloadCertificate(c)} title="Download PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => shareCertificateWhatsApp(c)} title="Share via WhatsApp">
                            <Share2 className="h-4 w-4" />
                          </Button>
                          {c.invoice_number && (
                            <span className="text-xs text-muted-foreground self-center ml-2">
                              <FileText className="h-3 w-3 inline mr-1" />{c.invoice_number}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
