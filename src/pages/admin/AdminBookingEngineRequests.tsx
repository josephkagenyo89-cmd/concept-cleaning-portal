import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

type Row={id:string;[key:string]:any};
const db=supabase as any;
const statusLabel=(s:string)=>String(s||'').replaceAll('_',' ');

export default function AdminBookingEngineRequests(){
 const {user}=useAuth();
 const [requests,setRequests]=useState<Row[]>([]);
 const [clients,setClients]=useState<Row[]>([]);
 const [items,setItems]=useState<Row[]>([]);
 const [services,setServices]=useState<Row[]>([]);
 const [events,setEvents]=useState<Row[]>([]);
 const [photos,setPhotos]=useState<Row[]>([]);
 const [staff,setStaff]=useState<Row[]>([]);
 const [clarificationMessage,setClarificationMessage]=useState('');
 const [searchTerm,setSearchTerm]=useState('');
 const [statusFilter,setStatusFilter]=useState('all');
 const [selectedId,setSelectedId]=useState('');
 const [quoteAmounts,setQuoteAmounts]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);

 const refresh=useCallback(async()=>{
  setLoading(true);
  const r=await db.from('booking_engine_requests').select('*').order('created_at',{ascending:false}).limit(100);
  if(r.error){toast({title:'Could not load Booking Engine requests',description:r.error.message,variant:'destructive'});setLoading(false);return;}
  const rows=r.data??[];setRequests(rows);setSelectedId(old=>old&&rows.some((x:Row)=>x.id===old)?old:(rows[0]?.id??''));
  const clientIds=[...new Set(rows.map((x:Row)=>x.customer_id).filter(Boolean))];
  const requestIds=rows.map((x:Row)=>x.id);
  const [c,i]=await Promise.all([
   clientIds.length?db.from('clients').select('id,full_name,phone,email').in('id',clientIds):Promise.resolve({data:[],error:null}),
   requestIds.length?db.from('booking_engine_request_items').select('*').in('request_id',requestIds).order('display_order'):Promise.resolve({data:[],error:null})
  ]);
  if(c.error||i.error)toast({title:'Some request details could not be loaded',description:c.error?.message||i.error?.message,variant:'destructive'});
  setClients(c.data??[]);setItems(i.data??[]);
  const serviceIds=[...new Set((i.data??[]).map((x:Row)=>x.service_id))];
  if(serviceIds.length){const s=await db.from('services').select('id,name,service_code').in('id',serviceIds);if(s.error)toast({title:'Could not load service names',description:s.error.message,variant:'destructive'});setServices(s.data??[]);}else setServices([]);
  const roleRows=await db.from('user_roles').select('user_id,role').in('role',['agent','admin','super_admin']);
  if(roleRows.error)toast({title:'Could not load staff accounts',description:roleRows.error.message,variant:'destructive'});
  const staffIds=(roleRows.data??[]).map((x:Row)=>x.user_id);
  if(staffIds.length){const p=await db.from('profiles').select('user_id,full_name').in('user_id',staffIds);if(p.error)toast({title:'Could not load staff profiles',description:p.error.message,variant:'destructive'});setStaff(p.data??[]);}else setStaff([]);
  setLoading(false);
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{let live=true;if(!selectedId){setEvents([]);setPhotos([]);return()=>{live=false;};}(async()=>{const [e,p]=await Promise.all([db.from('booking_engine_request_events').select('*').eq('request_id',selectedId).order('created_at',{ascending:false}),db.from('booking_engine_request_photos').select('*').eq('request_id',selectedId).order('display_order')]);if(!live)return;if(e.error||p.error)toast({title:'Could not load request history or photos',description:e.error?.message||p.error?.message,variant:'destructive'});setEvents(e.data??[]);const rows=p.data??[];const signed=await Promise.all(rows.map(async(photo:Row)=>{const url=await supabase.storage.from('booking-engine-photos').createSignedUrl(photo.storage_path,3600);return {...photo,signedUrl:url.data?.signedUrl};}));if(live)setPhotos(signed);})();return()=>{live=false;};},[selectedId]);

 const visibleRequests=useMemo(()=>requests.filter((row:Row)=>{const term=searchTerm.trim().toLowerCase();const customer=clients.find((x:Row)=>x.id===row.customer_id);const customerName=customer?.full_name||'';const customerPhone=customer?.phone||'';const matchesTerm=!term||String(row.request_number||'').toLowerCase().includes(term)||customerName.toLowerCase().includes(term)||customerPhone.toLowerCase().includes(term);return matchesTerm&&(statusFilter==='all'||row.status===statusFilter);}),[requests,clients,searchTerm,statusFilter]);
 const stats=useMemo(()=>({total:requests.length,review:requests.filter(x=>['submitted','under_review'].includes(x.status)).length,customer:requests.filter(x=>x.status==='awaiting_customer').length,quotes:requests.filter(x=>['quote_required','quote_prepared'].includes(x.status)).length,converted:requests.filter(x=>x.status==='converted').length,assigned:requests.filter(x=>!!x.assigned_to).length}),[requests]);
 const selected=useMemo(()=>requests.find(x=>x.id===selectedId)??null,[requests,selectedId]);
 const selectedItems=useMemo(()=>items.filter(x=>x.request_id===selectedId),[items,selectedId]);
 const client=clients.find(x=>x.id===selected?.customer_id);
 const serviceName=(id:string)=>services.find(x=>x.id===id)?.name||'Service';
 useEffect(()=>{setQuoteAmounts({});},[selectedId]);

 const transition=async(next:string,message:string)=>{
  if(!selected||!user)return;
  setSaving(true);
  try{
   const result=await db.rpc('transition_booking_engine_request_admin',{
    _request_id:selected.id,_to_status:next,_message:message
   });
   if(result.error)throw result.error;
   toast({title:'Request status updated',description:selected.request_number+' · '+statusLabel(next)});
   await refresh();
  }catch(e:any){toast({title:'Status update failed',description:e?.message||'Please retry.',variant:'destructive'});}
  finally{setSaving(false);}
 };

 const assess=async()=>{
  if(!selected)return;setSaving(true);
  try{
   const result=await db.rpc('calculate_booking_engine_request_price',{_request_id:selected.id});
   if(result.error)throw result.error;
   const next=result.data?.status==='quotation_required'?'quote_required':'approved';
   await transition(next,next==='quote_required'?'Pricing requires a formal staff quotation.':'Booking Engine pricing calculated and request approved for booking review.');
  }catch(e:any){toast({title:'Could not assess request pricing',description:e?.message||'Review the service configuration and answers.',variant:'destructive'});setSaving(false);}
 };

 const prepareQuote=async()=>{
  if(!selected)return;
  const needs=selectedItems.filter(x=>x.pricing_snapshot?.status==='quotation_required');
  const quoted=needs.map(x=>({item_id:x.id,quoted_amount:Number(quoteAmounts[x.id])}));
  if(!needs.length||quoted.some(x=>!Number.isFinite(x.quoted_amount)||x.quoted_amount<=0)){toast({title:'Enter a valid amount for every quotation-required service',variant:'destructive'});return;}
  setSaving(true);
  try{
   const result=await db.rpc('prepare_booking_engine_quotation',{_request_id:selected.id,_quoted_items:quoted});
   if(result.error)throw result.error;
   toast({title:'Quotation prepared',description:result.data?.quotation_number||'The quotation is linked to the Booking Engine request.'});
   await refresh();
  }catch(e:any){toast({title:'Could not prepare quotation',description:e?.message||'Please check the quoted amounts.',variant:'destructive'});}
  finally{setSaving(false);}
 };

 const assign=async(assignedUserId:string)=>{if(!selected)return;setSaving(true);try{const result=await db.rpc('assign_booking_engine_request_admin',{_request_id:selected.id,_assigned_user_id:assignedUserId||null});if(result.error)throw result.error;toast({title:'Request assignment updated'});await refresh();}catch(e:any){toast({title:'Could not update assignment',description:e?.message||'Please retry.',variant:'destructive'});}finally{setSaving(false);}};
 const requestClarification=async()=>{if(!clarificationMessage.trim()||clarificationMessage.trim().length>3000){toast({title:'Enter a clarification message of up to 3000 characters',variant:'destructive'});return;}await transition('awaiting_customer',clarificationMessage.trim());setClarificationMessage('');};

 const markReady=async()=>{
  if(!selected)return;setSaving(true);
  try{
   const result=await db.rpc('mark_booking_engine_ready_for_booking',{_request_id:selected.id});
   if(result.error)throw result.error;
   toast({title:'Approved for booking',description:'The customer can now confirm conversion from My Bookings.'});
   await refresh();
  }catch(e:any){toast({title:'Could not approve for booking',description:e?.message||'Please retry.',variant:'destructive'});}
  finally{setSaving(false);}
 };

 return <section className="mt-8 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Booking requests</h2><p className="text-sm text-muted-foreground">Review submitted guided requests, assess server pricing and prepare quotations.</p></div><Button variant="outline" onClick={()=>void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Latest requests</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">In review</p><p className="text-2xl font-bold">{stats.review}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Waiting on customer</p><p className="text-2xl font-bold">{stats.customer}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Quotation stage</p><p className="text-2xl font-bold">{stats.quotes}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Converted</p><p className="text-2xl font-bold">{stats.converted}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Assigned</p><p className="text-2xl font-bold">{stats.assigned}</p></CardContent></Card></div>
  <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.5fr)]">
   <Card className="h-fit"><CardHeader><CardTitle className="text-base">Request queue ({visibleRequests.length})</CardTitle></CardHeader><CardContent className="space-y-2"><Input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search request or customer…"/><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{['submitted','under_review','awaiting_customer','approved','quote_required','quote_prepared','customer_accepted','ready_for_booking','converted','rejected','cancelled'].map(status=><option key={status} value={status}>{statusLabel(status)}</option>)}</select>
    {loading&&<p className="text-sm text-muted-foreground">Loading requests…</p>}
    {!loading&&!requests.length&&<p className="text-sm text-muted-foreground">No guided booking requests yet.</p>}
    {visibleRequests.map(r=><button key={r.id} onClick={()=>setSelectedId(r.id)} className={'w-full rounded-lg border p-3 text-left '+(r.id===selectedId?'border-primary bg-primary/5':'hover:bg-muted/50')}>
     <span className="flex items-center justify-between gap-2"><b className="text-sm">{r.request_number}</b><Badge variant={r.status==='submitted'?'default':'secondary'}>{statusLabel(r.status)}</Badge></span>
     <span className="mt-1 block text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.requested_date||'Date pending'}</span>
    </button>)}
   </CardContent></Card>
   {!selected?<Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Select a request to review.</CardContent></Card>:<div className="space-y-4">
    <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base"><span>{selected.request_number}</span><Badge>{statusLabel(selected.status)}</Badge></CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
     <div className="grid gap-2 sm:grid-cols-2"><div><span className="text-xs text-muted-foreground">Customer</span><p className="font-medium">{client?.full_name||'Customer record unavailable'}</p><p className="text-xs text-muted-foreground">{client?.phone||''}</p></div><div><span className="text-xs text-muted-foreground">Preferred schedule</span><p>{selected.requested_date||'Not specified'} {selected.requested_time||''}</p></div><div className="sm:col-span-2"><span className="text-xs text-muted-foreground">Location</span><p>{selected.service_location||'Not provided'}</p></div></div>
     {selected.customer_notes&&<div className="rounded border p-3"><b className="text-xs">Customer notes</b><p className="mt-1 whitespace-pre-wrap">{selected.customer_notes}</p></div>}
     <div className="rounded border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-xs">Assigned staff member</b><span className="text-xs text-muted-foreground">{staff.find(x=>x.user_id===selected.assigned_to)?.full_name||'Unassigned'}</span></div><select className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.assigned_to||''} onChange={e=>void assign(e.target.value)} disabled={saving}><option value="">Unassigned</option>{staff.map(member=><option key={member.user_id} value={member.user_id}>{member.full_name||member.user_id}</option>)}</select></div>
     <div><b className="text-xs">Requested services</b><div className="mt-2 space-y-2">{selectedItems.map(item=><div key={item.id} className="rounded border p-3">
      <div className="flex flex-wrap justify-between gap-2"><b>{serviceName(item.service_id)}</b><span className="text-xs text-muted-foreground">Qty {item.quantity??1}</span></div>
      {Object.keys(item.answers||{}).length>0&&<pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(item.answers,null,2)}</pre>}
      {Object.keys(item.measurements||{}).length>0&&<p className="mt-1 text-xs">Measurements: {JSON.stringify(item.measurements)}</p>}
      {item.pricing_snapshot?.status&&<p className="mt-1 text-xs">Pricing: {item.pricing_snapshot.status}{item.pricing_snapshot.total!=null?' · KES '+Number(item.pricing_snapshot.total).toLocaleString():''}</p>}
      {item.scope_snapshot&&<details className="mt-2 text-xs"><summary className="cursor-pointer">Captured scope</summary><pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(item.scope_snapshot,null,2)}</pre></details>}
     </div>)}</div></div>
     {photos.length>0&&<div className="space-y-2"><b className="text-xs">Customer service photos ({photos.length})</b><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map(photo=><div key={photo.id} className="overflow-hidden rounded-lg border">{photo.signedUrl?<a href={photo.signedUrl} target="_blank" rel="noreferrer"><img src={photo.signedUrl} alt={photo.original_filename||'Customer service photo'} className="h-32 w-full object-cover"/></a>:<div className="flex h-32 items-center justify-center text-xs text-muted-foreground">Preview unavailable</div>}<div className="p-2"><p className="text-xs font-medium">{String(photo.photo_category).replaceAll('_',' ')}</p><p className="truncate text-[11px] text-muted-foreground">{photo.original_filename||'Uploaded image'}</p></div></div>)}</div></div>}
     <p className="text-xs text-muted-foreground">Scope acknowledgement: {selected.customer_acknowledged_scope?'Yes':'No'} · Quotation linked: {selected.quotation_id?'Yes':'No'} · Converted: {selected.converted_booking_id?'Yes':'No'}</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Workflow actions</CardTitle></CardHeader><CardContent className="space-y-3">
     {selected.status==='under_review'&&<div className="space-y-2 rounded-lg border p-3"><Label>Request more information from the customer</Label><Input value={clarificationMessage} maxLength={3000} onChange={e=>setClarificationMessage(e.target.value)} placeholder="Explain exactly what information or photo is needed…"/><Button variant="outline" onClick={()=>void requestClarification()} disabled={saving||!clarificationMessage.trim()}>Send clarification request</Button></div>}
     {selected.status==='awaiting_customer'&&<p className="text-sm text-muted-foreground">Waiting for the customer to respond to the clarification request.</p>}
     {selected.status==='submitted'&&<Button onClick={()=>void transition('under_review','Request assigned for staff review.')} disabled={saving}>Start review</Button>}
     {selected.status==='under_review'&&<Button onClick={()=>void assess()} disabled={saving}>Assess server-side pricing & approve</Button>}
     {selected.status==='quote_required'&&<div className="space-y-3"><div className="flex items-start gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-600"/>Enter the staff-approved amount for each service requiring a quotation. Other automatically priced items are retained.</div>{selectedItems.filter(x=>x.pricing_snapshot?.status==='quotation_required').map(item=><div key={item.id} className="space-y-1"><Label>{serviceName(item.service_id)} · quoted amount (KES)</Label><Input type="number" min="0.01" step="0.01" value={quoteAmounts[item.id]||''} onChange={e=>setQuoteAmounts(x=>({...x,[item.id]:e.target.value}))}/></div>)}<Button onClick={()=>void prepareQuote()} disabled={saving}>Prepare formal quotation</Button></div>}
     {selected.status==='approved'&&<Button onClick={()=>void markReady()} disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4"/>Approve for booking</Button>}
     {selected.status==='quote_prepared'&&<p className="text-sm text-muted-foreground">Quotation prepared. Waiting for the customer to accept it in My Bookings.</p>}
     {selected.status==='customer_accepted'&&<p className="text-sm text-muted-foreground">Customer accepted the quotation. The customer can continue to booking confirmation.</p>}
     {selected.status==='ready_for_booking'&&<p className="text-sm text-muted-foreground">Approved. Waiting for the customer to confirm conversion into an ERP booking.</p>}
     {selected.status==='converted'&&<p className="text-sm text-emerald-700">This request has been converted to an ERP booking.</p>}
     {events.length>0&&<div className="space-y-2 border-t pt-3"><b className="text-xs">Request activity</b><ol className="space-y-2">{events.map(event=><li key={event.id} className="rounded border p-2"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-semibold">{String(event.event_type).replaceAll('_',' ')}</span><span className="text-[11px] text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div>{event.message&&<p className="mt-1 whitespace-pre-wrap text-xs">{event.message}</p>}<p className="mt-1 text-[11px] text-muted-foreground">{event.actor_name||'System'}</p></li>)}</ol></div>}
     {['submitted','under_review','quote_required'].includes(selected.status)&&<Button variant="destructive" onClick={()=>void transition('rejected','Request rejected by staff after review.')} disabled={saving}>Reject request</Button>}
     {saving&&<p className="text-xs text-muted-foreground">Saving workflow update…</p>}
    </CardContent></Card>
   </div>}
  </div>
 </section>;
}
