import { useState, useEffect } from 'react';
import { X, MessageCircle, Send, Loader2, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DialogueMessage {
  role: 'customer' | 'agent';
  message: string;
  timestamp: string;
}

interface ActionButton {
  label: string;
  action: string;
  type?: string;
}

interface BookingAgentResponse {
  status: 'success' | 'error';
  agentMessage: string;
  buttons?: ActionButton[];
  selectedService?: {
    id: string;
    name: string;
    price: number;
  };
  error?: string;
}

export default function BookingAgentWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<DialogueMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [buttons, setButtons] = useState<ActionButton[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);

  useEffect(() => {
    if (isOpen && conversationHistory.length === 0) {
      showInitialGreeting();
    }
  }, [isOpen]);

  const showInitialGreeting = () => {
    const greeting: DialogueMessage = {
      role: 'agent',
      message: '👋 Hi! Welcome to Concept Cleaning Services!\n\nWhat service do you need?',
      timestamp: new Date().toISOString(),
    };
    setConversationHistory([greeting]);

    console.log('INITIAL BUTTONS: about to set 8 buttons');
    setButtons([
      { label: '🛋️ Sofa & Furniture', action: 'sofa' },
      { label: '🏠 Carpet & Floor', action: 'carpet' },
      { label: '🚫 Pest Control', action: 'pest' },
      { label: '✨ Deep Cleaning', action: 'deepclean' },
      { label: '🛏️ Mattress & Bed', action: 'mattress' },
      { label: '🚗 Car Interior', action: 'car' },
      { label: '🏢 Office & Commercial', action: 'office' },
      { label: '🔨 Post Construction', action: 'postcon' },
    ]);
  };

  const handleButtonClick = async (action: string) => {
    if (action === 'custom') {
      setButtons([]);
      return;
    }

    setLoading(true);
    try {
      const newHistory: DialogueMessage[] = [
        ...conversationHistory,
        {
          role: 'customer',
          message: action,
          timestamp: new Date().toISOString(),
        },
      ];

      setConversationHistory(newHistory);

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'anonymous-' + Math.random().toString(36).substr(2, 9);

      const response = await supabase.functions.invoke('booking-agent', {
        body: {
          customerMessage: action,
          conversationHistory: newHistory,
          userId,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data: BookingAgentResponse = response.data;
      console.log('Response data:', data);

      const updatedHistory: DialogueMessage[] = [
        ...newHistory,
        {
          role: 'agent',
          message: data.agentMessage,
          timestamp: new Date().toISOString(),
        },
      ];

      setConversationHistory(updatedHistory);

      if (data.buttons && data.buttons.length > 0) {
        setButtons(data.buttons);
      } else {
        setButtons([]);
      }

      if (data.selectedService) {
        setSelectedService(data.selectedService);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({ title: 'Error', description: 'Failed to process your request', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
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

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'anonymous-' + Math.random().toString(36).substr(2, 9);

      const response = await supabase.functions.invoke('booking-agent', {
        body: {
          customerMessage,
          conversationHistory: newHistory,
          userId,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data: BookingAgentResponse = response.data;
      console.log('Response:', data);

      const updatedHistory: DialogueMessage[] = [
        ...newHistory,
        {
          role: 'agent',
          message: data.agentMessage,
          timestamp: new Date().toISOString(),
        },
      ];

      setConversationHistory(updatedHistory);

      if (data.buttons && data.buttons.length > 0) {
        setButtons(data.buttons);
      } else {
        setButtons([]);
      }

      if (data.selectedService) {
        setSelectedService(data.selectedService);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = () => {
    if (selectedService) {
      const bookingUrl = `/booking-engine?serviceId=${selectedService.id}&serviceName=${encodeURIComponent(selectedService.name)}&price=${selectedService.price}`;
      window.location.href = bookingUrl;
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full py-3 px-6 shadow-lg flex items-center gap-2 z-40"
        >
          <MessageCircle size={20} />
          <span>What service?</span>
        </button>
      )}

      {isOpen && (
        <div className={`fixed bottom-6 right-6 w-96 bg-white rounded-lg shadow-2xl z-50 flex flex-col transition-all ${isMinimized ? 'h-16' : 'h-[600px]'}`}>
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <div>
              <h3 className="font-bold">Concept Cleaning</h3>
              <p className="text-sm opacity-90">Usually replies instantly</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsMinimized(!isMinimized)} className="hover:bg-blue-700 p-2 rounded">
                <ChevronDown size={20} />
              </button>
              <button onClick={() => { setIsOpen(false); setConversationHistory([]); setButtons([]); setSelectedService(null); }} className="hover:bg-blue-700 p-2 rounded">
                <X size={20} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {conversationHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-4 py-2 rounded-lg whitespace-pre-wrap ${msg.role === 'customer' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'}`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 px-4 py-2 rounded-lg">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  </div>
                )}
              </div>

              {buttons.length > 0 && !selectedService && (
                <div className="px-4 py-3 border-t space-y-2 max-h-56 overflow-y-auto bg-gray-50">
                  {buttons.map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleButtonClick(btn.action)}
                      disabled={loading}
                      className="w-full bg-blue-100 hover:bg-blue-200 text-blue-900 px-4 py-2 rounded text-left text-sm font-medium disabled:opacity-50 transition"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}

              {selectedService && (
                <div className="px-4 py-3 border-t bg-green-50">
                  <p className="text-sm font-bold mb-3 text-gray-900">{selectedService.name}</p>
                  <button
                    onClick={handleBookNow}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded font-bold"
                  >
                    👉 Book Now - KES {selectedService.price}
                  </button>
                </div>
              )}

              {!selectedService && buttons.length === 0 && (
                <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Tell us something..."
                    disabled={loading}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading || !userInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
