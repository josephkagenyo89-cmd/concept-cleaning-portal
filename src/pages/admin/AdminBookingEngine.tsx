import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getBookingOfferReadinessIssues, summarizeBookingOfferPerformance } from '@/lib/bookingEngineOffers';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, CirclePlus, ClipboardCheck, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import AdminBookingEngineRequests from '@/pages/admin/AdminBookingEngineRequests';
import AdminPackageContents from '@/pages/admin/AdminPackageContents';

const db = supabase as any;
type Row = { id: string; [key: string]: any };
type Service = { id: string; name: string; service_code: string | null; is_active: boolean; base_price?: number | null; pricing_model?: string | null; pricing_unit?: string | null; service_category?: { name: string } | null };
type Config = { id: string; service_id: string; enabled: boolean; customer_instructions: string | null; photo_mode: string; photo_min: number; photo_max: number; measurement_config: any; availability_config: any; config_version: number };
const parseObj = (s: string) => { const x = JSON.parse(s); if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Expected a JSON object.'); return x; };

export default function AdminBookingEngine() {
 const [services,setServices]=useState<Service[]>([]),[configs,setConfigs]=useState<Config[]>([]);
 const [serviceId,setServiceId]=useState(''),[config,setConfig]=useState<Config|null>(null);
 const [adminSection,setAdminSection]=useState<'packages'|'services'>('packages');
 const [viewMode,setViewMode]=useState<'guide'|'advanced'>('guide'),[activeTab,setActiveTab]=useState('setup');
 const [setupProgress,setSetupProgress]=useState<any>(null),[setupProgressLoading,setSetupProgressLoading]=useState(false),[approvingStep,setApprovingStep]=useState<string|null>(null);
 const [questions,setQuestions]=useState<Row[]>([]),[conditions,setConditions]=useState<Row[]>([]),[scope,setScope]=useState<Row[]>([]),[pricing,setPricing]=useState<Row[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [instructions,setInstructions]=useState(''),[photoMode,setPhotoMode]=useState('none'),[photoMin,setPhotoMin]=useState('0'),[photoMax,setPhotoMax]=useState('0'),[measurements,setMeasurements]=useState('{}'),[availability,setAvailability]=useState('{}');
 const [qLabel,setQLabel]=useState(''),[qKey,setQKey]=useState(''),[qDesc,setQDesc]=useState(''),[qType,setQType]=useState('text'),[qRequired,setQRequired]=useState(false),[qOptions,setQOptions]=useState('[]');
 const [scopeType,setScopeType]=useState('included'),[scopeTitle,setScopeTitle]=useState(''),[scopeDesc,setScopeDesc]=useState('');
 const [priceType,setPriceType]=useState('quotation'),[priceRate,setPriceRate]=useState(''),[priceUnit,setPriceUnit]=useState(''),[priceMin,setPriceMin]=useState(''),[priceMax,setPriceMax]=useState(''),[priceConditions,setPriceConditions]=useState('{}'),[editingPricingId,setEditingPricingId]=useState<string|null>(null);
 const [target,setTarget]=useState(''),[source,setSource]=useState(''),[operator,setOperator]=useState('equals'),[expected,setExpected]=useState(''),[action,setAction]=useState('show');
 const selected=useMemo(()=>services.find(x=>x.id===serviceId)??null,[services,serviceId]);

 const refresh=useCallback(async()=>{
  setLoading(true);
  const [s,c]=await Promise.all([
   db.from('services').select('id,name,service_code,is_active,base_price,pricing_model,pricing_unit,category_id,service_category:service_categories!services_category_id_fkey(name)').order('name'),
   db.from('booking_engine_service_config').select('*')
  ]);
  if(s.error||c.error) toast({title:'Could not load Booking Engine',description:s.error?.message||c.error?.message,variant:'destructive'});
  else {setServices(s.data??[]);setConfigs(c.data??[]);setServiceId((old:string)=>old&&(s.data??[]).some((x:Service)=>x.id===old)?old:(s.data?.[0]?.id??''));}
  setLoading(false);
 },[]);
 const load=useCallback(async()=>{
  const cfg=configs.find(x=>x.service_id===serviceId)??null;setConfig(cfg);setQuestions([]);setConditions([]);setScope([]);setPricing([]);
  if(!cfg)return;
  setInstructions(cfg.customer_instructions??'');setPhotoMode(cfg.photo_mode);setPhotoMin(String(cfg.photo_min));setPhotoMax(String(cfg.photo_max));
  setMeasurements(JSON.stringify(cfg.measurement_config??{},null,2));setAvailability(JSON.stringify(cfg.availability_config??{},null,2));
  const [q,s,p]=await Promise.all([
   db.from('booking_engine_questions').select('*').eq('service_config_id',cfg.id).order('display_order'),
   db.from('booking_engine_service_scope').select('*').eq('service_config_id',cfg.id).order('display_order'),
   db.from('booking_engine_pricing_rules').select('*').eq('service_config_id',cfg.id).order('created_at',{ascending:false})
  ]);
  if(q.error||s.error||p.error){toast({title:'Could not load configuration details',description:q.error?.message||s.error?.message||p.error?.message,variant:'destructive'});return;}
  setQuestions(q.data??[]);setScope(s.data??[]);setPricing(p.data??[]);
  if((q.data??[]).length){const c=await db.from('booking_engine_question_conditions').select('*').in('question_id',q.data.map((x:Row)=>x.id));if(c.error)toast({title:'Could not load conditions',description:c.error.message,variant:'destructive'});else setConditions(c.data??[]);}
 },[configs,serviceId]);
 const loadSetupProgress=useCallback(async()=>{
  if(!config?.id){setSetupProgress(null);return;}
  setSetupProgressLoading(true);
  const r=await db.rpc('get_booking_engine_setup_progress',{_service_config_id:config.id});
  if(r.error){setSetupProgress(null);toast({title:'Could not load setup approvals',description:r.error.message,variant:'destructive'});}
  else setSetupProgress(r.data);
  setSetupProgressLoading(false);
 },[config?.id]);
 useEffect(()=>{void refresh();},[refresh]);useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(viewMode==='guide'&&config?.id)void loadSetupProgress();else if(!config?.id)setSetupProgress(null);},[viewMode,config?.id,loadSetupProgress]);

 const create=async()=>{setSaving(true);const r=await db.from('booking_engine_service_config').insert({service_id:serviceId,enabled:false}).select('*').single();if(r.error)toast({title:'Create failed',description:r.error.message,variant:'destructive'});else{setConfigs(x=>[...x,r.data]);setConfig(r.data);toast({title:'Disabled configuration created'});}setSaving(false);};
  const activationIssue=(measurementConfig:any)=>{
   const activeRules=pricing.filter(x=>x.active);
   if(activeRules.some(x=>['per_unit','tiered'].includes(x.pricing_type))&&measurementConfig?.quantity?.enabled!==true)return 'Per-unit and tiered pricing require measurement_config.quantity.enabled=true and a customer-facing quantity label.';
   for(const rule of activeRules.filter(x=>x.pricing_type==='per_measurement')){
    if(!questions.some(q=>q.input_type==='measurement'&&q.question_key===rule.unit_key))return 'Add a measurement question whose key exactly matches pricing unit key: '+rule.unit_key;
   }
   return '';
  };
 const save=async()=>{
  if(!config)return;let m:any,a:any;try{m=parseObj(measurements);a=parseObj(availability);}catch(e){toast({title:'Invalid JSON',description:e instanceof Error?e.message:'Check JSON values.',variant:'destructive'});return;}
  const min=Number(photoMin),max=Number(photoMax);if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min||(photoMode==='none'&&(min!==0||max!==0))||(photoMode!=='none'&&max<1)){toast({title:'Invalid photo limits'});return;}

  if(config.enabled){const issue=activationIssue(m);if(issue){toast({title:'Configuration cannot be saved while enabled',description:issue,variant:'destructive'});return;}}
  setSaving(true);const r=await db.from('booking_engine_service_config').update({customer_instructions:instructions.trim()||null,photo_mode:photoMode,photo_min:min,photo_max:max,measurement_config:m,availability_config:a,config_version:config.config_version+1,updated_by:(await supabase.auth.getUser()).data.user?.id??null,updated_at:new Date().toISOString()}).eq('id',config.id).select('*').single();
  if(r.error)toast({title:'Setup not saved',description:r.error.message,variant:'destructive'});else{setConfig(r.data);setConfigs(x=>x.map(y=>y.id===r.data.id?r.data:y));toast({title:'Setup saved'});}setSaving(false);
 };
 const bumpVersion=async()=>{
  if(!config)return;
  const r=await db.from('booking_engine_service_config').update({config_version:config.config_version+1,updated_by:(await supabase.auth.getUser()).data.user?.id??null,updated_at:new Date().toISOString()}).eq('id',config.id).select('*').single();
  if(r.error)toast({title:'Configuration saved, but version refresh failed',description:r.error.message,variant:'destructive'});
  else{setConfig(r.data);setConfigs(x=>x.map(y=>y.id===r.data.id?r.data:y));}
 };
 const activate=async(enabled:boolean)=>{
  if(!config)return;
  if(enabled&&!setupProgress?.complete){toast({title:'Setup approvals are incomplete',description:'Complete and approve every setup step in order before enabling this service.',variant:'destructive'});return;}
  if(enabled&&(!pricing.some(x=>x.active)||!scope.some(x=>x.active&&x.scope_type==='included'))){toast({title:'Configuration incomplete',description:'Add an active pricing rule and one active included-scope item first.',variant:'destructive'});return;}
  if(enabled){let measurementConfig:any;try{measurementConfig=parseObj(measurements);}catch(e){toast({title:'Invalid measurement configuration',description:e instanceof Error?e.message:'Check JSON values.',variant:'destructive'});return;}const issue=activationIssue(measurementConfig);if(issue){toast({title:'Configuration is not ready to enable',description:issue,variant:'destructive'});return;}}
  if(!window.confirm(enabled?'Enable this service for Smart Booking? Confirm its questions, scope, pricing and instructions have been reviewed.':'Disable this service for new Smart Booking requests? Existing requests remain unchanged.'))return;
  const r=await db.from('booking_engine_service_config').update({enabled,config_version:config.config_version+1,updated_by:(await supabase.auth.getUser()).data.user?.id??null,updated_at:new Date().toISOString()}).eq('id',config.id).select('*').single();
  if(r.error)toast({title:'Activation update failed',description:r.error.message,variant:'destructive'});else{setConfig(r.data);setConfigs(x=>x.map(y=>y.id===r.data.id?r.data:y));toast({title:enabled?'Service enabled':'Service disabled'});}
 };
 const addQuestion=async()=>{
  if(!config||!qLabel.trim()||!qKey.trim())return;
  let opts:any;try{opts=JSON.parse(qOptions);if(!Array.isArray(opts))throw new Error('Options must be a JSON array.');}catch(e){toast({title:'Invalid options',description:e instanceof Error?e.message:'Check options.',variant:'destructive'});return;}
  if(['select','multi_select'].includes(qType)&&!opts.length){toast({title:'Add options for this question'});return;}
  const r=await db.from('booking_engine_questions').insert({service_config_id:config.id,question_key:qKey.trim().toLowerCase().replace(/\\s+/g,'_'),label:qLabel.trim(),description:qDesc.trim()||null,input_type:qType,required:qRequired,display_order:questions.length,options:opts,validation_rules:{},active:true}).select('*').single();
  if(r.error)toast({title:'Question not added',description:r.error.message,variant:'destructive'});else{await bumpVersion();setQuestions(x=>[...x,r.data]);setQLabel('');setQKey('');setQDesc('');setQOptions('[]');setQRequired(false);}
 };
 const remove=async(table:string,id:string,update:(fn:any)=>void)=>{if(!window.confirm('Delete this configuration item?'))return;const r=await db.from(table).delete().eq('id',id);if(r.error)toast({title:'Delete failed',description:r.error.message,variant:'destructive'});else{update((x:Row[])=>x.filter(y=>y.id!==id));if(table==='booking_engine_questions')setConditions(x=>x.filter(y=>y.question_id!==id&&y.depends_on_question_id!==id));await bumpVersion();}};
 const addScope=async()=>{if(!config||!scopeTitle.trim())return;const r=await db.from('booking_engine_service_scope').insert({service_config_id:config.id,scope_type:scopeType,title:scopeTitle.trim(),description:scopeDesc.trim()||null,display_order:scope.filter(x=>x.scope_type===scopeType).length}).select('*').single();if(r.error)toast({title:'Scope item not added',description:r.error.message,variant:'destructive'});else{await bumpVersion();setScope(x=>[...x,r.data]);setScopeTitle('');setScopeDesc('');}};
 const addPricing=async()=>{
  if(!config)return;
  if(config.enabled&&['per_unit','tiered'].includes(priceType)){let m:any;try{m=parseObj(measurements);}catch{toast({title:'Measurement configuration must be valid JSON'});return;}if(m.quantity?.enabled!==true){toast({title:'Quantity input is not configured',description:'Set measurement_config.quantity.enabled to true before adding per-unit or tiered pricing to an enabled service.',variant:'destructive'});return;}}
  if(config.enabled&&priceType==='per_measurement'&&!questions.some(q=>q.input_type==='measurement'&&q.question_key===priceUnit.trim())){toast({title:'Measurement question is missing',description:'Add a measurement question whose key matches the pricing unit key before adding this rule.',variant:'destructive'});return;}
  let conditions:any;try{conditions=parseObj(priceConditions);}catch(e){toast({title:'Invalid pricing conditions',description:e instanceof Error?e.message:'Use a JSON object.',variant:'destructive'});return;}
  const rate=priceType==='quotation'?null:Number(priceRate),min=priceMin.trim()?Number(priceMin):null,max=priceMax.trim()?Number(priceMax):null;
  if(priceType!=='quotation'&&(!priceRate.trim()||!Number.isFinite(rate)||rate!<0)){toast({title:'Enter an approved rate or choose quotation pricing'});return;}
  if((min!==null&&(!Number.isFinite(min)||min<0))||(max!==null&&(!Number.isFinite(max)||max<0))||(min!==null&&max!==null&&min>max)){toast({title:'Check quantity limits'});return;}
  const oldRule=editingPricingId?pricing.find(x=>x.id===editingPricingId):null;const r=await db.from('booking_engine_pricing_rules').insert({service_config_id:config.id,pricing_type:priceType,rate,unit_key:priceUnit.trim()||null,minimum_quantity:min,maximum_quantity:max,conditions,currency:'KES',version:Math.max(0,...pricing.map(x=>Number(x.version)||0))+1,active:true,created_by:(await supabase.auth.getUser()).data.user?.id??null}).select('*').single();
  if(r.error)toast({title:editingPricingId?'New price version not saved':'Pricing not added',description:r.error.message,variant:'destructive'});else{if(oldRule?.active){const retired=await db.from('booking_engine_pricing_rules').update({active:false,updated_by:(await supabase.auth.getUser()).data.user?.id??null,updated_at:new Date().toISOString()}).eq('id',oldRule.id);if(retired.error){await db.from('booking_engine_pricing_rules').update({active:false}).eq('id',r.data.id);toast({title:'Price was not changed',description:'The new version could not replace the current price. Refresh and try again.',variant:'destructive'});return;}}await bumpVersion();setPricing(x=>[r.data,...x.map(y=>y.id===oldRule?.id?{...y,active:false}:y)]);cancelPricingEdit();}
 };
 const editPricing=(rule:Row)=>{setEditingPricingId(rule.id);setPriceType(rule.pricing_type);setPriceRate(rule.rate===null?'':String(rule.rate));setPriceUnit(rule.unit_key||'');setPriceMin(rule.minimum_quantity===null?'':String(rule.minimum_quantity));setPriceMax(rule.maximum_quantity===null?'':String(rule.maximum_quantity));setPriceConditions(JSON.stringify(rule.conditions||{},null,2));setAdminSection('services');setViewMode('advanced');setActiveTab('pricing');};
 const cancelPricingEdit=()=>{setEditingPricingId(null);setPriceType('quotation');setPriceRate('');setPriceUnit('');setPriceMin('');setPriceMax('');setPriceConditions('{}');};
 const addCondition=async()=>{if(!target||!source||target===source||!expected.trim())return;let value:any;try{value=JSON.parse(expected);}catch{value=expected;}const r=await db.from('booking_engine_question_conditions').insert({question_id:target,depends_on_question_id:source,operator,expected_value:value,action}).select('*').single();if(r.error)toast({title:'Condition not added',description:r.error.message,variant:'destructive'});else{await bumpVersion();setConditions(x=>[...x,r.data]);setExpected('');}};
 const activePricing=pricing.filter(x=>x.active).length,activeIncluded=scope.filter(x=>x.active&&x.scope_type==='included').length;
 const activeQuestions=questions.filter(x=>x.active!==false).length;
 const measurementConfig=(()=>{try{return parseObj(measurements);}catch{return {};}})();
 const readinessIssues:string[]=[];
 if(!config)readinessIssues.push('Create a Smart Booking configuration for this service.');
 if(!activePricing)readinessIssues.push('Add at least one active pricing rule.');
 if(!activeIncluded)readinessIssues.push('Add at least one active included-scope item.');
 const guardIssue=config?activationIssue(measurementConfig):'';
 if(guardIssue)readinessIssues.push(guardIssue);
 const isReady=Boolean(config)&&readinessIssues.length===0;
 const setupStepDefinitions=[
  {key:'instructions',title:'Tell us about this service',short:'Service details',description:'Add a simple note for customers. Choose whether they may send photos. You can leave the other settings as they are if you are not sure.',doThis:'Open the Setup page. Add customer instructions if needed, check the photo setting, then press “Save setup”.',doneLooksLike:'You saved the service instructions and photo settings.',tab:'setup',button:'Open Step 1'},
  {key:'questions',title:'Choose the customer questions',short:'Questions',description:'Choose what customers should tell you before they book. Add at least one question.',doThis:'Open Customer questions. Add a question, or use a ready-made question from the Question library. Then come back here.',doneLooksLike:'At least one active customer question is listed.',tab:'questions',button:'Open Step 2'},
  {key:'pricing',title:'Tell us how to calculate the price',short:'Price',description:'Choose how this service is priced. Use a fixed price, a quantity or measurement price, or staff quotation.',doThis:'Open Pricing. Choose the right pricing method, enter an approved rate if needed, and add the pricing rule.',doneLooksLike:'At least one active pricing rule is listed.',tab:'pricing',button:'Open Step 3'},
  {key:'scope',title:'Write what the customer gets',short:'Included work',description:'Tell the customer what the service includes. You must add at least one included item.',doThis:'Open Service scope. Choose “Included”, write one thing the team will do, and press “Add scope item”.',doneLooksLike:'At least one active item appears under Included.',tab:'scope',button:'Open Step 4'},
  {key:'offers',title:'Add an extra offer (optional)',short:'Packages and extras',description:'You can add a package, an extra service or an upgrade. Do not add one if you do not have an approved offer.',doThis:'Open Packages & offers. Add and save an approved offer, or choose “Skip this step” if you have none.',doneLooksLike:'Your offers are saved, or you have recorded that there are no offers.',tab:'library',button:'Open Step 5'},
  {key:'final_review',title:'Check everything and finish',short:'Final check',description:'Look at the service one last time. If everything is correct, approve this step. You will still need to enable the service separately.',doThis:'Check the five steps above. If they are correct, press “Approve and finish”.',doneLooksLike:'All six steps show Approved. You can then enable Smart Booking for this service.',tab:null,button:'Approve and finish'},
 ];
 const stepStates=(setupProgress?.steps||[]) as Array<{key:string;title:string;approved:boolean;current:boolean;skipped:boolean;approved_at:string|null}>;
 const allStepsApproved=Boolean(setupProgress?.complete);
 const currentStepKey=setupProgress?.next_step??null;
 const approveStep=async(stepKey:string,skipOptional=false)=>{
  if(!config||approvingStep)return;
  setApprovingStep(stepKey);
  const r=await db.rpc('approve_booking_engine_setup_step',{_service_config_id:config.id,_step_key:stepKey,_skip_optional:skipOptional});
  if(r.error)toast({title:'Step not approved',description:r.error.message,variant:'destructive'});
  else{setSetupProgress(r.data);toast({title:skipOptional?'Optional step skipped and recorded':'Step approved',description:'The next setup step is now available.'});}
  setApprovingStep(null);
 };
 const openStep=(tab:string)=>{setActiveTab(tab);setViewMode('advanced');};
 return <div className="space-y-6">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Smart Booking Engine</h1><p className="text-sm text-muted-foreground">Review packages or manage individual service settings.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button><Button variant={adminSection==='packages'?'default':'outline'} onClick={()=>setAdminSection('packages')}>Packages & offers</Button><Button variant={adminSection==='services'?'default':'outline'} onClick={()=>setAdminSection('services')}>Service settings</Button><Button variant="default" onClick={()=>{setAdminSection('services');setViewMode('advanced');setActiveTab('pricing');}}>Manage prices</Button>{adminSection==='services'&&config&&<Button variant={viewMode==='guide'?'default':'outline'} onClick={()=>setViewMode(viewMode==='guide'?'advanced':'guide')}>{viewMode==='guide'?'Advanced Setup':'Back to Setup Guide'}</Button>}</div></div>
  <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="flex gap-3 p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-600"/><div><b>Nothing is enabled automatically.</b><p className="text-muted-foreground">The guide checks the selected service's real configuration. It will not invent prices, questions, service mappings or offers, and existing ERP service prices remain untouched.</p></div></CardContent></Card>
  {adminSection==='packages'?<BookingEngineLibrary services={services} configs={configs} />:<div className="grid gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
   <Card className="h-fit"><CardHeader><CardTitle className="text-base">1. Choose a service</CardTitle><p className="text-xs text-muted-foreground">Select the service you want to configure.</p></CardHeader><CardContent className="space-y-2">{loading?'Loading services…':services.map(s=>{const c=configs.find(x=>x.service_id===s.id);return <button key={s.id} onClick={()=>{setServiceId(s.id);setViewMode('guide');}} className={'w-full rounded-lg border p-3 text-left '+(serviceId===s.id?'border-primary bg-primary/5':'hover:bg-muted/50')}><span className="block text-sm font-medium">{s.name}</span><span className="mt-1 flex gap-1 text-xs text-muted-foreground">{s.service_code||'No code'} <Badge variant={c?.enabled?'default':'secondary'}>{c?.enabled?'Enabled':c?'Disabled':'Not configured'}</Badge></span></button>;})}</CardContent></Card>
   <div className="min-w-0 space-y-4">
    {!selected?<Card><CardContent className="p-8 text-center text-muted-foreground">Select a service to begin.</CardContent></Card>:!config?<Card><CardHeader><CardTitle>Start setup: {selected.name}</CardTitle><p className="text-sm text-muted-foreground">First create a disabled Smart Booking configuration. This does not publish the service or change its ERP price.</p></CardHeader><CardContent className="space-y-4"><div className="flex items-start gap-3 rounded-lg border p-4"><ClipboardCheck className="mt-0.5 h-5 w-5 text-primary"/><div className="space-y-1"><b className="text-sm">What happens next?</b><p className="text-sm text-muted-foreground">You will add customer questions, choose a pricing method, define included work and optionally create value offers. The guide will show which parts are complete.</p></div></div><Button onClick={()=>void create()} disabled={saving}>{saving?'Creating…':'Create configuration and continue'}<ArrowRight className="ml-2 h-4 w-4"/></Button></CardContent></Card>:viewMode==='guide'?<>
    <Card><CardHeader className="space-y-3"><div className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4"/>EASY SETUP — ONE STEP AT A TIME</div><CardTitle className="text-xl">Let’s set up {selected.name}</CardTitle><p className="text-base text-muted-foreground">Just follow the big instruction below. Finish one step, approve it, and the next step will open. You can stop and come back later.</p></CardHeader><CardContent className="space-y-5">
     {setupProgressLoading?<p className="text-sm text-muted-foreground">Checking your saved progress…</p>:!setupProgress?<div className="rounded-lg border p-4 text-sm text-muted-foreground">We could not load the saved steps. Press Refresh and try again. Do not continue until the status appears.</div>:<>
      <div className="rounded-xl border bg-muted/30 p-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-base font-semibold">Your setup progress</p><p className="text-sm text-muted-foreground">Follow the numbers from 1 to 6.</p></div><Badge variant={allStepsApproved?'default':'secondary'} className="text-sm px-3 py-1">{allStepsApproved?'Finished':stepStates.filter(x=>x.approved).length+' of 6 steps approved'}</Badge></div><div className="grid grid-cols-6 gap-1.5">{setupStepDefinitions.map((step,index)=>{const state=stepStates.find(x=>x.key===step.key);return <div key={step.key} className="space-y-1"><div className={'h-2 rounded-full '+(state?.approved?'bg-green-600':state?.current?'bg-primary':'bg-muted-foreground/20')}/><p className="text-center text-[10px] text-muted-foreground">{index+1}</p></div>;})}</div><div className="space-y-2">{setupStepDefinitions.map((step,index)=>{const state=stepStates.find(x=>x.key===step.key);const approved=Boolean(state?.approved);const current=Boolean(state?.current);return <div key={step.key} className={'flex items-center gap-3 rounded-lg border p-3 '+(current?'border-primary bg-primary/5':'')}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold">{approved?<CheckCircle2 className="h-5 w-5 text-green-600"/>:index+1}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{index+1}. {step.short}</p><p className="text-xs text-muted-foreground">{approved?'Finished':current?'Do this now':'Waiting for the step before it'}</p></div><Badge variant={approved?'default':current?'secondary':'outline'}>{approved?'Approved':current?'Your turn':'Locked'}</Badge></div>;})}</div></div>
      {allStepsApproved?<div className="rounded-xl border border-green-600/40 bg-green-600/5 p-5 space-y-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-6 w-6 text-green-600"/><p className="text-lg font-semibold">Well done! Setup is complete.</p></div><p className="text-sm text-muted-foreground">All six steps have been approved. Check the readiness notes below, then enable Smart Booking when you are ready.</p>{readinessIssues.length>0?<div className="space-y-2"><p className="text-sm font-semibold">One more thing to fix:</p>{readinessIssues.map((issue,i)=><p key={i} className="text-sm text-muted-foreground">• {issue}</p>)}</div>:<p className="text-sm text-green-700">Everything passes the current readiness checks.</p>}<Button className="w-full sm:w-auto" onClick={()=>void activate(true)} disabled={!isReady||config.enabled}>{config.enabled?'This service is already enabled':'Enable Smart Booking'}</Button>{config.enabled&&<Badge>Enabled</Badge>}</div>:(()=>{const step=setupStepDefinitions.find(x=>x.key===currentStepKey);if(!step)return <div className="rounded-lg border p-4 text-sm">We are checking the next step. Press Refresh if this message stays here.</div>;return <div className="rounded-xl border-2 border-primary p-4 sm:p-6 space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary" className="px-3 py-1 text-sm">YOUR NEXT STEP</Badge><span className="text-sm font-medium text-muted-foreground">Step {setupStepDefinitions.findIndex(x=>x.key===step.key)+1} of 6</span></div><div><p className="text-2xl font-bold">{step.title}</p><p className="mt-2 text-base text-muted-foreground">{step.description}</p></div><div className="rounded-lg bg-muted/50 p-4 space-y-2"><p className="font-semibold">What to do now</p><p className="text-base leading-relaxed">{step.doThis}</p><div className="border-t pt-2"><p className="text-xs font-semibold uppercase text-muted-foreground">How you know you are done</p><p className="text-sm">{step.doneLooksLike}</p></div></div><div className="flex flex-col gap-2 sm:flex-row">{step.tab&&<Button size="lg" className="w-full sm:w-auto" onClick={()=>openStep(step.tab!)}>{step.button}<ArrowRight className="ml-2 h-5 w-5"/></Button>}{step.key==='offers'&&<Button size="lg" variant="outline" disabled={approvingStep!==null} onClick={()=>void approveStep('offers',true)}>I have no offers — skip</Button>}{step.key==='final_review'&&<Button size="lg" disabled={approvingStep!==null} onClick={()=>void approveStep('final_review')}>{approvingStep==='final_review'?'Approving…':'Approve and finish'}<CheckCircle2 className="ml-2 h-5 w-5"/></Button>}</div><p className="text-xs text-muted-foreground">After you finish the work, come back here and press “Approve and continue”. We will check it before opening the next step.</p>{step.key!=='final_review'&&<Button variant="secondary" className="w-full sm:w-auto" disabled={approvingStep!==null} onClick={()=>void approveStep(step.key)}>{approvingStep===step.key?'Checking your work…':'I have finished this step — approve and continue'}<CheckCircle2 className="ml-2 h-4 w-4"/></Button>}</div>;})()}
      <div className="rounded-lg border p-3"><p className="text-sm font-semibold">Need help?</p><p className="text-sm text-muted-foreground">You can open Advanced Setup if you need more controls. The numbered steps and approvals will still be here when you return.</p><Button size="sm" variant="outline" className="mt-2" onClick={()=>setViewMode('advanced')}>Open Advanced Setup</Button></div>
     </>}
    </CardContent></Card>
    </>:<>
     <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b>{selected.name}</b><p className="text-xs text-muted-foreground">Version {config.config_version} · {selected.service_category?.name||'Category not assigned'}</p></div><div className="flex items-center gap-2"><Badge variant={config.enabled?'default':'secondary'}>{config.enabled?'Enabled':'Disabled'}</Badge><Button size="sm" variant={config.enabled?'destructive':'default'} onClick={()=>void activate(!config.enabled)}>{config.enabled?'Disable':'Review & enable'}</Button></div></CardContent></Card>
     <Card className="border-primary/40 bg-primary/5"><CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">You are working on: {setupStepDefinitions.find(x=>x.key===currentStepKey)?.title||'Your service setup'}</p><p className="text-sm text-muted-foreground">Make the change in this tab, press its Save or Add button, then return to the guide and approve the step to continue.</p></div><Button size="sm" onClick={()=>setViewMode('guide')}>Back to my numbered steps</Button></CardContent></Card>
     <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-sm">Advanced configuration</p><p className="text-xs text-muted-foreground">These detailed controls are optional. Follow the numbered guide if you are unsure.</p></div><Button size="sm" variant="outline" onClick={()=>setViewMode('guide')}>Back to guided setup</Button></div>
     <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4"><TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-6"><TabsTrigger value="setup">Setup</TabsTrigger><TabsTrigger value="questions">Questions</TabsTrigger><TabsTrigger value="conditions">Conditions</TabsTrigger><TabsTrigger value="scope">Scope</TabsTrigger><TabsTrigger value="pricing">Pricing</TabsTrigger><TabsTrigger value="library">Question library & offers</TabsTrigger></TabsList>
      <TabsContent value="setup"><Card><CardHeader><CardTitle className="text-base">Instructions & requirements</CardTitle></CardHeader><CardContent className="space-y-4">
       <div className="space-y-1"><Label>Customer instructions</Label><Textarea rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)}/></div>
       <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label>Photo mode</Label><Select value={photoMode} onValueChange={setPhotoMode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="optional">Optional</SelectItem><SelectItem value="required">Required</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Minimum photos</Label><Input type="number" min="0" value={photoMin} disabled={photoMode==='none'} onChange={e=>setPhotoMin(e.target.value)}/></div><div className="space-y-1"><Label>Maximum photos</Label><Input type="number" min="0" value={photoMax} disabled={photoMode==='none'} onChange={e=>setPhotoMax(e.target.value)}/></div></div>
       <div className="space-y-1"><Label>Measurement configuration (JSON object)</Label><p className="text-xs text-muted-foreground">For per-unit or tiered pricing, set measurement_config.quantity.enabled to true and provide a label. For per-measurement pricing, add a measurement question whose key exactly matches the pricing rule unit key.</p><Textarea rows={4} className="font-mono text-xs" value={measurements} onChange={e=>setMeasurements(e.target.value)}/></div>
       <div className="space-y-1"><Label>Availability configuration (JSON object)</Label><Textarea rows={4} className="font-mono text-xs" value={availability} onChange={e=>setAvailability(e.target.value)}/></div>
       <div className="flex justify-end"><Button onClick={()=>void save()} disabled={saving}><Save className="mr-2 h-4 w-4"/>Save setup</Button></div>
      </CardContent></Card></TabsContent>
      <TabsContent value="questions"><div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Customer questions ({questions.length})</CardTitle></CardHeader><CardContent className="space-y-2">{questions.map(q=><div key={q.id} className="flex items-start justify-between gap-3 rounded border p-3"><div><b className="text-sm">{q.label}</b>{q.required&&<Badge className="ml-2" variant="outline">Required</Badge>}<p className="text-xs text-muted-foreground">{q.question_key} · {q.input_type} · order {q.display_order}</p>{q.description&&<p className="text-sm text-muted-foreground">{q.description}</p>}</div><Button size="icon" variant="ghost" onClick={()=>void remove('booking_engine_questions',q.id,setQuestions)}><Trash2 className="h-4 w-4"/></Button></div>)}{!questions.length&&<p className="text-sm text-muted-foreground">No questions configured.</p>}</CardContent></Card>
       <Card><CardHeader><CardTitle className="text-base">Add question</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Customer label</Label><Input value={qLabel} onChange={e=>{setQLabel(e.target.value);setQKey(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));}}/></div><div className="space-y-1"><Label>Unique key</Label><Input value={qKey} onChange={e=>setQKey(e.target.value)}/></div><div className="space-y-1"><Label>Input type</Label><Select value={qType} onValueChange={setQType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['text','number','select','multi_select','boolean','date','time','measurement','address'].map(x=><SelectItem key={x} value={x}>{x.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div><div className="flex items-center gap-2 pt-6"><Switch checked={qRequired} onCheckedChange={setQRequired}/><Label>Required</Label></div><div className="space-y-1 sm:col-span-2"><Label>Help text</Label><Input value={qDesc} onChange={e=>setQDesc(e.target.value)}/></div>{['select','multi_select'].includes(qType)&&<div className="space-y-1 sm:col-span-2"><Label>Options (JSON array)</Label><Textarea rows={3} className="font-mono text-xs" value={qOptions} onChange={e=>setQOptions(e.target.value)}/></div>}<div className="sm:col-span-2"><Button onClick={()=>void addQuestion()} disabled={!qLabel.trim()||!qKey.trim()}><CirclePlus className="mr-2 h-4 w-4"/>Add question</Button></div></CardContent></Card></div></TabsContent>
      <TabsContent value="conditions"><Card><CardHeader><CardTitle className="text-base">Conditional question logic</CardTitle><p className="text-sm text-muted-foreground">Control a question based on another answer.</p></CardHeader><CardContent className="space-y-3">{conditions.map(c=><div key={c.id} className="flex items-center justify-between gap-2 rounded border p-3 text-sm"><span>{questions.find(q=>q.id===c.question_id)?.label} · {c.action} when {questions.find(q=>q.id===c.depends_on_question_id)?.label} {c.operator} {JSON.stringify(c.expected_value)}</span><Button size="icon" variant="ghost" onClick={()=>void remove('booking_engine_question_conditions',c.id,setConditions)}><Trash2 className="h-4 w-4"/></Button></div>)}{questions.length<2?<p className="text-sm text-muted-foreground">Add at least two questions first.</p>:<div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Target question</Label><Select value={target} onValueChange={setTarget}><SelectTrigger><SelectValue placeholder="Choose question"/></SelectTrigger><SelectContent>{questions.map(q=><SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Depends on</Label><Select value={source} onValueChange={setSource}><SelectTrigger><SelectValue placeholder="Choose question"/></SelectTrigger><SelectContent>{questions.filter(q=>q.id!==target).map(q=><SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Operator</Label><Select value={operator} onValueChange={setOperator}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['equals','not_equals','greater_than','less_than','contains'].map(x=><SelectItem key={x} value={x}>{x.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Expected value</Label><Input value={expected} onChange={e=>setExpected(e.target.value)}/></div><div className="space-y-1"><Label>Action</Label><Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['show','hide','required','optional'].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button onClick={()=>void addCondition()}><CirclePlus className="mr-2 h-4 w-4"/>Add condition</Button></div></div>}</CardContent></Card></TabsContent>
      <TabsContent value="scope"><Card><CardHeader><CardTitle className="text-base">Included, excluded & extra scope</CardTitle></CardHeader><CardContent className="space-y-3">{(['included','excluded','extra'] as const).map(kind=><div key={kind} className="space-y-2"><b className="text-sm capitalize">{kind}</b>{scope.filter(x=>x.scope_type===kind).map(item=><div key={item.id} className="flex items-center justify-between gap-2 rounded border p-3"><div><b className="text-sm">{item.title}</b>{!item.active&&<Badge className="ml-2" variant="secondary">Inactive</Badge>}{item.description&&<p className="text-sm text-muted-foreground">{item.description}</p>}</div><div className="flex items-center gap-2"><Switch checked={item.active} onCheckedChange={async()=>{const r=await db.from('booking_engine_service_scope').update({active:!item.active,updated_at:new Date().toISOString()}).eq('id',item.id).select('*').single();if(r.error)toast({title:'Scope update failed',description:r.error.message,variant:'destructive'});else{setScope(x=>x.map(y=>y.id===item.id?r.data:y));await bumpVersion();}}}/><Button size="icon" variant="ghost" onClick={()=>void remove('booking_engine_service_scope',item.id,setScope)}><Trash2 className="h-4 w-4"/></Button></div></div>)}</div>)}<div className="grid gap-3 border-t pt-4 sm:grid-cols-2"><div className="space-y-1"><Label>Scope type</Label><Select value={scopeType} onValueChange={setScopeType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="included">Included</SelectItem><SelectItem value="excluded">Excluded</SelectItem><SelectItem value="extra">Extra</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Title</Label><Input value={scopeTitle} onChange={e=>setScopeTitle(e.target.value)}/></div><div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={scopeDesc} onChange={e=>setScopeDesc(e.target.value)}/></div><div className="sm:col-span-2"><Button onClick={()=>void addScope()} disabled={!scopeTitle.trim()}><CirclePlus className="mr-2 h-4 w-4"/>Add scope item</Button></div></div></CardContent></Card></TabsContent>
      <TabsContent value="pricing"><div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Pricing versions</CardTitle><p className="text-sm text-muted-foreground">Booking Engine pricing only. Existing ERP service prices are untouched.</p></CardHeader><CardContent className="space-y-2">{pricing.map(rule=><div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><div><b className="text-sm">{rule.pricing_type.replace('_',' ')}{rule.rate!==null?' · KES '+Number(rule.rate).toLocaleString():' · Staff quotation'}</b><p className="text-xs text-muted-foreground">Version {rule.version}{rule.unit_key?' · per '+rule.unit_key:''}{rule.minimum_quantity!==null?' · min '+rule.minimum_quantity:''}{rule.maximum_quantity!==null?' · max '+rule.maximum_quantity:''}{rule.conditions&&Object.keys(rule.conditions).length>0?' · when '+JSON.stringify(rule.conditions):''}</p></div><div className="flex items-center gap-2"><Badge variant={rule.active?'default':'secondary'}>{rule.active?'Active':'Inactive'}</Badge><Button size="sm" variant="outline" onClick={()=>editPricing(rule)}>Edit price</Button><Button size="sm" variant="outline" onClick={async()=>{const r=await db.from('booking_engine_pricing_rules').update({active:!rule.active,updated_by:(await supabase.auth.getUser()).data.user?.id??null,updated_at:new Date().toISOString()}).eq('id',rule.id).select('*').single();if(r.error)toast({title:'Pricing update failed',description:r.error.message,variant:'destructive'});else{setPricing(x=>x.map(y=>y.id===rule.id?r.data:y));await bumpVersion();}}}>{rule.active?'Deactivate':'Reactivate'}</Button></div></div>)}{!pricing.length&&<p className="text-sm text-muted-foreground">No pricing rules configured.</p>}</CardContent></Card>
       <Card><CardHeader><CardTitle className="text-base">{editingPricingId?'Change price':'Add a new price'}</CardTitle><p className="text-sm text-muted-foreground">Choose a price type, enter the amount in KSh and save. Advanced conditions are optional.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Pricing model</Label><Select value={priceType} onValueChange={setPriceType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['fixed','per_unit','per_measurement','tiered','quotation'].map(x=><SelectItem key={x} value={x}>{x.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Rate (KES)</Label><Input type="number" min="0" step="0.01" disabled={priceType==='quotation'} value={priceRate} onChange={e=>setPriceRate(e.target.value)}/></div><div className="space-y-1"><Label>Unit / measurement key</Label><Input value={priceUnit} onChange={e=>setPriceUnit(e.target.value)} placeholder="e.g. room, seat, sqm"/></div><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Min quantity</Label><Input type="number" min="0" value={priceMin} onChange={e=>setPriceMin(e.target.value)}/></div><div className="space-y-1"><Label>Max quantity</Label><Input type="number" min="0" value={priceMax} onChange={e=>setPriceMax(e.target.value)}/></div></div><div className="space-y-1 sm:col-span-2"><Label>Conditional match (JSON object)</Label><Textarea rows={3} className="font-mono text-xs" value={priceConditions} onChange={e=>setPriceConditions(e.target.value)} placeholder='{"answers":{"material":"fabric"}}'/><p className="text-xs text-muted-foreground">Leave as {'{}'} for a standard rule. Use answers and/or measurements to match customer responses.</p></div><div className="sm:col-span-2"><Button onClick={()=>void addPricing()}><CirclePlus className="mr-2 h-4 w-4"/>{editingPricingId?'Save new price version':'Add price'}</Button>{editingPricingId&&<Button variant="outline" onClick={cancelPricingEdit}>Cancel</Button>}</div></CardContent></Card></div></TabsContent>
      <TabsContent value="library"><BookingEngineLibrary services={services} configs={configs} /></TabsContent>
     </Tabs>
     <Card><CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-3"><div>{questions.length} questions</div><div>{activeIncluded} active included scope items</div><div>{activePricing} active pricing rules</div></CardContent></Card>
    </>}
   </div>
  </div>}
  <AdminBookingEngineRequests />
 </div>;
}

type LibraryTemplate = {
 id: string; question_key: string; label: string; description: string | null; input_type: string;
 required_default: boolean; options: any[]; validation_rules: Record<string, any>;
 prompt_group: string | null; display_order: number; active: boolean;
};
type LibraryOffer = {
 id: string; offer_key: string; offer_type: string; title: string; description: string | null;
 terms: string | null; price_mode: string; price_value: number | null; currency: string;
 active: boolean; featured: boolean; starts_at: string | null; ends_at: string | null; display_order: number;
};
type OfferLink = { service_id: string; relationship: 'trigger' | 'included' | 'recommended'; quantity: number };

const emptyTemplateDraft = () => ({
 question_key: '', label: '', description: '', input_type: 'text', required_default: false,
 options: '[]', validation_rules: '{}', prompt_group: '', display_order: '0', active: true,
});
const emptyOfferDraft = () => ({
 offer_key: '', offer_type: 'add_on', title: '', description: '', terms: '',
 price_mode: 'quotation', price_value: '', active: false, featured: false,
 starts_at: '', ends_at: '', display_order: '0',
});
const makeKey = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
const parseValidationRules = (inputType: string, raw: string) => {
 const rules=JSON.parse(raw||'{}');
 if(!rules||typeof rules!=='object'||Array.isArray(rules))throw new Error('Validation rules must be an object.');
 const numeric=['number','measurement'].includes(inputType);
 const textual=['text','textarea','date','time','address'].includes(inputType);
 const allowed=numeric?['min','max']:textual?['min_length','max_length','pattern']:[];
 const unsupported=Object.keys(rules).filter(key=>!allowed.includes(key));
 if(unsupported.length)throw new Error('Remove unsupported rules for this answer type: '+unsupported.join(', ')+'.');
 for(const key of allowed.filter(k=>k!=='pattern')){
  if(rules[key]===undefined)continue;
  const value=Number(rules[key]);
  if(!Number.isFinite(value)||(key.endsWith('_length')&&(!Number.isInteger(value)||value<0)))throw new Error(key.replace('_',' ')+' must be a valid '+(key.endsWith('_length')?'whole number.':'number.'));
  rules[key]=value;
 }
 if(numeric&&rules.min!==undefined&&rules.max!==undefined&&rules.min>rules.max)throw new Error('Minimum cannot be greater than maximum.');
 if(textual&&rules.min_length!==undefined&&rules.max_length!==undefined&&rules.min_length>rules.max_length)throw new Error('Minimum length cannot be greater than maximum length.');
 if(textual&&rules.pattern!==undefined){
  if(typeof rules.pattern!=='string')throw new Error('Pattern must be text.');
  try{new RegExp(rules.pattern);}catch{throw new Error('Pattern is not a valid regular expression.');}
 }
 return rules;
};

function BookingEngineLibrary({ services, configs }: { services: Service[]; configs: Config[] }) {
 const [templates,setTemplates]=useState<LibraryTemplate[]>([]);
 const [offers,setOffers]=useState<LibraryOffer[]>([]);
 const [offerLinks,setOfferLinks]=useState<Record<string,OfferLink[]>>({});
 const [offerPerformance,setOfferPerformance]=useState<Record<string,{selections:number;convertedBookings:number;conversionRate:number}>>({});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [editingTemplate,setEditingTemplate]=useState<string|null>(null);
 const [templateDraft,setTemplateDraft]=useState(emptyTemplateDraft);
 const [selectedTemplateId,setSelectedTemplateId]=useState('');
 const [selectedConfigIds,setSelectedConfigIds]=useState<string[]>([]);
 const [editingOffer,setEditingOffer]=useState<string|null>(null);
 const [offerDraft,setOfferDraft]=useState(emptyOfferDraft);
 const [offerServiceLinks,setOfferServiceLinks]=useState<{trigger:string[];included:string[];recommended:string[]}>({trigger:[],included:[],recommended:[]});
 const [serviceSearch,setServiceSearch]=useState('');

 const reload=useCallback(async()=>{
  setLoading(true);
  const [t,o]=await Promise.all([
   db.from('booking_engine_question_templates').select('*').order('display_order').order('label'),
   db.from('booking_engine_value_offers').select('*').order('display_order').order('title'),
  ]);
  if(t.error||o.error){toast({title:'Could not load question library and offers',description:t.error?.message||o.error?.message,variant:'destructive'});setLoading(false);return;}
  const offerRows=(o.data||[]) as LibraryOffer[];
  const links=offerRows.length?await db.from('booking_engine_value_offer_services').select('offer_id,service_id,relationship,quantity').in('offer_id',offerRows.map(x=>x.id)):{data:[],error:null};
  if(links.error){toast({title:'Could not load offer service links',description:links.error.message,variant:'destructive'});setLoading(false);return;}
  const grouped:Record<string,OfferLink[]>={};
  for(const row of links.data||[]){(grouped[row.offer_id]??=[]).push({service_id:row.service_id,relationship:row.relationship,quantity:Number(row.quantity)||1});}
  const offerIds=offerRows.map(offer=>offer.id);
  const selections=offerIds.length
   ?await db.from('booking_engine_request_offers').select('offer_id,request_id,created_at').in('offer_id',offerIds).order('created_at',{ascending:false}).limit(1000)
   :{data:[],error:null};
  let performance:Record<string,{selections:number;convertedBookings:number;conversionRate:number}>={};
  if(!selections.error&&selections.data?.length){
   const requestIds=[...new Set(selections.data.map((row:any)=>row.request_id))];
   const requests=await db.from('booking_engine_requests').select('id,status,converted_booking_id').in('id',requestIds);
   if(!requests.error){
    performance=summarizeBookingOfferPerformance(selections.data,requests.data||[]);
   }else{
    toast({title:'Offer performance is temporarily unavailable',description:requests.error.message,variant:'destructive'});
   }
  }else if(selections.error){
   toast({title:'Offer performance is temporarily unavailable',description:selections.error.message,variant:'destructive'});
  }
  setTemplates((t.data||[]) as LibraryTemplate[]);setOffers(offerRows);setOfferLinks(grouped);setOfferPerformance(performance);setLoading(false);
 },[]);
 useEffect(()=>{void reload();},[reload]);

 const serviceName=(id:string)=>services.find(x=>x.id===id)?.name||'Unavailable service';
 const validateOfferReadiness=async(offerType:string,links:OfferLink[],startsAt:string|null,endsAt:string|null)=>{
  const requiredIds=[...new Set(links.filter(x=>x.relationship==='trigger'||x.relationship==='included').map(x=>x.service_id))];
  if(!requiredIds.length)return getBookingOfferReadinessIssues({offer_type:offerType,links,services:[],configurations:[],starts_at:startsAt,ends_at:endsAt});
  const [serviceResult,configResult]=await Promise.all([
   db.from('services').select('id,name,is_active').in('id',requiredIds),
   db.from('booking_engine_service_config').select('id,service_id,enabled').in('service_id',requiredIds)
  ]);
  if(serviceResult.error||configResult.error)return ['Could not verify service eligibility. Refresh the library and try again.'];
  const configRows=configResult.data||[];
  const configIds=configRows.map((row:any)=>row.id);
  const pricingResult=configIds.length
   ?await db.from('booking_engine_pricing_rules').select('service_config_id').in('service_config_id',configIds).eq('active',true)
   :{data:[],error:null};
  if(pricingResult.error)return ['Could not verify active pricing rules. Refresh the library and try again.'];
  const pricedConfigIds=new Set((pricingResult.data||[]).map((row:any)=>row.service_config_id));
  return getBookingOfferReadinessIssues({
   offer_type:offerType,links,services:serviceResult.data||[],
   configurations:configRows.map((row:any)=>({service_id:row.service_id,enabled:row.enabled===true,has_active_pricing:pricedConfigIds.has(row.id)})),
   starts_at:startsAt,ends_at:endsAt
  });
 };
 const configuredServices=configs.map(c=>({config:c,service:services.find(s=>s.id===c.service_id)})).filter(x=>x.service?.is_active);
 const filteredServices=services.filter(s=>s.is_active&&(!serviceSearch.trim()||s.name.toLowerCase().includes(serviceSearch.toLowerCase())||(s.service_code||'').toLowerCase().includes(serviceSearch.toLowerCase())));
 const setT=(key:string,value:any)=>setTemplateDraft(old=>({...old,[key]:value}));
 const templateValidation=(()=>{try{return JSON.parse(templateDraft.validation_rules||'{}');}catch{return {};}})();
 const setValidationRule=(key:string,value:string)=>{
  const current=(()=>{try{return JSON.parse(templateDraft.validation_rules||'{}');}catch{return {};}})();
  if(value.trim()==='')delete current[key];else current[key]=key==='pattern'?value:Number(value);
  setT('validation_rules',JSON.stringify(current));
 };
 const setO=(key:string,value:any)=>setOfferDraft(old=>({...old,[key]:value}));

 const editTemplate=(t:LibraryTemplate)=>{
  setEditingTemplate(t.id);setSelectedTemplateId(t.id);
  setTemplateDraft({question_key:t.question_key,label:t.label,description:t.description||'',input_type:t.input_type,required_default:t.required_default,options:JSON.stringify(t.options||[],null,2),validation_rules:JSON.stringify(t.validation_rules||{},null,2),prompt_group:t.prompt_group||'',display_order:String(t.display_order),active:t.active});
 };
 const saveTemplate=async()=>{
  if(!templateDraft.label.trim()||!templateDraft.question_key.trim()){toast({title:'Enter a question label and unique key'});return;}
  let options:any,validation:any;
  try{options=JSON.parse(templateDraft.options);validation=parseValidationRules(templateDraft.input_type,templateDraft.validation_rules);if(!Array.isArray(options))throw new Error('Options must be an array.');if(['select','multi_select'].includes(templateDraft.input_type)&&!options.length)throw new Error('Add at least one option for select questions.');}
  catch(e){toast({title:'Check question JSON',description:e instanceof Error?e.message:'Invalid JSON.',variant:'destructive'});return;}
  const order=Number(templateDraft.display_order);if(!Number.isInteger(order)){toast({title:'Display order must be a whole number'});return;}
  const user=(await supabase.auth.getUser()).data.user?.id??null;
  const payload={question_key:makeKey(templateDraft.question_key),label:templateDraft.label.trim(),description:templateDraft.description.trim()||null,input_type:templateDraft.input_type,required_default:templateDraft.required_default,options,validation_rules:validation,prompt_group:templateDraft.prompt_group.trim()||null,display_order:order,active:templateDraft.active,updated_by:user,updated_at:new Date().toISOString()};
  setSaving(true);
  const result=editingTemplate
   ?await db.from('booking_engine_question_templates').update(payload).eq('id',editingTemplate).select('*').single()
   :await db.from('booking_engine_question_templates').insert({...payload,created_by:user}).select('*').single();
  if(result.error){toast({title:'Question template was not saved',description:result.error.message,variant:'destructive'});setSaving(false);return;}
  if(editingTemplate){
   const sync=await db.from('booking_engine_questions').update({question_key:payload.question_key,label:payload.label,description:payload.description,input_type:payload.input_type,required:payload.required_default,options:payload.options,validation_rules:payload.validation_rules,active:payload.active,updated_at:new Date().toISOString()}).eq('question_template_id',editingTemplate).select('service_config_id');
   if(sync.error){toast({title:'Template saved; applied questions need a refresh',description:sync.error.message,variant:'destructive'});}
   else{
    const affected=[...new Set((sync.data||[]).map((row:any)=>row.service_config_id))];
    if(affected.length){const bumped=await db.rpc('bump_booking_engine_config_versions',{_config_ids:affected});if(bumped.error)toast({title:'Questions updated; configuration versions need a refresh',description:bumped.error.message,variant:'destructive'});}
   }
  }
  setSelectedTemplateId(result.data.id);setEditingTemplate(result.data.id);await reload();toast({title:'Question template saved'});setSaving(false);
 };
 const applyTemplate=async()=>{
  const template=templates.find(x=>x.id===selectedTemplateId);
  if(!template||!template.active){toast({title:'Select an active question template'});return;}
  if(!selectedConfigIds.length){toast({title:'Select at least one configured service'});return;}
  const rows=selectedConfigIds.map(id=>({service_config_id:id,question_template_id:template.id,question_key:template.question_key,label:template.label,description:template.description,input_type:template.input_type,required:template.required_default,display_order:template.display_order,options:template.options||[],validation_rules:template.validation_rules||{},active:true}));
  setSaving(true);
  const r=await db.from('booking_engine_questions').upsert(rows,{onConflict:'service_config_id,question_template_id'}).select('service_config_id');
  if(r.error)toast({title:'Could not apply question template',description:r.error.message,variant:'destructive'});
  else{
   const affected=[...new Set((r.data||[]).map((row:any)=>row.service_config_id))];
   const bumped=affected.length?await db.rpc('bump_booking_engine_config_versions',{_config_ids:affected}):{error:null};
   if(bumped.error)toast({title:'Question applied, but configuration versions need a refresh',description:bumped.error.message,variant:'destructive'});
   else toast({title:'Question applied',description:'Applied or updated on '+affected.length+' selected service configuration(s). Setup approvals will need to be reviewed again.'});
   setSelectedConfigIds([]);
  }
  setSaving(false);
 };
 const removeTemplate=async(t:LibraryTemplate)=>{
  if(!window.confirm('Delete this library template? Questions already applied to services will remain as independent questions.'))return;
  const r=await db.from('booking_engine_question_templates').delete().eq('id',t.id);
  if(r.error)toast({title:'Template not deleted',description:r.error.message,variant:'destructive'});
  else{if(selectedTemplateId===t.id){setSelectedTemplateId('');setEditingTemplate(null);setTemplateDraft(emptyTemplateDraft());}await reload();}
 };
 const resetTemplate=()=>{setEditingTemplate(null);setTemplateDraft(emptyTemplateDraft());};

 const editOffer=async(o:LibraryOffer)=>{
  const links=offerLinks[o.id]||[];
  setEditingOffer(o.id);setOfferDraft({offer_key:o.offer_key,offer_type:o.offer_type,title:o.title,description:o.description||'',terms:o.terms||'',price_mode:o.price_mode,price_value:o.price_value==null?'':String(o.price_value),active:o.active,featured:o.featured,starts_at:o.starts_at?new Date(o.starts_at).toISOString().slice(0,16):'',ends_at:o.ends_at?new Date(o.ends_at).toISOString().slice(0,16):'',display_order:String(o.display_order)});
  setOfferServiceLinks({trigger:links.filter(x=>x.relationship==='trigger').map(x=>x.service_id),included:links.filter(x=>x.relationship==='included').map(x=>x.service_id),recommended:links.filter(x=>x.relationship==='recommended').map(x=>x.service_id)});
 };
 const toggleOfferService=(relationship:'trigger'|'included'|'recommended',id:string,checked:boolean)=>{
  setOfferServiceLinks(old=>{
   const next={...old,[relationship]:checked?[...old[relationship],id]:old[relationship].filter(x=>x!==id)};
   if(checked&&relationship==='trigger') next.included=next.included.filter(x=>x!==id);
   if(checked&&relationship==='included') next.trigger=next.trigger.filter(x=>x!==id);
   return next;
  });
 };
 const saveOffer=async()=>{
  const key=makeKey(offerDraft.offer_key||offerDraft.title);
  if(!key||!offerDraft.title.trim()||(offerDraft.offer_type!=='package'&&!offerServiceLinks.trigger.length)){toast({title:'Add a title and the required service links'});return;}
  if(offerDraft.offer_type!=='package'&&!offerServiceLinks.included.length&&offerDraft.offer_type==='recurring'){toast({title:'Add at least one included service'});return;}
  if(offerDraft.offer_type==='package'&&offerDraft.price_mode!=='fixed'&&offerDraft.price_mode!=='quotation'){toast({title:'Packages use a calculated fixed bundle price.'});return;}
  if((offerDraft.offer_type==='add_on'||offerDraft.offer_type==='upgrade')&&offerDraft.price_mode==='quotation'){toast({title:'Optional extras and upgrades need a configured amount or discount. Use a fixed price or discount.'});return;}
  if(offerServiceLinks.trigger.some(id=>offerServiceLinks.included.includes(id))){toast({title:'A starting service cannot also be listed as an included service.'});return;}
  const existingOffer=editingOffer?offers.find(x=>x.id===editingOffer):null;
  const order=Number(offerDraft.display_order),amount=offerDraft.offer_type==='package'?(existingOffer?.price_value??null):(offerDraft.price_mode==='quotation'?null:Number(offerDraft.price_value));
  if(!Number.isInteger(order)||(amount!==null&&(!offerDraft.price_value.trim()||!Number.isFinite(amount)||amount<=0||(offerDraft.price_mode==='percentage_discount'&&amount>100)))||(amount===null&&offerDraft.price_mode!=='quotation')){toast({title:'Enter a valid positive offer amount and display order. Percentage discounts cannot exceed 100%.'});return;}
  const startDate=offerDraft.starts_at?new Date(offerDraft.starts_at):null;
  const endDate=offerDraft.ends_at?new Date(offerDraft.ends_at):null;
  if((startDate&&!Number.isFinite(startDate.getTime()))||(endDate&&!Number.isFinite(endDate.getTime()))){toast({title:'Enter valid campaign dates'});return;}
  const startsAt=startDate?.toISOString()??null;
  const endsAt=endDate?.toISOString()??null;
  if(offerDraft.active&&offerDraft.offer_type!=='package'){
   const links:OfferLink[]=[
    ...offerServiceLinks.trigger.map(service_id=>({service_id,relationship:'trigger' as const,quantity:1})),
    ...offerServiceLinks.included.map(service_id=>({service_id,relationship:'included' as const,quantity:1})),
    ...offerServiceLinks.recommended.map(service_id=>({service_id,relationship:'recommended' as const,quantity:1}))
   ];
   const issues=await validateOfferReadiness(offerDraft.offer_type,links,startsAt,endsAt);
   if(issues.length){toast({title:'Offer is not ready to publish',description:issues.join(' '),variant:'destructive'});return;}
  }
  const user=(await supabase.auth.getUser()).data.user?.id??null;
  const payload={offer_key:key,offer_type:offerDraft.offer_type,title:offerDraft.title.trim(),description:offerDraft.description.trim()||null,terms:offerDraft.terms.trim()||null,price_mode:offerDraft.offer_type==='package'?(existingOffer?.price_mode||'quotation'):offerDraft.price_mode,price_value:amount,currency:'KES',active:offerDraft.offer_type==='package'?false:offerDraft.active,featured:offerDraft.featured,starts_at:startsAt,ends_at:endsAt,display_order:order,updated_by:user,updated_at:new Date().toISOString()};
  setSaving(true);
  const result=editingOffer
   ?await db.from('booking_engine_value_offers').update(payload).eq('id',editingOffer).select('*').single()
   :await db.from('booking_engine_value_offers').insert({...payload,created_by:user}).select('*').single();
  if(result.error){toast({title:'Offer was not saved',description:result.error.message,variant:'destructive'});setSaving(false);return;}
  const id=result.data.id;
  const removed=await db.from('booking_engine_value_offer_services').delete().eq('offer_id',id);
  if(removed.error){toast({title:'Offer saved but service links were not refreshed',description:removed.error.message,variant:'destructive'});setSaving(false);await reload();return;}
  const links:OfferLink[]=[
   ...offerServiceLinks.trigger.map(service_id=>({service_id,relationship:'trigger' as const,quantity:1})),
   ...offerServiceLinks.included.map(service_id=>({service_id,relationship:'included' as const,quantity:1})),
   ...offerServiceLinks.recommended.map(service_id=>({service_id,relationship:'recommended' as const,quantity:1})),
  ];
  const inserted=links.length?await db.from('booking_engine_value_offer_services').insert(links.map(x=>({offer_id:id,...x}))):{error:null};
  if(inserted.error){toast({title:'Offer saved but service links need attention',description:inserted.error.message,variant:'destructive'});}
  else{toast({title:'Value offer saved'});setEditingOffer(id);}
  await reload();setSaving(false);
 };
 const toggleOffer=async(o:LibraryOffer)=>{
  if(!o.active&&o.offer_type==='package'){
   const packageItems=await db.from('booking_engine_package_items').select('id,service_id,size_label,quantity,individual_price,complimentary,active').eq('offer_id',o.id).eq('active',true);
   if(packageItems.error){toast({title:'Could not verify package contents',description:packageItems.error.message,variant:'destructive'});return;}
   const rows=packageItems.data||[];
   if(!rows.length||rows.some((x:any)=>!x.size_label?.trim()||!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0||(!x.complimentary&&(x.individual_price===null||!Number.isFinite(Number(x.individual_price))||Number(x.individual_price)<0)))||!o.price_value||o.price_mode!=='fixed'){
    toast({title:'Package is not ready to publish',description:'Add every service with its size, quantity and individual price, save the final package price, then approve it.',variant:'destructive'});return;
   }
   const first=rows[0];
   const linkRows=[{offer_id:o.id,service_id:first.service_id,relationship:'trigger',quantity:first.quantity},...rows.slice(1).map((x:any)=>({offer_id:o.id,service_id:x.service_id,relationship:'included',quantity:x.quantity}))];
   const cleared=await db.from('booking_engine_value_offer_services').delete().eq('offer_id',o.id);
   if(cleared.error){toast({title:'Package links could not be prepared',description:cleared.error.message,variant:'destructive'});return;}
   const linked=await db.from('booking_engine_value_offer_services').insert(linkRows);
   if(linked.error){toast({title:'Package links could not be saved',description:linked.error.message,variant:'destructive'});return;}
  }
  if(!o.active&&o.offer_type!=='package'){
   const links=offerLinks[o.id]||[];
   const issues=await validateOfferReadiness(o.offer_type,links,o.starts_at,o.ends_at);
   if(issues.length){toast({title:'Offer is not ready to publish',description:issues.join(' '),variant:'destructive'});return;}
  }
  const r=await db.from('booking_engine_value_offers').update({active:!o.active,updated_at:new Date().toISOString(),updated_by:(await supabase.auth.getUser()).data.user?.id??null}).eq('id',o.id);
  if(r.error)toast({title:'Offer status not updated',description:r.error.message,variant:'destructive'});else await reload();
 };
 const deleteOffer=async(o:LibraryOffer)=>{
  if(!window.confirm('Delete this offer? Its service links will also be deleted. Existing booking snapshots are not changed.'))return;
  const r=await db.from('booking_engine_value_offers').delete().eq('id',o.id);
  if(r.error)toast({title:'Offer not deleted',description:r.error.message,variant:'destructive'});
  else{if(editingOffer===o.id){setEditingOffer(null);setOfferDraft(emptyOfferDraft());setOfferServiceLinks({trigger:[],included:[],recommended:[]});}await reload();}
 };
 const servicePicker=(relationship:'trigger'|'included'|'recommended',title:string)=><div className="space-y-2 rounded-lg border p-3"><div className="text-sm font-semibold">{title} ({offerServiceLinks[relationship].length})</div><div className="max-h-40 space-y-2 overflow-auto">{filteredServices.map(s=><label key={s.id} className="flex items-center gap-2 text-sm"><Checkbox checked={offerServiceLinks[relationship].includes(s.id)} onCheckedChange={v=>toggleOfferService(relationship,s.id,v===true)}/><span>{s.name}</span></label>)}</div></div>;
 return <div className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Booking setup library</h3><p className="text-sm text-muted-foreground">Create reusable questions and customer packages in one place.</p></div><Button variant="outline" size="sm" onClick={()=>void reload()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh library</Button></div>
  {loading?<p className="text-sm text-muted-foreground">Loading library…</p>:<Tabs defaultValue="offers" className="space-y-4">
   <TabsList><TabsTrigger value="templates">Question templates ({templates.length})</TabsTrigger><TabsTrigger value="offers">Packages & offers ({offers.length})</TabsTrigger></TabsList>
   <TabsContent value="templates" className="space-y-4">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
     <Card><CardHeader><CardTitle className="text-base">Question library</CardTitle></CardHeader><CardContent className="space-y-2">{templates.map(t=><div key={t.id} className={'rounded-lg border p-3 '+(selectedTemplateId===t.id?'border-primary bg-primary/5':'')}><div className="flex items-start justify-between gap-2"><button className="min-w-0 text-left" onClick={()=>editTemplate(t)}><b className="text-sm">{t.label}</b><p className="text-xs text-muted-foreground">{t.question_key} · {t.input_type} · {t.prompt_group||'General'}</p></button><div className="flex items-center gap-2"><Badge variant={t.active?'default':'secondary'}>{t.active?'Active':'Inactive'}</Badge><Button size="icon" variant="ghost" onClick={()=>editTemplate(t)}><Save className="h-4 w-4"/></Button><Button size="icon" variant="ghost" onClick={()=>void removeTemplate(t)}><Trash2 className="h-4 w-4"/></Button></div></div>{t.description&&<p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}</div>)}{!templates.length&&<p className="text-sm text-muted-foreground">No question templates yet.</p>}</CardContent></Card>
     <Card><CardHeader><CardTitle className="text-base">{editingTemplate?'Edit question template':'Create question template'}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label>Question label</Label><Input value={templateDraft.label} onChange={e=>{setT('label',e.target.value);if(!editingTemplate)setT('question_key',makeKey(e.target.value));}}/></div>
      <div className="space-y-1"><Label>Unique question key</Label><Input value={templateDraft.question_key} onChange={e=>setT('question_key',e.target.value)}/></div>
      <div className="space-y-1"><Label>Answer type</Label><Select value={templateDraft.input_type} onValueChange={v=>{setT('input_type',v);setT('validation_rules','{}');}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['text','textarea','number','boolean','select','multi_select','measurement','date'].map(v=><SelectItem key={v} value={v}>{v.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Question group (free text)</Label><Input value={templateDraft.prompt_group} onChange={e=>setT('prompt_group',e.target.value)}/></div>
      <div className="space-y-1 sm:col-span-2"><Label>Help text</Label><Input value={templateDraft.description} onChange={e=>setT('description',e.target.value)}/></div>
      <div className="space-y-1"><Label>Display order</Label><Input type="number" value={templateDraft.display_order} onChange={e=>setT('display_order',e.target.value)}/></div>
      <div className="flex items-center gap-2 pt-6"><Switch checked={templateDraft.required_default} onCheckedChange={v=>setT('required_default',v)}/><Label>Required by default</Label></div>
      <div className="flex items-center gap-2 sm:col-span-2"><Switch checked={templateDraft.active} onCheckedChange={v=>setT('active',v)}/><Label>Available in library</Label></div>
      <div className="space-y-1 sm:col-span-2"><Label>Options (JSON array for select questions)</Label><Textarea rows={4} className="font-mono text-xs" value={templateDraft.options} onChange={e=>setT('options',e.target.value)}/></div>
      {['number','measurement'].includes(templateDraft.input_type)&&<div className="grid gap-3 sm:grid-cols-2 sm:col-span-2"><div className="space-y-1"><Label>Minimum answer</Label><Input type="number" step="any" value={templateValidation.min??''} onChange={e=>setValidationRule('min',e.target.value)}/></div><div className="space-y-1"><Label>Maximum answer</Label><Input type="number" step="any" value={templateValidation.max??''} onChange={e=>setValidationRule('max',e.target.value)}/></div></div>}
      {['text','textarea','date','time','address'].includes(templateDraft.input_type)&&<div className="grid gap-3 sm:grid-cols-2 sm:col-span-2"><div className="space-y-1"><Label>Minimum characters</Label><Input type="number" min="0" step="1" value={templateValidation.min_length??''} onChange={e=>setValidationRule('min_length',e.target.value)}/></div><div className="space-y-1"><Label>Maximum characters</Label><Input type="number" min="0" step="1" value={templateValidation.max_length??''} onChange={e=>setValidationRule('max_length',e.target.value)}/></div><div className="space-y-1 sm:col-span-2"><Label>Format pattern (optional)</Label><Input value={templateValidation.pattern??''} onChange={e=>setValidationRule('pattern',e.target.value)} placeholder="Example: ^[A-Za-z ]+$"/></div></div>}
      {!['number','measurement','text','textarea','date','time','address'].includes(templateDraft.input_type)&&<p className="text-xs text-muted-foreground sm:col-span-2">This answer type is validated against its configured options or answer type. No extra limits are needed.</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Button onClick={()=>void saveTemplate()} disabled={saving}>{saving?'Saving…':'Save template'}</Button><Button variant="outline" onClick={resetTemplate}>New template</Button></div>
     </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="text-base">Apply a question to service configurations</CardTitle><p className="text-sm text-muted-foreground">Choose one template and the exact configured services. No service/category mapping is inferred.</p></CardHeader><CardContent className="space-y-3">
     <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}><SelectTrigger><SelectValue placeholder="Choose a question template"/></SelectTrigger><SelectContent>{templates.filter(t=>t.active).map(t=><SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select>
     <div className="grid gap-2 sm:grid-cols-2">{configuredServices.map(({config:c,service})=><label key={c.id} className="flex items-center gap-2 rounded border p-2 text-sm"><Checkbox checked={selectedConfigIds.includes(c.id)} onCheckedChange={v=>setSelectedConfigIds(old=>v?[...old,c.id]:old.filter(id=>id!==c.id))}/><span className="min-w-0 flex-1 truncate">{service?.name}</span><Badge variant={c.enabled?'default':'secondary'}>{c.enabled?'Enabled':'Disabled'}</Badge></label>)}</div>
     {!configuredServices.length&&<p className="text-sm text-muted-foreground">Create a service configuration first to apply templates.</p>}
     <Button onClick={()=>void applyTemplate()} disabled={saving||!selectedTemplateId||!selectedConfigIds.length}><CirclePlus className="mr-2 h-4 w-4"/>Apply / update selected question</Button>
    </CardContent></Card>
   </TabsContent>
   <TabsContent value="offers" className="space-y-4">
    <AdminPackageContents offers={offers} services={services} />
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
     <Card><CardHeader><CardTitle className="text-base">Packages and value offers</CardTitle><p className="text-xs text-muted-foreground">Configure each package's service sizes, quantities and individual prices below. Save the calculated final price, then approve and publish.</p></CardHeader><CardContent className="space-y-2">{offers.map(o=>{const stats=offerPerformance[o.id]||{selections:0,convertedBookings:0,conversionRate:0};const complimentary=o.description?.match(/Complimentary service:\s*(.*?)(?=\. Condition:|\. Price:|$)/i)?.[1]||'';const condition=o.description?.match(/Condition:\s*(.*?)(?=\. Price:|$)/i)?.[1]||'';const needsReview=o.offer_type==='package'&&(/requires clarification/i.test(o.description||'')||(/carpet/i.test(condition)&&!/carpet/i.test(complimentary)));return <div key={o.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="text-sm">{o.title}</b><p className="text-xs text-muted-foreground">{o.offer_type==='package'?'Customer package':o.offer_type==='upgrade'?'Upgrade':o.offer_type==='recurring'?'Recurring offer':'Add-on'} · {o.active?'Published':'Draft'}</p></div><div className="flex items-center gap-1">{o.offer_type==='package'?<Button size="sm" variant={o.active?'outline':'default'} onClick={()=>void toggleOffer(o)}>{o.active?'Unpublish':'Approve & publish'}</Button>:<Switch checked={o.active} onCheckedChange={()=>void toggleOffer(o)}/>}<Button size="icon" variant="ghost" onClick={()=>void editOffer(o)}><Save className="h-4 w-4"/></Button><Button size="icon" variant="ghost" onClick={()=>void deleteOffer(o)}><Trash2 className="h-4 w-4"/></Button></div></div>{o.description&&<p className="mt-1 text-xs text-muted-foreground">{o.description}</p>}{needsReview&&<p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">Needs clarification before publication. Please resolve the complimentary-service condition in the package details.</p>}{o.offer_type==='package'&&<p className="mt-2 text-xs text-muted-foreground">Package price: {o.price_mode==='fixed'&&o.price_value!=null?'KSh '+Number(o.price_value).toLocaleString('en-KE'):'Not configured yet'} · Configure contents and price in the package editor below.</p>}<div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs"><div><span className="block text-muted-foreground">Selections</span><b className="tabular-nums">{stats.selections}</b></div><div><span className="block text-muted-foreground">ERP bookings</span><b className="tabular-nums">{stats.convertedBookings}</b></div><div><span className="block text-muted-foreground">Conversion</span><b className="tabular-nums">{stats.conversionRate}%</b></div></div></div>;})}{!offers.length&&<p className="text-sm text-muted-foreground">No offers or packages created yet. Nothing is advertised automatically.</p>}</CardContent></Card>
     <Card><CardHeader><CardTitle className="text-base">{editingOffer?'Edit customer package / offer':'Create a customer package or offer'}</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
       <div className="space-y-1"><Label>Package or offer name</Label><Input value={offerDraft.title} onChange={e=>{setO('title',e.target.value);if(!editingOffer)setO('offer_key',makeKey(e.target.value));}}/></div>
       <div className="space-y-1"><Label>What are you creating?</Label><Select value={offerDraft.offer_type} onValueChange={v=>{setO('offer_type',v);if(v==='package'&&['percentage_discount','fixed_discount'].includes(offerDraft.price_mode))setO('price_mode','fixed');if((v==='add_on'||v==='upgrade')&&offerDraft.price_mode==='quotation')setO('price_mode','fixed');}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="package">Package</SelectItem><SelectItem value="add_on">Add-on</SelectItem><SelectItem value="upgrade">Upgrade</SelectItem><SelectItem value="recurring">Recurring offer</SelectItem></SelectContent></Select></div>
       <div className="space-y-1"><Label>How should the price work?</Label><Select value={offerDraft.price_mode} onValueChange={v=>setO('price_mode',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{offerDraft.offer_type!=='package'&&<SelectItem value="quotation">Price confirmed after review</SelectItem>}<SelectItem value="fixed">{offerDraft.offer_type==='package'?'Fixed package price':'Fixed amount added'}</SelectItem>{offerDraft.offer_type!=='package'&&<><SelectItem value="percentage_discount">Percentage discount</SelectItem><SelectItem value="fixed_discount">Fixed amount discount</SelectItem></>}</SelectContent></Select></div>
       {offerDraft.offer_type!=='package'&&<div className="space-y-1"><Label>{offerDraft.price_mode==='percentage_discount'?'Discount percentage (%)':'Amount (KES)'}</Label><Input type="number" min="0" step="0.01" disabled={offerDraft.price_mode==='quotation'} value={offerDraft.price_value} onChange={e=>setO('price_value',e.target.value)}/></div>}
       <div className="space-y-1 sm:col-span-2"><Label>Short description customers will see</Label><Textarea rows={2} value={offerDraft.description} onChange={e=>setO('description',e.target.value)}/></div>
       <div className="flex items-center gap-2"><Switch checked={offerDraft.featured} onCheckedChange={v=>setO('featured',v)}/><Label>Feature this package</Label></div>
       {offerDraft.offer_type!=='package'&&<div className="flex items-center gap-2"><Switch checked={offerDraft.active} onCheckedChange={v=>setO('active',v)}/><Label>Publish for customers</Label></div>}
      </div>
      <div className="space-y-1"><Label>Find services</Label><Input value={serviceSearch} onChange={e=>setServiceSearch(e.target.value)} placeholder="Search services by name…"/></div>
      {offerDraft.offer_type!=='package'&&<div className="grid gap-2 md:grid-cols-3">{servicePicker('trigger','Which service should customers start with?')}{servicePicker('included','Which service(s) should be complimentary?')}{servicePicker('recommended','Optional additions to suggest')}</div>}
      <details className="rounded-lg border p-3">
       <summary className="cursor-pointer text-sm font-semibold">Advanced settings (optional)</summary>
       <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Internal reference key</Label><Input value={offerDraft.offer_key} onChange={e=>setO('offer_key',e.target.value)}/><p className="text-xs text-muted-foreground">Generated automatically from the name. Change only if needed.</p></div>
        <div className="space-y-1"><Label>Display order</Label><Input type="number" value={offerDraft.display_order} onChange={e=>setO('display_order',e.target.value)}/></div>
        <div className="space-y-1 sm:col-span-2"><Label>Terms and eligibility notes</Label><Textarea rows={2} value={offerDraft.terms} onChange={e=>setO('terms',e.target.value)}/></div>
        <div className="space-y-1"><Label>Publish from (optional)</Label><Input type="datetime-local" value={offerDraft.starts_at} onChange={e=>setO('starts_at',e.target.value)}/></div>
        <div className="space-y-1"><Label>Stop publishing (optional)</Label><Input type="datetime-local" value={offerDraft.ends_at} onChange={e=>setO('ends_at',e.target.value)}/></div>
       </div>
      </details>
      <p className="text-xs text-muted-foreground">For packages, configure the exact service sizes, quantities and package-specific prices in the editor above. Saving package details returns the package to draft; use Approve & publish only after its final price and contents are complete.</p>
      <div className="flex flex-wrap gap-2"><Button onClick={()=>void saveOffer()} disabled={saving}>{saving?'Saving…':'Save package / offer'}</Button><Button variant="outline" onClick={()=>{setEditingOffer(null);setOfferDraft(emptyOfferDraft());setOfferServiceLinks({trigger:[],included:[],recommended:[]});}}>New offer</Button></div>
     </CardContent></Card>
    </div>
   </TabsContent>
  </Tabs>}
 </div>;
}