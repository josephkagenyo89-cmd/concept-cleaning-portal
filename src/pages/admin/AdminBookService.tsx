import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Save,
  Printer,
  FileText,
  Search,
  User,
  MapPin,
  Phone,
  QrCode,
  CheckCircle,
  Send,
  FileCheck,
  ExternalLink,
  X,
  Clock,
  Calendar as CalendarIcon,
  UserCheck,
  Truck,
  CreditCard,
  Wrench,
  Lock,
  MoreHorizontal,
  MessageCircle,
  Paperclip,
  History,
  ShieldCheck,
  Settings2,
  Trash2,
  Edit3,
  Minus,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import BookingSettingsDialog from '@/components/booking/BookingSettingsDialog';
import { loadBookingSettings, BookingModuleSettings } from '@/lib/bookingSettings';

interface Client {
  id: string;
  name: string;
  phone: string;
  location: string;
  client_id?: string;
}

interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
}

export default function AdminBookService() {
  const { user, profile, roles, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingNo, setBookingNo] = useState('BK-2026-DRAFT');
  const [status, setStatus] = useState('DRAFT');
  const [lockStatus, setLockStatus] = useState('UNLOCKED');
  const [bookingSettings, setBookingSettings] = useState<BookingModuleSettings>(() => loadBookingSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [clientContactPerson, setClientContactPerson] = useState('');
  const [siteName, setSiteName] = useState('');
  const [gpsLocation, setGpsLocation] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [deposit, setDeposit] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Add service dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState('');
  const [serviceDiscount, setServiceDiscount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  // Location fields
  const [address, setAddress] = useState('');
  const [siteContact, setSiteContact] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Booking info fields
  const [salesperson, setSalesperson] = useState('');
  const [shipmentMode, setShipmentMode] = useState('Road');
  const [preferredDate, setPreferredDate] = useState<Date | undefined>(new Date());
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [paymentTerms, setPaymentTerms] = useState('Cash');
  const [assignedTechnician, setAssignedTechnician] = useState('');
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    loadClients();
    loadServices();
    loadAgents();
    generateBookingNo();
  }, []);

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, full_name, phone, whatsapp_number, location, client_code') as any;
    if (data) setClients((data as any[]).map((c: any) => ({ ...c, name: c.full_name, client_id: c.client_code })));
  };

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    if (data) {
      setServices(data);
      const cats = Array.from(new Set(data.map(s => s.category).filter(Boolean)));
      setCategories(cats);
    }
  };

  const loadAgents = async () => {
    const agentsResult = await (supabase
      .from('user_roles')
      .select('user_id, profiles!inner(id, full_name)')
      .eq('role', 'agent')) as any;
    const data = agentsResult.data?.map((r: any) => ({ id: r.profiles?.id, full_name: r.profiles?.full_name })) || [];
    setAgents(data);
  };

  const generateBookingNo = () => {
    const year = new Date().getFullYear();
    setBookingNo(`BK-${year}-DRAFT`);
  };

  const handleClientSelect = (value: string) => {
    setSelectedClient(value);
    const client = clients.find(c => c.id === value);
    if (client) {
      setClientName(client.name);
      setClientPhone(client.phone || '');
      setClientLocation(client.location || '');
    }
    setShowClientResults(false);
    setSearchQuery('');
  };

  // Filter clients for search
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.client_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = () => {
    if (searchQuery.trim() === '') {
      setShowClientResults(false);
      return;
    }
    if (filteredClients.length > 0) {
      setShowClientResults(true);
    } else {
      // No client found – navigate to CRM
      toast({ title: 'Client not found', description: 'Redirecting to CRM to add new client...' });
      navigate('/admin/clients');
    }
  };

  const handleWalkIn = () => {
    setClientName('Walk-in Client');
    setClientPhone('');
    setClientLocation('');
    setSelectedClient('');
    setShowClientResults(false);
    setSearchQuery('');
  };

  const addServiceItem = () => {
    if (!selectedServiceId) {
      toast({ title: 'Select a service', variant: 'destructive' });
      return;
    }
    const qty = Number(serviceQuantity);
    if (!qty || qty < 1) {
      toast({ title: 'Enter a quantity', variant: 'destructive' });
      return;
    }
    const service = services.find(s => s.id === selectedServiceId);
    if (!service) return;

    const price = service.base_price || 0;
    const total = (price * qty) - serviceDiscount;

    const newItem: ServiceItem = {
      id: service.id,
      code: service.service_code || '---',
      name: service.name,
      description: service.description || '',
      price,
      quantity: qty,
      discount: serviceDiscount,
      total,
    };
    setItems([...items, newItem]);
    setDialogOpen(false);
    setSelectedServiceId('');
    setServiceQuantity('');
    setServiceDiscount(0);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    setItems(items.map(i => {
      if (i.id !== id) return i;
      return { ...i, quantity: qty, total: (i.price * qty) - i.discount };
    }));
  };

  const updateDiscount = (id: string, disc: number) => {
    setItems(items.map(i => {
      if (i.id !== id) return i;
      return { ...i, discount: disc, total: (i.price * i.quantity) - disc };
    }));
  };

  const filteredServices = services.filter(s => {
    const matchesCategory = !selectedCategory || s.category === selectedCategory;
    const matchesSearch = !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase());
    return matchesCategory && matchesSearch && s.is_active !== false;
  });
  const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const totalDiscount = items.reduce((sum, i) => sum + i.discount, 0);
  const netTotal = items.reduce((sum, i) => sum + i.total, 0);
  const vatAmount = bookingSettings.service.enableVat
    ? Math.round(netTotal * bookingSettings.service.defaultVatRate) / 100
    : 0;
  const grandTotal = netTotal;
  const displayedTotal = grandTotal + vatAmount;
  const currentRole = roles.includes('super_admin') ? 'super_admin' : roles.includes('admin') ? 'admin' : 'agent';
  const canCreate = bookingSettings.permissions.create.includes(currentRole);
  const canConfirm = bookingSettings.permissions.confirm.includes(currentRole);
  const canGenerateDocs = bookingSettings.permissions.generateDocs.includes(currentRole);
  const canPrint = bookingSettings.permissions.printDocs.includes(currentRole);
  const canWhatsapp = bookingSettings.permissions.sendWhatsapp.includes(currentRole);
  const canApproveDiscount = bookingSettings.permissions.approveDiscount.includes(currentRole);
  const isSaved = status !== 'DRAFT';
  const balance = Math.max(0, displayedTotal - deposit - amountPaid);

  // Build an insert payload using only columns that exist on the bookings table.
  // booking_code is intentionally omitted: the database assigns a unique code
  // from its sequence (trg_assign_booking_code), which is safe for concurrent saves.
  const buildPayload = (statusValue: string) => ({
    agent_id: user?.id,
    client_id: selectedClient || null,
    client_name: clientName,
    client_phone: clientPhone,
    location: [address, clientLocation].filter(Boolean).join(', ') || clientLocation || 'N/A',
    service_id: items[0]?.id,
    service_date: preferredDate ? format(preferredDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    quantity: String(items.reduce((sum, i) => sum + i.quantity, 0)),
    status: statusValue,
    line_items: items,
    subtotal,
    discount_amount: totalDiscount,
    price: grandTotal,
    salesperson_name: salesperson || null,
  });

  const insertBooking = async (statusValue: string) => {
    const payload = buildPayload(statusValue);
    return await (supabase
      .from('bookings')
      .insert(payload as any)
      .select('booking_code')
      .single() as any);
  };

  const generateQuotation = async (bookingCode: string) => {
    try {
      const { data: quotationNumber, error: numberError } = await supabase
        .rpc('next_quotation_number');

      if (numberError) throw numberError;
      if (!quotationNumber) throw new Error('Failed to generate quotation number.');
      const quotationPayload = {
        quotation_number: quotationNumber,
        client_name: clientName,
        client_phone: clientPhone || '',
        service_name: items.map(i => i.name).join(', '),
        service_date: preferredDate ? format(preferredDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        price: grandTotal,
        created_by: user?.id,
        created_by_name: profile?.full_name || salesperson || 'Admin',
        created_by_role: currentRole,
        salesperson_id: user?.id || null,
        salesperson_name: salesperson || profile?.full_name || null,
        salesperson_role: currentRole,
        line_items: items,
        subtotal,
        discount_amount: totalDiscount,
        discount_reason: totalDiscount > 0 ? 'Booking discount' : null,
        local_id: bookingCode,
      };
      const { error: qError } = await supabase.from('quotations').insert(quotationPayload);
      if (qError) console.error('Quotation auto-generation failed:', qError.message);
    } catch (e) {
      console.error('Quotation generation error:', e);
    }
  };

  const handleSave = async () => {
    if (!clientName || items.length === 0) {
      toast({ title: 'Add client and at least one service', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await insertBooking('draft');
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    if (data?.booking_code) {
      setBookingNo(data.booking_code);
      await generateQuotation(data.booking_code);
    }
    toast({ title: 'Booking saved as draft!', description: data?.booking_code });
    setStatus('DRAFT');
    setLockStatus('UNLOCKED');
  };

  const handleConfirm = async () => {
    if (!clientName || items.length === 0) {
      toast({ title: 'Add client and at least one service', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await insertBooking('confirmed');
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    if (data?.booking_code) {
      setBookingNo(data.booking_code);
      await generateQuotation(data.booking_code);
    }
    toast({ title: 'Booking confirmed successfully!', description: data?.booking_code });
    setStatus('CONFIRMED');
    setLockStatus('LOCKED');
  };

  const resetForm = () => {
    setItems([]);
    setSelectedClient('');
    setClientName('');
    setClientPhone('');
    setClientLocation('');
    setAddress('');
    setSiteContact('');
    setContactPhone('');
    setSalesperson('');
    setShipmentMode('Road');
    setPreferredDate(new Date());
    setPreferredTime('09:00');
    setPaymentTerms('Cash');
    setAssignedTechnician('');
    setClientEmail('');
    setCompanyName('');
    setClientContactPerson('');
    setSiteName('');
    setGpsLocation('');
    setBookingNotes('');
    setCustomerNotes('');
    setInternalNotes('');
    setDeposit(0);
    setAmountPaid(0);
    setAttachments([]);
    generateBookingNo();
    setStatus('DRAFT');
    setLockStatus('UNLOCKED');
    setSearchQuery('');
    setShowClientResults(false);
  };

  const fieldClass = 'h-8 text-xs rounded border-input bg-background';
  const sectionTitle = 'flex items-center gap-2 border-b pb-2 text-xs font-bold uppercase text-primary';
  const money = (value: number) => `${bookingSettings.general.currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const actionDisabled = loading || !canCreate;

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-muted/45 p-2 sm:p-3">
      <BookingSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={setBookingSettings} />
      <div className="mx-auto max-w-[1600px] overflow-hidden rounded-md border bg-card shadow-sm">
        <header className="border-b bg-card px-3 py-3 lg:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">To Book</h1>
              <nav className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-label="Breadcrumb">
                <span>Home</span><span>/</span><span>Bookings</span><span>/</span><span className="font-medium text-primary">To Book</span>
              </nav>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 xl:pb-0">
              <Button variant="outline" size="sm" className="shrink-0" onClick={resetForm}><Plus className="mr-1 h-3.5 w-3.5" />New Booking</Button>
              <Button variant="secondary" size="sm" className="shrink-0" onClick={handleSave} disabled={actionDisabled}><Save className="mr-1 h-3.5 w-3.5" />Save Draft</Button>
              <Button size="sm" className="shrink-0" onClick={handleConfirm} disabled={actionDisabled || !clientName || items.length === 0}>{loading ? 'Saving…' : 'Save Booking'}</Button>
              <Button variant="outline" size="sm" className="shrink-0" disabled={!isSaved || !canGenerateDocs|| !bookingNo} onClick={() => bookingNo && generateQuotation(bookingNo) }><FileCheck className="mr-1 h-3.5 w-3.5" />Generate Quotation</Button>
              <Button size="sm" className="shrink-0 bg-success text-success-foreground hover:bg-success/90" onClick={handleConfirm} disabled={loading || !canConfirm || !clientName || items.length === 0}><CheckCircle className="mr-1 h-3.5 w-3.5" />Confirm Booking</Button>
              <Button variant="outline" size="icon" title="Print" aria-label="Print booking" disabled={!isSaved || !canPrint} onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /></Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="shrink-0"><MoreHorizontal className="mr-1 h-3.5 w-3.5" />More Actions</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem disabled={!isSaved || !canGenerateDocs} onClick={() => window.print()}><FileText className="mr-2 h-4 w-4" />Generate PDF</DropdownMenuItem>
                  <DropdownMenuItem disabled={!isSaved || !canWhatsapp || !clientPhone} onClick={() => window.open(`https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${clientName}, your booking ${bookingNo} has been prepared by Concept Cleaning Services.`)}`, '_blank')}><MessageCircle className="mr-2 h-4 w-4" />Send WhatsApp</DropdownMenuItem>
                  {isAdmin && <DropdownMenuItem onClick={() => setSettingsOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Booking Settings</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-3 border-b bg-muted/25 px-3 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs sm:flex sm:items-center sm:gap-8">
            <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Booking No.</p><p className="font-mono text-base font-bold text-primary">{isSaved ? bookingNo : 'Generated on save'}</p></div>
            <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Booking Date</p><p className="font-semibold">{format(new Date(), 'dd/MM/yyyy')}</p></div>
            <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Status</p><Badge variant={status === 'DRAFT' ? 'secondary' : 'default'} className="mt-0.5 text-[10px]">{status}</Badge></div>
            <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Lock</p><Badge variant="outline" className="mt-0.5 text-[10px]">{lockStatus}</Badge></div>
          </div>
          {bookingSettings.documents.showQr && <div className="flex items-center gap-2"><div className="grid h-11 w-11 place-items-center border bg-background"><QrCode className="h-8 w-8" /></div><div className="text-[10px] text-muted-foreground"><p className="font-semibold text-foreground">Scan to Verify</p><p>Available after saving</p></div></div>}
        </section>

        <div className="grid grid-cols-1 divide-y lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <section className="p-4 lg:col-span-1">
            <h2 className={sectionTitle}><User className="h-4 w-4" />Client Information</h2>
            <div className="mt-3 space-y-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Client ID or Phone Search</Label>
              <div className="flex flex-wrap gap-1.5">
                <div className="relative min-w-[160px] flex-1">
                  <Input className={fieldClass} placeholder="Client ID or phone" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowClientResults(e.target.value.length > 0); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }} />
                  {showClientResults && searchQuery && (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded border bg-popover shadow-lg">
                      {filteredClients.length > 0 ? filteredClients.map((client) => <button type="button" key={client.id} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => handleClientSelect(client.id)}><span className="font-medium">{client.name}</span><span className="text-muted-foreground">{client.client_id || client.phone}</span></button>) : <button type="button" className="w-full px-3 py-3 text-left text-xs text-destructive" onClick={() => navigate('/admin/clients')}>Client not found. Create New Client.</button>}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch}><Search className="mr-1 h-3.5 w-3.5" />Search CRM</Button>
                {bookingSettings.client.allowWalkIn && <Button variant="outline" size="sm" onClick={handleWalkIn}><UserCheck className="mr-1 h-3.5 w-3.5" />Walk-in</Button>}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <div><Label className="text-[10px]">Client Name</Label><Input className={fieldClass} value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
                <div><Label className="text-[10px]">Phone Number</Label><Input className={fieldClass} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} /></div>
                <div><Label className="text-[10px]">Company Name</Label><Input className={fieldClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
                <div><Label className="text-[10px]">Contact Person</Label><Input className={fieldClass} value={clientContactPerson} onChange={(e) => setClientContactPerson(e.target.value)} /></div>
                <div><Label className="text-[10px]">Email</Label><Input type="email" className={fieldClass} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></div>
                <div><Label className="text-[10px]">Address</Label><Input className={fieldClass} value={clientLocation} onChange={(e) => setClientLocation(e.target.value)} /></div>
              </div>
            </div>
          </section>

          <section className="p-4 lg:col-span-1">
            <h2 className={sectionTitle}><MapPin className="h-4 w-4" />Service Location</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div><Label className="text-[10px]">Site Name</Label><Input className={fieldClass} value={siteName} onChange={(e) => setSiteName(e.target.value)} /></div>
              <div><Label className="text-[10px]">Address</Label><Input className={fieldClass} placeholder="Building, floor, street" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              {bookingSettings.ui.showGps && <div><Label className="text-[10px]">GPS Location</Label><Input className={fieldClass} placeholder="Coordinates or map link" value={gpsLocation} onChange={(e) => setGpsLocation(e.target.value)} /></div>}
              {bookingSettings.ui.showSiteContact && <><div><Label className="text-[10px]">Contact Person</Label><Input className={fieldClass} value={siteContact} onChange={(e) => setSiteContact(e.target.value)} /></div><div><Label className="text-[10px]">Contact Number</Label><Input className={fieldClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div></>}
            </div>
          </section>

          <section className="p-4 lg:col-span-1">
            <h2 className={sectionTitle}><CalendarIcon className="h-4 w-4" />Booking Information</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div><Label className="text-[10px]">Booking Date</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="h-8 w-full justify-start text-xs font-normal"><CalendarIcon className="mr-2 h-3.5 w-3.5" />{preferredDate ? format(preferredDate, 'dd/MM/yyyy') : 'Select date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={preferredDate} onSelect={setPreferredDate} initialFocus /></PopoverContent></Popover></div>
              <div><Label className="text-[10px]">Preferred Time</Label><Input type="time" className={fieldClass} value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} /></div>
              {bookingSettings.ui.showTechnician && <div><Label className="text-[10px]">Assigned Technician</Label><Select value={assignedTechnician} onValueChange={setAssignedTechnician}><SelectTrigger className={fieldClass}><SelectValue placeholder="Select technician" /></SelectTrigger><SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>)}<SelectItem value="unassigned">Unassigned</SelectItem></SelectContent></Select></div>}
              <div><Label className="text-[10px]">Salesperson</Label><Select value={salesperson} onValueChange={setSalesperson}><SelectTrigger className={fieldClass}><SelectValue placeholder="Select salesperson" /></SelectTrigger><SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>)}<SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
              <div><Label className="text-[10px]">Payment Terms</Label><Select value={paymentTerms} onValueChange={setPaymentTerms}><SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger><SelectContent>{['Cash','M-Pesa','Bank Transfer','Credit Card',bookingSettings.payment.defaultTerms].filter((v, i, a) => a.indexOf(v) === i).map((term) => <SelectItem key={term} value={term}>{term}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-[10px]">Booking Notes</Label><Textarea className="min-h-14 text-xs" value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} /></div>
            </div>
          </section>

          <section className="p-4 lg:col-span-1">
            <h2 className={sectionTitle}><ShieldCheck className="h-4 w-4" />Status & Approval</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
              <dt className="text-muted-foreground">Booking Status</dt><dd><Badge variant={status === 'DRAFT' ? 'secondary' : 'default'} className="text-[10px]">{status}</Badge></dd>
              <dt className="text-muted-foreground">Approval</dt><dd><Badge variant="outline" className="text-[10px]">{status === 'CONFIRMED' ? 'APPROVED' : 'PENDING'}</Badge></dd>
              <dt className="text-muted-foreground">Created By</dt><dd className="font-medium">{profile?.full_name || 'Admin'}</dd>
              <dt className="text-muted-foreground">Role</dt><dd className="font-medium capitalize">{currentRole.replace('_', ' ')}</dd>
              <dt className="text-muted-foreground">Last Modified</dt><dd className="font-medium">{format(new Date(), 'dd/MM/yyyy HH:mm')}</dd>
            </dl>
          </section>
        </div>

        <section className="border-y bg-muted/20 px-3 py-4 lg:px-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-bold uppercase text-primary">Services</h2>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSelectedServiceId(''); setServiceQuantity(''); setServiceDiscount(0); setSelectedCategory(''); setServiceSearch(''); } }}>
              <DialogTrigger asChild><Button size="sm" disabled={!bookingSettings.service.enableMultiple && items.length > 0}><Plus className="mr-1 h-3.5 w-3.5" />Add Service</Button></DialogTrigger>
              <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
                <DialogHeader className="border-b px-4 py-3"><DialogTitle>Add Service</DialogTitle></DialogHeader>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search services..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} className="h-11 pl-9 text-base" /></div>
                  <div className="flex flex-wrap gap-1.5">{['', ...categories].map((category) => <Button key={category || 'all'} variant={selectedCategory === category ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setSelectedCategory(category)}>{category || 'All'}</Button>)}</div>
                  <div className="max-h-72 overflow-y-auto rounded border">
                    {filteredServices.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No services found</p>}
                    {filteredServices.map((service) => { const isSelected = selectedServiceId === service.id; return (
                      <button type="button" key={service.id} className={`flex w-full items-center justify-between gap-2 border-b px-3 py-3.5 text-left text-sm last:border-b-0 active:bg-muted ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}`} onClick={() => setSelectedServiceId(isSelected ? '' : service.id)}>
                        <span className="min-w-0"><strong className="block truncate">{service.name}</strong><small className="font-mono text-xs text-muted-foreground">{service.service_code}</small></span>
                        <span className="flex shrink-0 items-center gap-2"><span className="font-semibold">{money(service.base_price || 0)}</span>{isSelected && <Check className="h-4 w-4 text-primary" />}</span>
                      </button>); })}
                  </div>
                  {selectedServiceId && (
                    <div className="space-y-3 rounded border bg-muted/30 p-3">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" disabled={!serviceQuantity || Number(serviceQuantity) <= 1} onClick={() => setServiceQuantity(String(Math.max(1, Number(serviceQuantity || 0) - 1)))}><Minus className="h-4 w-4" /></Button>
                          <Input type="number" inputMode="numeric" min="1" placeholder="Qty" value={serviceQuantity} onChange={(e) => setServiceQuantity(e.target.value)} className="h-11 flex-1 text-center text-lg font-semibold" />
                          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setServiceQuantity(String(Number(serviceQuantity || 0) + 1))}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Discount (KES)</Label>
                        <Input type="number" inputMode="numeric" min="0" placeholder="0" value={serviceDiscount || ''} onChange={(e) => setServiceDiscount(Number(e.target.value) || 0)} className="mt-1 h-11" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t p-4">
                  <Button className="h-12 w-full text-base" onClick={addServiceItem} disabled={!selectedServiceId || !Number(serviceQuantity)}>
                    {!selectedServiceId ? 'Select a service above' : !Number(serviceQuantity) ? 'Enter quantity' : 'Add to Booking'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="hidden overflow-x-auto rounded border sm:block">
            <Table className="min-w-[1050px] text-xs"><TableHeader><TableRow className="bg-primary hover:bg-primary"><TableHead className="w-10 text-primary-foreground">#</TableHead><TableHead className="text-primary-foreground">Service</TableHead><TableHead className="text-primary-foreground">Description</TableHead><TableHead className="text-center text-primary-foreground">Qty</TableHead><TableHead className="text-primary-foreground">Unit</TableHead><TableHead className="text-right text-primary-foreground">Unit Price</TableHead><TableHead className="text-right text-primary-foreground">Discount %</TableHead><TableHead className="text-right text-primary-foreground">Discount KES</TableHead><TableHead className="text-right text-primary-foreground">VAT</TableHead><TableHead className="text-right text-primary-foreground">Line Total</TableHead><TableHead className="text-center text-primary-foreground">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{items.length === 0 ? <TableRow><TableCell colSpan={11} className="h-20 text-center text-muted-foreground">No services added. Select Add Service to begin.</TableCell></TableRow> : items.map((item, index) => { const itemNet = Math.max(0, item.price * item.quantity - item.discount); const itemVat = bookingSettings.service.enableVat ? itemNet * bookingSettings.service.defaultVatRate / 100 : 0; return <TableRow key={item.id}><TableCell>{index + 1}</TableCell><TableCell><p className="font-semibold">{item.name}</p><p className="font-mono text-[9px] text-muted-foreground">{item.code}</p></TableCell><TableCell className="max-w-52 truncate text-muted-foreground">{item.description}</TableCell><TableCell><Input type="number" min="1" placeholder="Qty" className="mx-auto h-7 w-14 text-center text-xs" value={item.quantity || ''} onChange={(e) => updateQuantity(item.id, Math.max(0, Number(e.target.value) || 0))} /></TableCell><TableCell>{bookingSettings.service.defaultUnit}</TableCell><TableCell className="text-right font-mono">{item.price.toLocaleString()}</TableCell><TableCell className="text-right font-mono">{item.price * item.quantity > 0 ? ((item.discount / (item.price * item.quantity)) * 100).toFixed(1) : '0.0'}</TableCell><TableCell><Input type="number" min="0" className="ml-auto h-7 w-20 text-right text-xs" value={item.discount} onChange={(e) => updateDiscount(item.id, Number(e.target.value) || 0)} /></TableCell><TableCell className="text-right font-mono">{itemVat.toLocaleString()}</TableCell><TableCell className="text-right font-mono font-bold">{(itemNet + itemVat).toLocaleString()}</TableCell><TableCell><div className="flex justify-center"><Button variant="ghost" size="icon" className="h-7 w-7" title="Edit service"><Edit3 className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete service" onClick={() => removeItem(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>; })}</TableBody>
            </Table>
          </div>
          <div className="space-y-2 sm:hidden">{items.length === 0 ? <div className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">No services added yet. Tap <strong>Add Service</strong> to begin.</div> : items.map((item) => <div key={item.id} className="rounded border bg-card p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><Badge variant="outline" className="font-mono text-[9px]">{item.code}</Badge><p className="mt-1 text-sm font-semibold leading-tight">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p></div><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-3 flex items-end gap-3"><div className="flex-1"><Label className="text-[10px]">Quantity</Label><div className="mt-1 flex items-center gap-1.5"><Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" disabled={item.quantity <= 1} onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="h-4 w-4" /></Button><Input type="number" inputMode="numeric" min="1" placeholder="Qty" className="h-10 flex-1 text-center text-base font-semibold" value={item.quantity || ''} onChange={(e) => updateQuantity(item.id, Math.max(0, Number(e.target.value) || 0))} /><Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="h-4 w-4" /></Button></div></div><div className="w-28"><Label className="text-[10px]">Discount (KES)</Label><Input type="number" inputMode="numeric" min="0" placeholder="0" className="mt-1 h-10" value={item.discount || ''} onChange={(e) => updateDiscount(item.id, Number(e.target.value) || 0)} /></div></div><div className="mt-3 flex justify-between border-t pt-2 text-xs"><span className="text-muted-foreground">{money(item.price)} × {item.quantity || 0}</span><strong className="text-sm">{money(item.total)}</strong></div></div>)}</div>
          <div className="mt-3 flex flex-col gap-1 text-xs sm:flex-row sm:justify-between"><span className="font-semibold">Total Items: {items.length}</span><span className="font-semibold">Subtotal Before Discount: <strong className="ml-2 text-sm">{money(subtotal)}</strong></span></div>
        </section>

        <div className="grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          <section className="p-4"><h2 className={sectionTitle}>Discount Information</h2><div className="mt-3 space-y-2"><div><Label className="text-[10px]">Discount Type</Label><Select value="fixed" disabled><SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Line Discount (KES)</SelectItem></SelectContent></Select></div><div><Label className="text-[10px]">Discount Amount</Label><Input className={fieldClass} value={totalDiscount.toFixed(2)} readOnly /></div><div><Label className="text-[10px]">Discount Reason</Label><Textarea className="min-h-16 text-xs" placeholder="Required when a discount is applied" /></div><Button variant="outline" size="sm" className="w-full" disabled={totalDiscount <= 0}>Request Discount</Button></div></section>
          <section className="p-4"><h2 className={sectionTitle}>Discount Approval</h2><div className="mt-3 rounded border bg-muted/30 p-3 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline" className="text-[9px]">NOT REQUESTED</Badge></div><div className="mt-3"><Label className="text-[10px]">Approval Comment</Label><Textarea className="mt-1 min-h-16 bg-background text-xs" disabled={!canApproveDiscount} /></div><div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" disabled={!canApproveDiscount || totalDiscount <= 0}>Approve</Button><Button variant="destructive" size="sm" disabled={!canApproveDiscount || totalDiscount <= 0}>Reject</Button></div></div></section>
          <section className="p-4"><h2 className={sectionTitle}>Price Breakdown</h2><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between text-destructive"><span>Discount</span><span>− {money(totalDiscount)}</span></div><div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">VAT ({bookingSettings.service.enableVat ? bookingSettings.service.defaultVatRate : 0}%)</span><span>+ {money(vatAmount)}</span></div><div className="flex items-baseline justify-between border-t pt-2"><strong className="text-sm">Grand Total</strong><strong className="text-lg text-primary">{money(displayedTotal)}</strong></div><div className="rounded border border-success/20 bg-success/10 p-2"><p className="text-[9px] font-bold uppercase text-success">Amount in Words</p><p className="mt-1 text-[10px]">Kenya Shillings {displayedTotal.toLocaleString()} only</p></div></div></section>
          <section className="p-4"><h2 className={sectionTitle}>Payment Summary</h2><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Payment Terms</span><strong>{paymentTerms}</strong></div>{bookingSettings.payment.allowDeposits && <div className="flex items-center justify-between gap-3"><Label className="text-xs text-muted-foreground">Deposit</Label><Input type="number" min="0" className="h-7 w-28 text-right text-xs" value={deposit || ''} onChange={(e) => setDeposit(Number(e.target.value) || 0)} /></div>}<div className="flex items-center justify-between gap-3"><Label className="text-xs text-muted-foreground">Amount Paid</Label><Input type="number" min="0" className="h-7 w-28 text-right text-xs" value={amountPaid || ''} onChange={(e) => setAmountPaid(Number(e.target.value) || 0)} /></div><div className="flex items-baseline justify-between border-t pt-3"><strong>Balance</strong><strong className="text-lg text-destructive">{money(balance)}</strong></div></div></section>
        </div>

        <Tabs defaultValue="attachments" className="border-t">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-muted/30 px-3 py-2">
            <TabsTrigger value="attachments" className="text-xs"><Paperclip className="mr-1 h-3.5 w-3.5" />Attachments ({attachments.length})</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs"><FileText className="mr-1 h-3.5 w-3.5" />Notes</TabsTrigger>
            <TabsTrigger value="history" className="text-xs"><History className="mr-1 h-3.5 w-3.5" />History</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs"><Clock className="mr-1 h-3.5 w-3.5" />Activity Log</TabsTrigger>
          </TabsList>
          <TabsContent value="attachments" className="m-0 p-4"><div className="rounded border border-dashed bg-muted/20 p-5 text-center"><Paperclip className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-1 text-xs text-muted-foreground">Photos, site images, contracts and supporting documents</p><Input type="file" multiple className="mx-auto mt-3 max-w-sm text-xs" onChange={(e) => setAttachments(Array.from(e.target.files || []))} /></div></TabsContent>
          <TabsContent value="notes" className="m-0 grid gap-3 p-4 md:grid-cols-2"><div><Label className="text-xs">Customer Notes</Label><Textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} /></div><div><Label className="text-xs">Internal Notes</Label><Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} /></div></TabsContent>
          <TabsContent value="history" className="m-0 p-4 text-xs text-muted-foreground">Booking history will appear after the booking is saved.</TabsContent>
          <TabsContent value="activity" className="m-0 p-4"><div className="grid gap-3 text-xs sm:grid-cols-3"><div><span className="text-muted-foreground">Created By</span><p className="font-semibold">{profile?.full_name || 'Admin'}</p></div><div><span className="text-muted-foreground">Last Modified By</span><p className="font-semibold">{profile?.full_name || 'Admin'}</p></div><div><span className="text-muted-foreground">Approval History</span><p className="font-semibold">No activity yet</p></div></div></TabsContent>
        </Tabs>

        <footer className="grid grid-cols-2 gap-4 border-t bg-muted/20 px-4 py-4 text-[10px] sm:grid-cols-4">
          <div className="flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-primary" /><div><p className="uppercase text-muted-foreground">Verification Code</p><p className="font-mono font-semibold">{isSaved ? bookingNo : 'Pending save'}</p></div></div>
          <div className="flex items-center gap-2"><CalendarIcon className="h-7 w-7 text-primary" /><div><p className="uppercase text-muted-foreground">Generated Date</p><p className="font-semibold">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p></div></div>
          <div className="flex items-center gap-2"><User className="h-7 w-7 text-primary" /><div><p className="uppercase text-muted-foreground">Generated By</p><p className="font-semibold">{profile?.full_name || 'Admin'}</p></div></div>
          <div className="flex items-center gap-2"><CheckCircle className="h-7 w-7 text-success" /><div><p className="font-semibold uppercase text-success">Secure Document</p><p className="text-muted-foreground">Official booking record</p></div>{bookingSettings.documents.showQr && <QrCode className="ml-auto h-8 w-8" />}</div>
        </footer>
      </div>
    </div>
  );
}
