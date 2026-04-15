import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface Props {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSigned: () => void;
  hasClientSignature: boolean;
}

export default function StaffSignatureDialog({ bookingId, open, onOpenChange, onSigned, hasClientSignature }: Props) {
  const { profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSigned, setHasSigned] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasSigned(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const submit = async () => {
    if (!hasSigned) return;
    setSubmitting(true);
    try {
      const signature = canvasRef.current!.toDataURL('image/png');
      const staffName = profile?.full_name || 'Staff';

      const updateData: any = {
        staff_signature: signature,
        staff_signed_at: new Date().toISOString(),
        staff_signed_name: staffName,
      };

      // If client also signed, mark as fully_confirmed
      if (hasClientSignature) {
        updateData.status = 'fully_confirmed';
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (error) throw error;

      toast({ title: 'Signature saved', description: hasClientSignature ? 'Booking fully confirmed!' : 'Awaiting client signature.' });
      onSigned();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onOpenAutoFocus={() => setTimeout(initCanvas, 100)}>
        <DialogHeader>
          <DialogTitle>Staff Service Confirmation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            By signing below, you confirm that the cleaning service has been completed as agreed.
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Staff: {profile?.full_name}</p>
            <Button size="sm" variant="ghost" onClick={clearCanvas} className="h-7 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />Clear
            </Button>
          </div>
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none"
              style={{ height: 140 }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={!hasSigned || submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Confirm & Sign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
