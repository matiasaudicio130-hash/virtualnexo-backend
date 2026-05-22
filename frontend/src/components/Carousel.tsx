import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProtectedImage } from "@/components/ProtectedImage";

interface MediaItem { url: string; type?: string; }

interface Props {
  items:    MediaItem[];
  aspectRatio?: "square" | "portrait" | "auto";
}

export function Carousel({ items, aspectRatio = "square" }: Props) {
  const [idx, setIdx]     = useState(0);
  const startX            = useRef(0);
  const dragging          = useRef(false);

  if (!items || items.length === 0) return null;
  if (items.length === 1) {
    return <SingleMedia item={items[0]} aspectRatio={aspectRatio} />;
  }

  function prev() { setIdx(i => Math.max(0, i - 1)); }
  function next() { setIdx(i => Math.min(items.length - 1, i + 1)); }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    dragging.current = true;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!dragging.current) return;
    const diff = startX.current - e.changedTouches[0].clientX;
    if (diff > 40)  next();
    if (diff < -40) prev();
    dragging.current = false;
  }

  const ratio = aspectRatio === "portrait" ? "aspect-[4/5]"
              : aspectRatio === "auto"     ? ""
              : "aspect-square";

  return (
    <div className={`relative w-full overflow-hidden select-none ${ratio}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)`, width: `${items.length * 100}%` }}
      >
        {items.map((item, i) => (
          <div key={i} className="flex-shrink-0 h-full" style={{ width: `${100 / items.length}%` }}>
            <SingleMedia item={item} aspectRatio={aspectRatio} />
          </div>
        ))}
      </div>

      {/* Prev / Next arrows — desktop */}
      {idx > 0 && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
        >
          <ChevronLeft size={18}/>
        </button>
      )}
      {idx < items.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
        >
          <ChevronRight size={18}/>
        </button>
      )}

      {/* Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={e => { e.stopPropagation(); setIdx(i); }}
            className={`rounded-full transition-all ${
              i === idx
                ? "w-4 h-1.5 bg-white"
                : "w-1.5 h-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>

      {/* Counter top-right */}
      <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">
        {idx + 1}/{items.length}
      </div>
    </div>
  );
}

function SingleMedia({ item, aspectRatio }: { item: MediaItem; aspectRatio: string }) {
  const ratio = aspectRatio === "portrait" ? "aspect-[4/5]"
              : aspectRatio === "auto"     ? ""
              : "aspect-square";

  if (item.type === "video") {
    return (
      <div className={`w-full bg-black ${ratio}`}>
        <video
          src={item.url}
          controls
          preload="metadata"
          className="w-full h-full object-contain"
          onContextMenu={e => e.preventDefault()}
          draggable={false}
          playsInline
        />
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden bg-bg-muted ${ratio}`}>
      <ProtectedImage
        src={item.url}
        alt=""
        className={`w-full h-full object-cover ${aspectRatio === "auto" ? "" : "absolute inset-0"}`}
      />
    </div>
  );
}
