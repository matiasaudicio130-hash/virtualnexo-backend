import { useState, useRef } from "react";
import { X, ImagePlus, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface SlotDef { x: number; y: number; w: number; h: number; }

interface Layout {
  id:     string;
  label:  string;
  count:  number;   // expected number of photos
  slots:  SlotDef[];
}

interface SlotState {
  file:    File | null;
  preview: string;
  zoom:    number;   // 1-4
  offsetX: number;  // px (in preview coords)
  offsetY: number;
}

interface Props {
  onDone:   (file: File) => void;
  onCancel: () => void;
}

// ── Layout definitions ───────────────────────────────────────────────────────
const LAYOUTS: Layout[] = [
  // 2 photos
  { id:"2h",    label:"Side",      count:2, slots:[
      {x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:1},
  ]},
  { id:"2v",    label:"Stack",     count:2, slots:[
      {x:0,y:0,w:1,h:.5},{x:0,y:.5,w:1,h:.5},
  ]},
  { id:"2big",  label:"Foco",      count:2, slots:[
      {x:0,y:0,w:1,h:.37},{x:0,y:.37,w:1,h:.63},
  ]},
  // 3 photos
  { id:"3h",    label:"3 lados",   count:3, slots:[
      {x:0,y:0,w:.333,h:1},{x:.333,y:0,w:.334,h:1},{x:.667,y:0,w:.333,h:1},
  ]},
  { id:"3l",    label:"Foco izq",  count:3, slots:[
      {x:0,y:0,w:.6,h:1},{x:.6,y:0,w:.4,h:.5},{x:.6,y:.5,w:.4,h:.5},
  ]},
  { id:"3r",    label:"Foco der",  count:3, slots:[
      {x:0,y:0,w:.4,h:.5},{x:0,y:.5,w:.4,h:.5},{x:.4,y:0,w:.6,h:1},
  ]},
  { id:"3top",  label:"Foco arr",  count:3, slots:[
      {x:0,y:0,w:1,h:.6},{x:0,y:.6,w:.5,h:.4},{x:.5,y:.6,w:.5,h:.4},
  ]},
  // 4 photos
  { id:"4g",    label:"2×2",       count:4, slots:[
      {x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5},
      {x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5},
  ]},
  { id:"4l",    label:"Foco izq",  count:4, slots:[
      {x:0,y:0,w:.62,h:1},
      {x:.62,y:0,w:.38,h:.333},{x:.62,y:.333,w:.38,h:.334},{x:.62,y:.667,w:.38,h:.333},
  ]},
  { id:"4top",  label:"Foco arr",  count:4, slots:[
      {x:0,y:0,w:1,h:.55},
      {x:0,y:.55,w:.333,h:.45},{x:.333,y:.55,w:.334,h:.45},{x:.667,y:.55,w:.333,h:.45},
  ]},
  { id:"4row",  label:"4 lados",   count:4, slots:[
      {x:0,y:0,w:.25,h:1},{x:.25,y:0,w:.25,h:1},
      {x:.5,y:0,w:.25,h:1},{x:.75,y:0,w:.25,h:1},
  ]},
];

const GAP_OPTIONS = [0, 4, 8, 16];
const RADIUS_OPTIONS = [0, 6, 14, 24];
const BG_OPTIONS = [
  { label:"Negro",    value:"#000000" },
  { label:"Blanco",   value:"#FFFFFF" },
  { label:"Dorado",   value:"#C9A227" },
  { label:"Rosa",     value:"#FF6B9D" },
  { label:"Morado",   value:"#A78BFA" },
  { label:"Oscuro",   value:"#0e0c09" },
];

const PREVIEW = 320;  // preview container px
const EXPORT  = 1080;

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src     = src;
  });
}

function drawCoverShifted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number,
  zoom: number, shiftX: number, shiftY: number,  // shift in export-canvas px
) {
  const scaledW = img.naturalWidth  * zoom;
  const scaledH = img.naturalHeight * zoom;

  const sx = (scaledW  - dw) / 2 - shiftX;
  const sy = (scaledH  - dh) / 2 - shiftY;
  const clamped_sx = Math.max(0, Math.min(scaledW  - dw, sx));
  const clamped_sy = Math.max(0, Math.min(scaledH - dh, sy));

  const srcX  = clamped_sx / zoom;
  const srcY  = clamped_sy / zoom;
  const srcW  = dw / zoom;
  const srcH  = dh / zoom;

  ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
}

function clipRound(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.clip();
}

// Mini icon that shows the slot layout
function LayoutIcon({ slots, active }: { slots: SlotDef[]; active: boolean }) {
  const S = 38;
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display:"block" }}>
      <rect x={0} y={0} width={S} height={S} rx={4}
        fill={active ? "rgba(201,162,39,0.2)" : "rgba(255,255,255,0.06)"} />
      {slots.map((sl, i) => (
        <rect
          key={i}
          x={sl.x * S + 1.5}
          y={sl.y * S + 1.5}
          width={sl.w * S - 3}
          height={sl.h * S - 3}
          rx={2}
          fill={active ? `rgba(201,162,39,${0.45 + i * 0.12})` : `rgba(255,255,255,${0.2 + i * 0.07})`}
        />
      ))}
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function CollageMaker({ onDone, onCancel }: Props) {
  const [layoutId,  setLayoutId]  = useState("2h");
  const [slots,     setSlots]     = useState<SlotState[]>(Array.from({ length: 4 }, () => ({
    file: null, preview: "", zoom: 1, offsetX: 0, offsetY: 0,
  })));
  const [gapIdx,    setGapIdx]    = useState(1);
  const [radIdx,    setRadIdx]    = useState(1);
  const [bgColor,   setBgColor]   = useState("#000000");
  const [applying,  setApplying]  = useState(false);
  const [error,     setError]     = useState("");
  const [step,      setStep]      = useState<"layout" | "edit">("layout");

  // Slot drag (pan inside slot)
  const draggingSlot = useRef<{ idx: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const pickingSlot   = useRef<number>(-1);

  const layout  = LAYOUTS.find(l => l.id === layoutId)!;
  const gap     = GAP_OPTIONS[gapIdx];
  const radius  = RADIUS_OPTIONS[radIdx];

  // ── Slot management ──────────────────────────────────────────────────────
  function openPicker(slotIdx: number) {
    pickingSlot.current = slotIdx;
    fileInputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || pickingSlot.current < 0) return;
    const idx = pickingSlot.current;
    const preview = URL.createObjectURL(f);
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, file: f, preview, zoom: 1, offsetX: 0, offsetY: 0 } : s));
  }

  function clearSlot(idx: number) {
    setSlots(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      if (s.preview) URL.revokeObjectURL(s.preview);
      return { file: null, preview: "", zoom: 1, offsetX: 0, offsetY: 0 };
    }));
  }

  function swapSlots(a: number, b: number) {
    setSlots(prev => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  // ── Slot drag (pan photo inside slot) ───────────────────────────────────
  function startSlotDrag(e: React.MouseEvent | React.TouchEvent, idx: number) {
    e.stopPropagation();
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    draggingSlot.current = { idx, startX: cx, startY: cy, origX: slots[idx].offsetX, origY: slots[idx].offsetY };
  }
  function onPreviewMouseMove(e: React.MouseEvent | React.TouchEvent) {
    if (!draggingSlot.current) return;
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const { idx, startX, startY, origX, origY } = draggingSlot.current;
    setSlots(prev => prev.map((s, i) => i !== idx ? s : {
      ...s,
      offsetX: origX + cx - startX,
      offsetY: origY + cy - startY,
    }));
  }
  function endSlotDrag() { draggingSlot.current = null; }

  // ── Export ───────────────────────────────────────────────────────────────
  async function handleExport() {
    const filledSlots = layout.slots.filter((_, i) => !!slots[i]?.file);
    if (filledSlots.length < 2) { setError("Agregá al menos 2 fotos para crear el collage."); return; }
    setApplying(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = EXPORT;
      const ctx    = canvas.getContext("2d")!;
      const sf     = EXPORT / PREVIEW;  // scale factor preview→export
      const gapEx  = gap * sf;
      const radEx  = radius * sf;

      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, EXPORT, EXPORT);

      for (let i = 0; i < layout.slots.length; i++) {
        const sl = layout.slots[i];
        const st = slots[i];
        if (!st.file || !st.preview) continue;

        const x  = sl.x * EXPORT + gapEx / 2;
        const y  = sl.y * EXPORT + gapEx / 2;
        const w  = sl.w * EXPORT - gapEx;
        const h  = sl.h * EXPORT - gapEx;

        ctx.save();
        if (radEx > 0) clipRound(ctx, x, y, w, h, radEx);
        else {
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
        }

        const img = await loadImage(st.preview);
        drawCoverShifted(ctx, img, x, y, w, h, st.zoom, st.offsetX * sf, st.offsetY * sf);
        ctx.restore();
      }

      canvas.toBlob(blob => {
        if (!blob) { setError("Error al generar el collage. Intentá de nuevo."); setApplying(false); return; }
        const outFile = new File([blob], "collage.jpg", { type: "image/jpeg" });
        onDone(outFile);
        setApplying(false);
      }, "image/jpeg", 0.92);

    } catch (e) {
      console.error("Collage export error:", e);
      setError("Error al procesar. Intentá de nuevo.");
      setApplying(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const filledCount = layout.slots.filter((_, i) => !!slots[i]?.file).length;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black select-none" style={{ touchAction:"none" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0 pt-safe">
        {step === "edit" ? (
          <button onClick={() => setStep("layout")} className="p-2 text-white/60 hover:text-white transition-colors flex items-center gap-1">
            <ChevronLeft size={18} /> <span className="text-sm">Layout</span>
          </button>
        ) : (
          <button onClick={onCancel} className="p-2 text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        )}
        <h3 className="text-sm font-semibold text-white">Collage</h3>
        {step === "layout" ? (
          <button
            onClick={() => setStep("edit")}
            className="text-amber-400 font-semibold text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            Siguiente <ChevronRight size={14} className="inline" />
          </button>
        ) : (
          <button
            onClick={handleExport}
            disabled={applying || filledCount < 2}
            className="text-amber-400 font-semibold text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            {applying ? "Generando…" : "Listo"}
          </button>
        )}
      </div>

      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-500/20 border-b border-red-500/30 text-red-400 text-xs text-center">
          {error}
        </div>
      )}

      {/* ── STEP 1: layout picker ─────────────────────────────────── */}
      {step === "layout" && (
        <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto px-4 py-5 gap-6">
          <p className="text-white/50 text-xs text-center">Elegí cómo van a estar distribuidas las fotos</p>

          {/* Preview box */}
          <div
            className="rounded-xl overflow-hidden flex-shrink-0"
            style={{ width: PREVIEW, height: PREVIEW, background: "#111", position:"relative" }}
          >
            {layout.slots.map((sl, i) => (
              <div
                key={i}
                style={{
                  position:"absolute",
                  left:   sl.x * PREVIEW + 2,
                  top:    sl.y * PREVIEW + 2,
                  width:  sl.w * PREVIEW - 4,
                  height: sl.h * PREVIEW - 4,
                  borderRadius: 6,
                  background: `rgba(201,162,39,${0.12 + i * 0.06})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  border:"1px solid rgba(201,162,39,0.2)",
                }}
              >
                <span className="text-amber-400/50 text-xs font-semibold">{i + 1}</span>
              </div>
            ))}
          </div>

          {/* Layout grid */}
          <div className="w-full space-y-3">
            {[2, 3, 4].map(count => {
              const group = LAYOUTS.filter(l => l.count === count);
              return (
                <div key={count}>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">{count} fotos</p>
                  <div className="flex gap-2 flex-wrap">
                    {group.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setLayoutId(l.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                          layoutId === l.id
                            ? "border-amber-400/60 bg-amber-400/10"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <LayoutIcon slots={l.slots} active={layoutId === l.id} />
                        <span className={`text-[9px] font-medium ${layoutId === l.id ? "text-amber-400" : "text-white/40"}`}>
                          {l.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 2: edit (add photos + options) ──────────────────── */}
      {step === "edit" && (
        <>
          {/* Preview */}
          <div className="flex-1 flex items-center justify-center bg-[#080808] overflow-hidden">
            <div
              className="rounded-xl overflow-hidden flex-shrink-0"
              style={{ width: PREVIEW, height: PREVIEW, background: bgColor, position:"relative" }}
              onMouseMove={onPreviewMouseMove}
              onMouseUp={endSlotDrag}
              onMouseLeave={endSlotDrag}
              onTouchMove={e => { e.preventDefault(); onPreviewMouseMove(e); }}
              onTouchEnd={endSlotDrag}
            >
              {layout.slots.map((sl, i) => {
                const st = slots[i];
                const x  = sl.x * PREVIEW + gap / 2;
                const y  = sl.y * PREVIEW + gap / 2;
                const w  = sl.w * PREVIEW - gap;
                const h  = sl.h * PREVIEW - gap;
                return (
                  <div
                    key={i}
                    style={{
                      position:"absolute", left: x, top: y, width: w, height: h,
                      borderRadius: radius, overflow:"hidden",
                      background: st.file ? "transparent" : "rgba(255,255,255,0.06)",
                      border: st.file ? "none" : "1.5px dashed rgba(255,255,255,0.2)",
                      cursor: st.file ? "grab" : "pointer",
                    }}
                    onClick={() => { if (!st.file) openPicker(i); }}
                  >
                    {st.file ? (
                      <>
                        <img
                          src={st.preview}
                          alt=""
                          draggable={false}
                          style={{
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            transform: `translate(${st.offsetX}px,${st.offsetY}px) scale(${st.zoom})`,
                            transformOrigin: "center",
                            pointerEvents: "none",
                            userSelect: "none",
                          }}
                        />
                        {/* Controls overlay */}
                        <div className="absolute top-1 right-1 flex gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); clearSlot(i); }}
                            className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
                          >
                            <X size={11} className="text-white" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); openPicker(i); }}
                            className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
                          >
                            <RotateCcw size={11} className="text-white" />
                          </button>
                        </div>
                        {/* Drag handle */}
                        <div
                          className="absolute inset-0"
                          onMouseDown={e => startSlotDrag(e, i)}
                          onTouchStart={e => { e.stopPropagation(); startSlotDrag(e, i); }}
                          style={{ cursor:"grab" }}
                        />
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/30">
                        <ImagePlus size={20} />
                        <span className="text-[10px]">Foto {i + 1}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controls */}
          <div className="flex-shrink-0 bg-[#0c0c0c] pb-safe px-4 py-3 space-y-3 border-t border-white/8">
            {/* Zoom per active slot */}
            {slots.some(s => !!s.file) && (
              <div className="space-y-2">
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Zoom por foto</p>
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {layout.slots.map((_, i) => {
                    if (!slots[i]?.file) return null;
                    return (
                      <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 min-w-[160px]">
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={slots[i].preview} className="w-full h-full object-cover" />
                        </div>
                        <input
                          type="range" min={1} max={3} step={0.01}
                          value={slots[i].zoom}
                          onChange={e => setSlots(prev => prev.map((s, idx) =>
                            idx === i ? { ...s, zoom: parseFloat(e.target.value) } : s
                          ))}
                          className="flex-1 accent-amber-400"
                        />
                        <span className="text-[10px] text-white/40 tabular-nums w-6">{slots[i].zoom.toFixed(1)}×</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Swap photos */}
            {layout.count >= 2 && slots.filter(s => !!s.file).length >= 2 && (
              <div className="flex gap-2">
                {layout.slots.map((_, a) => layout.slots.map((_, b) => a < b && slots[a].file && slots[b].file ? (
                  <button
                    key={`${a}-${b}`}
                    onClick={() => swapSlots(a, b)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 border border-white/10 text-white/60 hover:text-white text-[11px] transition-colors"
                  >
                    ⇄ Intercambiar {a + 1} y {b + 1}
                  </button>
                ) : null))}
              </div>
            )}

            {/* Gap */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40 w-10 flex-shrink-0">Espacio</span>
              <div className="flex gap-2 flex-1">
                {GAP_OPTIONS.map((g, i) => (
                  <button
                    key={g}
                    onClick={() => setGapIdx(i)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] border transition-all ${
                      gapIdx === i ? "border-amber-400 bg-amber-400/15 text-amber-400" : "border-white/15 text-white/50"
                    }`}
                  >
                    {g === 0 ? "Sin" : `${g}px`}
                  </button>
                ))}
              </div>
            </div>

            {/* Border radius */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40 w-10 flex-shrink-0">Bordes</span>
              <div className="flex gap-2 flex-1">
                {RADIUS_OPTIONS.map((r, i) => (
                  <button
                    key={r}
                    onClick={() => setRadIdx(i)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] border transition-all ${
                      radIdx === i ? "border-amber-400 bg-amber-400/15 text-amber-400" : "border-white/15 text-white/50"
                    }`}
                  >
                    {r === 0 ? "Rect" : `${r}px`}
                  </button>
                ))}
              </div>
            </div>

            {/* Background color */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40 w-10 flex-shrink-0">Fondo</span>
              <div className="flex gap-2">
                {BG_OPTIONS.map(bg => (
                  <button
                    key={bg.value}
                    onClick={() => setBgColor(bg.value)}
                    style={{ background: bg.value }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform flex-shrink-0 ${bgColor === bg.value ? "border-amber-400 scale-110" : "border-white/20"}`}
                  />
                ))}
              </div>
            </div>

            <p className="text-[9px] text-white/20 text-center">
              Arrastrá las fotos dentro de sus marcos para reposicionarlas
            </p>
          </div>
        </>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelected}
        className="hidden"
      />
    </div>
  );
}
