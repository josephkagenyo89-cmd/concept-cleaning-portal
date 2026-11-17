import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

type PhotoRow = { id: string; storage_path: string; photo_category: string; original_filename: string | null; file_size_bytes: number; signedUrl?: string };
type Props = { requestId: string; itemId: string; minPhotos?: number; maxPhotos?: number; onCountChange?: (count: number) => void };
const db = supabase as any;
const BUCKET = 'booking-engine-photos';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CATEGORIES = [
  { value: 'overall_area', label: 'Overall area' },
  { value: 'problem_area', label: 'Problem area' },
  { value: 'stain', label: 'Stain' },
  { value: 'damage', label: 'Damage' },
  { value: 'pest_evidence', label: 'Pest evidence' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'other', label: 'Other' },
];

export default function BookingEnginePhotoUpload({ requestId, itemId, minPhotos = 0, maxPhotos, onCountChange }: Props) {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [category, setCategory] = useState('overall_area');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await db.from('booking_engine_request_photos')
      .select('id,storage_path,photo_category,original_filename,file_size_bytes')
      .eq('request_id', requestId).eq('request_item_id', itemId).order('display_order');
    if (result.error) {
      toast({ title: 'Could not load uploaded photos', description: result.error.message, variant: 'destructive' });
      return;
    }
    const rows = (result.data || []) as PhotoRow[];
    const signed = await Promise.all(rows.map(async photo => {
      const url = await supabase.storage.from(BUCKET).createSignedUrl(photo.storage_path, 3600);
      return { ...photo, signedUrl: url.data?.signedUrl };
    }));
    setPhotos(signed);
    onCountChange?.(rows.length);
  }, [requestId, itemId, onCountChange]);

  useEffect(() => { void refresh(); }, [refresh]);

  const upload = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    const selected = Array.from(files);
    if (maxPhotos && photos.length + selected.length > maxPhotos) {
      toast({ title: 'Photo limit reached', description: 'You can upload a maximum of ' + maxPhotos + ' photos.', variant: 'destructive' });
      return;
    }
    for (const file of selected) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: 'Unsupported photo format', description: 'Use JPG, PNG or WebP images.', variant: 'destructive' });
        return;
      }
      if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
        toast({ title: 'Photo is too large', description: 'Each image must be 10 MB or smaller.', variant: 'destructive' });
        return;
      }
    }

    setBusy(true);
    try {
      for (const file of selected) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'photo';
        const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
        const path = requestId + '/' + itemId + '/' + token + '-' + safeName;
        const stored = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (stored.error) throw stored.error;
        const metadata = await db.from('booking_engine_request_photos').insert({
          request_id: requestId,
          request_item_id: itemId,
          storage_path: path,
          photo_category: category,
          original_filename: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
        });
        if (metadata.error) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw metadata.error;
        }
      }
      toast({ title: 'Photos uploaded', description: 'Your photos are securely attached to this draft request.' });
      await refresh();
    } catch (error: any) {
      toast({ title: 'Photo upload failed', description: error?.message || 'Please try again.', variant: 'destructive' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: PhotoRow) => {
    if (busy) return;
    setBusy(true);
    try {
      const deleted = await db.from('booking_engine_request_photos').delete().eq('id', photo.id);
      if (deleted.error) throw deleted.error;
      const storage = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      if (storage.error) throw storage.error;
      await refresh();
      toast({ title: 'Photo removed' });
    } catch (error: any) {
      toast({ title: 'Could not remove photo', description: error?.message || 'Please retry.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP · maximum 10 MB each</p>
      <Badge variant={photos.length >= minPhotos ? 'secondary' : 'outline'}>{photos.length}{minPhotos ? ' / at least ' + minPhotos : ' uploaded'}{maxPhotos ? ' · max ' + maxPhotos : ''}</Badge>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
        <SelectContent>{CATEGORIES.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {busy ? 'Uploading…' : 'Add photos'}
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || (!!maxPhotos && photos.length >= maxPhotos)} onChange={event => { void upload(event.target.files); event.currentTarget.value = ''; }} />
      </label>
    </div>
    {photos.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map(photo => <div key={photo.id} className="overflow-hidden rounded-lg border">
        {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.original_filename || 'Uploaded service photo'} className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">Preview unavailable</div>}
        <div className="flex items-center justify-between gap-2 p-2">
          <span className="min-w-0 truncate text-xs">{CATEGORIES.find(x => x.value === photo.photo_category)?.label || photo.photo_category}</span>
          <Button type="button" size="icon" variant="ghost" aria-label="Remove photo" onClick={() => void remove(photo)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>)}
    </div>}
    {photos.length < minPhotos && <p className="text-xs text-amber-700">Upload {minPhotos - photos.length} more photo(s) before submitting.</p>}
  </div>;
}
