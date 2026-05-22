import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface Gif {
  id: string;
  url: string;
  preview: string;
  title: string;
}

interface Props {
  onSelect: (gif: Gif) => void;
  onClose: () => void;
}

// Usa la API pública de Giphy (reemplazar con key propia en producción)
const GIPHY_KEY = "dc6zaTOxFJmzC";

export function GifPicker({ onSelect, onClose }: Props) {
  const [query, setQuery]   = useState("");
  const [gifs, setGifs]     = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);
  const timerRef            = useRef<any>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchGifs(query || "trending"), 400);
  }, [query]);

  async function fetchGifs(q: string) {
    setLoading(true);
    try {
      const endpoint = q === "trending"
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=r`
        : `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=r`;

      const res  = await fetch(endpoint);
      const json = await res.json();
      setGifs((json.data || []).map((g: any) => ({
        id:      g.id,
        url:     g.images.original.url,
        preview: g.images.fixed_width_small.url,
        title:   g.title,
      })));
    } catch { setGifs([]); }
    setLoading(false);
  }

  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 left-0 z-50 w-72 bg-bg-card border border-border rounded-2xl overflow-hidden shadow-xl animate-slide-up">

      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Search size={14} className="text-text-muted flex-shrink-0"/>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar GIFs..."
          autoFocus
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
        />
        <button onClick={onClose}><X size={14} className="text-text-muted"/></button>
      </div>

      {/* Grid */}
      <div className="h-56 overflow-y-auto p-2">
        {loading ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({length:9}).map((_,i) => (
              <div key={i} className="aspect-square bg-bg-muted rounded-lg animate-pulse"/>
            ))}
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-8">Sin resultados</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {gifs.map(g => (
              <button
                key={g.id}
                onClick={() => { onSelect(g); onClose(); }}
                className="aspect-square overflow-hidden rounded-lg hover:opacity-80 transition-opacity"
              >
                <img src={g.preview} alt={g.title} className="w-full h-full object-cover"/>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Giphy credit */}
      <div className="px-3 py-1.5 border-t border-border">
        <p className="text-[9px] text-text-muted text-center tracking-wide">Powered by GIPHY</p>
      </div>
    </div>
  );
}
