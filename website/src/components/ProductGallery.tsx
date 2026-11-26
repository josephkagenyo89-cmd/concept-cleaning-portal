import { useState } from "react";
import { Package, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  mainImage: string | null;
  additionalImages?: string[];
  name: string;
}

const ProductGallery = ({ mainImage, additionalImages = [], name }: Props) => {
  const allImages = [mainImage, ...additionalImages].filter(Boolean) as string[];
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  if (allImages.length === 0) {
    return (
      <div className="aspect-square bg-muted flex items-center justify-center rounded-lg">
        <Package className="w-16 h-16 text-muted-foreground/40" />
      </div>
    );
  }

  const prev = () => setCurrent((c) => (c === 0 ? allImages.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === allImages.length - 1 ? 0 : c + 1));

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
    setTouchStart(null);
  };

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-square bg-muted rounded-lg overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={allImages[current]}
          alt={`${name} - image ${current + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {allImages.length > 1 && (
          <>
            <Button
              size="icon"
              variant="secondary"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80"
              onClick={prev}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80"
              onClick={next}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === current ? "bg-primary" : "bg-background/60"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                i === current ? "border-primary" : "border-transparent"
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
