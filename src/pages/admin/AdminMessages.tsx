import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, MessageCircle, ArrowLeft, Bot, User, Search, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

interface Agent {
  user_id: string;
  full_name: string;
  phone: string;
  is_online: boolean;
  last_seen: string | null;
  status: string;
}

interface Conversation {
  id: string;
  agent_id: string;
  updated_at: string;
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
  '✅ Your payout is being processed.',
  '📝 Please provide more details.',
  '🎉 This has been resolved.',
  '🔍 I will look into this.',
];

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday ' + format(d, 'h:mm a');
  return format(d, 'MMM d, h:mm a');
}

function LastSeenText({ agent }: { agent: Agent }) {
  if (agent.is_online) {
    return <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">Online</span>;
  }
  if (!agent.last_seen) return <span className="text-xs text-muted-foreground">Never seen</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {formatDistanceToNow(new Date(agent.last_seen), { addSuffix: true })}
    </span>
  );
}

export default function AdminMessages() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all agents with their online status
  const loadAgents = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, is_online, last_seen, status')
      .order('is_online', { ascending: false })
      .order('last_seen', { ascending: false, nullsFirst: false });

    if (profiles) {
      setAgents(profiles as Agent[]);
    }

    // Load unread counts per agent
    const { data: convos } = await supabase.from('conversations').select('id, agent_id');
    if (convos && convos.length > 0) {
      const counts: Record<string, number> = {};
      await Promise.all(convos.map(async (c) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .eq('sender_role', 'agent')
          .eq('is_read', false);
        if (count && count > 0) counts[c.agent_id] = count;
      }));
      setUnreadMap(counts);
    }

    setLoading(false);
  };

  useEffect(() => { loadAgents(); }, []);

  // Real-time profile updates (online/offline)
  useEffect(() => {
    const channel = supabase
      .channel('admin-agent-presence')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        const updated = payload.new as any;
        setAgents(prev => prev.map(a =>
          a.user_id === updated.user_id
            ? { ...a, is_online: updated.is_online, last_seen: updated.last_seen }
            : a
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // When an agent is selected, find or create conversation
  const openChat = async (agent: Agent) => {
    setSelectedAgent(agent);
    setMessages([]);

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('agent_id', agent.user_id)
      .single();

    if (existing) {
      setConversationId(existing.id);
    } else {
      // Admin creates conversation for this agent
      const { data: created } = await supabase
        .from('conversations')
        .insert({ agent_id: agent.user_id })
        .select('id')
        .single();
      if (created) setConversationId(created.id);
    }
  };

  // Load messages when conversation selected
  useEffect(() => {
    if (!conversationId) return;

    const load = async () => {
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
        .eq('sender_role', 'agent')
        .eq('is_read', false);

      if (selectedAgent) {
        setUnreadMap(prev => ({ ...prev, [selectedAgent.user_id]: 0 }));
      }
    };
    load();

    const channel = supabase
      .channel(`admin-chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        if (msg.sender_role === 'agent') {
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then(() => {});
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Real-time unread updates when on list view
  useEffect(() => {
    if (selectedAgent) return;
    const channel = supabase
      .channel('admin-unread-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadAgents();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => {
        loadAgents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedAgent]);

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
      sender_role: 'admin',
      message: text.trim(),
    });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
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

  // Chat view
  if (selectedAgent && conversationId) {
    return (
      <Card className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
        <CardHeader className="pb-3 flex-row items-center gap-3 space-y-0 border-b">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { setSelectedAgent(null); setConversationId(null); loadAgents(); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <Circle
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current stroke-background stroke-2',
                  selectedAgent.is_online ? 'text-emerald-500' : 'text-muted-foreground/40'
                )}
              />
            </div>
            <div>
              <CardTitle className="text-base">{selectedAgent.full_name}</CardTitle>
              <LastSeenText agent={selectedAgent} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 px-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No messages yet. Start the conversation!</div>
            )}
            <div className="space-y-3 py-4">
              {messages.map((msg) => {
                const isMe = msg.sender_role === 'admin';
                return (
                  <div key={msg.id} className={cn('flex gap-2', isMe ? 'justify-end' : 'justify-start')}>
                    {!isMe && (
                      <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                        <User className="h-3.5 w-3.5 text-secondary-foreground" />
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
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {QUICK_REPLIES.map((qr) => (
              <Button key={qr} variant="outline" size="sm" className="text-xs rounded-full" onClick={() => sendMessage(qr)}>
                {qr}
              </Button>
            ))}
          </div>

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
            <Button size="icon" className="rounded-full shrink-0" onClick={() => sendMessage(newMessage)} disabled={sending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Agent list view
  const filtered = agents.filter(a =>
    !search || a.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = Object.values(unreadMap).reduce((sum, c) => sum + c, 0);
  const onlineCount = agents.filter(a => a.is_online).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          Messages
          {totalUnread > 0 && <Badge className="text-xs">{totalUnread}</Badge>}
        </h1>
        <Badge variant="outline" className="text-xs gap-1.5">
          <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
          {onlineCount} online
        </Badge>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-full"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search ? 'No matching agents.' : 'No agents found.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filtered.map((agent) => {
            const unread = unreadMap[agent.user_id] || 0;
            return (
              <Card
                key={agent.user_id}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  unread > 0 && 'border-primary/30 bg-primary/5'
                )}
                onClick={() => openChat(agent)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <Circle
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current stroke-background stroke-2',
                        agent.is_online ? 'text-emerald-500' : 'text-muted-foreground/30'
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className={cn('font-medium truncate', unread > 0 && 'text-foreground')}>
                        {agent.full_name}
                      </p>
                      <LastSeenText agent={agent} />
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{agent.phone}</p>
                      {unread > 0 && (
                        <Badge className="text-[10px] px-1.5 py-0 ml-2 shrink-0">{unread}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
