import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ImageComparison {
  id: string;
  label: string;
  beforeImage: string | null;
  afterImage: string | null;
  beforeAlt: string;
  afterAlt: string;
}

interface ImageCompareSliderProps {
  comparisons: ImageComparison[];
  className?: string;
  aspectClassName?: string;
  showHint?: boolean;
}

const ImageCompareSlider = ({
  comparisons,
  className = "",
  aspectClassName = "aspect-[4/3]",
  showHint = true,
}: ImageCompareSliderProps) => {
  const [activeId, setActiveId] = useState(comparisons[0]?.id ?? "");
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const activeComparison = comparisons.find((comparison) => comparison.id === activeId) ?? comparisons[0];

  if (!activeComparison) return null;

  const updatePosition = (clientX: number, element: HTMLDivElement) => {
    const bounds = element.getBoundingClientRect();
    if (bounds.width === 0) return;
    const nextPosition = ((clientX - bounds.left) / bounds.width) * 100;
    setPosition(Math.min(100, Math.max(0, nextPosition)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updatePosition(event.clientX, event.currentTarget);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) updatePosition(event.clientX, event.currentTarget);
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      setPosition((current) => Math.max(0, current - 5));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      setPosition((current) => Math.min(100, current + 5));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPosition(100);
    }
  };

  return (
    <div className={`w-full ${className}`} onClick={(event) => event.stopPropagation()}>
      {showHint && (
        <div className="flex items-center justify-between gap-3 pb-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Before & after
          </span>
          <span className="font-display text-sm italic text-accent-foreground">Drag to compare</span>
        </div>
      )}

      {comparisons.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto rounded-xl bg-muted p-1" role="tablist" aria-label="Compare work by category">
          {comparisons.map((comparison) => (
            <Button
              key={comparison.id}
              type="button"
              size="sm"
              variant={activeComparison.id === comparison.id ? "default" : "ghost"}
              role="tab"
              aria-selected={activeComparison.id === comparison.id}
              onClick={() => {
                setActiveId(comparison.id);
                setPosition(50);
              }}
              className="shrink-0"
            >
              {comparison.label}
            </Button>
          ))}
        </div>
      )}

      <div
        className={`relative w-full overflow-hidden rounded-xl bg-muted select-none touch-pan-y ${aspectClassName} ${dragging ? "cursor-ew-resize" : "cursor-col-resize"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={0}
        aria-label={`${activeComparison.label} before and after comparison`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}% before visible`}
      >
        {activeComparison.afterImage ? (
          <img
            src={activeComparison.afterImage}
            alt={activeComparison.afterAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">After photo coming soon</div>
        )}

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          {activeComparison.beforeImage ? (
            <img
              src={activeComparison.beforeImage}
              alt={activeComparison.beforeAlt}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">Before photo coming soon</div>
          )}
        </div>

        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground shadow-card">
          Before
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-card">
          After
        </span>

        <div
          className="pointer-events-none absolute inset-y-0 z-10 flex -translate-x-1/2 items-center justify-center"
          style={{ left: `${position}%` }}
        >
          <div className="absolute inset-y-0 w-0.5 bg-background shadow-card" />
          <Button
            type="button"
            tabIndex={-1}
            size="icon"
            variant="secondary"
            aria-hidden="true"
            className="pointer-events-none relative h-11 w-11 rounded-full border-2 border-gold bg-background text-primary shadow-soft"
          >
            <ChevronsLeftRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageCompareSlider;