import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

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
  '💰 Check my commission',
  '📋 Help with a booking',
  '📅 Next payout date?',
  '⚠️ Client complaint',
  '👋 Hello!',
];

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday ' + format(d, 'h:mm a');
  return format(d, 'MMM d, h:mm a');
}

export default function AgentMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
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

  useEffect(() => {
    if (!conversationId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);

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
    inputRef.current?.focus();
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
      <Card className="flex flex-col h-[calc(100vh-10rem)] overflow-hidden">
        <CardHeader className="pb-3 border-b bg-card">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            Admin Support
          </CardTitle>
          <p className="text-xs text-muted-foreground">Chat with your admin team</p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 px-4">
            {messages.length === 0 && (
              <div className="text-center py-16 px-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-primary" />
                </div>
                <p className="font-medium text-foreground mb-1">Start a conversation</p>
                <p className="text-sm text-muted-foreground">Send a message or tap a quick reply below.</p>
              </div>
            )}
            <div className="space-y-3 py-4">
              {messages.map((msg) => {
                const isMe = msg.sender_role === 'agent';
                return (
                  <div key={msg.id} className={cn('flex gap-2', isMe ? 'justify-end' : 'justify-start')}>
                    {!isMe && (
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    )}>
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      <p className={cn(
                        'text-[10px] mt-1',
                        isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {formatMsgTime(msg.created_at)}
                      </p>
                    </div>
                    {isMe && (
                      <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                        <User className="h-3.5 w-3.5 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {QUICK_REPLIES.map((qr) => (
                <Button
                  key={qr}
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-full"
                  onClick={() => sendMessage(qr)}
                >
                  {qr}
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-2 p-3 border-t bg-card">
            <Input
              ref={inputRef}
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(newMessage)}
              disabled={sending}
              className="rounded-full"
            />
            <Button
              size="icon"
              className="rounded-full shrink-0"
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
