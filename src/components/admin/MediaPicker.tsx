import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, ImagePlus, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';

type MediaItem = { name: string; url: string };

export default function MediaPicker({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast.error('Please select an image');

    setUploading(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      setItems((prev) => [{ name: file.name, url: objectUrl }, ...prev]);
      onChange(objectUrl);
      setOpen(false);
      toast.success('Image selected');
    } catch (e: any) {
      toast.error(e?.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type='button' variant='outline'>
          <ImagePlus className='mr-2 h-4 w-4' />Media Picker
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[85vh] max-w-4xl overflow-y-auto'>
        <DialogHeader><DialogTitle>Select blog image</DialogTitle></DialogHeader>
        <div className='flex items-center justify-between gap-3'>
          <p className='text-sm text-muted-foreground'>Upload a local image for this post. No storage bucket is required.</p>
          <label className='inline-flex cursor-pointer items-center'>
            <input type='file' accept='image/*' className='hidden' disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
            <span className='inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground'>{uploading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Upload className='mr-2 h-4 w-4' />}Upload image</span>
          </label>
        </div>

        {items.length === 0 ? (
          <div className='rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground'>No local media selected yet. Upload the first image.</div>
        ) : (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
            {items.map((item) => (
              <button key={item.name} type='button' onClick={() => { onChange(item.url); setOpen(false); }} className='group overflow-hidden rounded-lg border text-left'>
                <div className='relative aspect-[16/10] bg-muted'>
                  <img src={item.url} alt={item.name} className='h-full w-full object-cover' />
                  {value === item.url && <span className='absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground'><Check className='h-4 w-4' /></span>}
                </div>
                <p className='truncate p-2 text-xs'>{item.name}</p>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}