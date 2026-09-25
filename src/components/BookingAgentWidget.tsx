/**
 * BOOKING AGENT WIDGET
 * Floating widget that appears 10 seconds after page load
 * Single line question: "What service are you looking for?"
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, MessageCircle, Send, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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
    if (!userInput.trim() || loading || !user) return;

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

      const response = await fetch('/api/booking-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sb-token')}`,
        },
        body: JSON.stringify({
          customerMessage,
          conversationHistory,
          userId: user.id,
          requestId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from booking agent');
      }

      const data: BookingAgentResponse = await response.json();

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

      // If service matched, offer to open full booking flow
      if (data.matchedService && data.matchedService.confidence > 0.6) {
        // Add a subtle suggestion to open full booking
        setTimeout(() => {
          setConversationHistory([
            ...updatedHistory,
            {
              role: 'agent',
              message: `Ready to book "${data.matchedService?.service_name}"? Open the full booking form for more details.`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }, 500);
      }
    } catch (error) {
      console.error('Widget error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process your message',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible || !user) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition-shadow animate-bounce"
          aria-label="Open booking assistant"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-xl flex flex-col h-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary text-white px-4 py-3 rounded-t-lg">
            <h3 className="font-semibold">Booking Assistant</h3>
            <button
              onClick={() => {
                setIsOpen(false);
                setConversationHistory([]);
                setUserInput('');
              }}
              className="hover:bg-primary-dark p-1 rounded"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-slate-50">
            {conversationHistory.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">
                  What service are you looking for?
                </p>
              </div>
            ) : (
              conversationHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'customer'
                        ? 'bg-primary text-white'
                        : 'bg-white border border-slate-200 text-slate-900'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="border-t border-slate-200 p-3 bg-white rounded-b-lg flex gap-2"
          >
            <Input
              placeholder="Type here..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button
              type="submit"
              disabled={loading || !userInput.trim()}
              size="sm"
              className="px-3"
            >
              <Send className="h-3 w-3" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
