import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, Clock, CheckCircle, XCircle, Users, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface MassEmail {
  id: string;
  subject: string;
  body: string;
  audience_type: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_role: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
}

export default function AdminMassEmails() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('agent');
  const [sending, setSending] = useState(false);
  const [emails, setEmails] = useState<MassEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEmails = async () => {
    const { data } = await supabase
      .from('mass_emails')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEmails(data as MassEmail[]);
    setLoading(false);
  };

  useEffect(() => { loadEmails(); }, []);

  const loadLogs = async (emailId: string) => {
    setSelectedEmail(emailId);
    const { data } = await supabase
      .from('mass_email_logs')
      .select('*')
      .eq('email_id', emailId)
      .order('created_at', { ascending: true });
    if (data) setLogs(data as EmailLog[]);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || !user) return;
    setSending(true);

    try {
      // Create the email record
      const { data: email, error: createErr } = await supabase
        .from('mass_emails')
        .insert({
          subject: subject.trim(),
          body: body.trim(),
          audience_type: audience,
          created_by: user.id,
          status: 'draft',
        })
        .select('id')
        .single();

      if (createErr || !email) throw new Error('Failed to create email');

      // Invoke the edge function to send
      const { data, error } = await supabase.functions.invoke('send-mass-email', {
        body: { emailId: email.id },
      });

      if (error) throw error;

      toast({
        title: 'Email sent',
        description: `Sent: ${data?.sent || 0}, Failed: ${data?.failed || 0}`,
      });

      setSubject('');
      setBody('');
      loadEmails();
    } catch (err: any) {
      toast({
        title: 'Error sending email',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      draft: { variant: 'outline', icon: Clock },
      sending: { variant: 'secondary', icon: Loader2 },
      sent: { variant: 'default', icon: CheckCircle },
      failed: { variant: 'destructive', icon: XCircle },
      pending: { variant: 'outline', icon: Clock },
    };
    const { variant, icon: Icon } = map[status] || map.draft;
    return (
      <Badge variant={variant} className="gap-1 text-xs">
        <Icon className={`h-3 w-3 ${status === 'sending' ? 'animate-spin' : ''}`} />
        {status}
      </Badge>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Mail className="h-6 w-6 text-primary" />
        Mass Emails
      </h1>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="compose">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compose Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Audience</label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agents Only</SelectItem>
                    <SelectItem value="admin">Admins Only</SelectItem>
                    <SelectItem value="all">Everyone</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Subject</label>
                <Input
                  placeholder="Email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Body <span className="text-muted-foreground font-normal">(HTML supported, use {'{{firstName}}'} for personalization)</span>
                </label>
                <Textarea
                  placeholder="Write your email content here..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              {body && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Preview</label>
                  <Card className="p-4">
                    <p className="text-sm font-semibold mb-2">{subject || '(No subject)'}</p>
                    <div
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: body.replace(/\{\{firstName\}\}/g, 'John') }}
                    />
                  </Card>
                </div>
              )}

              <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Sending...' : 'Send Now'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
            </div>
          ) : emails.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No emails sent yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {emails.map((em) => (
                <Card
                  key={em.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedEmail === em.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => loadLogs(em.id)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{em.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs gap-1">
                          <Users className="h-3 w-3" />
                          {em.audience_type}
                        </Badge>
                        {statusBadge(em.status)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground ml-2">
                      {format(new Date(em.created_at), 'MMM d, h:mm a')}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {selectedEmail && logs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Delivery Log</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                          <div>
                            <p className="font-medium">{log.recipient_email}</p>
                            <p className="text-xs text-muted-foreground">{log.recipient_role}</p>
                          </div>
                          {statusBadge(log.status)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
