import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  'How do I check my commission?',
  'I need help with a booking',
  'When is my next payout?',
  'I have a client complaint',
];

export default function AgentMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Get or create conversation
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      // Try to find existing conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('agent_id', user.id)
        .single();

      if (existing) {
        setConversationId(existing.id);
      } else {
        const { data: created } = await supabase
          .from('conversations')
          .insert({ agent_id: user.id })
          .select('id')
          .single();
        if (created) setConversationId(created.id);
      }
      setLoading(false);
    };
    init();
  }, [user]);

  // Load messages and subscribe to realtime
  useEffect(() => {
    if (!conversationId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);

      // Mark unread admin messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_role', 'admin')
        .eq('is_read', false);
    };

    loadMessages();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        // Auto-mark admin messages as read
        if (msg.sender_role === 'admin') {
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then(() => {});
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !conversationId || !user) return;
    setSending(true);
    setNewMessage('');
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: 'agent',
      message: text.trim(),
    });
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <Card className="flex flex-col h-[calc(100vh-10rem)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            Messages — Admin Support
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 px-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <p>No messages yet. Send a message or use a quick reply below.</p>
              </div>
            )}
            <div className="space-y-3 py-4">
              {messages.map((msg) => {
                const isMe = msg.sender_role === 'agent';
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
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {QUICK_REPLIES.map((qr) => (
                <Button
                  key={qr}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => sendMessage(qr)}
                >
                  {qr}
                </Button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 p-4 border-t">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(newMessage)}
              disabled={sending}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(newMessage)}
              disabled={sending || !newMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
