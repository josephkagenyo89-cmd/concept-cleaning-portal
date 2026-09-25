/**
 * BOOKING AGENT DIALOGUE COMPONENT
 * Conversational AI interface for service selection
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Send, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DialogueMessage {
  role: 'customer' | 'agent';
  message: string;
  timestamp: string;
}

interface BookingAgentResponse {
  status: 'success' | 'error';
  agentMessage: string;
  extractedFacts?: Record<string, unknown>;
  matchedService?: {
    service_id: string;
    service_name: string;
    confidence: number;
  };
  photosRequired: boolean;
  photoReason?: string;
  nextStep: 'continue_dialogue' | 'collect_photos' | 'submit_request' | 'error';
  requestId?: string;
}

interface BookingAgentDialogueProps {
  userId: string;
  onServiceSelected: (serviceId: string, requestId: string) => void;
  onPhotosRequired: (requestId: string, reason: string) => void;
}

export default function BookingAgentDialogue({
  userId,
  onServiceSelected,
  onPhotosRequired,
}: BookingAgentDialogueProps) {
  const [conversationHistory, setConversationHistory] = useState<DialogueMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    const customerMessage = userInput.trim();
    setUserInput('');
    setLoading(true);

    try {
      // Add customer message to history
      const newHistory: DialogueMessage[] = [
        ...conversationHistory,
        {
          role: 'customer',
          message: customerMessage,
          timestamp: new Date().toISOString(),
        },
      ];

      setConversationHistory(newHistory);

      // Call booking agent API
      const response = await fetch('/api/booking-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sb-token')}`,
        },
        body: JSON.stringify({
          customerMessage,
          conversationHistory,
          userId,
          requestId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from booking agent');
      }

      const data: BookingAgentResponse = await response.json();

      // Add agent response to history
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

      // Handle next step
      if (data.nextStep === 'collect_photos' && data.requestId) {
        onPhotosRequired(data.requestId, data.photoReason || 'required');
      } else if (
        data.matchedService &&
        data.nextStep === 'continue_dialogue' &&
        data.requestId
      ) {
        // Service matched with high confidence - ask to confirm
        setConversationHistory([
          ...updatedHistory,
          {
            role: 'agent',
            message: `Great! I matched your request to "${data.matchedService.service_name}". Should I proceed with this service?`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error('Booking agent error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process your message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Chat Messages */}
      <Card className="h-96 overflow-y-auto bg-slate-50">
        <CardContent className="space-y-4 p-4">
          {conversationHistory.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Hi! I&apos;m your booking assistant.
                </p>
                <p className="text-xs text-muted-foreground">
                  Tell me what cleaning service you need.
                </p>
              </div>
            </div>
          ) : (
            <>
              {conversationHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === 'customer' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'customer'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-slate-200 text-slate-900'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Input Form */}
      <form onSubmit={sendMessage} className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Tell me what you need..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={loading || !userInput.trim()}
            size="sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex gap-2 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span>Photos may be needed after confirmation</span>
        </div>
      </form>
    </div>
  );
}
