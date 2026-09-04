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
} from 'lucide-react';
import { format } from 'date-fns';

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
  const { profile } = useAuth();
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

  // Add service dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState(1);
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
    const { data } = await supabase.from('clients').select('id, full_name, phone, location, client_id') as any;
    if (data) setClients((data as any[]).map((c: any) => ({ ...c, name: c.full_name })));
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
    const { data } = await (supabase.from('profiles') as any).select('id, full_name').eq('role', 'agent');
    if (data) setAgents(data);
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
    const service = services.find(s => s.id === selectedServiceId);
    if (!service) return;

    const price = service.base_price || 0;
    const total = (price * serviceQuantity) - serviceDiscount;

    const newItem: ServiceItem = {
      id: service.id,
      code: service.service_code || '---',
      name: service.name,
      description: service.description || '',
      price,
      quantity: serviceQuantity,
      discount: serviceDiscount,
      total,
    };
    setItems([...items, newItem]);
    setDialogOpen(false);
    setSelectedServiceId('');
    setServiceQuantity(1);
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
  const grandTotal = items.reduce((sum, i) => sum + i.total, 0);

  const handleSave = async () => {
    if (!clientName || items.length === 0) {
      toast({ title: 'Add client and at least one service', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const payload = {
      client_name: clientName,
      client_phone: clientPhone,
      client_location: clientLocation,
      booking_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'draft',
      items: items,
      subtotal,
      discount: totalDiscount,
      total: grandTotal,
      booking_no: bookingNo,
      address,
      site_contact: siteContact,
      contact_phone: contactPhone,
      salesperson,
      shipment_mode: shipmentMode,
      preferred_date: preferredDate ? format(preferredDate, 'yyyy-MM-dd') : null,
      preferred_time: preferredTime,
      payment_terms: paymentTerms,
      assigned_technician: assignedTechnician,
    };
    const { error } = await (supabase.from('bookings').insert(payload as any) as any);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Booking saved as draft!' });
    setStatus('DRAFT');
    setLockStatus('UNLOCKED');
  };

  const handleConfirm = async () => {
    if (!clientName || items.length === 0) {
      toast({ title: 'Add client and at least one service', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const payload = {
      client_name: clientName,
      client_phone: clientPhone,
      client_location: clientLocation,
      booking_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'confirmed',
      items: items,
      subtotal,
      discount: totalDiscount,
      total: grandTotal,
      booking_no: bookingNo.replace('DRAFT', format(new Date(), 'yyyyMMdd')),
      address,
      site_contact: siteContact,
      contact_phone: contactPhone,
      salesperson,
      shipment_mode: shipmentMode,
      preferred_date: preferredDate ? format(preferredDate, 'yyyy-MM-dd') : null,
      preferred_time: preferredTime,
      payment_terms: paymentTerms,
      assigned_technician: assignedTechnician,
    };
    const { error } = await (supabase.from('bookings').insert(payload as any) as any);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Booking confirmed successfully!' });
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
    generateBookingNo();
    setStatus('DRAFT');
    setLockStatus('UNLOCKED');
    setSearchQuery('');
    setShowClientResults(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4">
      {/* Header with Welcome + compact buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Welcome, {profile?.full_name || 'Admin'}</h1>
          <p className="text-sm text-muted-foreground">Role: {(profile as any)?.role || 'Administrator'}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={resetForm}><Plus className="h-3.5 w-3.5 mr-1" /> New</Button>
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={loading}><Save className="h-3.5 w-3.5 mr-1" /> Draft</Button>
          <Button size="sm" onClick={handleConfirm} disabled={loading || !clientName || items.length === 0}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" size="sm"><FileCheck className="h-3.5 w-3.5 mr-1" /> Quote</Button>
          <Button variant="default" size="sm"><CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirm</Button>
          <Button variant="outline" size="sm"><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          <Button variant="outline" size="sm"><FileText className="h-3.5 w-3.5 mr-1" /> PDF</Button>
        </div>
      </div>

      {/* Booking Details + QR */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Booking No.</p>
              <p className="text-lg font-mono font-bold">{bookingNo}</p>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={status === 'DRAFT' ? 'secondary' : 'default'}>{status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <QrCode className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Scan to Verify</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Information - Inline search */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4" /> Client Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Find Client</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Enter Client ID (CL-0001) or phone number"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.length > 0) {
                        const results = clients.filter(c =>
                          c.name.toLowerCase().includes(e.target.value.toLowerCase()) ||
                          c.phone?.includes(e.target.value) ||
                          c.client_id?.toLowerCase().includes(e.target.value.toLowerCase())
                        );
                        if (results.length > 0) {
                          setShowClientResults(true);
                        } else {
                          setShowClientResults(false);
                        }
                      } else {
                        setShowClientResults(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setShowClientResults(true);
                      }
                    }}
                    className="text-sm"
                  />
                  {showClientResults && filteredClients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-lg z-10 max-h-64 overflow-y-auto overscroll-contain">
                      {filteredClients.map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex items-center justify-between"
                          onClick={() => handleClientSelect(c.id)}
                        >
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.client_id || c.phone}</span>
                        </div>
                      ))}
                      <div
                        className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex items-center gap-2 border-t text-primary"
                        onClick={() => { setShowClientResults(false); navigate('/admin/clients'); }}
                      >
                        <span>+ Add new client</span>
                      </div>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-1" /> Search CRM
                </Button>
                <Button variant="outline" size="sm" onClick={handleWalkIn}>
                  <UserCheck className="h-4 w-4 mr-1" /> Walk-in
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Search the CRM to link this booking to a client.</p>
            </div>

            {selectedClient && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs">Client Name</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="text-sm" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Service Location - removed GPS */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Service Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Address / Site</Label>
              <Input
                placeholder="Building, floor, street..."
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Site Contact</Label>
              <Input
                placeholder="Contact person on-site"
                value={siteContact}
                onChange={e => setSiteContact(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Contact Phone</Label>
              <Input
                placeholder="+254..."
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Information */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Booking Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Salesperson</Label>
              <Select value={salesperson} onValueChange={setSalesperson}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Shipment Mode</Label>
              <Select value={shipmentMode} onValueChange={setShipmentMode}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Road">Road</SelectItem>
                  <SelectItem value="Air">Air</SelectItem>
                  <SelectItem value="Sea">Sea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Preferred Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-sm font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preferredDate ? format(preferredDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={preferredDate} onSelect={setPreferredDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Preferred Time</Label>
              <Select value={preferredTime} onValueChange={setPreferredTime}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select time" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="08:00">08:00 AM</SelectItem>
                  <SelectItem value="09:00">09:00 AM</SelectItem>
                  <SelectItem value="10:00">10:00 AM</SelectItem>
                  <SelectItem value="11:00">11:00 AM</SelectItem>
                  <SelectItem value="12:00">12:00 PM</SelectItem>
                  <SelectItem value="13:00">01:00 PM</SelectItem>
                  <SelectItem value="14:00">02:00 PM</SelectItem>
                  <SelectItem value="15:00">03:00 PM</SelectItem>
                  <SelectItem value="16:00">04:00 PM</SelectItem>
                  <SelectItem value="17:00">05:00 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Payment Terms</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select terms" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Assigned Technician</Label>
              <Select value={assignedTechnician} onValueChange={setAssignedTechnician}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-3" />

          {/* Services Table */}
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Services</Label>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setSelectedServiceId(''); setServiceQuantity(1); setServiceDiscount(0); setSelectedCategory(''); setServiceSearch(''); }
            }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Service</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Service</Label>
                    <Input
                      placeholder="Search services..."
                      value={serviceSearch}
                      onChange={e => setServiceSearch(e.target.value)}
                      className="mb-2 mt-1"
                    />
                    <div className="flex gap-1 flex-wrap mb-2">
                      <Button type="button" variant={selectedCategory === '' ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setSelectedCategory('')}>All</Button>
                      {categories.map(cat => (
                        <Button key={cat} type="button" variant={selectedCategory === cat ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setSelectedCategory(cat)}>{cat}</Button>
                      ))}
                    </div>
                    <div className="border rounded-md max-h-52 overflow-y-auto overscroll-contain">
                      {filteredServices.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">No services found</div>
                      ) : filteredServices.map(s => (
                        <div
                          key={s.id}
                          className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between hover:bg-muted ${selectedServiceId === s.id ? 'bg-primary/10' : ''}`}
                          onClick={() => setSelectedServiceId(s.id)}
                        >
                          <div>
                            <span className="font-medium">{s.name}</span>
                            {s.service_code && <span className="ml-2 text-xs text-muted-foreground font-mono">{s.service_code}</span>}
                          </div>
                          <span className="text-xs text-primary font-mono">Ksh {s.base_price?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Quantity</Label>
                      <Input type="number" min="1" value={serviceQuantity} onChange={e => setServiceQuantity(Number(e.target.value) || 1)} />
                    </div>
                    <div>
                      <Label>Discount (KES)</Label>
                      <Input type="number" min="0" value={serviceDiscount} onChange={e => setServiceDiscount(Number(e.target.value) || 0)} />
                    </div>
                  </div>
                  <Button onClick={addServiceItem} className="w-full">Add to Booking</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No services added yet</div>
          ) : (
            <>
            {/* Mobile card view - shown only on small screens */}
            <div className="sm:hidden space-y-3">
              {items.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="font-mono text-[10px] mb-1">{item.code}</Badge>
                      <p className="font-semibold text-sm leading-tight">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-destructive h-8 w-8 shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Quantity</label>
                      <Input type="number" min="1" value={item.quantity} onChange={e => updateQuantity(item.id, Number(e.target.value) || 1)} className="h-10 text-base text-center" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Discount (Ksh)</label>
                      <Input type="number" min="0" value={item.discount} onChange={e => updateDiscount(item.id, Number(e.target.value) || 0)} className="h-10 text-base text-right" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{item.price.toLocaleString()}</span> × {item.quantity}
                    </div>
                    <span className="font-bold text-sm text-primary font-mono">{item.total.toLocaleString()} Ksh</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view - hidden on small screens */}
            <div className="hidden sm:block overflow-x-auto">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">{item.code}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateQuantity(item.id, Number(e.target.value) || 1)} className="w-14 h-7 text-center mx-auto text-sm" />
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min="0" value={item.discount} onChange={e => updateDiscount(item.id, Number(e.target.value) || 0)} className="w-20 h-7 text-right ml-auto text-sm" />
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{item.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-destructive h-7 w-7"><X className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}

          {items.length > 0 && (
            <div className="mt-3 border-t pt-3 flex flex-col items-end gap-1 text-sm">
              <div className="flex justify-between w-full sm:w-56">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-mono">{subtotal.toLocaleString()} Ksh</span>
              </div>
              <div className="flex justify-between w-full sm:w-56">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-mono text-green-600">-{totalDiscount.toLocaleString()} Ksh</span>
              </div>
              <div className="flex justify-between w-full sm:w-56 text-base font-bold border-t pt-1">
                <span>Total:</span>
                <span className="text-primary">{grandTotal.toLocaleString()} Ksh</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status & Approval */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" /> Status & Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Booking Status</Label>
              <Badge variant={status === 'DRAFT' ? 'secondary' : 'default'}>{status}</Badge>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Lock Status</Label>
              <Badge variant={lockStatus === 'UNLOCKED' ? 'outline' : 'default'}>{lockStatus}</Badge>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Created By</Label>
              <p className="text-sm font-medium">{profile?.full_name || 'Admin'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Created On</Label>
              <p className="text-sm font-medium">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
