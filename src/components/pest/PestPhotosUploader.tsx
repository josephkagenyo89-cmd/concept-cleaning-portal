import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Photo { id: string; storage_path: string; kind: string; caption: string | null; signedUrl?: string; }

export default function PestPhotosUploader({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [kind, setKind] = useState<'before' | 'after' | 'evidence'>('before');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await (supabase as any).from('pest_photos').select('*').eq('pest_job_id', jobId).order('created_at');
    const list = (data as Photo[]) || [];
    // create signed URLs for display
    for (const p of list) {
      const { data: signed } = await (supabase as any).storage.from('pest-photos').createSignedUrl(p.storage_path, 3600);
      p.signedUrl = signed?.signedUrl;
    }
    setPhotos(list);
  };
  useEffect(() => { load(); }, [jobId]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${jobId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error: upErr } = await (supabase as any).storage.from('pest-photos').upload(path, file, { upsert: false });
      if (upErr) { toast({ title: upErr.message, variant: 'destructive' }); continue; }
      await (supabase as any).from('pest_photos').insert({ pest_job_id: jobId, storage_path: path, kind, uploaded_by: user!.id });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    load();
  };

  const remove = async (p: Photo) => {
    await (supabase as any).storage.from('pest-photos').remove([p.storage_path]);
    await (supabase as any).from('pest_photos').delete().eq('id', p.id);
    load();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="before">Before</option>
          <option value="after">After</option>
          <option value="evidence">Infestation evidence</option>
        </select>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} className="text-sm" />
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {photos.length === 0 ? <p className="text-sm text-muted-foreground">No photos uploaded.</p> :
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded border overflow-hidden">
              {p.signedUrl ? <img src={p.signedUrl} alt={p.kind} className="w-full h-32 object-cover" /> : <div className="w-full h-32 bg-muted" />}
              <div className="flex items-center justify-between p-2">
                <Badge variant="outline">{p.kind}</Badge>
                <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      }
      <p className="text-xs text-muted-foreground"><Upload className="h-3 w-3 inline mr-1" /> Photos are stored privately in Lovable Cloud.</p>
    </Card>
  );
}
