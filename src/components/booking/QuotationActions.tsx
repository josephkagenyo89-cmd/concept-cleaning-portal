import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { downloadQuotationPdf, shareQuotationWhatsApp } from '@/lib/quotationPdf';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface QuotationActionsProps {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  serviceDate: Date | undefined;
  price: number;
  userId: string;
  userName: string;
  userRole: string;
  disabled?: boolean;
}

export default function QuotationActions({
  clientName, clientPhone, serviceName, serviceDate, price, userId, userName, userRole, disabled
}: QuotationActionsProps) {
  const [generating, setGenerating] = useState(false);

  const getQuotationData = async () => {
    // Get next quotation number
    const { data: numData, error: numError } = await supabase.rpc('next_quotation_number');
    if (numError || !numData) {
      toast({ title: 'Failed to generate quotation number', variant: 'destructive' });
      return null;
    }
    const quotationNumber = numData as string;
    const dateStr = serviceDate ? format(serviceDate, 'PPP') : format(new Date(), 'PPP');

    // Save to database
    const { error: saveError } = await supabase.from('quotations' as any).insert({
      quotation_number: quotationNumber,
      client_name: clientName,
      client_phone: clientPhone,
      service_name: serviceName,
      service_date: serviceDate ? format(serviceDate, 'yyyy-MM-dd') : null,
      price,
      created_by: userId,
      created_by_name: userName,
      created_by_role: userRole,
    });
    if (saveError) {
      toast({ title: 'Failed to save quotation', description: saveError.message, variant: 'destructive' });
      return null;
    }

    return {
      quotationNumber,
      quotationDate: format(new Date(), 'PPP'),
      clientName,
      clientPhone,
      serviceName,
      serviceDate: dateStr,
      price,
    };
  };

  const handleDownload = async () => {
    setGenerating(true);
    const data = await getQuotationData();
    if (data) {
      downloadQuotationPdf(data);
      toast({ title: 'Quotation generated', description: data.quotationNumber });
    }
    setGenerating(false);
  };

  const handleShare = async () => {
    setGenerating(true);
    const data = await getQuotationData();
    if (data) {
      shareQuotationWhatsApp(data);
      toast({ title: 'Quotation generated & WhatsApp opened', description: data.quotationNumber });
    }
    setGenerating(false);
  };

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={disabled || generating}
      >
        <FileText className="h-4 w-4 mr-1" />
        {generating ? 'Generating...' : 'Download Quotation'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleShare}
        disabled={disabled || generating}
        className="text-[hsl(142,70%,45%)]"
      >
        <Share2 className="h-4 w-4 mr-1" />
        Share to Client
      </Button>
    </div>
  );
}
