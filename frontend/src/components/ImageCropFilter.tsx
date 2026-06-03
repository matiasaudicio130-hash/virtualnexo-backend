import { useState, useRef, useEffect } from "react";
import { X, ZoomIn, Crop, SlidersHorizontal, Sparkles, Type, RotateCcw, RotateCw, ArrowLeftRight } from "lucide-react";

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

const TEXT_COLORS = ["#FFFFFF", "#000000", "#FFE566", "#FF6B9D", "#A78BFA", "#34D399", "#FB923C"];

interface TextLayer {
  id: string;
  content: string;
  x: number;   // 0–1 ratio relative to PREVIEW container
  y: number;
  color: string;
  size: number; // font size in EXPORT canvas px
  bg: boolean;
}

const PREVIEW = 340;
const EXPORT  = 1080;

interface Props {
  file: File;
  onDone:   (result: File) => void;
  onCancel: () => void;
}

export function ImageCropFilter({ file, onDone, onCancel }: Props) {
  const [imgSrc,   setImgSrc]   = useState("");
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);

  // Transform
  const [zoom,  setZoom]  = useState(1);
  const [pos,   setPos]   = useState({ x: 0, y: 0 });
  const [angle, setAngle] = useState(0);   // fine: -45..+45 deg
  const [rot90, setRot90] = useState(0);   // 0 | 90 | 180 | 270
  const [flipH, setFlipH] = useState(false);

  // Adjust sliders (-100..+100)
  const [bright, setBright] = useState(0);
  const [cont,   setCont]   = useState(0);
  const [sat,    setSat]    = useState(0);
  const [warm,   setWarm]   = useState(0);

  // Filter preset
  const [filterIdx, setFilterIdx] = useState(0);

  // Text layers
  const [texts,   setTexts]   = useState<TextLayer[]>([]);
  const [newText, setNewText] = useState("");
  const [tColor,  setTColor]  = useState("#FFFFFF");
  const [tSize,   setTSize]   = useState(72);  // export px
  const [tBg,     setTBg]     = useState(false);

  const [tab,      setTab]      = useState<"crop" | "adjust" | "filter" | "text">("crop");
  const [applying, setApplying] = useState(false);

  // Refs for drag state
  const imgDragging  = useRef(false);
  const imgDragStart = useRef({ x: 0, y: 0 });
  const posAtDrag    = useRef({ x: 0, y: 0 });
  const txtDragId    = useRef<string | null>(null);
  const txtDragStart = useRef({ cx: 0, cy: 0, ox: 0, oy: 0 });
  const imgRef       = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Effective display dimensions (accounting for 90° rotations)
  const swapped = rot90 % 180 !== 0;
  const effW    = naturalW && naturalH ? (swapped ? naturalH : naturalW) : PREVIEW;
  const effH    = naturalW && naturalH ? (swapped ? naturalW : naturalH) : PREVIEW;
  const baseW   = effW >= effH ? PREVIEW : PREVIEW * (effW / effH);
  const baseH   = effH >= effW ? PREVIEW : PREVIEW * (effH / effW);
  const totalAngle = rot90 + angle;

  // Compose CSS filter string (preview + canvas export)
  const warmCss = warm > 0
    ? `sepia(${(warm * 0.6).toFixed(1)}%)`
    : warm < 0 ? `hue-rotate(${(-warm * 0.4).toFixed(1)}deg)` : "";
  const adjCss = [
    `brightness(${(1 + bright / 100).toFixed(3)})`,
    `contrast(${(1 + cont / 100).toFixed(3)})`,
    `saturate(${(1 + sat / 100).toFixed(3)})`,
    warmCss,
  ].filter(Boolean).join(" ");
  const presetCss      = FILTERS[filterIdx].css;
  const composedFilter = [adjCss, presetCss !== "none" ? presetCss : ""].filter(Boolean).join(" ");

  // ── Image drag (pan) ──────────────────────────────────────────
  function startImgDrag(cx: number, cy: number) {
    if (txtDragId.current) return;
    imgDragging.current  = true;
    imgDragStart.current = { x: cx, y: cy };
    posAtDrag.current    = { ...pos };
  }
  function moveImgDrag(cx: number, cy: number) {
    if (!imgDragging.current) return;
    setPos({
      x: posAtDrag.current.x + cx - imgDragStart.current.x,
      y: posAtDrag.current.y + cy - imgDragStart.current.y,
    });
  }
  function endImgDrag() { imgDragging.current = false; }

  // ── Text drag ─────────────────────────────────────────────────
  function startTxtDrag(
    e: React.MouseEvent | React.TouchEvent,
    id: string, ox: number, oy: number,
  ) {
    e.stopPropagation();
    txtDragId.current = id;
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    txtDragStart.current = { cx, cy, ox, oy };
  }
  function moveTxtDrag(cx: number, cy: number) {
    const id = txtDragId.current;
    if (!id) return;
    const dx = (cx - txtDragStart.current.cx) / PREVIEW;
    const dy = (cy - txtDragStart.current.cy) / PREVIEW;
    setTexts(prev => prev.map(t => t.id !== id ? t : {
      ...t,
      x: Math.max(0.05, Math.min(0.95, txtDragStart.current.ox + dx)),
      y: Math.max(0.05, Math.min(0.95, txtDragStart.current.oy + dy)),
    }));
  }
  function endTxtDrag() { txtDragId.current = null; }

  function onPointerMove(cx: number, cy: number) {
    moveTxtDrag(cx, cy);
    moveImgDrag(cx, cy);
  }
  function onPointerUp() { endImgDrag(); endTxtDrag(); }

  // ── Text management ───────────────────────────────────────────
  function addText() {
    if (!newText.trim()) return;
    setTexts(prev => [...prev, {
      id:      Math.random().toString(36).slice(2),
      content: newText.trim(),
      x: 0.5, y: 0.5,
      color: tColor, size: tSize, bg: tBg,
    }]);
    setNewText("");
  }

  // ── Canvas export ─────────────────────────────────────────────
  function handleApply() {
    const img = imgRef.current;
    if (!img || !naturalW) return;
    setApplying(true);

    const canvas      = document.createElement("canvas");
    canvas.width      = EXPORT;
    canvas.height     = EXPORT;
    const ctx         = canvas.getContext("2d")!;
    const sf          = EXPORT / PREVIEW;
    const angleRad    = (totalAngle * Math.PI) / 180;

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, EXPORT, EXPORT);

    // Draw image with transform + filter
    try { if (composedFilter) ctx.filter = composedFilter; } catch { /* safari <18 */ }
    ctx.save();
    ctx.translate(EXPORT / 2 + pos.x * sf, EXPORT / 2 + pos.y * sf);
    ctx.rotate(angleRad);
    if (flipH) ctx.scale(-1, 1);
    ctx.drawImage(
      img,
      -(baseW * zoom * sf) / 2,
      -(baseH * zoom * sf) / 2,
       baseW * zoom * sf,
       baseH * zoom * sf,
    );
    ctx.restore();

    // Text layers (no filter)
    try { ctx.filter = "none"; } catch { /* ignore */ }
    for (const t of texts) {
      const fs = t.size;
      ctx.font         = `bold ${fs}px sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      const tx = t.x * EXPORT;
      const ty = t.y * EXPORT;

      if (t.bg) {
        const mw  = ctx.measureText(t.content).width;
        const pad = fs * 0.3;
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.beginPath();
        ctx.rect(tx - mw / 2 - pad, ty - fs / 2 - pad * 0.5, mw + pad * 2, fs + pad);
        ctx.fill();
      } else {
        ctx.shadowColor   = "rgba(0,0,0,0.85)";
        ctx.shadowBlur    = fs * 0.18;
        ctx.shadowOffsetY = fs * 0.05;
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.content, tx, ty);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur  = 0;
    }

    canvas.toBlob(blob => {
      if (!blob) { setApplying(false); return; }
      onDone(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      setApplying(false);
    }, "image/jpeg", 0.92);
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black select-none touch-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0 pt-safe">
        <button onClick={onCancel} className="p-2 text-white/60 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <h3 className="text-sm font-medium text-white">Editar foto</h3>
        <button
          onClick={handleApply}
          disabled={applying}
          className="text-amber-400 font-semibold text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {applying ? "…" : "Listo"}
        </button>
      </div>

      {/* Preview area */}
      <div
        className="flex-1 flex items-center justify-center bg-[#0a0a0a] overflow-hidden"
        onMouseMove={e => onPointerMove(e.clientX, e.clientY)}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; onPointerMove(t.clientX, t.clientY); }}
        onTouchEnd={onPointerUp}
      >
        <div
          style={{ width: PREVIEW, height: PREVIEW, position: "relative", overflow: "hidden", background: "#000", flexShrink: 0 }}
          onMouseDown={e => startImgDrag(e.clientX, e.clientY)}
          onTouchStart={e => { e.preventDefault(); startImgDrag(e.touches[0].clientX, e.touches[0].clientY); }}
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
                left:            (PREVIEW - baseW) / 2,
                top:             (PREVIEW - baseH) / 2,
                transformOrigin: "center",
                transform:       `translate(${pos.x}px,${pos.y}px) rotate(${totalAngle}deg) scaleX(${flipH ? -1 : 1}) scale(${zoom})`,
                filter:          composedFilter || undefined,
                pointerEvents:   "none",
              }}
            />
          )}

          {/* Rule-of-thirds grid (crop tab only) */}
          {tab === "crop" && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.13) 1px,transparent 1px)," +
                  "linear-gradient(90deg,rgba(255,255,255,0.13) 1px,transparent 1px)",
                backgroundSize: `${PREVIEW / 3}px ${PREVIEW / 3}px`,
              }}
            />
          )}

          {/* Text overlays */}
          {texts.map(t => (
            <div
              key={t.id}
              onMouseDown={e => startTxtDrag(e, t.id, t.x, t.y)}
              onTouchStart={e => { e.stopPropagation(); startTxtDrag(e, t.id, t.x, t.y); }}
              style={{
                position:    "absolute",
                left:        `${t.x * 100}%`,
                top:         `${t.y * 100}%`,
                transform:   "translate(-50%,-50%)",
                color:       t.color,
                fontSize:    t.size * (PREVIEW / EXPORT),
                fontWeight:  "bold",
                fontFamily:  "sans-serif",
                whiteSpace:  "nowrap",
                cursor:      "grab",
                touchAction: "none",
                userSelect:  "none",
                padding:     t.bg ? "3px 10px" : "0",
                background:  t.bg ? "rgba(0,0,0,0.62)" : "transparent",
                borderRadius: t.bg ? "6px" : "0",
                textShadow:  !t.bg ? "0 1px 6px rgba(0,0,0,0.9),0 0 2px rgba(0,0,0,0.6)" : "none",
              }}
            >
              {t.content}
            </div>
          ))}
        </div>
      </div>

      {/* Controls panel */}
      <div className="flex-shrink-0 bg-black pb-safe">

        {/* ── CROP ─────────────────────────────────────────────── */}
        {tab === "crop" && (
          <div className="px-5 py-3 space-y-3">
            {/* Rotation & flip buttons */}
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => { setRot90(r => (r - 90 + 360) % 360); setPos({ x: 0, y: 0 }); }}
                className="flex flex-col items-center gap-0.5 text-white/60 hover:text-white transition-colors"
              >
                <RotateCcw size={22} />
                <span className="text-[9px]">-90°</span>
              </button>
              <button
                onClick={() => setFlipH(f => !f)}
                className={`flex flex-col items-center gap-0.5 transition-colors ${flipH ? "text-amber-400" : "text-white/60 hover:text-white"}`}
              >
                <ArrowLeftRight size={22} />
                <span className="text-[9px]">Voltear</span>
              </button>
              <button
                onClick={() => { setRot90(r => (r + 90) % 360); setPos({ x: 0, y: 0 }); }}
                className="flex flex-col items-center gap-0.5 text-white/60 hover:text-white transition-colors"
              >
                <RotateCw size={22} />
                <span className="text-[9px]">+90°</span>
              </button>
            </div>

            {/* Fine angle */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40 w-12 text-right tabular-nums">
                {angle > 0 ? "+" : ""}{angle.toFixed(0)}°
              </span>
              <input
                type="range" min={-45} max={45} step={0.5}
                value={angle}
                onChange={e => setAngle(parseFloat(e.target.value))}
                className="flex-1 accent-amber-400"
              />
              <span className="text-[9px] text-white/30 w-5">↺</span>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-3">
              <ZoomIn size={13} className="text-white/40 flex-shrink-0" />
              <input
                type="range" min={1} max={4} step={0.01}
                value={zoom}
                onChange={e => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-amber-400"
              />
              <span className="text-[10px] text-white/40 w-8 text-right tabular-nums">{zoom.toFixed(1)}×</span>
            </div>
          </div>
        )}

        {/* ── ADJUST ───────────────────────────────────────────── */}
        {tab === "adjust" && (
          <div className="px-5 py-3 space-y-2.5">
            {(
              [
                { label: "Brillo",     val: bright, set: setBright },
                { label: "Contraste",  val: cont,   set: setCont   },
                { label: "Saturación", val: sat,     set: setSat    },
                { label: "Calidez",    val: warm,    set: setWarm   },
              ] as { label: string; val: number; set: (n: number) => void }[]
            ).map(({ label, val, set }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[10px] text-white/50 w-20 flex-shrink-0">{label}</span>
                <input
                  type="range" min={-100} max={100} step={1}
                  value={val}
                  onChange={e => set(parseInt(e.target.value))}
                  className="flex-1 accent-amber-400"
                />
                <span className="text-[10px] text-white/40 w-9 text-right tabular-nums">
                  {val > 0 ? "+" : ""}{val}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── FILTERS ──────────────────────────────────────────── */}
        {tab === "filter" && imgSrc && (
          <div className="flex gap-2.5 px-4 py-3 overflow-x-auto scrollbar-none">
            {FILTERS.map((f, i) => (
              <button
                key={i}
                onClick={() => setFilterIdx(i)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 transition-opacity ${filterIdx === i ? "opacity-100" : "opacity-50"}`}
              >
                <div className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-colors ${filterIdx === i ? "border-amber-400" : "border-transparent"}`}>
                  <img
                    src={imgSrc}
                    alt={f.name}
                    className="w-full h-full object-cover"
                    style={{ filter: f.css !== "none" ? f.css : undefined }}
                  />
                </div>
                <span className="text-[9px] text-white/70 font-medium">{f.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── TEXT ─────────────────────────────────────────────── */}
        {tab === "text" && (
          <div className="px-4 py-3 space-y-3">
            {/* Input row */}
            <div className="flex gap-2">
              <input
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addText(); } }}
                placeholder="Escribí algo…"
                className="flex-1 bg-white/10 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm outline-none border border-white/10 focus:border-amber-400/50"
                style={{ fontSize: "16px" }}
              />
              <button
                onClick={addText}
                disabled={!newText.trim()}
                className="px-4 py-2 bg-amber-400 text-black rounded-xl font-bold text-lg disabled:opacity-40 flex-shrink-0"
              >
                +
              </button>
            </div>

            {/* Color picker */}
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-white/50 w-12 flex-shrink-0">Color</span>
              {TEXT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setTColor(c)}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full border-2 flex-shrink-0 transition-transform ${tColor === c ? "border-amber-400 scale-110" : "border-white/20"}`}
                />
              ))}
            </div>

            {/* Size + background toggle */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/50 w-12 flex-shrink-0">Tamaño</span>
              <input
                type="range" min={32} max={128} step={4}
                value={tSize}
                onChange={e => setTSize(parseInt(e.target.value))}
                className="flex-1 accent-amber-400"
              />
              <button
                onClick={() => setTBg(v => !v)}
                className={`flex-shrink-0 text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors ${tBg ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-white/20 text-white/50"}`}
              >
                Fondo
              </button>
            </div>

            {/* Added texts list */}
            {texts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {texts.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 max-w-[160px]"
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="text-[11px] text-white truncate">{t.content}</span>
                    <button
                      onClick={() => setTexts(prev => prev.filter(x => x.id !== t.id))}
                      className="text-white/40 hover:text-white flex-shrink-0 ml-0.5 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-white/30 text-center">
              Arrastrá el texto en la imagen para reposicionarlo
            </p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-t border-white/10">
          {([
            { id: "crop",   label: "Recortar", Icon: Crop              },
            { id: "adjust", label: "Ajustar",  Icon: SlidersHorizontal },
            { id: "filter", label: "Filtros",  Icon: Sparkles          },
            { id: "text",   label: "Texto",    Icon: Type              },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${tab === id ? "text-amber-400" : "text-white/40 hover:text-white/70"}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
