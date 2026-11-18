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
import { AlertTriangle, CheckCircle2, ShieldCheck, Minus, Plus, CalendarDays, Clock3, MapPin, ClipboardCheck } from 'lucide-react';
import { formatKes } from '@/lib/marketplace';
import BookingEnginePhotoUpload from '@/components/booking/BookingEnginePhotoUpload';

type Row = { id: string; [key: string]: any };
type Props = { serviceId: string; serviceName: string; initialNotes?: string; quoteMode?: boolean; initialOfferId?: string };
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

export default function ConfiguredBookingForm({ serviceId, serviceName, initialNotes = '', quoteMode = false, initialOfferId = '' }: Props) {
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
      let loadedOffers: Row[] = [];
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
        else if(live){const activeIds=new Set(ids);const now=Date.now();const availableOffers=(o.data||[]).map((row:any)=>row.offer).filter((offer:any)=>offer&&offer.offer_type!=='recurring'&&(!offer.starts_at||new Date(offer.starts_at).getTime()<=now)&&(!offer.ends_at||new Date(offer.ends_at).getTime()>=now));setConfig(c.data);setQuestions(q.data||[]);setConditions((cond.data||[]).filter((row:Row)=>activeIds.has(row.depends_on_question_id)));setScope(s.data||[]);setOfferOptions(availableOffers);loadedOffers=availableOffers;if(initialOfferId&&availableOffers.some((offer:any)=>offer.id===initialOfferId&&offer.offer_type==='package'))setSelectedOfferId(initialOfferId);const offerIds=availableOffers.map((offer:any)=>offer.id);if(offerIds.length){const links=await db.from('booking_engine_value_offer_services').select('offer_id,relationship,quantity,service:services!inner(name,description)').in('offer_id',offerIds);if(links.error){if(live)setError(links.error.message);}else if(live)setOfferServices(links.data||[]);}else setOfferServices([]);}
      }

      const saved = window.sessionStorage.getItem(draftKey);
      if (live && saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setDraftId(parsed.id || '');
            const restoredOffer = loadedOffers.find((offer:any)=>offer.id===parsed.selectedOfferId);
            setSelectedOfferId(restoredOffer?.offer_type==='package'?restoredOffer.id:(initialOfferId||''));
            setAnswers(parsed.answers || {});
            const restoredExtras = Array.isArray(parsed.extras) ? parsed.extras : [];
            setExtras(restoredOffer&&restoredOffer.offer_type!=='package'
              ? Array.from(new Set([...restoredExtras,'offer:'+restoredOffer.id]))
              : restoredExtras);
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
                const savedOffer=await db.from('booking_engine_request_offers').select('offer_id,offer:booking_engine_value_offers!inner(offer_type)').eq('request_id',saved).maybeSingle();
                if(live){
                  const savedOfferId=savedOffer.data?.offer_id||'';
                  const savedOfferType=savedOffer.data?.offer?.offer_type;
                  if(savedOfferId&&savedOfferType&&savedOfferType!=='package'){
                    setSelectedOfferId(initialOfferId||'');
                    setExtras(old=>Array.from(new Set([...old,'offer:'+savedOfferId])));
                  }else setSelectedOfferId(savedOfferId||initialOfferId||'');
                }
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

  const packageOffers = useMemo(() => offerOptions.filter((offer:any)=>offer.offer_type==='package'), [offerOptions]);
  const addonOffers = useMemo(() => offerOptions.filter((offer:any)=>offer.offer_type==='add_on'||offer.offer_type==='upgrade'), [offerOptions]);
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
  const quantityMin = Number(quantityConfig?.min ?? 1);
  const quantityMax = quantityConfig?.max == null ? undefined : Number(quantityConfig.max);
  const quantityStep = Math.max(Number(quantityConfig?.step ?? 1), 0.000001);
  const quantityUnit = quantityConfig?.unit || 'units';
  const setAnswer = (key:string,value:any) => { setAnswers(x=>({...x,[key]:value})); setPrice(null); setAck(false); };
  const requiredVisibleQuestions = questions.filter(q=>visibility[q.id]?.visible && visibility[q.id]?.required);
  const answeredRequiredQuestions = requiredVisibleQuestions.filter(q=>{
    const value=answers[q.question_key];
    return value!==undefined && value!==null && value!=='' && (!Array.isArray(value)||value.length>0);
  }).length;
  const detailsComplete = requiredVisibleQuestions.length===answeredRequiredQuestions;
  const scheduleComplete = !!date && date>=today() && !!time;
  const locationComplete = !!location.trim();
  const completionCount = [detailsComplete,scheduleComplete,locationComplete].filter(Boolean).length;
  const changeQuantity = (direction:number) => {
    const current=Number(quantity);
    const safeCurrent=Number.isFinite(current)?current:quantityMin;
    const next=Math.max(quantityMin,Math.min(quantityMax??Number.MAX_SAFE_INTEGER,safeCurrent+(direction*quantityStep)));
    setQuantity(String(Number(next.toFixed(4))));
    setPrice(null);
    setAck(false);
  };
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

  if(loading) return <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"/><span>Preparing your booking options…</span></div>;
  if(error || !config) return <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"><AlertTriangle className="mb-2 h-5 w-5 text-amber-600"/><p className="font-medium">This guided booking is not available right now.</p><p className="mt-1">{error}</p><p className="mt-2 text-xs text-muted-foreground">Your existing bookings are not affected. Please contact our team for assistance.</p></div>;

  return <div className="space-y-4">
    <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5"><ShieldCheck className="h-5 w-5 text-primary"/></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Book {serviceName}</h2><Badge variant="outline">Guided booking</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">{config.customer_instructions||'Tell us what you need. We will calculate your estimate and review your request before confirming an appointment.'}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5"/>Your choices are saved as you go. Pricing is verified securely.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Booking completion">
        {[{label:'Service details',done:detailsComplete},{label:'Date & time',done:scheduleComplete},{label:'Location',done:locationComplete}].map((step,index)=><div key={step.label} className="space-y-1.5">
          <div className={'h-1.5 rounded-full '+(step.done?'bg-primary':'bg-muted')}/>
          <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">{index+1}. {step.label}</p>
        </div>)}
      </div>
      <p className="mt-2 text-right text-[11px] text-muted-foreground">{completionCount} of 3 booking sections complete</p>
    </div>
    <section className="space-y-3 rounded-xl border p-3 sm:p-4">
      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary"/><h3 className="text-sm font-semibold">When should we come?</h3></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Preferred date</Label><Input type="date" min={today()} value={date} onChange={e=>{setDate(e.target.value);setPrice(null);setAck(false);}}/></div>
        <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5"/>Preferred time</Label><Input type="time" value={time} onChange={e=>{setTime(e.target.value);setPrice(null);setAck(false);}}/></div>
      </div>
      <p className="text-xs text-muted-foreground">This is your preferred time. Our team will confirm availability after reviewing your request.</p>
    </section>
    <section className="space-y-3 rounded-xl border p-3 sm:p-4">
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary"/><h3 className="text-sm font-semibold">Where is the service needed?</h3></div>
      <div className="space-y-1.5"><Label>Service address, estate or landmark</Label><Input value={location} onChange={e=>{setLocation(e.target.value);setPrice(null);setAck(false);}} placeholder="e.g. Estate, building, road or nearby landmark" autoComplete="street-address"/></div>
      <p className="text-xs text-muted-foreground">A nearby landmark helps our team locate you accurately.</p>
    </section>
    {quantityEnabled&&<section className="space-y-3 rounded-xl border p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{quantityConfig.label||'How many units?'}</h3><p className="text-xs text-muted-foreground">Choose the quantity you need.</p></div><Badge variant="secondary">{quantityMin}{quantityMax!==undefined?'–'+quantityMax:''} {quantityUnit}</Badge></div>
      <div className="flex items-center gap-3">
        <Button type="button" size="icon" variant="outline" aria-label={'Decrease '+quantityUnit} disabled={Number(quantity)<=quantityMin} onClick={()=>changeQuantity(-1)}><Minus className="h-4 w-4"/></Button>
        <div className="min-w-0 flex-1 text-center"><Input className="mx-auto h-12 max-w-32 text-center text-xl font-semibold tabular-nums" type="number" min={quantityMin} max={quantityMax} step={quantityStep} value={quantity} aria-label={quantityConfig.label||'Quantity'} onChange={e=>{setQuantity(e.target.value);setPrice(null);setAck(false);}}/><p className="mt-1 text-xs text-muted-foreground">{quantityUnit}</p></div>
        <Button type="button" size="icon" variant="outline" aria-label={'Increase '+quantityUnit} disabled={quantityMax!==undefined&&Number(quantity)>=quantityMax} onClick={()=>changeQuantity(1)}><Plus className="h-4 w-4"/></Button>
      </div>
    </section>}
    {questions.length>0&&<section className="space-y-3 rounded-xl border p-3 sm:p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">Tell us a little more</h3><p className="mt-1 text-xs text-muted-foreground">These questions help us prepare the right service.</p></div><Badge variant="outline">{answeredRequiredQuestions}/{requiredVisibleQuestions.length} required</Badge></div>{questions.map(q=>{
      const st=visibility[q.id]; if(!st?.visible)return null;
      const value=answers[q.question_key]??(q.input_type==='multi_select'?[]:'');
      const opts=optionsFor(q.options);
      return <div key={q.id} className="space-y-2 rounded-lg bg-muted/20 p-3"><Label className="text-sm">{q.label}{st.required?' *':''}</Label>{q.description&&<p className="text-xs text-muted-foreground">{q.description}</p>}
        {q.input_type==='select'?(opts.length>0&&opts.length<=4?<div className="grid gap-2 sm:grid-cols-2">{opts.map((o:any)=>{const selected=String(value)===o.value;return <button key={o.value} type="button" aria-pressed={selected} onClick={()=>setAnswer(q.question_key,o.value)} className={'flex min-h-12 items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm transition '+(selected?'border-primary bg-primary/5 ring-1 ring-primary':'bg-background hover:border-primary/50')}><span className="font-medium">{o.label}</span><span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border '+(selected?'border-primary bg-primary text-primary-foreground':'text-transparent')}><CheckCircle2 className="h-3.5 w-3.5"/></span></button>;})}</div>:<select className="h-11 w-full rounded-lg border bg-background px-3 text-sm" value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value)}><option value="">Choose an option</option>{opts.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>)
        :q.input_type==='multi_select'?<div className="grid gap-2 sm:grid-cols-2">{opts.map((o:any)=><label key={o.value} className="flex items-center gap-2 text-sm"><Checkbox checked={Array.isArray(value)&&value.includes(o.value)} onCheckedChange={v=>setAnswer(q.question_key,v?[...value,o.value]:value.filter((x:string)=>x!==o.value))}/>{o.label}</label>)}</div>
        :q.input_type==='boolean'?<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value==='true')}><option value="">Choose yes or no</option><option value="true">Yes</option><option value="false">No</option></select>
        :q.input_type==='date'||q.input_type==='time'?<Input type={q.input_type} value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value)}/>
        :q.input_type==='number'||q.input_type==='measurement'?<Input type="number" min={q.validation_rules?.min??'0'} max={q.validation_rules?.max??undefined} step="any" value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value===''?'':Number(e.target.value))}/>
        :q.input_type==='textarea'||q.input_type==='address'?<Textarea rows={2} minLength={q.validation_rules?.min_length??undefined} maxLength={q.validation_rules?.max_length??undefined} value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value)}/>
        :<Input minLength={q.validation_rules?.min_length??undefined} maxLength={q.validation_rules?.max_length??undefined} pattern={q.validation_rules?.pattern||undefined} value={String(value)} onChange={e=>setAnswer(q.question_key,e.target.value)}/>}
      </div>;
    })}</section>}
    {packageOffers.length>0&&<div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Choose a package</h3><p className="text-xs text-muted-foreground">Select one package for this service. The booking engine checks its final price.</p><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedOfferId} onChange={e=>{setSelectedOfferId(e.target.value);setPrice(null);}}><option value="">No package</option>{packageOffers.map((offer:any)=><option key={offer.id} value={offer.id}>{offer.title}{offer.price_mode==='fixed'?' · '+formatKes(Number(offer.price_value)||0):' · quotation'}</option>)}</select>{packageOffers.filter((offer:any)=>offer.id===selectedOfferId).map((offer:any)=><div key={offer.id} className="rounded-lg border bg-muted/20 p-3"><p className="text-sm font-semibold">{offer.title}</p>{offer.description&&<p className="mt-1 text-xs text-muted-foreground">{offer.description}</p>}{offer.terms&&<p className="mt-1 text-xs text-muted-foreground">{offer.terms}</p>}{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='included').length>0&&<div className="mt-2"><p className="text-xs font-semibold">Included services</p><ul className="mt-1 list-disc pl-5 text-xs">{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='included').map((link:any,i:number)=><li key={i}>{link.service?.name||'Service'}{Number(link.quantity)>1?' × '+link.quantity:''}</li>)}</ul></div>}{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='recommended').length>0&&<div className="mt-2"><p className="text-xs font-semibold">Related services</p><ul className="mt-1 list-disc pl-5 text-xs">{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='recommended').map((link:any,i:number)=><li key={i}>{link.service?.name||'Service'}</li>)}</ul></div>}</div>)}</div>}
    {addonOffers.length>0&&<div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Optional extras and upgrades</h3><p className="text-xs text-muted-foreground">Choose any additions you want. Their configured prices or discounts are included in the server-calculated estimate.</p><div className="space-y-2">{addonOffers.map((offer:any)=>{const key='offer:'+offer.id;const selected=extras.includes(key);const priceLabel=offer.price_mode==='fixed'?'+'+formatKes(Number(offer.price_value)||0):offer.price_mode==='fixed_discount'?'-'+formatKes(Number(offer.price_value)||0):offer.price_mode==='percentage_discount'?Number(offer.price_value||0)+'% off':'included in quotation';return <label key={offer.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={selected} onCheckedChange={v=>{setExtras(old=>v?Array.from(new Set([...old,key])):old.filter(id=>id!==key));setPrice(null);}}/><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><b>{offer.title}</b><Badge variant="secondary">{priceLabel}</Badge></span>{offer.description&&<span className="mt-1 block text-xs text-muted-foreground">{offer.description}</span>}{offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='included').length>0&&<span className="mt-1 block text-xs text-muted-foreground">Includes: {offerServices.filter((link:any)=>link.offer_id===offer.id&&link.relationship==='included').map((link:any)=>link.service?.name||'Service').join(', ')}</span>}</span></label>;})}</div></div>}
    <div className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Service scope</h3>
      {groups.included.map(x=><p key={x.id} className="flex gap-2 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600"/><span><b>{x.title}</b>{x.description?' — '+x.description:''}</span></p>)}
      {groups.excluded.map(x=><p key={x.id} className="text-sm text-muted-foreground">Not included: {x.title}{x.description?' — '+x.description:''}</p>)}
      {groups.extra.length>0&&<div className="space-y-2"><p className="text-xs font-semibold">Other scope requests · our team will confirm these separately</p>{groups.extra.map(x=><label key={x.id} className="flex items-start gap-2 text-sm"><Checkbox checked={extras.includes(x.id)} onCheckedChange={v=>{setExtras(old=>v?[...old,x.id]:old.filter(id=>id!==x.id));setPrice(null);}}/><span><b>{x.title}</b>{x.description?' — '+x.description:''}</span></label>)}</div>}
    </div>
    {config.photo_mode !== 'none' && <div className="border-t pt-4"><h3 className="mb-2 text-sm font-semibold">Service photos {config.photo_mode === 'required' ? '*' : '(optional)'}</h3>{draftId && requestItemId ? <BookingEnginePhotoUpload requestId={draftId} itemId={requestItemId} minPhotos={config.photo_mode === 'required' ? Math.max(1, Number(config.photo_min) || 1) : 0} maxPhotos={Number(config.photo_max) > 0 ? Number(config.photo_max) : undefined} onCountChange={setPhotoCount} /> : <p className="text-xs text-muted-foreground">Review your details first to create a secure draft, then upload clear photos of the service area.</p>}</div>}
    <div className="space-y-1"><Label>Additional notes (optional)</Label><Textarea rows={2} value={notes} onChange={e=>{setNotes(e.target.value);setPrice(null);}}/></div>
    <div className="rounded-xl border border-dashed p-3 sm:p-4">
      <div className="flex items-start gap-3"><ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><div><p className="text-sm font-semibold">Ready to see your estimate?</p><p className="mt-1 text-xs text-muted-foreground">We’ll check your selected options against the approved service pricing. No price is guessed in the browser.</p></div></div>
      <Button className="mt-3 w-full" onClick={()=>void review()} disabled={saving}>{saving?'Calculating your estimate…':'Calculate my estimate'}</Button>
    </div>
    {price&&<Card className="overflow-hidden border-primary/40 shadow-sm"><CardHeader className="bg-primary/5 pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-sm">Your estimate</CardTitle><Badge variant="outline">{price.status==='quotation_required'?'Quotation required':'Calculated by server'}</Badge></div></CardHeader><CardContent className="space-y-4 p-4">
      {price.status==='priced'?<div><p className="text-xs text-muted-foreground">Estimated total</p><p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{formatKes(Number(price.total)||0)}</p></div>:<p className="text-sm">Our team will prepare a formal quotation. No price has been assumed.</p>}
      <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-medium">Your selections</p><div className="mt-2 flex flex-wrap gap-1.5">{quantityEnabled&&<Badge variant="secondary">{quantity} {quantityUnit}</Badge>}{selectedOfferId&&packageOffers.filter((offer:any)=>offer.id===selectedOfferId).map((offer:any)=><Badge key={offer.id} variant="secondary">Package: {offer.title}</Badge>)}{addonOffers.filter((offer:any)=>extras.includes('offer:'+offer.id)).map((offer:any)=><Badge key={offer.id} variant="secondary">Extra: {offer.title}</Badge>)}{questions.filter(q=>visibility[q.id]?.visible&&answers[q.question_key]!==undefined&&answers[q.question_key]!=='' ).map(q=><Badge key={q.id} variant="secondary">{q.label}: {Array.isArray(answers[q.question_key])?answers[q.question_key].join(', '):String(answers[q.question_key])}</Badge>)}</div></div>
      <p className="text-xs text-muted-foreground">This is an estimate, not a confirmed appointment. Our team will review your request and confirm availability.</p>
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={ack} onCheckedChange={v=>setAck(!!v)}/><span>I have reviewed and acknowledge the included and excluded service scope.</span></label>
      <Button className="w-full" onClick={()=>void submit()} disabled={saving||!ack}>{saving?'Submitting request…':'Submit booking request'}</Button>
    </CardContent></Card>}
  </div>;
}
