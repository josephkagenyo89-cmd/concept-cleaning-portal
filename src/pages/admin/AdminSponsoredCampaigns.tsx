import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { compressImageToWebP } from '@/lib/imageCompression';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Plus, RefreshCw, Save, ShieldCheck, ImagePlus, Loader2, Search, Trash2, Upload, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const db=supabase as any;
const blank=()=>({campaign_code:'',owner_type:'concept',provider_name:'',provider_email:'',provider_phone:'',title:'',description:'',destination_url:'',creative_image_url:'',billing_model:'none',budget_amount:'',agreed_amount:'',billing_status:'not_invoiced',starts_at:'',ends_at:'',internal_notes:''});
const billingStatuses=[{value:'not_invoiced',label:'Not yet invoiced'},{value:'invoiced',label:'Invoice sent'},{value:'partially_paid',label:'Partially paid'},{value:'paid',label:'Fully paid'},{value:'overdue',label:'Overdue'},{value:'waived',label:'Waived'}];
const billingModels=[{value:'fixed',label:'Fixed fee'},{value:'cpc',label:'Cost per click (CPC)'},{value:'cpm',label:'Cost per 1,000 views (CPM)'}];
const placementOptions=[{value:'homepage_featured',label:'Homepage featured — appears on the homepage'},{value:'marketplace_featured',label:'Marketplace featured — appears in the service marketplace'},{value:'category_featured',label:'Category featured — appears in a selected service category'},{value:'search_featured',label:'Search featured — appears with matching search results'}];
const labelPresets=['Sponsored','Featured partner','Recommended partner','Special offer'];
export default function AdminSponsoredCampaigns(){
 const [rows,setRows]=useState<any[]>([]),[placements,setPlacements]=useState<any[]>([]),[events,setEvents]=useState<any[]>([]),[billingRows,setBillingRows]=useState<any[]>([]);
 const [selected,setSelected]=useState(''),[draft,setDraft]=useState(blank),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [slot,setSlot]=useState('homepage_featured'),[category,setCategory]=useState(''),[service,setService]=useState(''),[label,setLabel]=useState('Sponsored');
 const [categories,setCategories]=useState<any[]>([]),[services,setServices]=useState<any[]>([]);
 const [packageLinks,setPackageLinks]=useState<{key:string;label:string;url:string}[]>([]);
 const [billType,setBillType]=useState('invoice'),[billRef,setBillRef]=useState(''),[billAmount,setBillAmount]=useState(''),[billDue,setBillDue]=useState('');
 const current=rows.find(x=>x.id===selected)||null;
 const set=(k:string,v:string)=>setDraft(old=>({...old,[k]:v}));
 const reload=useCallback(async()=>{
  setLoading(true);
  const [c,p,e,cat,s,b]=await Promise.all([
   db.from('sponsored_campaigns').select('*').order('created_at',{ascending:false}),
   db.from('sponsored_campaign_placements').select('*').order('display_order'),
   db.from('sponsored_campaign_events').select('campaign_id,event_type').limit(10000),
   db.from('service_categories').select('id,name').eq('is_active',true).order('name'),
   db.from('services').select('id,name').eq('is_active',true).order('name'),
   db.from('sponsored_campaign_billing_records').select('*').order('created_at',{ascending:false}).limit(500)
  ]);
  const err=c.error||p.error||e.error||cat.error||s.error||b.error;
  if(err)toast({title:'Could not load sponsored campaigns',description:err.message,variant:'destructive'});
  else{setRows(c.data||[]);setPlacements(p.data||[]);setEvents(e.data||[]);setCategories(cat.data||[]);setServices(s.data||[]);setBillingRows(b.data||[]);setSelected(old=>old&&(c.data||[]).some((x:any)=>x.id===old)?old:(c.data?.[0]?.id||''));}
  // Build direct package booking links from the same published offer records used by the customer package page.
  try {
   const now=Date.now();
   const offerResult=await db.from('booking_engine_value_offers')
    .select('id,title,starts_at,ends_at,price_value')
    .eq('active',true).eq('offer_type','package').eq('price_mode','fixed')
    .not('price_value','is',null).order('display_order').order('title');
   if(offerResult.error) throw offerResult.error;
   const currentOffers=(offerResult.data||[]).filter((o:any)=>
    (!o.starts_at||new Date(o.starts_at).getTime()<=now)&&(!o.ends_at||new Date(o.ends_at).getTime()>now)
   );
   const offerIds=currentOffers.map((o:any)=>o.id);
   const itemResult=offerIds.length?await db.from('booking_engine_package_items')
    .select('offer_id,service_id,size_label,quantity,individual_price,complimentary,display_order,service:services!inner(is_active)')
    .in('offer_id',offerIds).eq('active',true).order('display_order').order('created_at'):{data:[],error:null};
   if(itemResult.error) throw itemResult.error;
   const itemsByOffer=new Map<string,any[]>();
   for(const item of itemResult.data||[]) itemsByOffer.set(item.offer_id,[...(itemsByOffer.get(item.offer_id)||[]),item]);
   const firstServiceIds=[...new Set(currentOffers.map((o:any)=>(itemsByOffer.get(o.id)||[])[0]?.service_id).filter(Boolean))];
   const configResult=firstServiceIds.length?await db.from('booking_engine_service_config').select('service_id').in('service_id',firstServiceIds).eq('enabled',true):{data:[],error:null};
   if(configResult.error) throw configResult.error;
   const configuredTriggers=new Set((configResult.data||[]).map((row:any)=>row.service_id));
   const completeOffers=currentOffers.filter((o:any)=>{
    const items=itemsByOffer.get(o.id)||[];
    const total=items.reduce((sum:number,item:any)=>sum+(item.complimentary?0:Number(item.individual_price)*Number(item.quantity)),0);
    return items.length>0&&configuredTriggers.has(items[0].service_id)&&items.every((item:any)=>
     !!item.size_label?.trim()&&Number(item.quantity)>0&&item.service?.is_active===true&&
     (item.complimentary||(item.individual_price!=null&&Number(item.individual_price)>0))
    )&&Math.abs(total-Number(o.price_value))<=0.01;
   });
   const requested=[{key:'gold',label:'Gold Package'},{key:'platinum',label:'Platinum Package'},{key:'ultimate',label:'Ultimate Package'}];
   const links=requested.flatMap(p=>{
    const offer=completeOffers.find((o:any)=>new RegExp('\\b'+p.key+'\\b','i').test(o.title||''));
    const serviceId=offer?(itemsByOffer.get(offer.id)||[])[0]?.service_id:null;
    return offer&&serviceId?[{...p,url:'https://conceptcleaningservices.co.ke/service/'+encodeURIComponent(serviceId)+'?offer='+encodeURIComponent(offer.id)}]:[];
   });
   setPackageLinks(links);
  } catch(error:any) {
   console.error('Could not prepare sponsored package destinations:',error);
   setPackageLinks([]);
  }
  setLoading(false);
 },[]);
 useEffect(()=>{void reload();},[reload]);
 useEffect(()=>{if(!current)return;setDraft({campaign_code:current.campaign_code,owner_type:current.owner_type,provider_name:current.provider_name||'',provider_email:current.provider_email||'',provider_phone:current.provider_phone||'',title:current.title,description:current.description||'',destination_url:current.destination_url||'',creative_image_url:current.creative_image_url||'',billing_model:current.billing_model,budget_amount:current.budget_amount==null?'':String(current.budget_amount),agreed_amount:current.agreed_amount==null?'':String(current.agreed_amount),billing_status:current.billing_status,starts_at:current.starts_at?new Date(current.starts_at).toISOString().slice(0,16):'',ends_at:current.ends_at?new Date(current.ends_at).toISOString().slice(0,16):'',internal_notes:current.internal_notes||''});},[selected]);
 const save=async()=>{
  if(!draft.campaign_code.trim()||!draft.title.trim()){toast({title:'Campaign code and title are required'});return;}
  if(draft.owner_type==='third_party'&&!draft.provider_name.trim()){toast({title:'Provider name is required'});return;}
  if(draft.starts_at&&draft.ends_at&&new Date(draft.starts_at)>=new Date(draft.ends_at)){toast({title:'End date must be after start date',variant:'destructive'});return;}
  for(const [label,value] of [['Budget',draft.budget_amount],['Agreed amount',draft.agreed_amount]] as const){if(value!==''&&(!Number.isFinite(Number(value))||Number(value)<0)){toast({title:label+' must be a valid non-negative amount',variant:'destructive'});return;}}
  for(const [label,value] of [['Destination URL',draft.destination_url],['Creative image URL',draft.creative_image_url]] as const){if(value){try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new Error();}catch{toast({title:label+' must be a valid http or https URL',variant:'destructive'});return;}}}
  const user=(await supabase.auth.getUser()).data.user?.id||null;
  const payload={campaign_code:draft.campaign_code.trim().toUpperCase(),owner_type:draft.owner_type,provider_name:draft.owner_type==='third_party'?draft.provider_name.trim():null,provider_email:draft.owner_type==='third_party'?draft.provider_email.trim()||null:null,provider_phone:draft.owner_type==='third_party'?draft.provider_phone.trim()||null:null,title:draft.title.trim(),description:draft.description.trim()||null,destination_url:draft.destination_url.trim()||null,creative_image_url:draft.creative_image_url.trim()||null,billing_model:draft.owner_type==='concept'?'none':draft.billing_model,budget_amount:draft.budget_amount===''?null:Number(draft.budget_amount),agreed_amount:draft.agreed_amount===''?null:Number(draft.agreed_amount),billing_status:draft.owner_type==='concept'?'not_applicable':draft.billing_status,starts_at:draft.starts_at?new Date(draft.starts_at).toISOString():null,ends_at:draft.ends_at?new Date(draft.ends_at).toISOString():null,internal_notes:draft.internal_notes.trim()||null,updated_at:new Date().toISOString()};
  setSaving(true);const r=current?await db.from('sponsored_campaigns').update(payload).eq('id',current.id).select('*').single():await db.from('sponsored_campaigns').insert({...payload,created_by:user,status:'draft'}).select('*').single();
  if(r.error)toast({title:'Campaign not saved',description:r.error.message,variant:'destructive'});else{toast({title:current?'Campaign updated':'Draft created'});setSelected(r.data.id);await reload();}setSaving(false);
 };
 const status=async(next:string)=>{
  if(!current)return;
  if(next==='approved'&&current.owner_type==='third_party'&&!['paid','waived'].includes(current.billing_status)){toast({title:'Third-party billing must be paid or waived before approval',variant:'destructive'});return;}
  const user=(await supabase.auth.getUser()).data.user?.id||null;const payload:any={status:next,updated_at:new Date().toISOString()};
  if(next==='approved'){payload.approved_by=user;payload.approved_at=new Date().toISOString();}
  const r=await db.from('sponsored_campaigns').update(payload).eq('id',current.id);
  if(r.error)toast({title:'Status update failed',description:r.error.message,variant:'destructive'});else await reload();
 };
 const addPlacement=async()=>{
  if(!current)return;if(slot==='category_featured'&&!category){toast({title:'Select a category'});return;}
  const categoryId=slot==='category_featured'?category:null,serviceId=service||null;
  const duplicate=placements.some(p=>p.campaign_id===current.id&&p.placement_key===slot&&p.category_id===categoryId&&p.service_id===serviceId);
  if(duplicate){toast({title:'This placement already exists for the campaign',variant:'destructive'});return;}
  const r=await db.from('sponsored_campaign_placements').insert({campaign_id:current.id,placement_key:slot,category_id:categoryId,service_id:serviceId,display_label:label.trim()||'Sponsored',active:false});
  if(r.error)toast({title:'Placement not added',description:r.error.message,variant:'destructive'});else{toast({title:'Disabled placement added'});setService('');await reload();}
 };
 const placementToggle=async(p:any)=>{
  if(!p.active&&current?.status!=='approved'){toast({title:'Approve campaign before enabling placement',variant:'destructive'});return;}
  const r=await db.from('sponsored_campaign_placements').update({active:!p.active,updated_at:new Date().toISOString()}).eq('id',p.id);
  if(r.error)toast({title:'Placement update failed',description:r.error.message,variant:'destructive'});else await reload();
 };
 const addBilling=async()=>{
  if(!current||!billRef.trim()||Number(billAmount)<=0){toast({title:'Enter billing reference and a positive amount'});return;}
  const user=(await supabase.auth.getUser()).data.user?.id||null;
  const r=await db.from('sponsored_campaign_billing_records').insert({campaign_id:current.id,record_type:billType,reference_number:billRef.trim(),amount:Number(billAmount),status:billType==='invoice'?'issued':'recorded',issued_at:billType==='invoice'?new Date().toISOString():null,due_at:billDue?new Date(billDue).toISOString():null,created_by:user});
  if(r.error)toast({title:'Billing record failed',description:r.error.message,variant:'destructive'});else{setBillRef('');setBillAmount('');setBillDue('');toast({title:'Billing record saved'});await reload();}
 };
 const metrics=(type:string)=>events.filter(x=>x.campaign_id===selected&&x.event_type===type).length;
 const currentBilling=billingRows.filter(x=>x.campaign_id===selected);
 const setBilling=async(value:string)=>{if(!current)return;const r=await db.from('sponsored_campaigns').update({billing_status:value,updated_at:new Date().toISOString()}).eq('id',current.id);if(r.error)toast({title:'Billing status not updated',description:r.error.message,variant:'destructive'});else await reload();};
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><Megaphone className="h-5 w-5 text-primary"/>Sponsored campaigns</h1><p className="text-sm text-muted-foreground">Internal campaign register for Concept promotions and paid third-party placements.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>void reload()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button><Button onClick={()=>{setSelected('');setDraft(blank());}}><Plus className="mr-2 h-4 w-4"/>New campaign</Button></div></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Campaigns',value:rows.length},{label:'Awaiting approval',value:rows.filter(x=>x.status==='pending_approval').length},{label:'Impressions',value:events.filter(x=>x.event_type==='impression').length},{label:'Clicks',value:events.filter(x=>x.event_type==='click').length}].map(x=><Card key={x.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{x.label}</p><p className="text-2xl font-bold">{x.value.toLocaleString()}</p></CardContent></Card>)}</div>
  <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
   <Card><CardHeader><CardTitle className="text-base">Campaign register</CardTitle></CardHeader><CardContent className="space-y-2">{loading?'Loading…':rows.length===0?<p className="text-sm text-muted-foreground">No campaigns created.</p>:rows.map(c=><button key={c.id} onClick={()=>setSelected(c.id)} className={'w-full rounded-lg border p-3 text-left '+(selected===c.id?'border-primary bg-primary/5':'hover:bg-muted/40')}><span className="block text-sm font-semibold">{c.title}</span><span className="text-xs text-muted-foreground">{c.owner_type==='concept'?'Concept':c.provider_name||'Provider'} · {c.status.replaceAll('_',' ')}</span></button>)}</CardContent></Card>
   <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">{current?'Campaign settings':'New campaign'}</CardTitle></CardHeader><CardContent className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2"><div><Label>Campaign reference code *</Label><Input value={draft.campaign_code} onChange={e=>set('campaign_code',e.target.value.toUpperCase())} placeholder="e.g. NOV26-CONCEPT-01"/><p className="mt-1 text-xs text-muted-foreground">A unique internal code to identify this campaign. Use letters, numbers and hyphens.</p></div><div><Label>Who is running this campaign?</Label><Select value={draft.owner_type} onValueChange={v=>{set('owner_type',v);if(v==='third_party'&&draft.billing_model==='none')set('billing_model','fixed');}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="concept">Concept-owned</SelectItem><SelectItem value="third_party">Third-party paid</SelectItem></SelectContent></Select></div></div>
    {draft.owner_type==='third_party'&&<div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3"><div><Label>Business / advertiser name *</Label><Input value={draft.provider_name} onChange={e=>set('provider_name',e.target.value)} placeholder="e.g. ABC Home Supplies"/><p className="mt-1 text-xs text-muted-foreground">Name of the business paying for the advert.</p></div><div><Label>Advertiser email address</Label><Input type="email" value={draft.provider_email} onChange={e=>set('provider_email',e.target.value)} placeholder="name@business.co.ke"/></div><div><Label>Advertiser phone number</Label><Input value={draft.provider_phone} onChange={e=>set('provider_phone',e.target.value)} placeholder="e.g. 0712 345 678"/></div></div>}
    <div><Label>Advert headline / campaign title *</Label><Input value={draft.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Trusted home cleaning products"/><p className="mt-1 text-xs text-muted-foreground">The short heading customers will see on the sponsored card.</p></div><div><Label>Short advert description</Label><Textarea value={draft.description} onChange={e=>set('description',e.target.value)} placeholder="Briefly explain what is being promoted and why a customer should click. Keep it clear and customer-friendly."/><p className="mt-1 text-xs text-muted-foreground">Write 1–2 short sentences. Avoid internal notes or billing information here.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Where should the customer go? (Destination link)</Label><Input value={draft.destination_url} onChange={e=>set('destination_url',e.target.value)} placeholder="https://conceptcleaningservices.co.ke/..."/><Select value="" onValueChange={value=>{const preset=packageLinks.find(x=>x.key===value);if(preset)set('destination_url',preset.url);}}><SelectTrigger><SelectValue placeholder="Prefill a package booking link"/></SelectTrigger><SelectContent>{['gold','platinum','ultimate'].map(key=>{const preset=packageLinks.find(x=>x.key===key);const label=key.charAt(0).toUpperCase()+key.slice(1)+' Package';return <SelectItem key={key} value={key} disabled={!preset}>{label}{!preset?' — no active published package':''}</SelectItem>;})}</SelectContent></Select><p className="text-xs text-muted-foreground">Choose Gold, Platinum or Ultimate to fill its direct booking link. You can still edit the URL manually. Links are built from currently published package offers.</p></div><div><Label>Campaign image / banner</Label><SponsoredMediaPicker value={draft.creative_image_url} onChange={url=>set('creative_image_url',url)}/></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label>Campaign start date and time</Label><Input type="datetime-local" value={draft.starts_at} onChange={e=>set('starts_at',e.target.value)}/><p className="mt-1 text-xs text-muted-foreground">When the advert is allowed to start showing. Uses Kenya local time.</p></div><div><Label>Campaign end date and time</Label><Input type="datetime-local" value={draft.ends_at} onChange={e=>set('ends_at',e.target.value)}/><p className="mt-1 text-xs text-muted-foreground">When the advert should stop showing. Leave blank for no scheduled end.</p></div></div>
    {draft.owner_type==='third_party'&&<div className="space-y-3 rounded-lg border p-3"><p className="text-sm font-semibold">Provider commercial terms</p><div className="grid gap-3 sm:grid-cols-2"><div><Label>How will the advertiser be charged?</Label><Select value={draft.billing_model} onValueChange={v=>set('billing_model',v)}><SelectTrigger><SelectValue placeholder="Choose a charging method"/></SelectTrigger><SelectContent>{billingModels.map(x=><SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Fixed fee = one agreed price. CPC = charged per click. CPM = charged per 1,000 advert views.</p></div><div><Label>Payment status</Label><Select value={draft.billing_status} onValueChange={v=>set('billing_status',v)}><SelectTrigger><SelectValue placeholder="Choose payment status"/></SelectTrigger><SelectContent>{billingStatuses.map(x=><SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Select the current invoice/payment position. A third-party campaign must be paid or waived before approval.</p></div><div><Label>Campaign budget (KES)</Label><Input type="number" min="0" value={draft.budget_amount} onChange={e=>set('budget_amount',e.target.value)} placeholder="e.g. 15000"/><p className="mt-1 text-xs text-muted-foreground">Optional planned amount allocated to this campaign.</p></div><div><Label>Agreed advertising fee (KES)</Label><Input type="number" min="0" value={draft.agreed_amount} onChange={e=>set('agreed_amount',e.target.value)} placeholder="e.g. 10000"/><p className="mt-1 text-xs text-muted-foreground">The amount Concept agreed to charge the advertiser.</p></div></div></div>}
    <div><Label>Internal admin notes (not shown to customers)</Label><Textarea value={draft.internal_notes} onChange={e=>set('internal_notes',e.target.value)} placeholder="Add follow-up reminders, special instructions or approval context for the Concept team."/></div>
    <div className="flex flex-wrap justify-between gap-2 border-t pt-3"><Badge variant="outline">{current?current.status.replaceAll('_',' '):'New draft'}</Badge><Button onClick={()=>void save()} disabled={saving}><Save className="mr-2 h-4 w-4"/>{saving?'Saving…':'Save campaign'}</Button></div>
    {current&&<div className="flex flex-wrap gap-2 border-t pt-3">{current.status==='draft'&&<Button size="sm" variant="outline" onClick={()=>void status('pending_approval')}>Submit for approval</Button>}{current.status==='pending_approval'&&<><Button size="sm" onClick={()=>void status('approved')}>Approve</Button><Button size="sm" variant="destructive" onClick={()=>void status('rejected')}>Reject</Button></>}{current.status==='approved'&&<Button size="sm" variant="outline" onClick={()=>void status('paused')}>Pause</Button>}{current.status==='paused'&&<Button size="sm" onClick={()=>void status('approved')}>Resume</Button>}{['approved','paused'].includes(current.status)&&<Button size="sm" variant="outline" onClick={()=>void status('completed')}>Mark completed</Button>}{!['completed','cancelled','rejected'].includes(current.status)&&<Button size="sm" variant="destructive" onClick={()=>void status('cancelled')}>Cancel campaign</Button>}</div>}
   </CardContent></Card>
   {current&&<div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Placement controls</CardTitle><p className="text-xs text-muted-foreground">Placements are disabled by default. Approved and enabled placements appear in their selected public locations.</p></CardHeader><CardContent className="space-y-3"><div><Label>Where should this advert appear?</Label><Select value={slot} onValueChange={setSlot}><SelectTrigger><SelectValue placeholder="Choose a website location"/></SelectTrigger><SelectContent>{placementOptions.map(x=><SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Choose the public website area where this campaign should be displayed.</p></div>{slot==='category_featured'&&<div><Label>Which service category?</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Select the category to target"/></SelectTrigger><SelectContent>{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">The advert will appear only in this selected category.</p></div>}{slot!=='homepage_featured'&&<div><Label>Link this advert to a service (optional)</Label><Select value={service||'all'} onValueChange={v=>setService(v==='all'?'':v)}><SelectTrigger><SelectValue placeholder="Choose a service or all services"/></SelectTrigger><SelectContent><SelectItem value="all">All services / no specific service</SelectItem>{services.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Choose a service when the advert is relevant to one service. Otherwise leave it on “All services”.</p></div>}<div><Label>Small label shown on the advert</Label><Select value={labelPresets.includes(label)?label:'custom'} onValueChange={v=>setLabel(v==='custom'?'':v)}><SelectTrigger><SelectValue placeholder="Choose a label"/></SelectTrigger><SelectContent>{labelPresets.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}<SelectItem value="custom">Write a custom label</SelectItem></SelectContent></Select>{!labelPresets.includes(label)&&<Input className="mt-2" value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Official partner"/>}<p className="mt-1 text-xs text-muted-foreground">This short tag appears on the sponsored card so customers know it is a promoted placement.</p></div><Button variant="outline" onClick={()=>void addPlacement()}><Plus className="mr-2 h-4 w-4"/>Add disabled placement</Button><div className="space-y-2">{placements.filter(p=>p.campaign_id===selected).map(p=><div key={p.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm"><span>{p.placement_key.replaceAll('_',' ')} · {p.display_label}</span><Button size="sm" variant={p.active?'destructive':'outline'} disabled={!p.active&&current.status!=='approved'} onClick={()=>void placementToggle(p)}>{p.active?'Disable':'Enable'}</Button></div>)}</div></CardContent></Card>
   <Card><CardHeader><CardTitle className="text-base">Performance & provider billing</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-3 gap-2 text-center">{['impression','click','conversion'].map((t,i)=><div className="rounded bg-muted/40 p-2" key={t}><p className="text-lg font-bold">{metrics(t)}</p><p className="text-xs text-muted-foreground">{['Impressions','Clicks','Conversions'][i]}</p></div>)}</div><p className="text-xs text-muted-foreground">Impressions and clicks are recorded by the trusted tracking endpoint when public placements are viewed or selected.</p>{current.owner_type==='third_party'&&<><div className="border-t pt-3"><Label>Billing record type</Label><Select value={billType} onValueChange={setBillType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="invoice">Invoice</SelectItem><SelectItem value="payment">Payment</SelectItem><SelectItem value="credit_note">Credit note</SelectItem><SelectItem value="adjustment">Adjustment</SelectItem></SelectContent></Select><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><Label>Invoice / receipt reference</Label><Input value={billRef} onChange={e=>setBillRef(e.target.value)} placeholder="e.g. INV-2026-001"/></div><div><Label>Amount (KES)</Label><Input type="number" min="0.01" value={billAmount} onChange={e=>setBillAmount(e.target.value)} placeholder="e.g. 10000"/></div><div><Label>Payment due date (if applicable)</Label><Input type="date" value={billDue} onChange={e=>setBillDue(e.target.value)}/></div></div><Button className="mt-2" variant="outline" onClick={()=>void addBilling()}>Save billing record</Button></div><div className="border-t pt-3"><Label>Overall payment status</Label><Select value={current.billing_status} onValueChange={v=>void setBilling(v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{billingStatuses.map(x=><SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></div><div className="border-t pt-3"><p className="mb-2 text-sm font-semibold">Billing history</p>{currentBilling.length===0?<p className="text-xs text-muted-foreground">No billing records yet.</p>:<div className="space-y-2">{currentBilling.map((r:any)=><div key={r.id} className="flex flex-wrap justify-between gap-2 rounded border p-2 text-xs"><span><strong>{r.record_type.replaceAll('_',' ')}</strong> · {r.reference_number}<span className="block text-muted-foreground">{r.status} · {r.due_at?new Date(r.due_at).toLocaleDateString():'No due date'}</span></span><strong>{new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:2}).format(Number(r.amount))}</strong></div>)}</div>}</div></>}</CardContent></Card></div>}
  </div></div>
  <p className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><ShieldCheck className="h-4 w-4 shrink-0"/>Admin-only campaign controls. Public reads are restricted to approved campaign creative fields; billing records and tracking writes are not exposed to browser roles.</p>
 </div>;
}


const SPONSORED_MEDIA_BUCKET = 'assets';
const SPONSORED_MEDIA_PREFIX = 'sponsored-campaigns';
const SPONSORED_MEDIA_MAX_BYTES = 20 * 1024;
type SponsoredMediaItem = { name: string; metadata?: Record<string, unknown> };

function SponsoredMediaPicker({value,onChange}:{value:string;onChange:(url:string)=>void}){
 const [open,setOpen]=useState(false),[items,setItems]=useState<SponsoredMediaItem[]>([]),[search,setSearch]=useState('');
 const [loading,setLoading]=useState(false),[uploading,setUploading]=useState(false),[deleting,setDeleting]=useState('');
 const publicUrl=(name:string)=>supabase.storage.from(SPONSORED_MEDIA_BUCKET).getPublicUrl(SPONSORED_MEDIA_PREFIX+'/'+name).data.publicUrl;
 const load=useCallback(async()=>{
  setLoading(true);
  const {data,error}=await supabase.storage.from(SPONSORED_MEDIA_BUCKET).list(SPONSORED_MEDIA_PREFIX,{limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}});
  if(error)toast({title:'Media library could not be loaded',description:error.message,variant:'destructive'});
  else setItems((data||[]).filter(item=>!!item.name&&!!item.metadata?.mimetype&&String(item.metadata.mimetype).startsWith('image/')) as SponsoredMediaItem[]);
  setLoading(false);
 },[]);
 useEffect(()=>{if(open)void load();},[open,load]);
 const filtered=items.filter(item=>item.name.toLowerCase().includes(search.toLowerCase().trim()));
 const upload=async(file?:File)=>{
  if(!file)return;setUploading(true);
  try{
   const compressed=await compressImageToWebP(file,SPONSORED_MEDIA_MAX_BYTES);
   if(compressed.size>SPONSORED_MEDIA_MAX_BYTES)throw new Error('The compressed image exceeds the 20 KB maximum.');
   const base=file.name.replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,36)||'campaign-image';
   const name=base+'-'+crypto.randomUUID()+'.webp';
   const {error}=await supabase.storage.from(SPONSORED_MEDIA_BUCKET).upload(SPONSORED_MEDIA_PREFIX+'/'+name,compressed,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
   if(error)throw error;
   onChange(publicUrl(name));await load();
   toast({title:'Image compressed and uploaded',description:(compressed.size/1024).toFixed(1)+' KB · WebP'});
  }catch(error){toast({title:'Image upload failed',description:error instanceof Error?error.message:'Please try another image.',variant:'destructive'});}
  finally{setUploading(false);}
 };
 const remove=async(item:SponsoredMediaItem)=>{
  const url=publicUrl(item.name);setDeleting(item.name);
  const {data:used,error:usageError}=await (supabase as any).from('sponsored_campaigns').select('id').eq('creative_image_url',url).limit(1);
  if(usageError){toast({title:'Could not check image usage',description:usageError.message,variant:'destructive'});setDeleting('');return;}
  if(used?.length){toast({title:'Image is in use',description:'Remove it from its campaign before deleting it.',variant:'destructive'});setDeleting('');return;}
  const {error}=await supabase.storage.from(SPONSORED_MEDIA_BUCKET).remove([SPONSORED_MEDIA_PREFIX+'/'+item.name]);
  if(error)toast({title:'Image could not be deleted',description:error.message,variant:'destructive'});
  else{toast({title:'Image deleted'});await load();}
  setDeleting('');
 };
 return <>
  <div className="space-y-2">
   <div className="flex flex-wrap items-center gap-2"><Input value={value} onChange={event=>onChange(event.target.value)} placeholder="Paste an external HTTPS image URL (optional)" className="min-w-0 flex-1"/><Button type="button" variant="outline" onClick={()=>setOpen(true)}><ImagePlus className="mr-2 h-4 w-4"/>Media picker</Button></div>
   {value&&<div className="flex items-center gap-3 rounded-md border p-2"><img src={value} alt="Selected campaign creative" className="h-16 w-24 rounded object-cover"/><div className="min-w-0 flex-1"><p className="text-xs font-medium">Selected campaign image</p><p className="truncate text-xs text-muted-foreground">{value}</p></div><Button type="button" size="sm" variant="ghost" onClick={()=>onChange('')}>Clear</Button></div>}
   <p className="text-xs text-muted-foreground">Upload JPG, PNG or WebP. Images are converted to WebP and must be 20 KB or smaller. Existing external image URLs remain supported.</p>
  </div>
  <Dialog open={open} onOpenChange={setOpen}>
   <DialogContent className="flex max-h-[90vh] w-[calc(100%-1rem)] max-w-3xl flex-col overflow-hidden">
    <DialogHeader><DialogTitle>Campaign media library</DialogTitle><DialogDescription>Choose an existing image or upload a new image compressed to a maximum of 20 KB.</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search campaign images" className="pl-9"/></div>
     <Button type="button" disabled={uploading} onClick={()=>document.getElementById('sponsored-media-upload')?.click()}>{uploading?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Upload className="mr-2 h-4 w-4"/>}{uploading?'Compressing…':'Upload image'}</Button>
     <input id="sponsored-media-upload" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event=>{const file=event.target.files?.[0];event.target.value='';void upload(file);}}/>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
     {loading?<div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading media…</div>
      :!filtered.length?<div className="py-12 text-center text-sm text-muted-foreground">No campaign images found. Upload the first one.</div>
      :<div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3 lg:grid-cols-4">{filtered.map(item=>{
       const url=publicUrl(item.name),size=Number(item.metadata?.size||0),selected=value===url;
       return <div key={item.name} className={'overflow-hidden rounded-lg border '+(selected?'border-primary ring-2 ring-primary/20':'')}>
        <button type="button" onClick={()=>{onChange(url);setOpen(false);}} className="block w-full text-left"><img src={url} alt={item.name} loading="lazy" className="aspect-[4/3] w-full bg-muted object-cover"/><div className="space-y-1 p-2"><p className="truncate text-xs font-medium">{item.name}</p><div className="flex items-center justify-between gap-1"><Badge variant="secondary">{(size/1024).toFixed(1)} KB</Badge>{selected&&<Check className="h-4 w-4 text-primary"/>}</div></div></button>
        <div className="border-t p-1"><Button type="button" size="sm" variant="ghost" className="h-7 w-full text-xs text-destructive" disabled={deleting===item.name} onClick={()=>void remove(item)}>{deleting===item.name?<Loader2 className="mr-1 h-3 w-3 animate-spin"/>:<Trash2 className="mr-1 h-3 w-3"/>}Delete</Button></div>
       </div>;
      })}</div>}
    </div>
    <div className="flex justify-end border-t pt-3"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Close</Button></div>
   </DialogContent>
  </Dialog>
 </>;
}
