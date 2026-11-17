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
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, CirclePlus, ClipboardCheck, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import AdminBookingEngineRequests from '@/pages/admin/AdminBookingEngineRequests';

const db = supabase as any;
type Row = { id: string; [key: string]: any };
type Service = { id: string; name: string; service_code: string | null; is_active: boolean; service_category?: { name: string } | null };
type Config = { id: string; service_id: string; enabled: boolean; customer_instructions: string | null; photo_mode: string; photo_min: number; photo_max: number; measurement_config: any; availability_config: any; config_version: number };
const parseObj = (s: string) => { const x = JSON.parse(s); if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Expected a JSON object.'); return x; };

export default function AdminBookingEngine() {
 const [services,setServices]=useState<Service[]>([]),[configs,setConfigs]=useState<Config[]>([]);
 const [serviceId,setServiceId]=useState(''),[config,setConfig]=useState<Config|null>(null);
 const [viewMode,setViewMode]=useState<'guide'|'advanced'>('guide'),[activeTab,setActiveTab]=useState('setup');
 const [setupProgress,setSetupProgress]=useState<any>(null),[setupProgressLoading,setSetupProgressLoading]=useState(false),[approvingStep,setApprovingStep]=useState<string|null>(null);
 const [questions,setQuestions]=useState<Row[]>([]),[conditions,setConditions]=useState<Row[]>([]),[scope,setScope]=useState<Row[]>([]),[pricing,setPricing]=useState<Row[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [instructions,setInstructions]=useState(''),[photoMode,setPhotoMode]=useState('none'),[photoMin,setPhotoMin]=useState('0'),[photoMax,setPhotoMax]=useState('0'),[measurements,setMeasurements]=useState('{}'),[availability,setAvailability]=useState('{}');
 const [qLabel,setQLabel]=useState(''),[qKey,setQKey]=useState(''),[qDesc,setQDesc]=useState(''),[qType,setQType]=useState('text'),[qRequired,setQRequired]=useState(false),[qOptions,setQOptions]=useState('[]');
 const [scopeType,setScopeType]=useState('included'),[scopeTitle,setScopeTitle]=useState(''),[scopeDesc,setScopeDesc]=useState('');
 const [priceType,setPriceType]=useState('quotation'),[priceRate,setPriceRate]=useState(''),[priceUnit,setPriceUnit]=useState(''),[priceMin,setPriceMin]=useState(''),[priceMax,setPriceMax]=useState('');
 const [target,setTarget]=useState(''),[source,setSource]=useState(''),[operator,setOperator]=useState('equals'),[expected,setExpected]=useState(''),[action,setAction]=useState('show');
 const selected=useMemo(()=>services.find(x=>x.id===serviceId)??null,[services,serviceId]);

 const refresh=useCallback(async()=>{
  setLoading(true);
  const [s,c]=await Promise.all([
   db.from('services').select('id,name,service_code,is_active,category_id,service_category:service_categories!services_category_id_fkey(name)').order('name'),
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
   if(photoMode==='required')return 'Required photo upload is not available yet. Keep photo mode optional or none.';
   const activeRules=pricing.filter(x=>x.active);
   if(activeRules.some(x=>['per_unit','tiered'].includes(x.pricing_type))&&measurementConfig?.quantity?.enabled!==true)return 'Per-unit and tiered pricing require measurement_config.quantity.enabled=true and a customer-facing quantity label.';
   for(const rule of activeRules.filter(x=>x.pricing_type==='per_measurement')){
    if(!questions.some(q=>q.input_type==='measurement'&&q.question_key===rule.unit_key))return 'Add a measurement question whose key exactly matches pricing unit key: '+rule.unit_key;
   }
   if(activeRules.some(x=>x.pricing_type==='per_unit'&&(x.minimum_quantity!==null||x.maximum_quantity!==null)))return 'Per-unit min/max quantity limits are not enforced by the current pricing RPC. Use tiered pricing for bounded quantities.';
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
  if(config.enabled&&qRequired){toast({title:'Required questions are not ready for activation',description:'The database submit function does not yet enforce required answers. Keep this question optional until server-side validation is added.',variant:'destructive'});return;}let opts:any;try{opts=JSON.parse(qOptions);if(!Array.isArray(opts))throw new Error('Options must be a JSON array.');}catch(e){toast({title:'Invalid options',description:e instanceof Error?e.message:'Check options.',variant:'destructive'});return;}
  if(['select','multi_select'].includes(qType)&&!opts.length){toast({title:'Add options for this question'});return;}
  const r=await db.from('booking_engine_questions').insert({service_config_id:config.id,question_key:qKey.trim().toLowerCase().replace(/\\s+/g,'_'),label:qLabel.trim(),description:qDesc.trim()||null,input_type:qType,required:qRequired,display_order:questions.length,options:opts}).select('*').single();
  if(r.error)toast({title:'Question not added',description:r.error.message,variant:'destructive'});else{await bumpVersion();setQuestions(x=>[...x,r.data]);setQLabel('');setQKey('');setQDesc('');setQOptions('[]');setQRequired(false);}
 };
 const remove=async(table:string,id:string,update:(fn:any)=>void)=>{if(!window.confirm('Delete this configuration item?'))return;const r=await db.from(table).delete().eq('id',id);if(r.error)toast({title:'Delete failed',description:r.error.message,variant:'destructive'});else{update((x:Row[])=>x.filter(y=>y.id!==id));if(table==='booking_engine_questions')setConditions(x=>x.filter(y=>y.question_id!==id&&y.depends_on_question_id!==id));await bumpVersion();}};
 const addScope=async()=>{if(!config||!scopeTitle.trim())return;const r=await db.from('booking_engine_service_scope').insert({service_config_id:config.id,scope_type:scopeType,title:scopeTitle.trim(),description:scopeDesc.trim()||null,display_order:scope.filter(x=>x.scope_type===scopeType).length}).select('*').single();if(r.error)toast({title:'Scope item not added',description:r.error.message,variant:'destructive'});else{await bumpVersion();setScope(x=>[...x,r.data]);setScopeTitle('');setScopeDesc('');}};
 const addPricing=async()=>{
  if(!config)return;
  if(config.enabled&&['per_unit','tiered'].includes(priceType)){let m:any;try{m=parseObj(measurements);}catch{toast({title:'Measurement configuration must be valid JSON'});return;}if(m.quantity?.enabled!==true){toast({title:'Quantity input is not configured',description:'Set measurement_config.quantity.enabled to true before adding per-unit or tiered pricing to an enabled service.',variant:'destructive'});return;}}
  if(config.enabled&&priceType==='per_measurement'&&!questions.some(q=>q.input_type==='measurement'&&q.question_key===priceUnit.trim())){toast({title:'Measurement question is missing',description:'Add a measurement question whose key matches the pricing unit key before adding this rule.',variant:'destructive'});return;}
  if(config.enabled&&priceType==='per_unit'&&(priceMin.trim()||priceMax.trim())){toast({title:'Use tiered pricing for quantity limits',description:'The current per-unit pricing RPC does not enforce min/max quantity fields.',variant:'destructive'});return;}
  const rate=priceType==='quotation'?null:Number(priceRate),min=priceMin.trim()?Number(priceMin):null,max=priceMax.trim()?Number(priceMax):null;
  if(priceType!=='quotation'&&(!priceRate.trim()||!Number.isFinite(rate)||rate!<0)){toast({title:'Enter an approved rate or choose quotation pricing'});return;}
  if((min!==null&&(!Number.isFinite(min)||min<0))||(max!==null&&(!Number.isFinite(max)||max<0))||(min!==null&&max!==null&&min>max)){toast({title:'Check quantity limits'});return;}
  const r=await db.from('booking_engine_pricing_rules').insert({service_config_id:config.id,pricing_type:priceType,rate,unit_key:priceUnit.trim()||null,minimum_quantity:min,maximum_quantity:max,currency:'KES',version:Math.max(0,...pricing.map(x=>Number(x.version)||0))+1,active:true,created_by:(await supabase.auth.getUser()).data.user?.id??null}).select('*').single();
  if(r.error)toast({title:'Pricing not added',description:r.error.message,variant:'destructive'});else{await bumpVersion();setPricing(x=>[r.data,...x]);setPriceRate('');setPriceUnit('');setPriceMin('');setPriceMax('');}
 };
 const addCondition=async()=>{if(config?.enabled&&action==='required'){toast({title:'Required conditions are not ready',description:'The database submit function does not yet enforce conditional required answers.',variant:'destructive'});return;}if(!target||!source||target===source||!expected.trim())return;let value:any;try{value=JSON.parse(expected);}catch{value=expected;}const r=await db.from('booking_engine_question_conditions').insert({question_id:target,depends_on_question_id:source,operator,expected_value:value,action}).select('*').single();if(r.error)toast({title:'Condition not added',description:r.error.message,variant:'destructive'});else{await bumpVersion();setConditions(x=>[...x,r.data]);setExpected('');}};
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
  {key:'instructions',title:'Service instructions & requirements',description:'Review customer instructions, photo requirements, measurements and availability settings.',tab:'setup',button:'Open instructions'},
  {key:'questions',title:'Customer questions',description:'Add and review the questions customers must answer so your team can understand the job.',tab:'questions',button:'Open customer questions'},
  {key:'pricing',title:'Booking price method',description:'Choose the correct pricing method and add only approved rates or staff quotation rules.',tab:'pricing',button:'Open pricing setup'},
  {key:'scope',title:'Included service scope',description:'Define what is included, excluded and available as an extra. At least one included item is required.',tab:'scope',button:'Open service scope'},
  {key:'offers',title:'Packages & value offers',description:'Review packages, add-ons and upgrades mapped to the exact services. This step is optional and can be explicitly skipped.',tab:'library',button:'Open packages & offers'},
  {key:'final_review',title:'Final review & approval',description:'Review the completed configuration. Approval is required before the service can be enabled.',tab:null,button:'Review configuration'},
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
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Smart Booking Engine</h1><p className="text-sm text-muted-foreground">Set up online bookings one clear step at a time.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>{config&&<Button variant={viewMode==='guide'?'default':'outline'} onClick={()=>setViewMode(viewMode==='guide'?'advanced':'guide')}>{viewMode==='guide'?'Advanced Setup':'Back to Setup Guide'}</Button>}</div></div>
  <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="flex gap-3 p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-600"/><div><b>Nothing is enabled automatically.</b><p className="text-muted-foreground">The guide checks the selected service's real configuration. It will not invent prices, questions, service mappings or offers, and existing ERP service prices remain untouched.</p></div></CardContent></Card>
  <div className="grid gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
   <Card className="h-fit"><CardHeader><CardTitle className="text-base">1. Choose a service</CardTitle><p className="text-xs text-muted-foreground">Select the service you want to configure.</p></CardHeader><CardContent className="space-y-2">{loading?'Loading services…':services.map(s=>{const c=configs.find(x=>x.service_id===s.id);return <button key={s.id} onClick={()=>{setServiceId(s.id);setViewMode('guide');}} className={'w-full rounded-lg border p-3 text-left '+(serviceId===s.id?'border-primary bg-primary/5':'hover:bg-muted/50')}><span className="block text-sm font-medium">{s.name}</span><span className="mt-1 flex gap-1 text-xs text-muted-foreground">{s.service_code||'No code'} <Badge variant={c?.enabled?'default':'secondary'}>{c?.enabled?'Enabled':c?'Disabled':'Not configured'}</Badge></span></button>;})}</CardContent></Card>
   <div className="min-w-0 space-y-4">
    {!selected?<Card><CardContent className="p-8 text-center text-muted-foreground">Select a service to begin.</CardContent></Card>:!config?<Card><CardHeader><CardTitle>Start setup: {selected.name}</CardTitle><p className="text-sm text-muted-foreground">First create a disabled Smart Booking configuration. This does not publish the service or change its ERP price.</p></CardHeader><CardContent className="space-y-4"><div className="flex items-start gap-3 rounded-lg border p-4"><ClipboardCheck className="mt-0.5 h-5 w-5 text-primary"/><div className="space-y-1"><b className="text-sm">What happens next?</b><p className="text-sm text-muted-foreground">You will add customer questions, choose a pricing method, define included work and optionally create value offers. The guide will show which parts are complete.</p></div></div><Button onClick={()=>void create()} disabled={saving}>{saving?'Creating…':'Create configuration and continue'}<ArrowRight className="ml-2 h-4 w-4"/></Button></CardContent></Card>:viewMode==='guide'?<>
    <Card><CardHeader><div className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4"/>INTELLIGENT SETUP WIZARD</div><CardTitle className="text-xl">Set up {selected.name}</CardTitle><p className="text-sm text-muted-foreground">Complete each step, save your work, review it and approve it before moving forward. Your approvals are saved to the database.</p></CardHeader><CardContent className="space-y-4">
     {setupProgressLoading?<p className="text-sm text-muted-foreground">Loading saved approvals…</p>:!setupProgress?<div className="rounded-lg border p-4 text-sm text-muted-foreground">Setup approval status could not be loaded. Refresh the page or try again before continuing.</div>:<>
      <div className="rounded-lg bg-muted/50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Your progress</p><p className="text-xs text-muted-foreground">Six approvals are required. The next step unlocks only after the current step is approved.</p></div><Badge variant={allStepsApproved?'default':'secondary'}>{allStepsApproved?'All steps approved':stepStates.filter(x=>x.approved).length+' of 6 approved'}</Badge></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-all" style={{width:((stepStates.filter(x=>x.approved).length/6)*100)+'%'}}/></div></div>
      <div className="space-y-3">{setupStepDefinitions.map((step,index)=>{const state=stepStates.find(x=>x.key===step.key);const approved=Boolean(state?.approved);const current=Boolean(state?.current);const locked=!approved&&!current;return <div key={step.key} className={'rounded-lg border p-3 sm:p-4 '+(current?'border-primary bg-primary/5':'')}><div className="flex gap-3"><div className="pt-0.5">{approved?<CheckCircle2 className="h-5 w-5 text-green-600"/>:locked?<Circle className="h-5 w-5 text-muted-foreground"/>:<ClipboardCheck className="h-5 w-5 text-primary"/>}</div><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{index+1}. {step.title}</p><Badge variant={approved?'default':current?'secondary':'outline'}>{approved?(state?.skipped?'Skipped — approved':'Approved'):current?'Current step':'Locked'}</Badge></div><p className="text-sm text-muted-foreground">{step.description}</p>{approved&&state?.approved_at&&<p className="text-xs text-muted-foreground">Approved {new Date(state.approved_at).toLocaleString()}</p>}<div className="flex flex-wrap gap-2">{step.tab&&<Button size="sm" variant="outline" disabled={locked} onClick={()=>openStep(step.tab!)}>{approved?'Review settings':step.button}<ArrowRight className="ml-2 h-4 w-4"/></Button>}{current&&<Button size="sm" disabled={approvingStep!==null} onClick={()=>void approveStep(step.key)}>{approvingStep===step.key?'Approving…':'Approve and continue'}<CheckCircle2 className="ml-2 h-4 w-4"/></Button>}{current&&step.key==='offers'&&<Button size="sm" variant="ghost" disabled={approvingStep!==null} onClick={()=>void approveStep('offers',true)}>Skip optional step</Button>}</div></div></div></div>;})}</div>
      <div className="rounded-lg border p-4 space-y-3"><div><p className="font-semibold text-sm">Final activation check</p><p className="text-sm text-muted-foreground">After all six steps have been approved, you can enable Smart Booking for this service. Approval does not publish or enable it by itself.</p></div>{readinessIssues.length>0?<div className="space-y-2"><p className="text-sm font-medium">Configuration items still to resolve:</p>{readinessIssues.map((issue,i)=><div key={i} className="flex gap-2 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"/><span>{issue}</span></div>)}</div>:<p className="text-sm text-green-700">The configuration passes the current readiness checks.</p>}<div className="flex flex-wrap items-center gap-2"><Button onClick={()=>void activate(true)} disabled={!isReady||!allStepsApproved||config.enabled}>{config.enabled?'Service already enabled':allStepsApproved?'Enable approved service':'Complete all approvals to enable'}</Button>{config.enabled&&<Badge variant="default">Currently enabled</Badge>}</div>{!allStepsApproved&&currentStepKey&&<p className="text-xs text-muted-foreground">Next required approval: {setupStepDefinitions.find(x=>x.key===currentStepKey)?.title||currentStepKey}.</p>}</div>
     </>}
    </CardContent></Card>
    </>:<>
     <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b>{selected.name}</b><p className="text-xs text-muted-foreground">Version {config.config_version} · {selected.service_category?.name||'Category not assigned'}</p></div><div className="flex items-center gap-2"><Badge variant={config.enabled?'default':'secondary'}>{config.enabled?'Enabled':'Disabled'}</Badge><Button size="sm" variant={config.enabled?'destructive':'default'} onClick={()=>void activate(!config.enabled)}>{config.enabled?'Disable':'Review & enable'}</Button></div></CardContent></Card>
     <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-sm">Advanced configuration</p><p className="text-xs text-muted-foreground">Use these tabs to make detailed changes to the selected service.</p></div><Button size="sm" variant="outline" onClick={()=>setViewMode('guide')}>Back to guided setup</Button></div>
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
      <TabsContent value="pricing"><div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Pricing versions</CardTitle><p className="text-sm text-muted-foreground">Booking Engine pricing only. Existing ERP service prices are untouched.</p></CardHeader><CardContent className="space-y-2">{pricing.map(rule=><div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><div><b className="text-sm">{rule.pricing_type.replace('_',' ')}{rule.rate!==null?' · KES '+Number(rule.rate).toLocaleString():' · Staff quotation'}</b><p className="text-xs text-muted-foreground">Version {rule.version}{rule.unit_key?' · per '+rule.unit_key:''}{rule.minimum_quantity!==null?' · min '+rule.minimum_quantity:''}{rule.maximum_quantity!==null?' · max '+rule.maximum_quantity:''}</p></div><div className="flex items-center gap-2"><Badge variant={rule.active?'default':'secondary'}>{rule.active?'Active':'Inactive'}</Badge><Button size="sm" variant="outline" onClick={async()=>{const r=await db.from('booking_engine_pricing_rules').update({active:!rule.active,updated_by:(await supabase.auth.getUser()).data.user?.id??null,updated_at:new Date().toISOString()}).eq('id',rule.id).select('*').single();if(r.error)toast({title:'Pricing update failed',description:r.error.message,variant:'destructive'});else{setPricing(x=>x.map(y=>y.id===rule.id?r.data:y));await bumpVersion();}}}>{rule.active?'Deactivate':'Reactivate'}</Button></div></div>)}{!pricing.length&&<p className="text-sm text-muted-foreground">No pricing rules configured.</p>}</CardContent></Card>
       <Card><CardHeader><CardTitle className="text-base">Add pricing rule</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Pricing model</Label><Select value={priceType} onValueChange={setPriceType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['fixed','per_unit','per_measurement','tiered','quotation'].map(x=><SelectItem key={x} value={x}>{x.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Rate (KES)</Label><Input type="number" min="0" step="0.01" disabled={priceType==='quotation'} value={priceRate} onChange={e=>setPriceRate(e.target.value)}/></div><div className="space-y-1"><Label>Unit / measurement key</Label><Input value={priceUnit} onChange={e=>setPriceUnit(e.target.value)} placeholder="e.g. room, seat, sqm"/></div><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Min quantity</Label><Input type="number" min="0" value={priceMin} onChange={e=>setPriceMin(e.target.value)}/></div><div className="space-y-1"><Label>Max quantity</Label><Input type="number" min="0" value={priceMax} onChange={e=>setPriceMax(e.target.value)}/></div></div><div className="sm:col-span-2"><Button onClick={()=>void addPricing()}><CirclePlus className="mr-2 h-4 w-4"/>Add versioned pricing</Button></div></CardContent></Card></div></TabsContent>
      <TabsContent value="library"><BookingEngineLibrary services={services} configs={configs} /></TabsContent>
     </Tabs>
     <Card><CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-3"><div>{questions.length} questions</div><div>{activeIncluded} active included scope items</div><div>{activePricing} active pricing rules</div></CardContent></Card>
    </>}
   </div>
  </div>
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

function BookingEngineLibrary({ services, configs }: { services: Service[]; configs: Config[] }) {
 const [templates,setTemplates]=useState<LibraryTemplate[]>([]);
 const [offers,setOffers]=useState<LibraryOffer[]>([]);
 const [offerLinks,setOfferLinks]=useState<Record<string,OfferLink[]>>({});
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
  setTemplates((t.data||[]) as LibraryTemplate[]);setOffers(offerRows);setOfferLinks(grouped);setLoading(false);
 },[]);
 useEffect(()=>{void reload();},[reload]);

 const serviceName=(id:string)=>services.find(x=>x.id===id)?.name||'Unavailable service';
 const configuredServices=configs.map(c=>({config:c,service:services.find(s=>s.id===c.service_id)})).filter(x=>x.service?.is_active);
 const filteredServices=services.filter(s=>s.is_active&&(!serviceSearch.trim()||s.name.toLowerCase().includes(serviceSearch.toLowerCase())||(s.service_code||'').toLowerCase().includes(serviceSearch.toLowerCase())));
 const setT=(key:string,value:any)=>setTemplateDraft(old=>({...old,[key]:value}));
 const setO=(key:string,value:any)=>setOfferDraft(old=>({...old,[key]:value}));

 const editTemplate=(t:LibraryTemplate)=>{
  setEditingTemplate(t.id);setSelectedTemplateId(t.id);
  setTemplateDraft({question_key:t.question_key,label:t.label,description:t.description||'',input_type:t.input_type,required_default:t.required_default,options:JSON.stringify(t.options||[],null,2),validation_rules:JSON.stringify(t.validation_rules||{},null,2),prompt_group:t.prompt_group||'',display_order:String(t.display_order),active:t.active});
 };
 const saveTemplate=async()=>{
  if(!templateDraft.label.trim()||!templateDraft.question_key.trim()){toast({title:'Enter a question label and unique key'});return;}
  let options:any,validation:any;
  try{options=JSON.parse(templateDraft.options);validation=JSON.parse(templateDraft.validation_rules);if(!Array.isArray(options)||!validation||typeof validation!=='object'||Array.isArray(validation))throw new Error('Options must be an array and validation rules must be an object.');}
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
   const sync=await db.from('booking_engine_questions').update({question_key:payload.question_key,label:payload.label,description:payload.description,input_type:payload.input_type,required:payload.required_default,options:payload.options,active:payload.active,updated_at:new Date().toISOString()}).eq('question_template_id',editingTemplate);
   if(sync.error){toast({title:'Template saved; applied questions need a refresh',description:sync.error.message,variant:'destructive'});}
  }
  setSelectedTemplateId(result.data.id);setEditingTemplate(result.data.id);await reload();toast({title:'Question template saved'});setSaving(false);
 };
 const applyTemplate=async()=>{
  const template=templates.find(x=>x.id===selectedTemplateId);
  if(!template||!template.active){toast({title:'Select an active question template'});return;}
  if(!selectedConfigIds.length){toast({title:'Select at least one configured service'});return;}
  const rows=selectedConfigIds.map(id=>({service_config_id:id,question_template_id:template.id,question_key:template.question_key,label:template.label,description:template.description,input_type:template.input_type,required:template.required_default,display_order:template.display_order,options:template.options||[],active:true}));
  setSaving(true);
  const r=await db.from('booking_engine_questions').upsert(rows,{onConflict:'service_config_id,question_template_id'}).select('id');
  if(r.error)toast({title:'Could not apply question template',description:r.error.message,variant:'destructive'});
  else{toast({title:'Question applied',description:'Applied or updated on '+selectedConfigIds.length+' selected service configuration(s).'});setSelectedConfigIds([]);}
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
  setOfferServiceLinks(old=>({...old,[relationship]:checked?[...old[relationship],id]:old[relationship].filter(x=>x!==id)}));
 };
 const saveOffer=async()=>{
  const key=makeKey(offerDraft.offer_key||offerDraft.title);
  if(!key||!offerDraft.title.trim()||!offerServiceLinks.trigger.length){toast({title:'Add a title and at least one triggering service'});return;}
  if(offerDraft.offer_type==='package'&&!offerServiceLinks.included.length){toast({title:'A package needs at least one included service'});return;}
  const order=Number(offerDraft.display_order),amount=offerDraft.price_mode==='quotation'?null:Number(offerDraft.price_value);
  if(!Number.isInteger(order)|| (amount!==null&&(!Number.isFinite(amount)||amount<0)) || (amount===null&&offerDraft.price_mode!=='quotation')){toast({title:'Check the offer display order and price'});return;}
  const user=(await supabase.auth.getUser()).data.user?.id??null;
  const payload={offer_key:key,offer_type:offerDraft.offer_type,title:offerDraft.title.trim(),description:offerDraft.description.trim()||null,terms:offerDraft.terms.trim()||null,price_mode:offerDraft.price_mode,price_value:amount,currency:'KES',active:offerDraft.active,featured:offerDraft.featured,starts_at:offerDraft.starts_at?new Date(offerDraft.starts_at).toISOString():null,ends_at:offerDraft.ends_at?new Date(offerDraft.ends_at).toISOString():null,display_order:order,updated_by:user,updated_at:new Date().toISOString()};
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
  const links=offerLinks[o.id]||[];
  if(!o.active&&(!links.some(x=>x.relationship==='trigger')||(o.offer_type==='package'&&!links.some(x=>x.relationship==='included')))){toast({title:'Complete the offer service links before activating it'});return;}
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
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Reusable booking configuration</h3><p className="text-sm text-muted-foreground">Build questions and offers once, then explicitly apply them to services by ID.</p></div><Button variant="outline" size="sm" onClick={()=>void reload()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh library</Button></div>
  {loading?<p className="text-sm text-muted-foreground">Loading library…</p>:<Tabs defaultValue="templates" className="space-y-4">
   <TabsList><TabsTrigger value="templates">Question templates ({templates.length})</TabsTrigger><TabsTrigger value="offers">Packages & offers ({offers.length})</TabsTrigger></TabsList>
   <TabsContent value="templates" className="space-y-4">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
     <Card><CardHeader><CardTitle className="text-base">Question library</CardTitle></CardHeader><CardContent className="space-y-2">{templates.map(t=><div key={t.id} className={'rounded-lg border p-3 '+(selectedTemplateId===t.id?'border-primary bg-primary/5':'')}><div className="flex items-start justify-between gap-2"><button className="min-w-0 text-left" onClick={()=>editTemplate(t)}><b className="text-sm">{t.label}</b><p className="text-xs text-muted-foreground">{t.question_key} · {t.input_type} · {t.prompt_group||'General'}</p></button><div className="flex items-center gap-2"><Badge variant={t.active?'default':'secondary'}>{t.active?'Active':'Inactive'}</Badge><Button size="icon" variant="ghost" onClick={()=>editTemplate(t)}><Save className="h-4 w-4"/></Button><Button size="icon" variant="ghost" onClick={()=>void removeTemplate(t)}><Trash2 className="h-4 w-4"/></Button></div></div>{t.description&&<p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}</div>)}{!templates.length&&<p className="text-sm text-muted-foreground">No question templates yet.</p>}</CardContent></Card>
     <Card><CardHeader><CardTitle className="text-base">{editingTemplate?'Edit question template':'Create question template'}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label>Question label</Label><Input value={templateDraft.label} onChange={e=>{setT('label',e.target.value);if(!editingTemplate)setT('question_key',makeKey(e.target.value));}}/></div>
      <div className="space-y-1"><Label>Unique question key</Label><Input value={templateDraft.question_key} onChange={e=>setT('question_key',e.target.value)}/></div>
      <div className="space-y-1"><Label>Answer type</Label><Select value={templateDraft.input_type} onValueChange={v=>setT('input_type',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['text','textarea','number','boolean','select','multi_select','measurement','date'].map(v=><SelectItem key={v} value={v}>{v.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Question group (free text)</Label><Input value={templateDraft.prompt_group} onChange={e=>setT('prompt_group',e.target.value)}/></div>
      <div className="space-y-1 sm:col-span-2"><Label>Help text</Label><Input value={templateDraft.description} onChange={e=>setT('description',e.target.value)}/></div>
      <div className="space-y-1"><Label>Display order</Label><Input type="number" value={templateDraft.display_order} onChange={e=>setT('display_order',e.target.value)}/></div>
      <div className="flex items-center gap-2 pt-6"><Switch checked={templateDraft.required_default} onCheckedChange={v=>setT('required_default',v)}/><Label>Required by default</Label></div>
      <div className="flex items-center gap-2 sm:col-span-2"><Switch checked={templateDraft.active} onCheckedChange={v=>setT('active',v)}/><Label>Available in library</Label></div>
      <div className="space-y-1 sm:col-span-2"><Label>Options (JSON array for select questions)</Label><Textarea rows={4} className="font-mono text-xs" value={templateDraft.options} onChange={e=>setT('options',e.target.value)}/></div>
      <div className="space-y-1 sm:col-span-2"><Label>Validation rules (JSON object)</Label><Textarea rows={3} className="font-mono text-xs" value={templateDraft.validation_rules} onChange={e=>setT('validation_rules',e.target.value)}/></div>
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
     <Card><CardHeader><CardTitle className="text-base">Packages and value offers</CardTitle></CardHeader><CardContent className="space-y-2">{offers.map(o=><div key={o.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="text-sm">{o.title}</b><p className="text-xs text-muted-foreground">{o.offer_key} · {o.offer_type.replace('_',' ')} · {o.price_mode.replace('_',' ')}</p><p className="text-xs text-muted-foreground">{(offerLinks[o.id]||[]).filter(x=>x.relationship==='trigger').length} trigger · {(offerLinks[o.id]||[]).filter(x=>x.relationship==='included').length} included · {(offerLinks[o.id]||[]).filter(x=>x.relationship==='recommended').length} recommended</p></div><div className="flex items-center gap-1"><Switch checked={o.active} onCheckedChange={()=>void toggleOffer(o)}/><Button size="icon" variant="ghost" onClick={()=>void editOffer(o)}><Save className="h-4 w-4"/></Button><Button size="icon" variant="ghost" onClick={()=>void deleteOffer(o)}><Trash2 className="h-4 w-4"/></Button></div></div>{o.description&&<p className="mt-1 text-xs text-muted-foreground">{o.description}</p>}</div>)}{!offers.length&&<p className="text-sm text-muted-foreground">No offers or packages created yet. Nothing is advertised automatically.</p>}</CardContent></Card>
     <Card><CardHeader><CardTitle className="text-base">{editingOffer?'Edit package / offer':'Create package / offer'}</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Offer title</Label><Input value={offerDraft.title} onChange={e=>{setO('title',e.target.value);if(!editingOffer)setO('offer_key',makeKey(e.target.value));}}/></div><div className="space-y-1"><Label>Unique key</Label><Input value={offerDraft.offer_key} onChange={e=>setO('offer_key',e.target.value)}/></div>
       <div className="space-y-1"><Label>Type</Label><Select value={offerDraft.offer_type} onValueChange={v=>setO('offer_type',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['add_on','package','upgrade','recurring'].map(v=><SelectItem key={v} value={v}>{v.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
       <div className="space-y-1"><Label>Price / offer model</Label><Select value={offerDraft.price_mode} onValueChange={v=>setO('price_mode',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['quotation','fixed','percentage_discount','fixed_discount'].map(v=><SelectItem key={v} value={v}>{v.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
       <div className="space-y-1"><Label>Configured value (KES or %)</Label><Input type="number" min="0" step="0.01" disabled={offerDraft.price_mode==='quotation'} value={offerDraft.price_value} onChange={e=>setO('price_value',e.target.value)}/></div>
       <div className="space-y-1"><Label>Display order</Label><Input type="number" value={offerDraft.display_order} onChange={e=>setO('display_order',e.target.value)}/></div>
       <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={offerDraft.description} onChange={e=>setO('description',e.target.value)}/></div>
       <div className="space-y-1 sm:col-span-2"><Label>Terms and eligibility notes</Label><Textarea rows={2} value={offerDraft.terms} onChange={e=>setO('terms',e.target.value)}/></div>
       <div className="space-y-1"><Label>Starts (optional)</Label><Input type="datetime-local" value={offerDraft.starts_at} onChange={e=>setO('starts_at',e.target.value)}/></div>
       <div className="space-y-1"><Label>Ends (optional)</Label><Input type="datetime-local" value={offerDraft.ends_at} onChange={e=>setO('ends_at',e.target.value)}/></div>
       <div className="flex items-center gap-2"><Switch checked={offerDraft.featured} onCheckedChange={v=>setO('featured',v)}/><Label>Featured</Label></div>
       <div className="flex items-center gap-2"><Switch checked={offerDraft.active} onCheckedChange={v=>setO('active',v)}/><Label>Active / publish</Label></div>
      </div>
      <div className="space-y-1"><Label>Filter services</Label><Input value={serviceSearch} onChange={e=>setServiceSearch(e.target.value)} placeholder="Search current services…"/></div>
      <div className="grid gap-2 md:grid-cols-3">{servicePicker('trigger','Show this offer when selected')}{servicePicker('included','Services included in this package')}{servicePicker('recommended','Complementary recommendations')}</div>
      <p className="text-xs text-muted-foreground">Service links use the live service IDs. Prices and discounts are only published as configured here; selecting an offer will not silently change the core service estimate.</p>
      <div className="flex flex-wrap gap-2"><Button onClick={()=>void saveOffer()} disabled={saving}>{saving?'Saving…':'Save package / offer'}</Button><Button variant="outline" onClick={()=>{setEditingOffer(null);setOfferDraft(emptyOfferDraft());setOfferServiceLinks({trigger:[],included:[],recommended:[]});}}>New offer</Button></div>
     </CardContent></Card>
    </div>
   </TabsContent>
  </Tabs>}
 </div>;
}