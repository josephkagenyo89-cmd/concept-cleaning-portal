/**
 * BOOKING AGENT WIDGET - WhatsApp Style
 * Floating widget that appears 10 seconds after page load
 * Calls Supabase Edge Function
 */

import { useState, useEffect } from 'react';
import { X, MessageCircle, Send, Loader2, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DialogueMessage {
  role: 'customer' | 'agent';
  message: string;
  timestamp: string;
}

interface BookingAgentResponse {
  status: 'success' | 'error';
  agentMessage: string;
  matchedService?: {
    service_id: string;
    service_name: string;
    confidence: number;
  };
  nextStep: string;
  requestId?: string;
}

export default function BookingAgentWidget() {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<DialogueMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Show widget 10 seconds after page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    const customerMessage = userInput.trim();
    setUserInput('');
    setLoading(true);

    try {
      const newHistory: DialogueMessage[] = [
        ...conversationHistory,
        {
          role: 'customer',
          message: customerMessage,
          timestamp: new Date().toISOString(),
        },
      ];

      setConversationHistory(newHistory);

      // Get auth token if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : '';
      
      // Generate anonymous ID if not authenticated
      const userId = session?.user?.id || 'anonymous-' + Math.random().toString(36).substr(2, 9);

      // Call Supabase Edge Function
      const response = await supabase.functions.invoke('booking-agent', {
        body: {
          customerMessage,
          conversationHistory,
          userId,
          requestId,
        },
        headers: authHeader ? { Authorization: authHeader } : {},
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to get response');
      }

      const data: BookingAgentResponse = response.data;

      const updatedHistory: DialogueMessage[] = [
        ...newHistory,
        {
          role: 'agent',
          message: data.agentMessage,
          timestamp: new Date().toISOString(),
        },
      ];

      setConversationHistory(updatedHistory);

      if (data.requestId) {
        setRequestId(data.requestId);
      }
    } catch (error) {
      console.error('Widget error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process message';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  // Closed/Hidden state - show pill button
  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 font-medium text-sm hover:scale-105 active:scale-95"
        aria-label="Open booking assistant"
      >
        <MessageCircle className="h-5 w-5" />
        <span>What service are you looking for?</span>
      </button>
    );
  }

  // Open state - show chat widget
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden border border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-primary to-primary/90 text-white px-5 py-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Concept Cleaning</h3>
            <p className="text-xs text-white/80">Usually replies instantly</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-white/20 rounded-full transition"
            aria-label="Minimize"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              setConversationHistory([]);
              setUserInput('');
            }}
            className="p-2 hover:bg-white/20 rounded-full transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-slate-50 max-h-[350px]">
            {conversationHistory.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center py-8">
                <div>
                  <MessageCircle className="h-8 w-8 mx-auto text-primary/30 mb-2" />
                  <p className="text-sm font-medium text-slate-900">What service are you looking for?</p>
                  <p className="text-xs text-slate-500 mt-1">Tell us your cleaning or pest control needs</p>
                </div>
              </div>
            ) : (
              <>
                {conversationHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        msg.role === 'customer'
                          ? 'bg-primary text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 rounded-lg rounded-bl-none px-3 py-2 flex gap-1">
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="border-t border-slate-200 p-3 bg-white flex gap-2"
          >
            <input
              type="text"
              placeholder="Type here..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={loading || !userInput.trim()}
              className="p-2 rounded-full bg-primary text-white hover:bg-primary/90 disabled:bg-slate-300 transition"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
