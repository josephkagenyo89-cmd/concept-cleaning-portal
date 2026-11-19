import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Save, Trash2 } from 'lucide-react';

const db = supabase as any;
type Package = { id: string; title: string; price_value: number | null; active: boolean; offer_type: string };
type Service = { id: string; name: string; base_price?: number | null; pricing_model?: string | null; pricing_unit?: string | null; is_active: boolean };
type Item = { id?: string; offer_id: string; service_id: string; item_label: string; size_label: string; quantity: string; individual_price: string; complimentary: boolean; display_order: number; active: boolean };

const emptyItem = (offerId = ''): Item => ({ offer_id: offerId, service_id: '', item_label: '', size_label: '', quantity: '1', individual_price: '', complimentary: false, display_order: 0, active: true });

export default function AdminPackageContents({ offers, services }: { offers: Package[]; services: Service[] }) {
 const packages = useMemo(() => offers.filter(o => o.offer_type === 'package'), [offers]);
 const activeServices = useMemo(() => services.filter(s => s.is_active), [services]);
 const [offerId, setOfferId] = useState('');
 const [items, setItems] = useState<Item[]>([]);
 const [draft, setDraft] = useState<Item>(emptyItem());
 const [editingItemId, setEditingItemId] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const selected = packages.find(p => p.id === offerId);
 const total = items.filter(i => i.active && !i.complimentary).reduce((sum, i) => sum + (Number(i.individual_price) || 0) * (Number(i.quantity) || 0), 0);

 const load = useCallback(async (id: string) => {
  if (!id) { setItems([]); return; }
  setLoading(true);
  const r = await db.from('booking_engine_package_items').select('*').eq('offer_id', id).order('display_order').order('created_at');
  if (r.error) toast({ title: 'Could not load package contents', description: r.error.message, variant: 'destructive' });
  else setItems((r.data || []).map((x: any) => ({ ...x, quantity: String(x.quantity), individual_price: x.individual_price == null ? '' : String(x.individual_price), item_label: x.item_label || '', size_label: x.size_label || '' })));
  setLoading(false);
 }, []);
 useEffect(() => { if (!offerId && packages.length) setOfferId(packages[0].id); }, [offerId, packages]);
 useEffect(() => { void load(offerId); setDraft(emptyItem(offerId)); }, [offerId, load]);

 const setField = (key: keyof Item, value: any) => setDraft(old => ({ ...old, [key]: value }));
 const addItem = async () => {
  const quantity = Number(draft.quantity);
  const price = draft.complimentary ? 0 : Number(draft.individual_price);
  if (!offerId || !draft.service_id || !draft.size_label.trim() || !Number.isFinite(quantity) || quantity <= 0 || (!draft.complimentary && (!draft.individual_price.trim() || !Number.isFinite(price) || price <= 0))) {
   toast({ title: 'Complete the service, size/variant, quantity and individual price', variant: 'destructive' }); return;
  }
  setSaving(true);
  const unpublish=await db.from('booking_engine_value_offers').update({active:false,featured:false,updated_at:new Date().toISOString()}).eq('id',offerId);
  if(unpublish.error){toast({title:'Could not return package to draft',description:unpublish.error.message,variant:'destructive'});setSaving(false);return;}
  const row = { offer_id: offerId, service_id: draft.service_id, item_label: draft.item_label.trim() || null, size_label: draft.size_label.trim(), quantity, individual_price: draft.complimentary ? 0 : price, complimentary: draft.complimentary, display_order: items.length, active: true };
  const r = editingItemId
   ? await db.from('booking_engine_package_items').update(row).eq('id', editingItemId).select('*').single()
   : await db.from('booking_engine_package_items').insert(row).select('*').single();
  if (r.error) toast({ title: 'Package item was not added', description: r.error.message, variant: 'destructive' });
  else { const saved = { ...r.data, quantity: String(r.data.quantity), individual_price: r.data.individual_price == null ? '' : String(r.data.individual_price), item_label: r.data.item_label || '', size_label: r.data.size_label || '' }; setItems(old => editingItemId ? old.map(x => x.id === editingItemId ? saved : x) : [...old, saved]); setDraft(emptyItem(offerId)); setEditingItemId(null); }
  setSaving(false);
 };
 const editItem = (item: Item) => { setEditingItemId(item.id || null); setDraft({ ...item }); };
 const removeItem = async (item: Item) => {
  if (!item.id) return;
  const unpublish=await db.from('booking_engine_value_offers').update({active:false,featured:false,updated_at:new Date().toISOString()}).eq('id',offerId);
  if(unpublish.error){toast({title:'Could not return package to draft',description:unpublish.error.message,variant:'destructive'});return;}
  const r = await db.from('booking_engine_package_items').delete().eq('id', item.id);
  if (r.error) toast({ title: 'Could not remove package item', description: r.error.message, variant: 'destructive' });
  else setItems(old => old.filter(x => x.id !== item.id));
 };
 const savePrice = async () => {
  if (!selected || !items.length) { toast({ title: 'Add the package contents before saving its price' }); return; }
  if (items.some(i => !i.size_label.trim() || (!i.complimentary && (!i.individual_price.trim() || !Number.isFinite(Number(i.individual_price)) || Number(i.individual_price) <= 0)))) {
   toast({ title: 'Every chargeable item needs a size/variant and an individual price greater than zero; mark free items as complimentary', variant: 'destructive' }); return;
  }
  const finalPrice = items.filter(i => i.active && !i.complimentary).reduce((sum, i) => sum + Number(i.individual_price) * Number(i.quantity), 0);
  if (finalPrice <= 0) { toast({ title: 'The package final price must be greater than zero', variant: 'destructive' }); return; }
  setSaving(true);
  const r = await db.from('booking_engine_value_offers').update({ active:false, featured:false, price_mode: 'fixed', price_value: finalPrice, currency: 'KES', updated_at: new Date().toISOString() }).eq('id', offerId).select('id').single();
  if (r.error) toast({ title: 'Package price was not saved', description: r.error.message, variant: 'destructive' });
  else toast({ title: 'Package price saved', description: 'Final customer price: KSh ' + finalPrice.toLocaleString('en-KE') });
  setSaving(false);
 };
 return <Card>
  <CardHeader><CardTitle className="text-base">Package contents, sizes and individual prices</CardTitle><p className="text-sm text-muted-foreground">Configure each package separately. These prices do not change the normal service catalogue. Customers see the service, size, quantity and one final package price. Editing a published package automatically returns it to draft for reapproval.</p></CardHeader>
  <CardContent className="space-y-4">
   <div className="space-y-1"><Label>Select package to configure</Label><Select value={offerId} onValueChange={setOfferId}><SelectTrigger><SelectValue placeholder="Choose a package" /></SelectTrigger><SelectContent>{packages.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
   {selected && <>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><p className="font-semibold">{selected.title}</p><p className="text-xs text-muted-foreground">{items.length} configured items · {selected.active ? 'Published' : 'Draft'}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Calculated final price</p><p className="text-xl font-bold">KSh {total.toLocaleString('en-KE')}</p></div></div>
    {loading ? <p className="text-sm text-muted-foreground">Loading package items…</p> : <div className="space-y-2">{items.map((item, index) => {
      const service = activeServices.find(s => s.id === item.service_id);
      return <div key={item.id || index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="font-medium">{item.item_label || service?.name || 'Service'} <span className="font-normal text-muted-foreground">· {item.size_label} · Qty {item.quantity}</span></p><p className="text-xs text-muted-foreground">{service?.name || 'Unavailable service'} · {item.complimentary ? 'Complimentary' : 'KSh ' + (Number(item.individual_price) || 0).toLocaleString('en-KE') + ' each'}</p></div><div className="flex items-center gap-2"><Badge variant={item.complimentary ? 'secondary' : 'outline'}>{item.complimentary ? 'FREE' : 'Chargeable'}</Badge><Button size="sm" variant="outline" onClick={() => editItem(item)}>Edit</Button><Button size="icon" variant="ghost" onClick={() => void removeItem(item)} aria-label="Remove package item"><Trash2 className="h-4 w-4" /></Button></div></div>;
    })}{!items.length && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No contents configured yet. Add each included service below.</p>}</div>}
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
     <div className="font-semibold text-sm">Add a service to this package</div>
     <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2"><Label>Catalogue service</Label><Select value={draft.service_id} onValueChange={v => { setField('service_id', v); const s=activeServices.find(x=>x.id===v); if(s&&!draft.individual_price&&s.base_price!=null)setField('individual_price',String(s.base_price));  }}><SelectTrigger><SelectValue placeholder="Choose the exact service" /></SelectTrigger><SelectContent>{activeServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Customer-facing size / variant</Label><Input value={draft.size_label} onChange={e => setField('size_label',e.target.value)} placeholder="e.g. 5-seater, King size, 2 carpets" /></div>
      <div className="space-y-1"><Label>Display label (optional)</Label><Input value={draft.item_label} onChange={e => setField('item_label',e.target.value)} placeholder="e.g. Sofa cleaning" /></div>
      <div className="space-y-1"><Label>Quantity</Label><Input type="number" min="0.01" step="0.01" value={draft.quantity} onChange={e => setField('quantity',e.target.value)} /></div>
      <div className="space-y-1"><Label>Individual package price (KSh)</Label><Input type="number" min="0" step="0.01" disabled={draft.complimentary} value={draft.complimentary ? '0' : draft.individual_price} onChange={e => setField('individual_price',e.target.value)} placeholder="Enter approved price" /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={draft.complimentary} onCheckedChange={v => setField('complimentary',v===true)} />This item is complimentary (FREE)</label>
     </div>
     <p className="text-xs text-muted-foreground">Catalogue base price is only a suggested starting value. Confirm the package-specific price. The final package total uses individual price × quantity for chargeable items.</p>
     <div className="flex flex-wrap gap-2"><Button onClick={() => void addItem()} disabled={saving || !draft.service_id}><Plus className="mr-2 h-4 w-4" />{editingItemId ? 'Save item changes' : 'Add service'}</Button>{editingItemId && <Button variant="outline" onClick={() => { setEditingItemId(null); setDraft(emptyItem(offerId)); }}>Cancel edit</Button>}</div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Save the calculated price before approving and publishing this package.</p><Button onClick={() => void savePrice()} disabled={saving || !items.length}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save final package price'}</Button></div>
   </>}
  </CardContent>
 </Card>;
}
