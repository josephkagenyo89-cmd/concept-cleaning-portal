import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, ImagePlus, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';

type MediaItem = { name: string; url: string; created_at?: string | null };

export default function MediaPicker({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from('assets').list('blog', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) toast.error(error.message);
    else setItems((data || []).filter((f) => f.name && f.metadata?.mimetype?.startsWith('image/')).map((f) => ({
      name: f.name,
      url: supabase.storage.from('assets').getPublicUrl('blog/' + f.name).data.publicUrl,
      created_at: f.created_at
    })));
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast.error('Please select an image');
    setUploading(true);
    try {
      const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '.jpg';
      const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image';
      const path = 'blog/' + Date.now() + '-' + base + ext;
      const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const url = supabase.storage.from('assets').getPublicUrl(path).data.publicUrl;
      onChange(url);
      toast.success('Image uploaded and selected');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Image upload failed');
    } finally { setUploading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type='button' variant='outline'><ImagePlus className='mr-2 h-4 w-4' />Media Picker</Button></DialogTrigger>
      <DialogContent className='max-h-[85vh] max-w-4xl overflow-y-auto'>
        <DialogHeader><DialogTitle>Select blog image</DialogTitle></DialogHeader>
        <div className='flex items-center justify-between gap-3'>
          <p className='text-sm text-muted-foreground'>Choose an existing image or upload a new one.</p>
          <label className='inline-flex cursor-pointer items-center'>
            <input type='file' accept='image/*' className='hidden' disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
            <span className='inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground'>{uploading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Upload className='mr-2 h-4 w-4' />}Upload image</span>
          </label>
        </div>
        {loading ? <div className='flex justify-center py-12'><Loader2 className='h-6 w-6 animate-spin' /></div> : items.length === 0 ? <div className='rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground'>No blog media yet. Upload the first image.</div> :
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
            {items.map((item) => <button key={item.name} type='button' onClick={() => { onChange(item.url); setOpen(false); }} className='group overflow-hidden rounded-lg border text-left'>
              <div className='relative aspect-[16/10] bg-muted'><img src={item.url} alt={item.name} className='h-full w-full object-cover' />{value === item.url && <span className='absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground'><Check className='h-4 w-4' /></span>}</div>
              <p className='truncate p-2 text-xs'>{item.name}</p>
            </button>)}
          </div>}
      </DialogContent>
    </Dialog>
  );
}