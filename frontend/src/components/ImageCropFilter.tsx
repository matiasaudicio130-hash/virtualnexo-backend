import { useState, useRef, useEffect } from "react";
import { X, ZoomIn, Crop, Sliders } from "lucide-react";

const FILTERS = [
  { name: "Normal",  css: "none" },
  { name: "Vivid",   css: "saturate(1.6) contrast(1.1)" },
  { name: "B&W",     css: "grayscale(1)" },
  { name: "Fade",    css: "brightness(1.15) contrast(0.85) saturate(0.8)" },
  { name: "Warm",    css: "sepia(0.4) saturate(1.3) brightness(1.05)" },
  { name: "Cool",    css: "hue-rotate(20deg) saturate(1.1) brightness(1.02)" },
  { name: "Drama",   css: "contrast(1.5) brightness(0.85)" },
  { name: "Noir",    css: "grayscale(0.9) contrast(1.4) brightness(0.9)" },
  { name: "Glow",    css: "brightness(1.2) saturate(1.4) contrast(0.9)" },
  { name: "Vintage", css: "sepia(0.6) hue-rotate(-10deg) saturate(0.75)" },
];

const SIZE   = 320;   // preview container px
const EXPORT = 800;   // output canvas resolution

interface Props {
  file: File;
  onDone:   (result: File) => void;
  onCancel: () => void;
}

export function ImageCropFilter({ file, onDone, onCancel }: Props) {
  const [imgSrc,    setImgSrc]    = useState("");
  const [naturalW,  setNaturalW]  = useState(0);
  const [naturalH,  setNaturalH]  = useState(0);
  const [filterIdx, setFilterIdx] = useState(0);
  const [zoom,      setZoom]      = useState(1);
  const [pos,       setPos]       = useState({ x: 0, y: 0 });
  const [tab,       setTab]       = useState<"crop" | "filter">("crop");

  const dragging  = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posAtDrag = useRef({ x: 0, y: 0 });
  const imgRef    = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Fit-contain base dimensions inside SIZE×SIZE
  const baseW = naturalW && naturalH
    ? (naturalW >= naturalH ? SIZE : SIZE * (naturalW / naturalH))
    : SIZE;
  const baseH = naturalW && naturalH
    ? (naturalH >= naturalW ? SIZE : SIZE * (naturalH / naturalW))
    : SIZE;

  function startDrag(cx: number, cy: number) {
    dragging.current  = true;
    dragStart.current = { x: cx, y: cy };
    posAtDrag.current = { ...pos };
  }
  function moveDrag(cx: number, cy: number) {
    if (!dragging.current) return;
    setPos({
      x: posAtDrag.current.x + cx - dragStart.current.x,
      y: posAtDrag.current.y + cy - dragStart.current.y,
    });
  }
  function endDrag() { dragging.current = false; }

  function handleApply() {
    const img = imgRef.current;
    if (!img || !naturalW) return;

    const canvas  = document.createElement("canvas");
    canvas.width  = EXPORT;
    canvas.height = EXPORT;
    const ctx     = canvas.getContext("2d")!;
    const sf      = EXPORT / SIZE;

    const dispW   = baseW * zoom;
    const dispH   = baseH * zoom;
    const imgLeft = SIZE / 2 + pos.x - dispW / 2;
    const imgTop  = SIZE / 2 + pos.y - dispH / 2;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, EXPORT, EXPORT);

    const filterCss = FILTERS[filterIdx].css;
    if (filterCss !== "none") ctx.filter = filterCss;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, EXPORT, EXPORT);
    ctx.clip();
    ctx.drawImage(img, imgLeft * sf, imgTop * sf, dispW * sf, dispH * sf);
    ctx.restore();

    canvas.toBlob(blob => {
      if (!blob) return;
      onDone(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  const filterCss = FILTERS[filterIdx].css;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black select-none touch-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button onClick={onCancel} className="p-2 text-white/60 hover:text-white">
          <X size={20} />
        </button>
        <h3 className="text-sm font-medium text-white">Editar foto</h3>
        <button
          onClick={handleApply}
          className="text-amber-400 font-semibold text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          Listo
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        <div
          className="relative overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ width: SIZE, height: SIZE, background: "#111", flexShrink: 0 }}
          onMouseDown={e => startDrag(e.clientX, e.clientY)}
          onMouseMove={e => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchEnd={endDrag}
        >
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              draggable={false}
              onLoad={e => {
                setNaturalW(e.currentTarget.naturalWidth);
                setNaturalH(e.currentTarget.naturalHeight);
              }}
              style={{
                position:        "absolute",
                width:           baseW,
                height:          baseH,
                left:            (SIZE - baseW) / 2,
                top:             (SIZE - baseH) / 2,
                transformOrigin: "center",
                transform:       `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
                filter:          filterCss !== "none" ? filterCss : undefined,
                pointerEvents:   "none",
              }}
            />
          )}
          {/* Rule-of-thirds grid */}
          {tab === "crop" && (
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)," +
                "linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: `${SIZE / 3}px ${SIZE / 3}px`,
            }} />
          )}
        </div>
      </div>

      {/* Zoom slider */}
      {tab === "crop" && (
        <div className="flex items-center gap-3 px-6 py-2 flex-shrink-0">
          <ZoomIn size={14} className="text-white/40 flex-shrink-0" />
          <input
            type="range" min={1} max={3} step={0.01}
            value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-amber-400"
          />
          <span className="text-xs text-white/40 w-8 text-right tabular-nums">{zoom.toFixed(1)}×</span>
        </div>
      )}

      {/* Filter strip */}
      {tab === "filter" && imgSrc && (
        <div className="flex gap-2.5 px-4 py-2 overflow-x-auto scrollbar-none flex-shrink-0">
          {FILTERS.map((f, i) => (
            <button key={i} onClick={() => setFilterIdx(i)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 transition-opacity ${filterIdx === i ? "opacity-100" : "opacity-50"}`}>
              <div className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-colors ${filterIdx === i ? "border-amber-400" : "border-transparent"}`}>
                <img src={imgSrc} alt={f.name} className="w-full h-full object-cover"
                  style={{ filter: f.css !== "none" ? f.css : undefined }} />
              </div>
              <span className="text-[9px] text-white/70 font-medium">{f.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-t border-white/10 flex-shrink-0">
        {([
          { id: "crop",   label: "Recortar", Icon: Crop    },
          { id: "filter", label: "Filtros",  Icon: Sliders },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${tab === id ? "text-amber-400" : "text-white/40"}`}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
