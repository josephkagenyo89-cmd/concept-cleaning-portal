import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type ServiceConfig = {
  id: string;
  service_id: string;
  enabled: boolean;
  service_name: string;
};

type QuestionRow = {
  id: string;
  service_config_id: string;
  question_key: string;
  label: string;
  description: string | null;
  input_type: string;
  required: boolean;
  display_order: number;
  options: unknown;
};

type QuestionForm = {
  question_key: string;
  label: string;
  description: string;
  input_type: string;
  required: boolean;
  display_order: number;
  options: string;
};

const INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'address', label: 'Address' },
];

const emptyForm: QuestionForm = {
  question_key: '',
  label: '',
  description: '',
  input_type: 'text',
  required: false,
  display_order: 0,
  options: '',
};

function optionsToText(options: unknown): string {
  if (!Array.isArray(options)) return '';

  return options
    .filter(option => typeof option === 'string')
    .join('\n');
}

function parseOptions(value: string): string[] {
  return value
    .split('\n')
    .map(option => option.trim())
    .filter(Boolean);
}

export default function BookingEngineQuestionsConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [selectedServiceConfigId, setSelectedServiceConfigId] = useState('');
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);

  const loadServices = async () => {
    const { data, error } = await supabase
      .from('booking_engine_service_config')
      .select('id, service_id, enabled')
      .order('created_at');

    if (error) throw error;

    const configRows = data || [];

    if (configRows.length === 0) {
      setServices([]);
      setSelectedServiceConfigId('');
      setQuestions([]);
      return;
    }

    const serviceIds = configRows.map(row => row.service_id);

    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('id, name')
      .in('id', serviceIds);

    if (serviceError) throw serviceError;

    const serviceMap = new Map(
      (serviceData || []).map(service => [service.id, service.name])
    );

    const mapped = configRows.map(row => ({
      id: row.id,
      service_id: row.service_id,
      enabled: row.enabled,
      service_name: serviceMap.get(row.service_id) || 'Unknown service',
    }));

    setServices(mapped);

    if (
      !selectedServiceConfigId ||
      !mapped.some(row => row.id === selectedServiceConfigId)
    ) {
      setSelectedServiceConfigId(mapped[0]?.id || '');
    }
  };

  const loadQuestions = async (serviceConfigId: string) => {
    if (!serviceConfigId) {
      setQuestions([]);
      return;
    }

    const { data, error } = await supabase
      .from('booking_engine_questions')
      .select(
        'id, service_config_id, question_key, label, description, input_type, required, display_order, options'
      )
      .eq('service_config_id', serviceConfigId)
      .order('display_order')
      .order('created_at');

    if (error) throw error;

    setQuestions((data || []) as QuestionRow[]);
  };

  const loadData = async () => {
    setLoading(true);

    try {
      await loadServices();
    } catch (error: any) {
      toast({
        title: 'Load failed',
        description:
          error.message || 'Unable to load Booking Engine questions.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedServiceConfigId) return;

    loadQuestions(selectedServiceConfigId).catch((error: any) => {
      toast({
        title: 'Questions failed to load',
        description: error.message || 'Unable to load questions.',
        variant: 'destructive',
      });
    });

    setEditingId(null);
    setForm(emptyForm);
  }, [selectedServiceConfigId]);

  const startNew = () => {
    setEditingId(null);
    setFormOpen(true);
    setForm({
      ...emptyForm,
      display_order: questions.length,
    });
  };

  const startEdit = (question: QuestionRow) => {
    setEditingId(question.id);
    setFormOpen(true);
    setForm({
      question_key: question.question_key,
      label: question.label,
      description: question.description || '',
      input_type: question.input_type,
      required: question.required,
      display_order: question.display_order,
      options: optionsToText(question.options),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormOpen(false);
    setForm(emptyForm);
  };

  const saveQuestion = async () => {
    if (!selectedServiceConfigId) {
      toast({
        title: 'Select a service',
        description: 'Select a Booking Engine service first.',
        variant: 'destructive',
      });
      return;
    }

    const questionKey = form.question_key.trim();
    const label = form.label.trim();

    if (!questionKey || !label) {
      toast({
        title: 'Missing information',
        description: 'Question key and label are required.',
        variant: 'destructive',
      });
      return;
    }

    const needsOptions =
      form.input_type === 'select' ||
      form.input_type === 'multi_select';

    const parsedOptions = parseOptions(form.options);

    if (needsOptions && parsedOptions.length === 0) {
      toast({
        title: 'Options required',
        description:
          'Select and Multi Select questions must have at least one option.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(editingId || 'new');

    try {
      const payload = {
        service_config_id: selectedServiceConfigId,
        question_key: questionKey,
        label,
        description: form.description.trim() || null,
        input_type: form.input_type,
        required: form.required,
        display_order: Math.max(0, Number(form.display_order) || 0),
        options: needsOptions ? parsedOptions : [],
      };

      if (editingId) {
        const { error } = await supabase
          .from('booking_engine_questions')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('booking_engine_questions')
          .insert(payload);

        if (error) throw error;
      }

      await loadQuestions(selectedServiceConfigId);
      cancelEdit();

      toast({
        title: 'Saved',
        description: 'Booking Engine question saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error.message || 'Unable to save question.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const deleteQuestion = async (question: QuestionRow) => {
    if (!window.confirm(`Delete the question "${question.label}"?`)) {
      return;
    }

    setSaving(question.id);

    try {
      const { error } = await supabase
        .from('booking_engine_questions')
        .delete()
        .eq('id', question.id);

      if (error) throw error;

      await loadQuestions(selectedServiceConfigId);

      if (editingId === question.id) {
        cancelEdit();
      }

      toast({
        title: 'Deleted',
        description: 'Booking Engine question deleted.',
      });
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message || 'Unable to delete question.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="booking-engine-customer-questions">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Customer Questions</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure the questions customers answer when requesting a
              service.
            </p>
          </div>

          <Button
            onClick={startNew}
            disabled={!selectedServiceConfigId || !!saving}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {services.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Configure a Booking Engine service first before adding questions.
          </div>
        ) : (
          <>
            <div>
              <Label>Service</Label>
              <select
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedServiceConfigId}
                onChange={e => setSelectedServiceConfigId(e.target.value)}
              >
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.service_name}
                    {service.enabled ? '' : ' (Disabled)'}
                  </option>
                ))}
              </select>
            </div>

            {formOpen ? (
              <div className="rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">
                      {editingId ? 'Edit Question' : 'New Question'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Use a stable question key such as
                      <code className="ml-1">sofa_fabric</code>.
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelEdit}
                    disabled={!!saving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Question Key</Label>
                    <Input
                      className="mt-2"
                      value={form.question_key}
                      onChange={e =>
                        setForm(prev => ({
                          ...prev,
                          question_key: e.target.value,
                        }))
                      }
                      placeholder="sofa_fabric"
                      disabled={!!saving}
                    />
                  </div>

                  <div>
                    <Label>Label</Label>
                    <Input
                      className="mt-2"
                      value={form.label}
                      onChange={e =>
                        setForm(prev => ({
                          ...prev,
                          label: e.target.value,
                        }))
                      }
                      placeholder="What type of sofa fabric do you have?"
                      disabled={!!saving}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      className="mt-2"
                      value={form.description}
                      onChange={e =>
                        setForm(prev => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional explanation shown to the customer."
                      disabled={!!saving}
                    />
                  </div>

                  <div>
                    <Label>Input Type</Label>
                    <select
                      className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.input_type}
                      onChange={e =>
                        setForm(prev => ({
                          ...prev,
                          input_type: e.target.value,
                        }))
                      }
                      disabled={!!saving}
                    >
                      {INPUT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Display Order</Label>
                    <Input
                      className="mt-2"
                      type="number"
                      min={0}
                      value={form.display_order}
                      onChange={e =>
                        setForm(prev => ({
                          ...prev,
                          display_order: Number(e.target.value),
                        }))
                      }
                      disabled={!!saving}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Switch
                    checked={form.required}
                    onCheckedChange={required =>
                      setForm(prev => ({ ...prev, required }))
                    }
                    disabled={!!saving}
                  />
                  <div>
                    <Label>Required</Label>
                    <p className="text-sm text-muted-foreground">
                      Customer must answer this question before continuing.
                    </p>
                  </div>
                </div>

                {(form.input_type === 'select' ||
                  form.input_type === 'multi_select') && (
                  <div className="mt-4">
                    <Label>Options</Label>
                    <Textarea
                      className="mt-2"
                      value={form.options}
                      onChange={e =>
                        setForm(prev => ({
                          ...prev,
                          options: e.target.value,
                        }))
                      }
                      placeholder={'One option per line\nFabric\nLeather\nVelvet'}
                      disabled={!!saving}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter one option per line.
                    </p>
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={!!saving}
                  >
                    Cancel
                  </Button>

                  <Button
                    onClick={saveQuestion}
                    disabled={!!saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Question
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {questions.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No questions configured for this service.
                </div>
              ) : (
                questions.map(question => (
                  <div
                    key={question.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{question.label}</h3>
                          {question.required && (
                            <Badge variant="secondary">Required</Badge>
                          )}
                          <Badge variant="outline">
                            {question.input_type}
                          </Badge>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Key: {question.question_key} · Order:{' '}
                          {question.display_order}
                        </p>

                        {question.description && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {question.description}
                          </p>
                        )}

                        {Array.isArray(question.options) &&
                          question.options.length > 0 && (
                            <p className="mt-2 text-sm">
                              Options:{' '}
                              {question.options
                                .filter(option => typeof option === 'string')
                                .join(', ')}
                            </p>
                          )}
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(question)}
                          disabled={!!saving}
                        >
                          Edit
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => deleteQuestion(question)}
                          disabled={saving === question.id}
                        >
                          {saving === question.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
