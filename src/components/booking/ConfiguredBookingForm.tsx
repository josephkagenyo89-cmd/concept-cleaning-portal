import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { formatKes } from '@/lib/marketplace';
import BookingEnginePhotoUpload from '@/components/booking/BookingEnginePhotoUpload';

type Row = { id: string; [key: string]: any };
type Props = { serviceId: string; serviceName: string; initialNotes?: string; quoteMode?: boolean };
const db = supabase as any;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const optionsFor = (value: any) => Array.isArray(value) ? value.map((x: any) => {
 if (typeof x === 'string') return { value: x, label: x };
 const optionValue = x?.value ?? x?.id ?? x?.label ?? '';
 const optionLabel = x?.label ?? x?.value ?? x?.id ?? '';
 return { value: String(optionValue), label: String(optionLabel) };
}).filter((x: any) => x.value !== '' && x.label !== '') : [];
const answerValidationError = (question: Row, value: any) => {
 const rules=question.validation_rules||{};
 if(value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length))return '';
 if(['number','measurement'].includes(question.input_type)){
  const n=Number(value);
  if(!Number.isFinite(n))return 'Enter a valid number.';
  if(rules.min!==undefined&&n<Number(rules.min))return 'Enter at least '+rules.min+'.';
  if(rules.max!==undefined&&n>Number(rules.max))return 'Enter no more than '+rules.max+'.';
  return '';
 }
 if(question.input_type==='boolean')return typeof value==='boolean'?'':'Choose yes or no.';
 const options=optionsFor(question.options);
 if(question.input_type==='select')return options.some((option:any)=>option.value===String(value))?'':'Choose one of the listed options.';
 if(question.input_type==='multi_select')return Array.isArray(value)&&value.every((entry:any)=>options.some((option:any)=>option.value===String(entry)))?'':'Choose only from the listed options.';
 const text=String(value);
 if(rules.min_length!==undefined&&text.length<Number(rules.min_length))return 'Enter at least '+rules.min_length+' characters.';
 if(rules.max_length!==undefined&&text.length>Number(rules.max_length))return 'Use no more than '+rules.max_length+' characters.';
 if(rules.pattern){try{if(!new RegExp(rules.pattern).test(text))return 'Use the requested format.';}catch{return 'This question has an invalid format rule. Please contact our team.';}}
 return '';
};
const matches = (rule: Row, value: any) => {
  const expected = rule.expected_value;
  if (rule.operator === 'equals') return String(value ?? '') === String(expected ?? '');
  if (rule.operator === 'not_equals') return String(value ?? '') !== String(expected ?? '');
  if (rule.operator === 'greater_than' || rule.operator === 'less_than') {
    if (value === undefined || value === null || String(value).trim() === '') return false;
    const actualNumber = Number(value), expectedNumber = Number(expected);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
    return rule.operator === 'greater_than' ? actualNumber > expectedNumber : actualNumber < expectedNumber;
  }
  if (rule.operator === 'contains') return Array.isArray(value) ? value.includes(expected) : String(value ?? '').includes(String(expected ?? ''));
  return false;
};

export default function ConfiguredBookingForm({ serviceId, serviceName, initialNotes = '', quoteMode = false }: Props) {
  const { user, customerClient } = useAuth();
  const navigate = useNavigate();
  const [config,setConfig] = useState<any>(null), [questions,setQuestions] = useState<Row[]>([]), [conditions,setConditions] = useState<Row[]>([]), [scope,setScope] = useState<Row[]>([]), [offerOptions,setOfferOptions] = useState<Row[]>([]), [offerServices,setOfferServices] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [answers,setAnswers] = useState<Record<string,any>>({}), [extras,setExtras] = useState<string[]>([]), [selectedOfferId,setSelectedOfferId] = useState('');
  const [quantity,setQuantity] = useState('1'), [date,setDate] = useState(''), [time,setTime] = useState(''), [location,setLocation] = useState('');
  const [notes,setNotes] = useState(initialNotes), [ack,setAck] = useState(false), [saving,setSaving] = useState(false);
  const [price,setPrice] = useState<any>(null), [draftId,setDraftId] = useState('');
  const [requestItemId,setRequestItemId] = useState(''), [photoCount,setPhotoCount] = useState(0);
  const [loadedDraftKey,setLoadedDraftKey] = useState('');
  const draftKey = 'ccs-booking-engine-draft:' + (user?.id || 'guest') + ':' + serviceId;

  useEffect(() => {
    let live = true;
    setLoadedDraftKey('');
    (async () => {
      setLoading(true);
      const c = await supabase.from('booking_engine_service_config').select('id,service_id,enabled,customer_instructions,photo_mode,photo_min,photo_max,measurement_config,availability_config,config_version').eq('service_id',serviceId).eq('enabled',true).maybeSingle();
      if (c.error) { if(live) setError(c.error.message); }
      else if (!c.data) { if(live) setError('Guided booking is not enabled for this service.'); }
      else {
        const [q,s,o] = await Promise.all([
          supabase.from('booking_engine_questions').select('*').eq('service_config_id',c.data.id).eq('active',true).order('display_order'),
          supabase.from('booking_engine_service_scope').select('*').eq('service_config_id',c.data.id).eq('active',true).order('display_order'),
          db.from('booking_engine_value_offer_services').select('offer_id,offer:booking_engine_value_offers!inner(id,offer_key,title,description,terms,offer_type,price_mode,price_value,currency,featured,starts_at,ends_at,updated_at)').eq('service_id',serviceId).eq('relationship','trigger').eq('offer.active',true)
        ]);
        const ids=(q.data||[]).map((x:Row)=>x.id);
        const cond=ids.length?await supabase.from('booking_engine_question_conditions').select('*').in('question_id',ids):{data:[],error:null};
        if(q.error||cond.error||s.error||o.error){if(live)setError(q.error?.message||cond.error?.message||s.error?.message||o.error?.message||'Could not load service setup.');}
        else if(live){const activeIds=new Set(ids);const availableOffers=(o.data||[]).map((row:any)=>row.offer).filter((offer:any)=>offer&&offer.offer_type!=='recurring');setConfig(c.data);setQuestions(q.data||[]);setConditions((cond.data||[]).filter((row:Row)=>activeIds.has(row.depends_on_question_id)));setScope(s.data||[]);setOfferOptions(availableOffers);const offerIds=availableOffers.map((offer:any)=>offer.id);if(offerIds.length){const links=await db.from('booking_engine_value_offer_services').select('offer_id,relationship,quantity,service:services!inner(name,description)').in('offer_id',offerIds);if(links.error){if(live)setError(links.error.message);}else if(live)setOfferServices(links.data||[]);}else setOfferServices([]);}
      }

      const saved = window.sessionStorage.getItem(draftKey);
      if (live && saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setDraftId(parsed.id || '');
            setSelectedOfferId(parsed.selectedOfferId || '');
            setAnswers(parsed.answers || {});
            setExtras(Array.isArray(parsed.extras) ? parsed.extras : []);
            setQuantity(String(parsed.quantity ?? '1'));
            setDate(parsed.date || '');
            setTime(parsed.time || '');
            setLocation(parsed.location || '');
            setNotes(parsed.notes ?? initialNotes);
          } else {
            setDraftId(saved);
            const request = await supabase.from('booking_engine_requests')
              .select('id,status,requested_date,requested_time,service_location,customer_notes')
              .eq('id', saved).maybeSingle();
            if (request.data?.status === 'draft') {
              setDate(request.data.requested_date || '');
              setTime(request.data.requested_time || '');
              setLocation(request.data.service_location || '');
              setNotes(request.data.customer_notes || initialNotes);
              const item = await supabase.from('booking_engine_request_items')
                .select('id,quantity,answers,selected_extras')
                .eq('request_id', saved).eq('service_id', serviceId).maybeSingle();
              if (item.data) {
                setRequestItemId(item.data.id);
                const savedOffer=await db.from('booking_engine_request_offers').select('offer_id').eq('request_id',saved).maybeSingle();
                if(live)setSelectedOfferId(savedOffer.data?.offer_id||'');
                setQuantity(String(item.data.quantity ?? '1'));
                setAnswers(item.data.answers || {});
                setExtras(Array.isArray(item.data.selected_extras) ? item.data.selected_extras : []);
              }
            } else {
              setDraftId('');
              window.sessionStorage.removeItem(draftKey);
            }
          }
        } catch {
          setDraftId(saved);
        }
      }
      if (live) {
        setPrice(null);
        setAck(false);
        setLoadedDraftKey(draftKey);
        setLoading(false);
      }
    })();
    return () => { live=false; };
  },[serviceId,draftKey]);

  useEffect(() => {
    if (loadedDraftKey !== draftKey) return;
    window.sessionStorage.setItem(draftKey, JSON.stringify({
      id: draftId, answers, extras, selectedOfferId, quantity, date, time, location, notes,
    }));
  }, [loadedDraftKey, draftKey, draftId, answers, extras, selectedOfferId, quantity, date, time, location, notes]);

  const visibility = useMemo(() => {
    const out: Record<string,{visible:boolean;required:boolean}> = {};
    for(const q of questions) {
      let visible=true, required=!!q.required;
      for(const c of conditions.filter((x:Row)=>x.question_id===q.id)) {
        const key=questions.find((x:Row)=>x.id===c.depends_on_question_id)?.question_key;
        const yes=matches(c,answers[key || '']);
        if(c.action==='show') visible=yes;
        if(c.action==='hide'&&yes) visible=false;
        if(c.action==='required') required=yes;
        if(c.action==='optional'&&yes) required=false;
      }
      out[q.id]={visible,required};
    }
    return out;
  },[questions,conditions,answers]);

  const groups = useMemo(() => ({
    included:scope.filter(x=>x.scope_type==='included'),
    excluded:scope.filter(x=>x.scope_type==='excluded'),
    extra:scope.filter(x=>x.scope_type==='extra')
  }),[scope]);
  const quantityConfig = config?.measurement_config?.quantity;
  const quantityEnabled = quantityConfig?.enabled === true;
  const setAnswer = (key:string,value:any) => { setAnswers(x=>({...x,[key]:value})); setPrice(null); };
  const validate = () => {
    if(!user || !customerClient) return 'Sign in with your customer account to use guided booking.';
    if(!date || date<today()) return 'Choose a valid preferred date.';
    if(!time) return 'Choose a preferred time.';
    if(!location.trim()) return 'Enter the service address, estate or nearby landmark.';
    if(quantityEnabled && (!Number.isFinite(Number(quantity)) || Number(quantity)<=0 || (quantityConfig.min!=null && Number(quantity)<Number(quantityConfig.min)) || (quantityConfig.max!=null && Number(quantity)>Number(quantityConfig.max)))) return 'Enter a valid quantity within the configured limits.';
    if(config?.photo_mode==='required' && draftId && requestItemId && photoCount < Math.max(1, Number(config.photo_min) || 1)) return 'Upload at least '+Math.max(1, Number(config.photo_min) || 1)+' service photo(s) before submitting.';
    if(config?.photo_max > 0 && photoCount > Number(config.photo_max)) return 'Remove photos until you meet the maximum of '+config.photo_max+'.';
    for(const q of questions) {
      const state=visibility[q.id], v=answers[q.question_key];
      if(state?.visible && state.required && (v===undefined || v===null || v==='' || (Array.isArray(v)&&!v.length))) return 'Please answer: ' + q.label;
      if(state?.visible){const validation=answerValidationError(q,v);if(validation)return q.label+': '+validation;}
    }
    return '';
  };

  const review = async () => {
    const problem=validate();
    if(problem) { toast({title:'Complete the required details',description:problem,variant:'destructive'}); return; }
    if(!groups.included.length) { toast({title:'Service scope is incomplete',description:'An administrator must configure included scope before accepting requests.',variant:'destructive'}); return; }
    setSaving(true);
    try {
      let id=draftId;
      if(id) {
        const existing=await supabase.from('booking_engine_requests').select('id,status').eq('id',id).maybeSingle();
        if(existing.error) throw existing.error;
        if (!existing.data) {
          id = '';
          setDraftId('');
          window.sessionStorage.removeItem(draftKey);
        } else if (existing.data.status !== 'draft') {
          const activeStatuses = ['submitted','under_review','awaiting_customer','approved','quote_required','quote_prepared','customer_accepted','ready_for_booking','converted'];
          if (activeStatuses.includes(existing.data.status)) {
            toast({ title: 'Request already submitted', description: 'You can track its progress under My Bookings.' });
            window.sessionStorage.removeItem(draftKey);
            setDraftId('');
            setLoadedDraftKey('');
            navigate('/my/bookings?tab=requests');
            return;
          }
          id = '';
          setDraftId('');
          window.sessionStorage.removeItem(draftKey);
        }
      }
      const requestNotes=[quoteMode?'Customer requested a formal quotation.':'',notes.trim()].filter(Boolean).join('\n')||null;
      if(!id) {
        const created=await supabase.rpc('create_booking_engine_request',{_requested_date:date,_requested_time:time,_service_location:location.trim(),_customer_notes:requestNotes} as any);
        if(created.error) throw created.error;
        id=String(created.data); setDraftId(id); window.sessionStorage.setItem(draftKey,id);
      }
      const found=await supabase.from('booking_engine_request_items').select('id').eq('request_id',id).eq('service_id',serviceId).maybeSingle();
      if(found.error) throw found.error;
      const measurements:Record<string,number>={};
      questions.filter(q=>q.input_type==='measurement').forEach(q=>{const n=Number(answers[q.question_key]);if(Number.isFinite(n)&&n>0)measurements[q.question_key]=n;});
      const args={_quantity:quantityEnabled?Number(quantity):1,_measurements:measurements,_answers:answers,_selected_extras:extras};
      let itemId=found.data?.id;
      if(itemId) {
        const updated=await supabase.rpc('update_booking_engine_request_item',{_item_id:itemId,...args} as any);
        if(updated.error) throw updated.error;
      } else {
        const added=await supabase.rpc('add_booking_engine_request_item',{_request_id:id,_service_id:serviceId,...args} as any);
        if(added.error) throw added.error;
        itemId=String(added.data);
      }
      setRequestItemId(itemId);
      const snapshot={configuration_version:config.config_version,included:groups.included.map(x=>({title:x.title,description:x.description})),excluded:groups.excluded.map(x=>({title:x.title,description:x.description})),selected_extras:groups.extra.filter(x=>extras.includes(x.id)).map(x=>({title:x.title,description:x.description}))};
      const saved=await supabase.from('booking_engine_request_items').update({scope_snapshot:snapshot,service_config_version:config.config_version}).eq('id',itemId);
      if(saved.error) throw saved.error;
      const offerResult=await supabase.rpc('set_booking_engine_request_offer',{_request_id:id,_request_item_id:itemId,_offer_id:selectedOfferId||null} as any);
      if(offerResult.error) throw offerResult.error;
      const updatedRequest=await supabase.rpc('update_booking_engine_request',{_request_id:id,_requested_date:date,_requested_time:time,_service_location:location.trim(),_customer_notes:requestNotes,_customer_acknowledged_scope:false} as any);
      if(updatedRequest.error) throw updatedRequest.error;
      const priced=await supabase.rpc('calculate_booking_engine_request_price',{_request_id:id} as any);
      if(priced.error) throw priced.error;
      setPrice(priced.data); setAck(false);
      toast({title:'Estimate calculated',description:priced.data?.status==='quotation_required'?'Our team will prepare a formal quotation.':'The estimate was calculated by the server.'});
    } catch(e:any) {
      toast({title:'Could not prepare request',description:e?.message||'Your draft may be saved. Retry to continue.',variant:'destructive'});
    } finally { setSaving(false); }
  };

  const submit = async () => {
    const problem=validate();
    if(problem) { toast({title:'Cannot submit yet',description:problem,variant:'destructive'}); return; }
    if(!draftId) { toast({title:'Review your request first',description:'Calculate the server-side estimate before submitting.',variant:'destructive'}); return; }

    setSaving(true);
    try {
      const current = await supabase.from('booking_engine_requests')
        .select('id,status').eq('id',draftId).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) throw new Error('Your saved draft could not be found. Please review your request again.');

      if (current.data.status !== 'draft') {
        const submittedStatuses = ['submitted','under_review','awaiting_customer','approved','quote_required','quote_prepared','customer_accepted','ready_for_booking','converted'];
        if (submittedStatuses.includes(current.data.status)) {
          window.sessionStorage.removeItem(draftKey);
          setDraftId('');
          setLoadedDraftKey('');
          toast({ title: 'Request already submitted', description: 'Your existing request is safe. You can track it under My Bookings.' });
          navigate('/my/bookings?tab=requests');
          return;
        }
        throw new Error('This request is no longer an editable draft. Start a new request if you still need the service.');
      }

      if(!price) throw new Error('Review your request and calculate the server-side estimate before submitting.');
      if(!ack) throw new Error('Please acknowledge the included and excluded service scope.');

      const requestNotes=[quoteMode?'Customer requested a formal quotation.':'',notes.trim()].filter(Boolean).join('\n')||null;
      const updated=await supabase.rpc('update_booking_engine_request',{_request_id:draftId,_requested_date:date,_requested_time:time,_service_location:location.trim(),_customer_notes:requestNotes,_customer_acknowledged_scope:true} as any);
      if(updated.error) throw updated.error;
      const result=await supabase.rpc('submit_booking_engine_request',{_request_id:draftId} as any);
      if(result.error) throw result.error;
      window.sessionStorage.removeItem(draftKey); setDraftId(''); setLoadedDraftKey('');
      toast({title:'Request submitted',description:'Our team will review it and confirm the next steps. This is not yet a confirmed appointment.'});
      navigate('/my/bookings?tab=requests');
    } catch(e:any) { toast({title:'Request not submitted',description:e?.message||'Please retry.',variant:'destructive'}); }
    finally { setSaving(false); }
  };

  if(loading) return <div className="py-4 text-sm text-muted-foreground">Loading guided service setup…</div>;
  if(error || !config) return <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><AlertTriangle className="mb-2 h-5 w-5 text-amber-600"/>{error}</div>;

  return <div className="space-y-4">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4"/>Guided booking · {serviceName}</div><p className="mt-1 text-xs text-muted-foreground">{config.customer_instructions||'Complete the details below. Our team will review your request before confirming the appointment.'}</p><p className="mt-1 text-[11px] text-muted-foreground">Configuration version {config.config_version}. Pricing is calculated securely by the server.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label>Preferred date</Label><Input type="date" min={today()} value={date} onChange={e=>{setDate(e.target.value);setPrice(null);}}/></div>
      <div className="space-y-1"><Label>Preferred time</Label><Input type="time" value={time} onChange={e=>{setTime(e.target.value);setPrice(null);}}/></div>
      <div className="space-y-1 sm:col-span-2"><Label>Service address / estate / landmark</Label><Input value={location} onChange={e=>{setLocation(e.target.value);setPrice(null);}} placeholder="Estate, building, road or nearby landmark"/></div>
      {quantityEnabled&&<div className="space-y-1"><Label>{quantityConfig.label||'Quantity / units'}</Label><Input type="number" min={quantityConfig.min??'0.01'} max={quantityConfig.max??undefined} step={quantityConfig.step??'0.01'} value={quantity} onChange={e=>{setQuantity(e.target.value);setPrice(null);}}/></div>}
    </div>
    {questions.length>0&&<div className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Service details</h3>{questions.map(q=>{
      const st=visibility[q.id]; if(!st?.visible)return null;
      const value=answers[q.question_key]??(q.input_type==='multi_select'?[]:'');
      const opts=optionsFor(q.options);
      return <div key={q.id} className="space-y-1.5"><Label>{q.label}{st.required?' *':''}</Label>{q.description&&<p className="text-xs text-muted-foreground">{q.description}</p>}
        {q.input_type==='select'?<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value)}><option value="">Select an option</option>{opts.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
        :q.input_type==='multi_select'?<div className="grid gap-2 sm:grid-cols-2">{opts.map((o:any)=><label key={o.value} className="flex items-center gap-2 text-sm"><Checkbox checked={Array.isArray(value)&&value.includes(o.value)} onCheckedChange={v=>setAnswer(q.question_key,v?[...value,o.value]:value.filter((x:string)=>x!==o.value))}/>{o.label}</label>)}</div>
        :q.input_type==='boolean'?<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value==='true')}><option value="">Choose yes or no</option><option value="true">Yes</option><option value="false">No</option></select>
        :q.input_type==='date'||q.input_type==='time'?<Input type={q.input_type} value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value)}/>
        :q.input_type==='number'||q.input_type==='measurement'?<Input type="number" min={q.validation_rules?.min??'0'} max={q.validation_rules?.max??undefined} step="any" value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value===''?'':Number(e.target.value))}/>
        :q.input_type==='textarea'||q.input_type==='address'?<Textarea rows={2} minLength={q.validation_rules?.min_length??undefined} maxLength={q.validation_rules?.max_length??undefined} value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value)}/>
        :<Input minLength={q.validation_rules?.min_length??undefined} maxLength={q.validation_rules?.max_length??undefined} pattern={q.validation_rules?.pattern||undefined} value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value)}/>}
      </div>;
    })}</div>}
    {offerOptions.length>0&&<div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Packages & value offers</h3><p className="text-xs text-muted-foreground">Choose an available package or offer for this service. The final price is validated by our server.</p><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedOfferId} onChange={e=>{setSelectedOfferId(e.target.value);setPrice(null);}}><option value="">No package or offer</option>{offerOptions.map((offer:any)=><option key={offer.id} value={offer.id}>{offer.title}{offer.price_mode==='fixed'?' · '+formatKes(Number(offer.price_value)||0):offer.price_mode==='percentage_discount'?' · '+Number(offer.price_value||0)+'% off':offer.price_mode==='fixed_discount'?' · '+formatKes(Number(offer.price_value)||0)+' off':' · quotation'}</option>)}</select>{offerOptions.filter((offer:any)=>offer.id===selectedOfferId).map((offer:any)=><div key={offer.id} className="rounded-lg border bg-muted/20 p-3"><p className="text-sm font-semibold">{offer.title}</p>{offer.description&&<p className="mt-1 text-xs text-muted-foreground">{offer.description}</p>}{offer.terms&&<p className="mt-1 text-xs text-muted-foreground">{offer.terms}</p>}{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='included').length>0&&<div className="mt-2"><p className="text-xs font-semibold">Included services</p><ul className="mt-1 list-disc pl-5 text-xs">{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='included').map((link:any,i:number)=><li key={i}>{link.service?.name||'Service'}{Number(link.quantity)>1?' × '+link.quantity:''}</li>)}</ul></div>}{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='recommended').length>0&&<div className="mt-2"><p className="text-xs font-semibold">Recommended additions</p><ul className="mt-1 list-disc pl-5 text-xs">{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='recommended').map((link:any,i:number)=><li key={i}>{link.service?.name||'Service'}</li>)}</ul></div>}</div>)}</div>}
    <div className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Service scope</h3>
      {groups.included.map(x=><p key={x.id} className="flex gap-2 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600"/><span><b>{x.title}</b>{x.description?' — '+x.description:''}</span></p>)}
      {groups.excluded.map(x=><p key={x.id} className="text-sm text-muted-foreground">Not included: {x.title}{x.description?' — '+x.description:''}</p>)}
      {groups.extra.length>0&&<div className="space-y-2"><p className="text-xs font-semibold">Optional extras · interest only, not included in estimate</p>{groups.extra.map(x=><label key={x.id} className="flex items-start gap-2 text-sm"><Checkbox checked={extras.includes(x.id)} onCheckedChange={v=>{setExtras(old=>v?[...old,x.id]:old.filter(id=>id!==x.id));setPrice(null);}}/><span><b>{x.title}</b>{x.description?' — '+x.description:''}</span></label>)}</div>}
    </div>
    {config.photo_mode !== 'none' && <div className="border-t pt-4"><h3 className="mb-2 text-sm font-semibold">Service photos {config.photo_mode === 'required' ? '*' : '(optional)'}</h3>{draftId && requestItemId ? <BookingEnginePhotoUpload requestId={draftId} itemId={requestItemId} minPhotos={config.photo_mode === 'required' ? Math.max(1, Number(config.photo_min) || 1) : 0} maxPhotos={Number(config.photo_max) > 0 ? Number(config.photo_max) : undefined} onCountChange={setPhotoCount} /> : <p className="text-xs text-muted-foreground">Review your details first to create a secure draft, then upload clear photos of the service area.</p>}</div>}
    <div className="space-y-1"><Label>Additional notes (optional)</Label><Textarea rows={2} value={notes} onChange={e=>{setNotes(e.target.value);setPrice(null);}}/></div>
    <Button className="w-full" variant="outline" onClick={()=>void review()} disabled={saving}>{saving?'Calculating…':'Review details & calculate estimate'}</Button>
    {price&&<Card className="border-primary/30"><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm"><span>Server-calculated estimate</span><Badge variant="outline">{price.status==='quotation_required'?'Quotation required':'Calculated'}</Badge></CardTitle></CardHeader><CardContent className="space-y-3">
      {price.status==='priced'?<div className="text-2xl font-bold">{formatKes(Number(price.total)||0)}</div>:<p className="text-sm">Our team will prepare a formal quotation. No price has been assumed.</p>}
      <p className="text-xs text-muted-foreground">This is an estimate only. Your appointment is not confirmed until our team reviews it.</p>
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={ack} onCheckedChange={v=>setAck(!!v)}/><span>I have reviewed and acknowledge the included and excluded service scope.</span></label>
      <Button className="w-full" onClick={()=>void submit()} disabled={saving||!ack}>{saving?'Submitting…':'Submit request'}</Button>
    </CardContent></Card>}
  </div>;
}
