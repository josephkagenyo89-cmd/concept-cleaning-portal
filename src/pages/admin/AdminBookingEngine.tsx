import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, CirclePlus, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';

const db = supabase as any;
type Service = { id: string; name: string; service_code: string | null; is_active: boolean; category_id: string | null; service_category?: { name: string } | null };
type Config = { id: string; service_id: string; enabled: boolean; customer_instructions: string | null; photo_mode: string; photo_min: number; photo_max: number; measurement_config: any; availability_config: any; config_version: number };
type Row = { id: string; [key: string]: any };
const parseObject = (value: string) => { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Enter a valid JSON object.'); return parsed; };

export default function AdminBookingEngine() {
  const [services, setServices] = useState<Service[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [questions, setQuestions] = useState<Row[]>([]);
  const [scope, setScope] = useState<Row[]>([]);
  const [pricing, setPricing] = useState<Row[]>([]);
  const [conditions, setConditions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [photoMode, setPhotoMode] = useState('none');
  const [photoMin, setPhotoMin] = useState('0');
  const [photoMax, setPhotoMax] = useState('0');
  const [measurements, setMeasurements] = useState('{}');
  const [availability, setAvailability] = useState('{}');

  const [qLabel, setQLabel] = useState('');
  const [qKey, setQKey] = useState('');
  const [qDescription, setQDescription] = useState('');
  const [qType, setQType] = useState('text');
  const [qRequired, setQRequired] = useState(false);
  const [qOptions, setQOptions] = useState('[]');
  const [scopeType, setScopeType] = useState('included');
  const [scopeTitle, setScopeTitle] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [priceType, setPriceType] = useState('quotation');
  const [priceRate, setPriceRate] = useState('');
  const [priceUnit, setPriceUnit] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [conditionTarget, setConditionTarget] = useState('');
  const [conditionSource, setConditionSource] = useState('');
  const [conditionOperator, setConditionOperator] = useState('equals');
  const [conditionExpected, setConditionExpected] = useState('');
  const [conditionAction, setConditionAction] = useState('show');

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId]);

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    const [s, c] = await Promise.all([
      db.from('services').select('id,name,service_code,is_active,category_id,service_category:service_categories!services_category_id_fkey(name)').order('name'),
      db.from('booking_engine_service_config').select('*'),
    ]);
    if (s.error || c.error) {
      toast({ title: 'Booking Engine could not load', description: s.error?.message || c.error?.message, variant: 'destructive' });
    } else {
      setServices(s.data ?? []); setConfigs(c.data ?? []);
      setServiceId((current: string) => current && (s.data ?? []).some((x: Service) => x.id === current) ? current : (s.data?.[0]?.id ?? ''));
    }
    setLoading(false);
  }, []);

  const loadConfig = useCallback(async () => {
    const found = configs.find((x) => x.service_id === serviceId);
    setConfig(found ?? null);
    setQuestions([]); setScope([]); setPricing([]); setConditions([]);
    if (!found) return;
    setInstructions(found.customer_instructions ?? '');
    setPhotoMode(found.photo_mode); setPhotoMin(String(found.photo_min)); setPhotoMax(String(found.photo_max));
    setMeasurements(JSON.stringify(found.measurement_config ?? {}, null, 2));
    setAvailability(JSON.stringify(found.availability_config ?? {}, null, 2));
    const [q, s, p] = await Promise.all([
      db.from('booking_engine_questions').select('*').eq('service_config_id', found.id).order('display_order'),
      db.from('booking_engine_service_scope').select('*').eq('service_config_id', found.id).order('display_order'),
      db.from('booking_engine_pricing_rules').select('*').eq('service_config_id', found.id).order('created_at', { ascending: false }),
    ]);
    if (q.error || s.error || p.error) {
      toast({ title: 'Configuration details could not load', description: q.error?.message || s.error?.message || p.error?.message, variant: 'destructive' }); return;
    }
    setQuestions(q.data ?? []); setScope(s.data ?? []); setPricing(p.data ?? []);
    if ((q.data ?? []).length) {
      const result = await db.from('booking_engine_question_conditions').select('*').in('question_id', q.data.map((x: Row) => x.id));
      if (result.error) toast({ title: 'Conditional rules could not load', description: result.error.message, variant: 'destructive' });
      else setConditions(result.data ?? []);
    }
  }, [configs, serviceId]);

  useEffect(() => { void loadCatalogue(); }, [loadCatalogue]);
  useEffect(() => { void loadConfig(); }, [loadConfig]);

  const createConfig = async () => {
    setSaving(true);
    const result = await db.from('booking_engine_service_config').insert({ service_id: serviceId, enabled: false }).select('*').single();
    if (result.error) toast({ title: 'Could not create configuration', description: result.error.message, variant: 'destructive' });
    else { setConfigs((old) => [...old, result.data]); setConfig(result.data); toast({ title: 'Disabled configuration created', description: 'No public booking or pricing has been changed.' }); }
    setSaving(false);
  };

  const saveSetup = async () => {
    if (!config) return;
    let measurementConfig: any, availabilityConfig: any;
    try { measurementConfig = parseObject(measurements); availabilityConfig = parseObject(availability); }
    catch (error) { toast({ title: 'Invalid JSON', description: error instanceof Error ? error.message : 'Check your configuration.', variant: 'destructive' }); return; }
    const min = Number(photoMin), max = Number(photoMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || (photoMode === 'none' && (min !== 0 || max !== 0)) || (photoMode !== 'none' && max < 1)) {
      toast({ title: 'Invalid photo limits', description: 'Photo counts must match the selected photo mode.', variant: 'destructive' }); return;
    }
    setSaving(true);
    const result = await db.from('booking_engine_service_config').update({
      customer_instructions: instructions.trim() || null, photo_mode: photoMode, photo_min: min, photo_max: max,
      measurement_config: measurementConfig, availability_config: availabilityConfig,
      config_version: config.config_version + 1, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', config.id).select('*').single();
    if (result.error) toast({ title: 'Setup not saved', description: result.error.message, variant: 'destructive' });
    else { setConfig(result.data); setConfigs((old) => old.map((x) => x.id === result.data.id ? result.data : x)); toast({ title: 'Service setup saved' }); }
    setSaving(false);
  };

  const changeEnabled = async (enabled: boolean) => {
    if (!config) return;
    if (enabled) {
      if (!pricing.some((x) => x.active) || !scope.some((x) => x.active && x.scope_type === 'included')) {
        toast({ title: 'Configuration incomplete', description: 'Add an active pricing rule and at least one active included-scope item before enabling.', variant: 'destructive' }); return;
      }
      if (!window.confirm('Enable this service for Smart Booking? Confirm that its customer questions, scope, pricing and instructions have been reviewed and approved.')) return;
    } else if (!window.confirm('Disable this service for new Smart Booking requests? Existing requests will remain unchanged.')) return;
    setSaving(true);
    const result = await db.from('booking_engine_service_config').update({ enabled, config_version: config.config_version + 1, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', config.id).select('*').single();
    if (result.error) toast({ title: 'Activation update failed', description: result.error.message, variant: 'destructive' });
    else { setConfig(result.data); setConfigs((old) => old.map((x) => x.id === result.data.id ? result.data : x)); toast({ title: enabled ? 'Service enabled' : 'Service disabled' }); }
    setSaving(false);
  };

  const addQuestion = async () => {
    if (!config || !qLabel.trim() || !qKey.trim()) return;
    let options: any;
    try { options = JSON.parse(qOptions); if (!Array.isArray(options)) throw new Error('Options must be a JSON array.'); }
    catch (error) { toast({ title: 'Invalid options', description: error instanceof Error ? error.message : 'Enter a JSON array.', variant: 'destructive' }); return; }
    if (['select', 'multi_select'].includes(qType) && !options.length) { toast({ title: 'Options required', description: 'Select questions need at least one option.', variant: 'destructive' }); return; }
    const result = await db.from('booking_engine_questions').insert({
      service_config_id: config.id, question_key: qKey.trim().toLowerCase().replace(/\\s+/g, '_'),
      label: qLabel.trim(), description: qDescription.trim() || null, input_type: qType,
      required: qRequired, display_order: questions.length, options,
    }).select('*').single();
    if (result.error) toast({ title: 'Question not added', description: result.error.message, variant: 'destructive' });
    else { setQuestions((old) => [...old, result.data]); setQLabel(''); setQKey(''); setQDescription(''); setQOptions('[]'); setQRequired(false); toast({ title: 'Question added' }); }
  };

  const deleteQuestion = async (id: string) => {
    if (!window.confirm('Delete this question and any linked conditions?')) return;
    const result = await db.from('booking_engine_questions').delete().eq('id', id);
    if (result.error) toast({ title: 'Question not deleted', description: result.error.message, variant: 'destructive' });
    else { setQuestions((old) => old.filter((x) => x.id !== id)); setConditions((old) => old.filter((x) => x.question_id !== id && x.depends_on_question_id !== id)); }
  };

  const addScope = async () => {
    if (!config || !scopeTitle.trim()) return;
    const result = await db.from('booking_engine_service_scope').insert({
      service_config_id: config.id, scope_type: scopeType, title: scopeTitle.trim(),
      description: scopeDescription.trim() || null, display_order: scope.filter((x) => x.scope_type === scopeType).length,
    }).select('*').single();
    if (result.error) toast({ title: 'Scope item not added', description: result.error.message, variant: 'destructive' });
    else { setScope((old) => [...old, result.data]); setScopeTitle(''); setScopeDescription(''); }
  };

  const toggleScope = async (item: Row) => {
    const result = await db.from('booking_engine_service_scope').update({ active: !item.active, updated_at: new Date().toISOString() }).eq('id', item.id).select('*').single();
    if (result.error) toast({ title: 'Scope update failed', description: result.error.message, variant: 'destructive' });
    else setScope((old) => old.map((x) => x.id === item.id ? result.data : x));
  };

  const deleteScope = async (id: string) => {
    if (!window.confirm('Delete this scope item?')) return;
    const result = await db.from('booking_engine_service_scope').delete().eq('id', id);
    if (result.error) toast({ title: 'Scope item not deleted', description: result.error.message, variant: 'destructive' });
    else setScope((old) => old.filter((x) => x.id !== id));
  };

  const addPricing = async () => {
    if (!config) return;
    const rate = priceType === 'quotation' ? null : Number(priceRate);
    const min = priceMin.trim() ? Number(priceMin) : null, max = priceMax.trim() ? Number(priceMax) : null;
    if (priceType !== 'quotation' && (!priceRate.trim() || !Number.isFinite(rate) || (rate as number) < 0)) { toast({ title: 'Valid rate required', description: 'Enter an approved non-negative KES rate, or use quotation pricing.', variant: 'destructive' }); return; }
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)) || (min !== null && max !== null && min > max)) { toast({ title: 'Invalid quantity range' }); return; }
    const result = await db.from('booking_engine_pricing_rules').insert({
      service_config_id: config.id, pricing_type: priceType, rate, unit_key: priceUnit.trim() || null,
      minimum_quantity: min, maximum_quantity: max, currency: 'KES',
      version: Math.max(0, ...pricing.map((x) => Number(x.version) || 0)) + 1, active: true,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    }).select('*').single();
    if (result.error) toast({ title: 'Pricing rule not added', description: result.error.message, variant: 'destructive' });
    else { setPricing((old) => [result.data, ...old]); setPriceRate(''); setPriceUnit(''); setPriceMin(''); setPriceMax(''); toast({ title: 'New pricing version saved', description: 'Previous pricing versions are retained.' }); }
  };

  const togglePricing = async (rule: Row) => {
    const result = await db.from('booking_engine_pricing_rules').update({ active: !rule.active, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', rule.id).select('*').single();
    if (result.error) toast({ title: 'Pricing update failed', description: result.error.message, variant: 'destructive' });
    else setPricing((old) => old.map((x) => x.id === rule.id ? result.data : x));
  };

  const addCondition = async () => {
    if (!conditionTarget || !conditionSource || conditionTarget === conditionSource || !conditionExpected.trim()) { toast({ title: 'Complete the conditional rule fields' }); return; }
    let expected: any;
    try { expected = JSON.parse(conditionExpected); } catch { expected = conditionExpected; }
    const result = await db.from('booking_engine_question_conditions').insert({
      question_id: conditionTarget, depends_on_question_id: conditionSource, operator: conditionOperator,
      expected_value: expected, action: conditionAction,
    }).select('*').single();
    if (result.error) toast({ title: 'Condition not added', description: result.error.message, variant: 'destructive' });
    else { setConditions((old) => [...old, result.data]); setConditionExpected(''); }
  };

  const deleteCondition = async (id: string) => {
    if (!window.confirm('Delete this conditional rule?')) return;
    const result = await db.from('booking_engine_question_conditions').delete().eq('id', id);
    if (result.error) toast({ title: 'Condition not deleted', description: result.error.message, variant: 'destructive' });
    else setConditions((old) => old.filter((x) => x.id !== id));
  };

  const activePricing = pricing.filter((x) => x.active).length;
  const activeIncluded = scope.filter((x) => x.active && x.scope_type === 'included').length;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">Smart Booking Engine</h1><p className="text-sm text-muted-foreground">Configure service questions, conditional logic, scope, measurements and pricing.</p></div>
      <Button variant="outline" onClick={() => void loadCatalogue()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="flex gap-3 p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" /><div><b>Activation is manual.</b><p className="text-muted-foreground">New configurations remain disabled. No service mappings or prices are seeded or inferred from the ERP catalogue.</p></div></CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="h-fit"><CardHeader><CardTitle className="text-base">Service catalogue</CardTitle></CardHeader><CardContent className="space-y-2">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : services.map((service) => {
          const item = configs.find((x) => x.service_id === service.id);
          return <button key={service.id} type="button" onClick={() => setServiceId(service.id)} className={'w-full rounded-lg border p-3 text-left ' + (serviceId === service.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
            <span className="block text-sm font-medium">{service.name}</span><span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">{service.service_code || 'No service code'} <Badge variant={item?.enabled ? 'default' : 'secondary'}>{item?.enabled ? 'Enabled' : item ? 'Disabled' : 'Not configured'}</Badge></span>
          </button>;
        })}
      </CardContent></Card>
      <div className="min-w-0 space-y-4">
        {!selectedService ? <Card><CardContent className="p-8 text-center text-muted-foreground">Select a service.</CardContent></Card> :
        !config ? <Card><CardHeader><CardTitle>{selectedService.name}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Create a disabled configuration. This does not change the existing service price or public booking flow.</p><Button onClick={() => void createConfig()} disabled={saving}><CirclePlus className="mr-2 h-4 w-4" />Create configuration</Button></CardContent></Card> :
        <>
          <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b>{selectedService.name}</b><p className="text-xs text-muted-foreground">Version {config.config_version} · {selectedService.service_category?.name || 'Category not assigned'}</p></div><div className="flex items-center gap-2"><Badge variant={config.enabled ? 'default' : 'secondary'}>{config.enabled ? 'Enabled' : 'Disabled'}</Badge><Button size="sm" variant={config.enabled ? 'destructive' : 'default'} disabled={saving} onClick={() => void changeEnabled(!config.enabled)}>{config.enabled ? 'Disable' : 'Review & enable'}</Button></div></CardContent></Card>
          <Tabs defaultValue="setup" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5"><TabsTrigger value="setup">Setup</TabsTrigger><TabsTrigger value="questions">Questions</TabsTrigger><TabsTrigger value="conditions">Conditions</TabsTrigger><TabsTrigger value="scope">Scope</TabsTrigger><TabsTrigger value="pricing">Pricing</TabsTrigger></TabsList>
            <TabsContent value="setup"><Card><CardHeader><CardTitle className="text-base">Customer instructions & requirements</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="space-y-1"><Label>Customer instructions</Label><Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label>Photo mode</Label><Select value={photoMode} onValueChange={setPhotoMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="optional">Optional</SelectItem><SelectItem value="required">Required</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Minimum photos</Label><Input type="number" min="0" value={photoMin} disabled={photoMode === 'none'} onChange={(e) => setPhotoMin(e.target.value)} /></div><div className="space-y-1"><Label>Maximum photos</Label><Input type="number" min="0" value={photoMax} disabled={photoMode === 'none'} onChange={(e) => setPhotoMax(e.target.value)} /></div></div>
              <div className="space-y-1"><Label>Measurement configuration (JSON object)</Label><Textarea className="font-mono text-xs" rows={4} value={measurements} onChange={(e) => setMeasurements(e.target.value)} /></div>
              <div className="space-y-1"><Label>Availability configuration (JSON object)</Label><Textarea className="font-mono text-xs" rows={4} value={availability} onChange={(e) => setAvailability(e.target.value)} /></div>
              <div className="flex justify-end"><Button onClick={() => void saveSetup()} disabled={saving}><Save className="mr-2 h-4 w-4" />Save setup</Button></div>
            </CardContent></Card></TabsContent>
            <TabsContent value="questions"><div className="space-y-4">
              <Card><CardHeader><CardTitle className="text-base">Configured questions ({questions.length})</CardTitle></CardHeader><CardContent className="space-y-2">{questions.map((q) => <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg border p-3"><div><b className="text-sm">{q.label}</b>{q.required && <Badge className="ml-2" variant="outline">Required</Badge>}<p className="text-xs text-muted-foreground">{q.question_key} · {q.input_type} · order {q.display_order}</p>{q.description && <p className="text-sm text-muted-foreground">{q.description}</p>}</div><Button size="icon" variant="ghost" onClick={() => void deleteQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button></div>)}{!questions.length && <p className="text-sm text-muted-foreground">No questions configured. Add only those relevant to this service.</p>}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Add customer question</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Question label</Label><Input value={qLabel} onChange={(e) => { setQLabel(e.target.value); if (!qKey) setQKey(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')); }} /></div>
                <div className="space-y-1"><Label>Unique question key</Label><Input value={qKey} onChange={(e) => setQKey(e.target.value)} /></div>
                <div className="space-y-1"><Label>Input type</Label><Select value={qType} onValueChange={setQType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['text','number','select','multi_select','boolean','date','time','measurement','address'].map((x) => <SelectItem key={x} value={x}>{x.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={qRequired} onCheckedChange={setQRequired} /><Label>Required</Label></div>
                <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Input value={qDescription} onChange={(e) => setQDescription(e.target.value)} /></div>
                {['select','multi_select'].includes(qType) && <div className="space-y-1 sm:col-span-2"><Label>Options (JSON array)</Label><Textarea rows={3} className="font-mono text-xs" value={qOptions} onChange={(e) => setQOptions(e.target.value)} placeholder='["Option A","Option B"]' /></div>}
                <div className="sm:col-span-2"><Button onClick={() => void addQuestion()} disabled={!qLabel.trim() || !qKey.trim()}><CirclePlus className="mr-2 h-4 w-4" />Add question</Button></div>
              </CardContent></Card>
            </div></TabsContent>
            <TabsContent value="conditions"><Card><CardHeader><CardTitle className="text-base">Conditional question rules</CardTitle><p className="text-sm text-muted-foreground">Show, hide, require or make a question optional based on another answer.</p></CardHeader><CardContent className="space-y-3">
              {conditions.map((c) => <div key={c.id} className="flex items-center justify-between gap-2 rounded border p-3 text-sm"><span>{questions.find((q) => q.id === c.question_id)?.label} · {c.action} when {questions.find((q) => q.id === c.depends_on_question_id)?.label} {c.operator} {JSON.stringify(c.expected_value)}</span><Button size="icon" variant="ghost" onClick={() => void deleteCondition(c.id)}><Trash2 className="h-4 w-4" /></Button></div>)}
              {questions.length < 2 ? <p className="text-sm text-muted-foreground">Add at least two questions first.</p> : <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Target question</Label><Select value={conditionTarget} onValueChange={setConditionTarget}><SelectTrigger><SelectValue placeholder="Choose question" /></SelectTrigger><SelectContent>{questions.map((q) => <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Depends on</Label><Select value={conditionSource} onValueChange={setConditionSource}><SelectTrigger><SelectValue placeholder="Choose question" /></SelectTrigger><SelectContent>{questions.filter((q) => q.id !== conditionTarget).map((q) => <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Operator</Label><Select value={conditionOperator} onValueChange={setConditionOperator}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['equals','not_equals','greater_than','less_than','contains'].map((x) => <SelectItem key={x} value={x}>{x.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Expected value</Label><Input value={conditionExpected} onChange={(e) => setConditionExpected(e.target.value)} /></div>
                <div className="space-y-1"><Label>Action</Label><Select value={conditionAction} onValueChange={setConditionAction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['show','hide','required','optional'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-end"><Button onClick={() => void addCondition()}><CirclePlus className="mr-2 h-4 w-4" />Add condition</Button></div>
              </div>}
            </CardContent></Card></TabsContent>
            <TabsContent value="scope"><Card><CardHeader><CardTitle className="text-base">Included, excluded & optional scope</CardTitle></CardHeader><CardContent className="space-y-3">
              {(['included','excluded','extra'] as const).map((kind) => <div key={kind} className="space-y-2"><h3 className="text-sm font-semibold capitalize">{kind}</h3>{scope.filter((x) => x.scope_type === kind).map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded border p-3"><div><b className="text-sm">{item.title}</b>{!item.active && <Badge className="ml-2" variant="secondary">Inactive</Badge>}{item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}</div><div className="flex items-center gap-2"><Switch checked={item.active} onCheckedChange={async () => { const r = await db.from('booking_engine_service_scope').update({ active: !item.active, updated_at: new Date().toISOString() }).eq('id', item.id).select('*').single(); if (r.error) toast({ title: 'Scope update failed', description: r.error.message, variant: 'destructive' }); else setScope((old) => old.map((x) => x.id === item.id ? r.data : x)); }} /><Button size="icon" variant="ghost" onClick={() => void deleteScope(item.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>)}
              <div className="grid gap-3 border-t pt-4 sm:grid-cols-2"><div className="space-y-1"><Label>Scope type</Label><Select value={scopeType} onValueChange={setScopeType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="included">Included</SelectItem><SelectItem value="excluded">Excluded</SelectItem><SelectItem value="extra">Extra</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Title</Label><Input value={scopeTitle} onChange={(e) => setScopeTitle(e.target.value)} /></div><div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={scopeDescription} onChange={(e) => setScopeDescription(e.target.value)} /></div><div className="sm:col-span-2"><Button onClick={() => void addScope()} disabled={!scopeTitle.trim()}><CirclePlus className="mr-2 h-4 w-4" />Add scope item</Button></div></div>
            </CardContent></Card></TabsContent>
            <TabsContent value="pricing"><div className="space-y-4">
              <Card><CardHeader><CardTitle className="text-base">Pricing versions</CardTitle><p className="text-sm text-muted-foreground">These are Booking Engine rules only; existing ERP service prices are not modified.</p></CardHeader><CardContent className="space-y-2">{pricing.map((rule) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><div><b className="text-sm">{rule.pricing_type.replace('_',' ')}{rule.rate !== null ? ' · KES ' + Number(rule.rate).toLocaleString() : ' · Staff quotation'}</b><p className="text-xs text-muted-foreground">Version {rule.version}{rule.unit_key ? ' · per ' + rule.unit_key : ''}{rule.minimum_quantity !== null ? ' · min ' + rule.minimum_quantity : ''}{rule.maximum_quantity !== null ? ' · max ' + rule.maximum_quantity : ''}</p></div><div className="flex items-center gap-2"><Badge variant={rule.active ? 'default' : 'secondary'}>{rule.active ? 'Active' : 'Inactive'}</Badge><Button size="sm" variant="outline" onClick={async () => { const r = await db.from('booking_engine_pricing_rules').update({ active: !rule.active, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', rule.id).select('*').single(); if (r.error) toast({ title: 'Pricing update failed', description: r.error.message, variant: 'destructive' }); else setPricing((old) => old.map((x) => x.id === rule.id ? r.data : x)); }}>{rule.active ? 'Deactivate' : 'Reactivate'}</Button></div></div>)}{!pricing.length && <p className="text-sm text-muted-foreground">No pricing rules configured.</p>}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Add pricing rule</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Pricing model</Label><Select value={priceType} onValueChange={setPriceType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['fixed','per_unit','per_measurement','tiered','quotation'].map((x) => <SelectItem key={x} value={x}>{x.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Rate (KES)</Label><Input type="number" min="0" step="0.01" disabled={priceType === 'quotation'} value={priceRate} onChange={(e) => setPriceRate(e.target.value)} placeholder={priceType === 'quotation' ? 'Staff quotation' : 'Approved rate'} /></div>
                <div className="space-y-1"><Label>Unit / measurement key</Label><Input value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} placeholder="e.g. room, seat, sqm" /></div>
                <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Minimum qty</Label><Input type="number" min="0" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} /></div><div className="space-y-1"><Label>Maximum qty</Label><Input type="number" min="0" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} /></div></div>
                <div className="sm:col-span-2"><Button onClick={async () => { const rate = priceType === 'quotation' ? null : Number(priceRate); const min = priceMin.trim() ? Number(priceMin) : null; const max = priceMax.trim() ? Number(priceMax) : null; if (priceType !== 'quotation' && (!priceRate.trim() || !Number.isFinite(rate) || rate! < 0)) { toast({ title: 'Enter an approved rate or select quotation pricing' }); return; } if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)) || (min !== null && max !== null && min > max)) { toast({ title: 'Check the quantity range' }); return; } const r = await db.from('booking_engine_pricing_rules').insert({ service_config_id: config.id, pricing_type: priceType, rate, unit_key: priceUnit.trim() || null, minimum_quantity: min, maximum_quantity: max, currency: 'KES', version: Math.max(0, ...pricing.map((x) => Number(x.version) || 0)) + 1, active: true, created_by: (await supabase.auth.getUser()).data.user?.id ?? null }).select('*').single(); if (r.error) toast({ title: 'Pricing rule not added', description: r.error.message, variant: 'destructive' }); else { setPricing((old) => [r.data, ...old]); setPriceRate(''); setPriceUnit(''); setPriceMin(''); setPriceMax(''); toast({ title: 'New pricing version saved; prior versions retained.' }); } }}><CirclePlus className="mr-2 h-4 w-4" />Add versioned pricing</Button></div>
              </CardContent></Card>
            </div></TabsContent>
          </Tabs>
          <Card><CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-3"><div>{questions.length} questions</div><div>{activeIncluded} active included-scope items</div><div>{activePricing} active pricing rules</div></CardContent></Card>
        </>}
      </div>
    </div>
  </div>;
}
