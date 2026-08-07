import { MessageCircle } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

/**
 * Floating "Customer Care" WhatsApp button for the public marketplace and the
 * customer portal. The number comes from ERP Settings → General.
 */
export default function CustomerCareButton() {
  const { settings } = useSettings();
  const phone = (settings.general.phone || '+254796563741').replace(/\D/g, '');
  const normalized = phone.startsWith('0') ? `254${phone.slice(1)}` : phone;
  const href = `https://wa.me/${normalized}?text=${encodeURIComponent(
    'Hello Concept Cleaning Services, I need assistance.'
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact Customer Care on WhatsApp"
      className="fixed bottom-28 right-4 z-50 flex items-center gap-2 rounded-full bg-[hsl(142,70%,45%)] px-4 py-3 text-white shadow-lg transition-opacity hover:opacity-90 md:bottom-24"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm font-semibold">Customer Care</span>
    </a>
  );
}
