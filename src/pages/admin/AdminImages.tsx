// @ts-nocheck
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Edit2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fetchServiceCategories, FALLBACK_CATEGORIES } from '@/lib/serviceCategories';

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default function AdminImages() {
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    listFiles();
    (async () => {
      try {
        const names = await fetchServiceCategories(true).then((c) => c.map((x) => x.name));
        setCategories(names.length ? names : FALLBACK_CATEGORIES);
      } catch (e) {
        setCategories(FALLBACK_CATEGORIES);
      }
    })();
  }, []);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function listFiles() {
    try {
      const { data, error } = await supabase.storage.from('assets').list('', { limit: 500 });
      if (error) throw error;
      setFiles(data || []);
    } catch (e: any) {
      console.error('Could not list files', e);
      toast({ title: 'Error', description: 'Could not list storage files', variant: 'destructive' });
    }
  }

  async function handleUpload(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    const file = filesList[0];
    await uploadFile(file);
  }

  async function handleUploadForCategory(cat: string, filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    const file = filesList[0];
    const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
    const filename = `categories/${slugify(cat)}${ext}`;
    await uploadFile(file, filename, `${file.name} uploaded for ${cat}`);
  }

  async function uploadFile(file: File, destPath?: string, successMessage?: string) {
    const path = destPath || file.name;
    setUploading(true);
    setUploadStatus((s) => ({ ...s, [path]: 'starting' }));
    setUploadProgress((p) => ({ ...p, [path]: 0 }));
    try {
      // Supabase JS client does not expose progress callbacks for browser uploads.
      // We'll upload and then poll for the file to appear in the public listing to monitor completion.
      setUploadStatus((s) => ({ ...s, [path]: 'uploading' }));
      const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true });
      if (error) throw error;
      // Start a short polling monitor to confirm file appears and mark progress.
      await monitorUploadCompletion(path);
      setUploadProgress((p) => ({ ...p, [path]: 100 }));
      setUploadStatus((s) => ({ ...s, [path]: 'completed' }));
      toast({ title: 'Uploaded', description: successMessage || `${file.name} uploaded.` });
      await listFiles();
    } catch (e: any) {
      console.error('Upload failed', e);
      setUploadStatus((s) => ({ ...s, [path]: 'failed' }));
      setUploadProgress((p) => ({ ...p, [path]: 0 }));
      toast({ title: 'Upload failed', description: e.message || 'Failed to upload file', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  async function monitorUploadCompletion(path: string, timeout = 15000, interval = 800) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const { data } = supabase.storage.from('assets').getPublicUrl(path);
        const pub = data?.publicUrl || data?.publicURL || null;
        if (pub) return true;
      } catch (e) {
        // ignore
      }
      // Update an approximate progress percentage while waiting
      setUploadProgress((p) => {
        const current = p[path] || 0;
        const next = Math.min(95, current + Math.floor(Math.random() * 20) + 5);
        return { ...p, [path]: next };
      });
      // sleep
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, interval));
    }
    // timed out
    setUploadStatus((s) => ({ ...s, [path]: 'timeout' }));
    return false;
  }

  // Open native file picker (Media Picker) when available
  async function pickAndUpload(fallbackElement: HTMLInputElement | null, category?: string) {
    try {
      if ((window as any).showOpenFilePicker) {
        const opts = [{ description: 'Images', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] } }];
        // @ts-ignore
        const [handle] = await window.showOpenFilePicker({ multiple: false, types: opts });
        const file = await handle.getFile();
        if (category) {
          const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
          const filename = `categories/${slugify(category)}${ext}`;
          await uploadFile(file, filename, `${file.name} uploaded for ${category}`);
        } else {
          await uploadFile(file);
        }
        return;
      }
    } catch (e) {
      // Fall through to fallback input
      console.warn('showOpenFilePicker failed or cancelled', e);
    }

    // Fallback: open the hidden file input
    if (fallbackElement) {
      fallbackElement.value = '';
      fallbackElement.click();
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.storage.from('assets').remove([name]);
      if (error) throw error;
      toast({ title: 'Deleted', description: name });
      await listFiles();
    } catch (e: any) {
      console.error('Delete failed', e);
      toast({ title: 'Delete failed', description: e.message || 'Failed to delete', variant: 'destructive' });
    }
  }

  async function handleRename(oldName: string) {
    const newName = prompt('New filename (including extension)', oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;

    try {
      const { data, error: dlError } = await supabase.storage.from('assets').download(oldName);
      if (dlError) throw dlError;

      const blob = await data.arrayBuffer();
      const file = new File([blob], newName);

      const { error: upError } = await supabase.storage.from('assets').upload(newName, file, { upsert: true });
      if (upError) throw upError;

      const { error: rmError } = await supabase.storage.from('assets').remove([oldName]);
      if (rmError) throw rmError;

      toast({ title: 'Renamed', description: `${oldName} → ${newName}` });
      await listFiles();
    } catch (e: any) {
      console.error('Rename failed', e);
      toast({ title: 'Rename failed', description: e.message || 'Failed to rename', variant: 'destructive' });
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold">Category Images</h1>
        <p className="text-sm text-muted-foreground">Upload or replace an image for a category. Changes will be used as the category image across the marketplace.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => {
          const slug = slugify(cat);
          const path = `categories/${slug}.jpg`;
          const { data } = supabase.storage.from('assets').getPublicUrl(path as string);
          const publicUrl = data?.publicUrl || data?.publicURL || null;

          return (
            <div key={cat} className="rounded border bg-card p-3 flex items-center gap-4">
              <div className="w-24 h-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                {publicUrl ? (
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <img src={publicUrl} alt={cat} className="w-full h-full object-cover" />
                  </a>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                )}
              </div>

              <div className="flex-1">
                <div className="font-medium">{cat}</div>
                <div className="text-xs text-muted-foreground">Filename: {`categories/${slug}.jpg`}</div>
                {uploadStatus[`categories/${slug}.jpg`] && (
                  <div className="text-xs mt-1">
                    <span className="font-medium">Status:</span> {uploadStatus[`categories/${slug}.jpg`]}
                    <div className="w-full bg-muted h-2 rounded mt-1 overflow-hidden">
                      <div
                        style={{ width: `${uploadProgress[`categories/${slug}.jpg`] || 0}%` }}
                        className="h-2 bg-green-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <>
                  <input
                    ref={(el) => (fileInputs.current[slug] = el)}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadForCategory(cat, e.target.files)}
                  />
                  <Button
                    size="sm"
                    onClick={() => pickAndUpload(fileInputs.current[slug], cat)}
                    className="flex items-center gap-2"
                  >
                    <Upload /> Upload
                  </Button>
                </>
                <div className="flex gap-2">
                  <button className="text-xs text-muted-foreground" onClick={() => handleRename(path)}><Edit2 /></button>
                  <button className="text-xs text-muted-foreground" onClick={() => handleDelete(path)}><Trash2 /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded border bg-card p-3">
        <h2 className="font-semibold mb-2">All files</h2>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files in storage.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f: any) => (
              <li key={f.name} className="flex items-center justify-between">
                <div className="truncate">{f.name}</div>
                <div className="flex items-center gap-2">
                  <button className="text-xs text-muted-foreground" onClick={() => handleRename(f.name)}><Edit2 /></button>
                  <button className="text-xs text-muted-foreground" onClick={() => handleDelete(f.name)}><Trash2 /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
