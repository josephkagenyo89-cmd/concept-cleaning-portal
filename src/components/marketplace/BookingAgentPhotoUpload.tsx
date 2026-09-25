/**
 * BOOKING AGENT PHOTO UPLOAD COMPONENT
 * Handles photo capture and upload for booking requests
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PhotoFile {
  id: string;
  file: File;
  preview: string;
  category: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
}

interface BookingAgentPhotoUploadProps {
  requestId: string;
  requestItemId?: string;
  userId: string;
  reason: string;
  onComplete: () => void;
  onCancel: () => void;
}

const PHOTO_CATEGORIES = [
  { value: 'overall_area', label: 'Overall area' },
  { value: 'problem_area', label: 'Problem area' },
  { value: 'stain', label: 'Stain or damage' },
  { value: 'pest_evidence', label: 'Pest evidence' },
  { value: 'measurement', label: 'Measurement reference' },
  { value: 'other', label: 'Other' },
];

export default function BookingAgentPhotoUpload({
  requestId,
  requestItemId,
  userId,
  reason,
  onComplete,
  onCancel,
}: BookingAgentPhotoUploadProps) {
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('overall_area');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file',
          description: 'Only image files are allowed.',
          variant: 'destructive',
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10 MB.',
          variant: 'destructive',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const photoFile: PhotoFile = {
          id: Math.random().toString(36).substr(2, 9),
          file,
          preview: event.target?.result as string,
          category: selectedCategory,
          uploading: false,
          uploaded: false,
        };
        setPhotos((prev) => [...prev, photoFile]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== id));
  };

  const uploadPhotos = async () => {
    if (photos.length === 0) {
      toast({
        title: 'No photos',
        description: 'Please add at least one photo.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      for (const photo of photos) {
        if (photo.uploaded) continue;

        const photoToUpload = { ...photo, uploading: true };
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? photoToUpload : p))
        );

        const response = await fetch('/api/booking-agent/upload-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('sb-token')}`,
          },
          body: JSON.stringify({
            requestId,
            requestItemId,
            category: photo.category,
            fileName: photo.file.name,
            fileData: photo.preview,
            mimeType: photo.file.type,
            userId,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Upload failed');
        }

        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photo.id ? { ...p, uploading: false, uploaded: true } : p
          )
        );
      }

      toast({
        title: 'Success',
        description: 'All photos uploaded successfully.',
      });

      onComplete();
    } catch (error) {
      console.error('Photo upload error:', error);
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'Failed to upload photos.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const allUploaded = photos.every((p) => p.uploaded);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="font-semibold">Add Photos</h3>
          <p className="text-sm text-muted-foreground">
            {reason === 'quotation_required'
              ? 'We need photos to provide an accurate quote.'
              : reason === 'unmatched_service'
              ? 'Photos help us understand your needs better.'
              : 'Please add photos to proceed.'}
          </p>
        </div>

        {/* Category Selector */}
        <div className="space-y-2">
          <Label htmlFor="photo-category">Photo type</Label>
          <select
            id="photo-category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={uploading}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PHOTO_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          Add photos
        </Button>

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative">
                <img
                  src={photo.preview}
                  alt="Preview"
                  className="h-32 w-full rounded-md object-cover"
                />

                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => removePhoto(photo.id)}
                    disabled={uploading}
                    className="gap-1"
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </Button>
                </div>

                {photo.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}

                {photo.uploaded && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                )}

                {photo.error && (
                  <div className="absolute top-2 right-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                )}

                <p className="mt-1 text-xs text-muted-foreground">
                  {PHOTO_CATEGORIES.find((c) => c.value === photo.category)
                    ?.label || 'Unknown'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={uploading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={uploadPhotos}
            disabled={uploading || photos.length === 0}
            className="flex-1"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : allUploaded ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Continue
              </>
            ) : (
              'Upload photos'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
