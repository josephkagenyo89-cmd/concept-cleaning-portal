import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";

const WhatsAppButton = () => (
  <a
    href={whatsappLink("Hello, I would like to book a cleaning service")}
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald hover:bg-emerald-dark text-white shadow-glow hover:scale-110 transition-all flex items-center justify-center group ring-4 ring-emerald/20"
    aria-label="Chat on WhatsApp"
  >
    <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
    <span className="absolute inset-0 rounded-full bg-emerald animate-ping opacity-20" />
  </a>
);

export default WhatsAppButton;
