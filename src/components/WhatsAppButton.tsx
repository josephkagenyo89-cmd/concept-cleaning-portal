import { MessageCircle } from 'lucide-react';

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/254796563741"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-[hsl(142,70%,45%)] px-4 py-3 text-white shadow-lg hover:opacity-90 transition-opacity md:bottom-6"
      aria-label="Contact support on WhatsApp"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm font-medium hidden sm:inline">Need Help?</span>
    </a>
  );
}
