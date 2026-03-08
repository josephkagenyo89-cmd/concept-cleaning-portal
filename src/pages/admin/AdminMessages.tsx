import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, MessageCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  agent_id: string;
  updated_at: string;
  agent_name?: string;
  unread_count?: number;
  last_message?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const QUICK_REPLIES = [
  'Your payout is being processed.',
  'Please provide more details.',
  'This has been resolved.',
  'I will look into this and get back to you.',
];

export default function AdminMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations with agent names and unread counts
  const loadConversations = async () => {
    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!convos) { setLoading(false); return; }

    // Get agent profiles and unread counts
    const enriched = await Promise.all(convos.map(async (c: any) => {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('user_id', c.agent_id).single(),
        supabase.from('messages').select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id).eq('sender_role', 'agent').eq('is_read', false),
      ]);
      // Get last message
      const { data: lastMsg } = await supabase.from('messages')
        .select('message').eq('conversation_id', c.id)
        .order('created_at', { ascending: false }).limit(1).single();

      return {
        ...c,
        agent_name: profile?.full_name || 'Unknown Agent',
        unread_count: count || 0,
        last_message: lastMsg?.message || '',
      } as Conversation;
    }));

    setConversations(enriched);
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, []);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvo) return;

    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConvo)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);

      // Mark agent messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', selectedConvo)
        .eq('sender_role', 'agent')
        .eq('is_read', false);

      // Update local unread count
      setConversations(prev => prev.map(c =>
        c.id === selectedConvo ? { ...c, unread_count: 0 } : c
      ));
    };
    load();

    const channel = supabase
      .channel(`admin-messages-${selectedConvo}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConvo}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        if (msg.sender_role === 'agent') {
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then(() => {});
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConvo]);

  // Realtime for new conversations/messages (list refresh)
  useEffect(() => {
    const channel = supabase
      .channel('admin-convos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (!selectedConvo) loadConversations();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConvo]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedConvo || !user) return;
    setSending(true);
    setNewMessage('');
    await supabase.from('messages').insert({
      conversation_id: selectedConvo,
      sender_id: user.id,
      sender_role: 'admin',
      message: text.trim(),
    });
    // Update conversation timestamp
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', selectedConvo);
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  // Chat view
  if (selectedConvo) {
    const convo = conversations.find(c => c.id === selectedConvo);
    return (
      <Card className="flex flex-col h-[calc(100vh-8rem)]">
        <CardHeader className="pb-3 flex-row items-center gap-3 space-y-0">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedConvo(null); loadConversations(); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-lg">{convo?.agent_name || 'Agent'}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 px-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No messages yet.</div>
            )}
            <div className="space-y-3 py-4">
              {messages.map((msg) => {
                const isMe = msg.sender_role === 'admin';
                return (
                  <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    )}>
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                      <p className={cn(
                        'text-[10px] mt-1',
                        isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Quick replies */}
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {QUICK_REPLIES.map((qr) => (
              <Button key={qr} variant="outline" size="sm" className="text-xs" onClick={() => sendMessage(qr)}>
                {qr}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 p-4 border-t">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(newMessage)}
              disabled={sending}
            />
            <Button size="icon" onClick={() => sendMessage(newMessage)} disabled={sending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Conversation list
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <MessageCircle className="h-6 w-6 text-primary" />
        Messages
      </h1>
      {conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No conversations yet. Agents will appear here when they message you.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((convo) => (
            <Card
              key={convo.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedConvo(convo.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{convo.agent_name}</p>
                    {(convo.unread_count ?? 0) > 0 && (
                      <Badge className="text-[10px] px-1.5 py-0">{convo.unread_count}</Badge>
                    )}
                  </div>
                  {convo.last_message && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{convo.last_message}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground ml-2 shrink-0">
                  {format(new Date(convo.updated_at), 'MMM d')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
