import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { compressImageToWebP } from '@/lib/imageCompression';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, ImagePlus, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';

type MediaItem = { name: string; metadata?: Record<string, unknown> };
const BUCKET = 'assets';
const FOLDER = 'blog-covers';

export default function MediaPicker({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const publicUrl = (name: string) => supabase.storage.from(BUCKET).getPublicUrl(FOLDER + '/' + name).data.publicUrl;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from(BUCKET).list(FOLDER, { limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) toast.error('Could not load blog media: ' + error.message);
    else setItems((data || []).filter(item => !!item.name && String(item.metadata?.mimetype || '').startsWith('image/')) as MediaItem[]);
    setLoading(false);
  };
  useEffect(() => { if (open) void load(); }, [open]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImageToWebP(file);
      const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
      const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'blog-cover';
      const name = base + '-' + token + '.webp';
      const { error } = await supabase.storage.from(BUCKET).upload(FOLDER + '/' + name, compressed, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
      if (error) throw error;
      onChange(publicUrl(name));
      await load();
      setOpen(false);
      toast.success('Image compressed and uploaded (' + (compressed.size / 1024).toFixed(1) + ' KB)');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Image upload failed');
    } finally { setUploading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type='button' variant='outline'><ImagePlus className='mr-2 h-4 w-4' />Media library</Button></DialogTrigger>
      <DialogContent className='max-h-[85vh] max-w-4xl overflow-y-auto'>
        <DialogHeader><DialogTitle>Select blog cover image</DialogTitle></DialogHeader>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-sm text-muted-foreground'>Images are converted to WebP and limited to 20 KB before upload.</p>
          <label className='inline-flex cursor-pointer items-center'>
            <input type='file' accept='image/jpeg,image/png,image/webp' className='hidden' disabled={uploading} onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void upload(file); }} />
            <span className='inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground'>{uploading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Upload className='mr-2 h-4 w-4' />}{uploading ? 'Compressing…' : 'Upload image'}</span>
          </label>
        </div>
        {loading ? <div className='py-10 text-center text-sm text-muted-foreground'>Loading media…</div> : items.length === 0 ? (
          <div className='rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground'>No blog images uploaded yet.</div>
        ) : (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
            {items.map(item => {
              const url = publicUrl(item.name);
              return <button key={item.name} type='button' onClick={() => { onChange(url); setOpen(false); }} className='group overflow-hidden rounded-lg border text-left'>
                <div className='relative aspect-[16/10] bg-muted'><img src={url} alt={item.name} loading='lazy' className='h-full w-full object-cover' />{value === url && <span className='absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground'><Check className='h-4 w-4' /></span>}</div>
                <p className='truncate p-2 text-xs'>{item.name}</p>
              </button>;
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
