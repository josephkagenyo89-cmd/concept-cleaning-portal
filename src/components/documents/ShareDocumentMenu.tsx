import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Share2, FileText, Star, Award, ChevronDown } from 'lucide-react';
import { shareDocumentWhatsApp, DocumentData } from '@/lib/documentPdf';
import { loadAllSettings } from '@/lib/settings';
import { toast } from '@/hooks/use-toast';

interface ShareDocumentMenuProps {
  /** Primary document to share (typically an invoice). */
  document: DocumentData;
  /** Optional certificate document (service or pest) — enables "Send Certificate + Review". */
  certificate?: DocumentData | null;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
  label?: string;
  iconOnly?: boolean;
  disabled?: boolean;
}

export default function ShareDocumentMenu({
  document,
  certificate,
  size = 'sm',
  variant = 'outline',
  label = 'Send Invoice + Review Request',
  iconOnly = false,
  disabled,
}: ShareDocumentMenuProps) {
  const [busy, setBusy] = useState(false);

  const phone = (document.clientPhone || '').trim();
  if (!phone) return null;

  const share = async (doc: DocumentData, withReview: boolean) => {
    setBusy(true);
    try {
      let reviewUrl = '';
      if (withReview) {
        const settings = await loadAllSettings();
        reviewUrl = settings.integrations?.google_review_url || '';
        if (!reviewUrl) {
          toast({
            title: 'Google review link not set',
            description: 'Add it in Settings → Integrations. Sending message without review link.',
          });
        }
      }
      shareDocumentWhatsApp(doc, {
        mode: withReview ? 'document_with_review' : 'document_only',
        googleReviewUrl: reviewUrl,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          disabled={disabled || busy}
          className={variant === 'ghost' ? 'text-[hsl(142,70%,45%)]' : ''}
          title={label}
        >
          <Share2 className="h-4 w-4" />
          {!iconOnly && <span className="ml-1">{busy ? 'Opening…' : label}</span>}
          {!iconOnly && <ChevronDown className="h-3 w-3 ml-1 opacity-70" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Share via WhatsApp</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => share(document, false)}>
          <FileText className="h-4 w-4 mr-2" />
          Send {document.documentType === 'invoice' ? 'Invoice' : 'Document'} Only
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => share(document, true)}>
          <Star className="h-4 w-4 mr-2 text-amber-500" />
          Send {document.documentType === 'invoice' ? 'Invoice' : 'Document'} + Review Request
        </DropdownMenuItem>
        {certificate && (
          <DropdownMenuItem onClick={() => share(certificate, true)}>
            <Award className="h-4 w-4 mr-2 text-[hsl(174,60%,45%)]" />
            Send Certificate + Review Request
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
