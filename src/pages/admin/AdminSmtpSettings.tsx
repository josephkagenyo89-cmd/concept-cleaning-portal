import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, SendHorizonal, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SmtpConfig {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  from_name: string;
  from_email: string;
  use_tls: boolean;
}

const defaultConfig: SmtpConfig = {
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_pass: '',
  from_name: 'Concept Cleaning Services',
  from_email: '',
  use_tls: true,
};

export default function AdminSmtpSettings() {
  const [config, setConfig] = useState<SmtpConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('smtp_settings')
        .select('*')
        .limit(1)
        .single();
      if (data) {
        setConfig(data as unknown as SmtpConfig);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass || !config.from_email) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from('smtp_settings')
          .update({
            smtp_host: config.smtp_host,
            smtp_port: config.smtp_port,
            smtp_user: config.smtp_user,
            smtp_pass: config.smtp_pass,
            from_name: config.from_name,
            from_email: config.from_email,
            use_tls: config.use_tls,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('smtp_settings')
          .insert({
            smtp_host: config.smtp_host,
            smtp_port: config.smtp_port,
            smtp_user: config.smtp_user,
            smtp_pass: config.smtp_pass,
            from_name: config.from_name,
            from_email: config.from_email,
            use_tls: config.use_tls,
          })
          .select('id')
          .single();
        if (error) throw error;
        if (data) setConfig(prev => ({ ...prev, id: data.id }));
      }
      toast({ title: 'Settings saved', description: 'SMTP configuration updated successfully.' });
    } catch (err: any) {
      toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail.trim()) {
      toast({ title: 'Enter test email', description: 'Please enter an email address to send a test to.', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-smtp', {
        body: { to: testEmail.trim() },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Test email sent!', description: `Check ${testEmail} for the test email.` });
      } else {
        throw new Error(data?.error || 'Failed to send test email');
      }
    } catch (err: any) {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        SMTP Settings
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Server Configuration</CardTitle>
          <CardDescription>Configure the SMTP server used for sending mass emails to agents and admins.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp_host">SMTP Host *</Label>
              <Input
                id="smtp_host"
                placeholder="smtp.gmail.com"
                value={config.smtp_host}
                onChange={(e) => setConfig(p => ({ ...p, smtp_host: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_port">SMTP Port *</Label>
              <Input
                id="smtp_port"
                type="number"
                placeholder="587"
                value={config.smtp_port}
                onChange={(e) => setConfig(p => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp_user">Username / Email *</Label>
              <Input
                id="smtp_user"
                placeholder="admin@conceptcleaning.co.ke"
                value={config.smtp_user}
                onChange={(e) => setConfig(p => ({ ...p, smtp_user: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_pass">Password / App Password *</Label>
              <div className="relative">
                <Input
                  id="smtp_pass"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={config.smtp_pass}
                  onChange={(e) => setConfig(p => ({ ...p, smtp_pass: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                placeholder="Concept Cleaning Services"
                value={config.from_name}
                onChange={(e) => setConfig(p => ({ ...p, from_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from_email">From Email *</Label>
              <Input
                id="from_email"
                type="email"
                placeholder="admin@conceptcleaning.co.ke"
                value={config.from_email}
                onChange={(e) => setConfig(p => ({ ...p, from_email: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="use_tls"
              checked={config.use_tls}
              onCheckedChange={(checked) => setConfig(p => ({ ...p, use_tls: checked, smtp_port: checked ? 587 : 465 }))}
            />
            <Label htmlFor="use_tls">Use TLS (port 587). Disable for SSL (port 465).</Label>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Email</CardTitle>
          <CardDescription>Send a test email to verify your SMTP configuration works.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-col sm:flex-row">
            <Input
              placeholder="recipient@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={testing || !config.id} className="gap-2 shrink-0">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              {testing ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
          {!config.id && (
            <p className="text-sm text-muted-foreground">Save your SMTP settings first before testing.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
