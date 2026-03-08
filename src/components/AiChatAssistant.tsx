import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const SUGGESTIONS = [
  { label: '📋 Book a Service', action: 'navigate', path: '/agent/book', message: "I'd like to book a cleaning service." },
  { label: '🧹 View Services', action: 'ask', message: 'What cleaning services do you offer and what are the prices?' },
  { label: '📞 Contact Support', action: 'ask', message: 'How can I contact support?' },
];

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (t: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  let resp: Response;
  try {
    resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages }),
    });
  } catch {
    onError('Network error. Please check your connection.');
    return;
  }

  if (!resp.ok) {
    try {
      const body = await resp.json();
      onError(body.error || 'Something went wrong.');
    } catch {
      onError('Something went wrong. Please try again.');
    }
    return;
  }

  if (!resp.body) {
    onError('No response received.');
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (c) onDelta(c);
      } catch {
        buf = line + '\n' + buf;
        break;
      }
    }
  }
  onDone();
}

export default function AiChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { isAgent } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      const userMsg: Msg = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      let assistantSoFar = '';
      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
            );
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      await streamChat({
        messages: [...messages, userMsg],
        onDelta: upsert,
        onDone: () => setLoading(false),
        onError: (msg) => {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `⚠️ ${msg}` },
          ]);
          setLoading(false);
        },
      });
    },
    [messages, loading]
  );

  const handleSuggestion = (s: (typeof SUGGESTIONS)[number]) => {
    if (s.action === 'navigate' && s.path) {
      navigate(s.path);
      setOpen(false);
      return;
    }
    sendMessage(s.message);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105',
          'bg-primary text-primary-foreground',
          isAgent ? 'bottom-32 right-4 md:bottom-6 md:right-6' : 'bottom-6 right-4 md:right-6'
        )}
        aria-label="AI Assistant"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl',
            'bottom-[7.5rem] right-4 w-[calc(100vw-2rem)] max-w-sm',
            'md:bottom-24 md:right-6 md:w-96',
            isAgent ? 'h-[min(70vh,520px)]' : 'h-[min(75vh,560px)]',
            isAgent ? 'md:bottom-24' : 'md:bottom-24'
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b bg-primary px-4 py-3">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
            <span className="text-sm font-semibold text-primary-foreground">
              AI Cleaning Assistant
            </span>
            <button
              className="ml-auto text-primary-foreground/80 hover:text-primary-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="flex flex-col gap-3 p-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    👋 Hi! I'm your Concept Cleaning assistant. How can I help you today?
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => handleSuggestion(s)}
                        className="rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  )}
                >
                  {m.content}
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-1 px-3 py-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick suggestions after messages exist */}
          {messages.length > 0 && !loading && (
            <div className="flex gap-1.5 overflow-x-auto border-t px-3 py-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSuggestion(s)}
                  className="shrink-0 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask about our services..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={loading}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
