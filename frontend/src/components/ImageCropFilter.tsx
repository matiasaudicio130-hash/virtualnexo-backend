import { useState, useRef, useEffect, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  X, ZoomIn, Crop, SlidersHorizontal, Sparkles, Type,
  RotateCcw, Pencil, Undo2, Trash2, AlignLeft, AlignCenter, AlignRight,
  Check, Minus, Plus as PlusIcon, Shapes, Eye, EyeOff,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const PREVIEW  = 340;   // preview container size (px)
const EXPORT   = 1080;  // export canvas size (px, square)
const MAX_UNDO = 20;

// Filters
const FILTERS = [
  { name: "Normal",   css: "none" },
  { name: "Vivid",    css: "saturate(1.6) contrast(1.1)" },
  { name: "B&W",      css: "grayscale(1)" },
  { name: "Fade",     css: "brightness(1.15) contrast(0.85) saturate(0.8)" },
  { name: "Warm",     css: "sepia(0.35) saturate(1.3) brightness(1.05)" },
  { name: "Cool",     css: "hue-rotate(18deg) saturate(1.1) brightness(1.02)" },
  { name: "Drama",    css: "contrast(1.5) brightness(0.85)" },
  { name: "Noir",     css: "grayscale(0.9) contrast(1.4) brightness(0.9)" },
  { name: "Glow",     css: "brightness(1.2) saturate(1.4) contrast(0.9)" },
  { name: "Vintage",  css: "sepia(0.6) hue-rotate(-10deg) saturate(0.75)" },
  { name: "Lush",     css: "saturate(1.8) brightness(1.05) contrast(1.05)" },
  { name: "Matte",    css: "contrast(0.9) saturate(0.85) brightness(1.1)" },
  { name: "Pop",      css: "saturate(2) contrast(1.15) brightness(1.05)" },
  { name: "Soft",     css: "brightness(1.1) contrast(0.85) saturate(0.9) blur(0.3px)" },
  { name: "Chrome",   css: "saturate(1.3) contrast(1.3) hue-rotate(-5deg)" },
];

const TEXT_COLORS  = ["#FFFFFF","#000000","#FFE566","#FF6B9D","#A78BFA","#34D399","#FB923C","#60A5FA","#F87171","#A3E635"];
const BRUSH_COLORS = ["#FFFFFF","#000000","#FFE566","#FF6B9D","#A78BFA","#34D399","#60A5FA","#F87171","rgba(0,0,0,0)"];
const TEXT_FONTS   = [
  { label: "Sans",    value: "sans-serif"                   },
  { label: "Serif",   value: "Georgia, serif"               },
  { label: "Mono",    value: "'Courier New', monospace"      },
  { label: "Bold",    value: "Impact, 'Arial Black', sans-serif" },
];
const ASPECTS = [
  { label: "Libre", value: undefined  },
  { label: "1:1",   value: 1          },
  { label: "4:5",   value: 4 / 5      },
  { label: "9:16",  value: 9 / 16     },
  { label: "16:9",  value: 16 / 9     },
];

type Tab = "crop" | "adjust" | "filter" | "text" | "draw" | "shapes";
type Align = "left" | "center" | "right";
type ShapeType = "circle" | "rect" | "heart" | "star" | "triangle" | "diamond" | "arrow" | "line";

interface ShapeLayer {
  id:       string;
  type:     ShapeType;
  x:        number;   // 0-1 center relative to PREVIEW
  y:        number;
  size:     number;   // in EXPORT canvas px
  rotation: number;   // degrees
  color:    string;
  opacity:  number;
  filled:   boolean;
}

const SHAPE_TYPES: { id: ShapeType; label: string }[] = [
  { id: "circle",   label: "Círculo"   },
  { id: "rect",     label: "Cuadrado"  },
  { id: "heart",    label: "Corazón"   },
  { id: "star",     label: "Estrella"  },
  { id: "triangle", label: "Triángulo" },
  { id: "diamond",  label: "Rombo"     },
  { id: "arrow",    label: "Flecha"    },
  { id: "line",     label: "Línea"     },
];

const SHAPE_COLORS = ["#FFFFFF","#000000","#FFE566","#FF6B9D","#A78BFA","#34D399","#FB923C","#60A5FA","#F87171"];

// Generate inline SVG string for a shape (used both in preview and export)
function makeShapeSVG(type: ShapeType, S: number, color: string, filled: boolean): string {
  const sw = Math.max(4, S * 0.07);
  const fill = filled ? color : "none";

  let inner = "";
  switch (type) {
    case "circle":
      inner = `<circle cx="${S/2}" cy="${S/2}" r="${S/2 - sw/2}" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;
      break;
    case "rect":
      inner = `<rect x="${sw/2}" y="${sw/2}" width="${S-sw}" height="${S-sw}" rx="${S*0.06}" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;
      break;
    case "heart": {
      const m = S/2;
      inner = `<path d="M${m},${S*0.28} C${m},${S*0.09} ${S*0.04},${S*0.09} ${S*0.04},${S*0.28} C${S*0.04},${S*0.56} ${m},${S*0.82} ${m},${S*0.95} C${m},${S*0.82} ${S*0.96},${S*0.56} ${S*0.96},${S*0.28} C${S*0.96},${S*0.09} ${m},${S*0.09} ${m},${S*0.28}Z" fill="${color}" stroke="none"/>`;
      break;
    }
    case "star": {
      const cx = S/2, cy = S/2, ro = S/2 - sw/2, ri = ro * 0.38;
      let pts = "";
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI / 5) - Math.PI / 2;
        const r = i % 2 === 0 ? ro : ri;
        pts += `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)} `;
      }
      inner = `<polygon points="${pts.trim()}" fill="${color}" stroke="none"/>`;
      break;
    }
    case "triangle":
      inner = `<polygon points="${S/2},${sw/2} ${S-sw/2},${S-sw/2} ${sw/2},${S-sw/2}" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;
      break;
    case "diamond":
      inner = `<polygon points="${S/2},${sw/2} ${S-sw/2},${S/2} ${S/2},${S-sw/2} ${sw/2},${S/2}" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;
      break;
    case "arrow": {
      const h = S * 0.32, p = S * 0.42;
      inner = `<polygon points="${sw},${S/2-h/2} ${S-p},${S/2-h/2} ${S-p},${S*0.1} ${S-sw},${S/2} ${S-p},${S*0.9} ${S-p},${S/2+h/2} ${sw},${S/2+h/2}" fill="${color}" stroke="none"/>`;
      break;
    }
    case "line":
      inner = `<line x1="${S*0.05}" y1="${S/2}" x2="${S*0.95}" y2="${S/2}" stroke="${color}" stroke-width="${S*0.1}" stroke-linecap="round"/>`;
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${inner}</svg>`;
}

// Load SVG string as HTMLImageElement for canvas export
function svgToImage(svgStr: string, size: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const img  = new Image(size, size);
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("svg load failed")); };
    img.src = url;
  });
}

interface TextLayer {
  id: string;
  content: string;
  x: number;        // 0-1 relative to PREVIEW
  y: number;
  color: string;
  size: number;     // font-size in EXPORT canvas px
  font: string;
  bg: boolean;
  align: Align;
}

interface Props {
  file: File;
  onDone:   (result: File) => void;
  onCancel: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src     = src;
  });
}

function getRotatedSize(w: number, h: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    width:  Math.abs(Math.cos(rad) * w) + Math.abs(Math.sin(rad) * h),
    height: Math.abs(Math.sin(rad) * w) + Math.abs(Math.cos(rad) * h),
  };
}

async function buildCroppedCanvas(
  imgSrc: string,
  crop: Area,
  rotation: number,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imgSrc);
  const { width: bW, height: bH } = getRotatedSize(img.naturalWidth, img.naturalHeight, rotation);

  // Step 1: draw full image rotated into bounding box
  const rot = document.createElement("canvas");
  rot.width  = bW;
  rot.height = bH;
  const rCtx = rot.getContext("2d")!;
  rCtx.translate(bW / 2, bH / 2);
  rCtx.rotate((rotation * Math.PI) / 180);
  rCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  // Step 2: crop to pixel area (scale to EXPORT)
  const scale = Math.min(EXPORT / crop.width, EXPORT / crop.height);
  const outW  = Math.round(crop.width  * scale);
  const outH  = Math.round(crop.height * scale);

  const out = document.createElement("canvas");
  out.width  = outW;
  out.height = outH;
  out.getContext("2d")!.drawImage(rot, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH);

  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ImageCropFilter({ file, onDone, onCancel }: Props) {
  const [imgSrc, setImgSrc] = useState("");

  // Crop state (react-easy-crop)
  const [crop,     setCrop]     = useState<Point>({ x: 0, y: 0 });
  const [zoom,     setZoom]     = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect,   setAspect]   = useState<number | undefined>(1);
  const [cropArea, setCropArea] = useState<Area | null>(null);

  // Adjust (-100..+100)
  const [bright, setBright] = useState(0);
  const [cont,   setCont]   = useState(0);
  const [sat,    setSat]    = useState(0);
  const [warm,   setWarm]   = useState(0);
  const [vignet, setVignet] = useState(0);  // 0-100
  const [blur,   setBlur]   = useState(0);  // 0-20 (global blur)

  // Filter preset
  const [filterIdx, setFilterIdx] = useState(0);

  // Text
  const [texts,      setTexts]     = useState<TextLayer[]>([]);
  const [selTextId,  setSelTextId] = useState<string | null>(null);
  const [tInput,     setTInput]    = useState("");
  const [tColor,     setTColor]    = useState("#FFFFFF");
  const [tSize,      setTSize]     = useState(72);
  const [tFont,      setTFont]     = useState("sans-serif");
  const [tBg,        setTBg]       = useState(false);
  const [tAlign,     setTAlign]    = useState<Align>("center");
  const [addingText, setAddingText] = useState(false);

  // Draw
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCtxRef    = useRef<CanvasRenderingContext2D | null>(null);
  const [drawColor,   setDrawColor] = useState("#FFFFFF");
  const [drawSize,    setDrawSize]  = useState(8);
  const [eraserMode,  setEraserMode] = useState(false);
  const [hasDrawing,  setHasDrawing] = useState(false);
  const [undoCount,   setUndoCount]  = useState(0);
  const snaps       = useRef<ImageData[]>([]);
  const lastPoint   = useRef<{ x: number; y: number } | null>(null);
  const isDrawingNow = useRef(false);

  // Shapes
  const [shapes,    setShapes]   = useState<ShapeLayer[]>([]);
  const [sType,     setSType]    = useState<ShapeType>("heart");
  const [sColor,    setSColor]   = useState("#FF6B9D");
  const [sSize,     setSSize]    = useState(160);
  const [sFilled,   setSFilled]  = useState(true);
  const [sOpacity,  setSOpacity] = useState(1);
  const [sRotation, setSRotation] = useState(0);

  // Text drag
  const txtDragRef   = useRef<{ id: string; cx: number; cy: number; ox: number; oy: number } | null>(null);
  const shapeDragRef = useRef<{ id: string; cx: number; cy: number; ox: number; oy: number } | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCropArea(pixels), []);

  // UI
  const [tab,      setTab]      = useState<Tab>("crop");
  const [applying, setApplying] = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Initialise drawing canvas when tab switches to draw
  useEffect(() => {
    if (tab !== "draw") return;
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    drawCtxRef.current = ctx;
    ctx.lineCap   = "round";
    ctx.lineJoin  = "round";
  }, [tab]);

  // ── Composed CSS filter ───────────────────────────────────────────────────
  const warmCss = warm !== 0
    ? (warm > 0 ? `sepia(${(warm * 0.6).toFixed(1)}%)` : `hue-rotate(${(-warm * 0.35).toFixed(1)}deg)`)
    : "";
  const blurCss  = blur > 0 ? `blur(${(blur * 0.5).toFixed(1)}px)` : "";
  const adjCss   = [
    `brightness(${(1 + bright / 100).toFixed(3)})`,
    `contrast(${(1 + cont / 100).toFixed(3)})`,
    `saturate(${(1 + sat / 100).toFixed(3)})`,
    warmCss,
    blurCss,
  ].filter(Boolean).join(" ");
  const presetCss      = FILTERS[filterIdx].css;
  const composedFilter = [adjCss, presetCss !== "none" ? presetCss : ""].filter(Boolean).join(" ");

  // ── Text drag helpers ────────────────────────────────────────────────────
  function startTxtDrag(e: React.MouseEvent | React.TouchEvent, id: string, ox: number, oy: number) {
    e.stopPropagation();
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    txtDragRef.current = { id, cx, cy, ox, oy };
  }
  function onPreviewPointerMove(cx: number, cy: number) {
    if (tab === "draw") return;
    const d = txtDragRef.current;
    if (d) {
      const dx = (cx - d.cx) / PREVIEW;
      const dy = (cy - d.cy) / PREVIEW;
      setTexts(prev => prev.map(t => t.id !== d.id ? t : {
        ...t,
        x: Math.max(0.02, Math.min(0.98, d.ox + dx)),
        y: Math.max(0.02, Math.min(0.98, d.oy + dy)),
      }));
    }
    const s = shapeDragRef.current;
    if (s) {
      const dx = (cx - s.cx) / PREVIEW;
      const dy = (cy - s.cy) / PREVIEW;
      setShapes(prev => prev.map(sh => sh.id !== s.id ? sh : {
        ...sh,
        x: Math.max(0.02, Math.min(0.98, s.ox + dx)),
        y: Math.max(0.02, Math.min(0.98, s.oy + dy)),
      }));
    }
  }
  function onPreviewPointerUp() { txtDragRef.current = null; shapeDragRef.current = null; }

  function startShapeDrag(e: React.MouseEvent | React.TouchEvent, id: string, ox: number, oy: number) {
    e.stopPropagation();
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    shapeDragRef.current = { id, cx, cy, ox, oy };
  }

  function addShape() {
    setShapes(prev => [...prev, {
      id:       Math.random().toString(36).slice(2),
      type:     sType,
      x: 0.5, y: 0.5,
      size:     sSize,
      rotation: sRotation,
      color:    sColor,
      opacity:  sOpacity,
      filled:   sFilled,
    }]);
  }

  function deleteShape(id: string) {
    setShapes(prev => prev.filter(s => s.id !== id));
  }

  // ── Drawing helpers ──────────────────────────────────────────────────────
  function canvasPoint(e: React.TouchEvent | React.MouseEvent): { x: number; y: number } {
    const canvas = drawCanvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const src    = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return {
      x: ((src.clientX - rect.left) / rect.width)  * PREVIEW,
      y: ((src.clientY - rect.top)  / rect.height) * PREVIEW,
    };
  }

  function saveSnap() {
    const ctx = drawCtxRef.current;
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, PREVIEW, PREVIEW);
    snaps.current = [...snaps.current.slice(-(MAX_UNDO - 1)), data];
    setUndoCount(snaps.current.length);
  }

  function undo() {
    const ctx = drawCtxRef.current;
    if (!ctx || snaps.current.length === 0) return;
    const prev = snaps.current[snaps.current.length - 1];
    ctx.putImageData(prev, 0, 0);
    snaps.current = snaps.current.slice(0, -1);
    setUndoCount(snaps.current.length);
    setHasDrawing(snaps.current.length > 0 || true);
  }

  function clearDrawing() {
    const ctx = drawCtxRef.current;
    if (!ctx) return;
    saveSnap();
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    setHasDrawing(false);
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    if (tab !== "draw") return;
    e.preventDefault();
    saveSnap();
    const ctx = drawCtxRef.current;
    if (!ctx) return;
    isDrawingNow.current = true;
    const pt = canvasPoint(e);
    lastPoint.current = pt;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    if (eraserMode) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = drawSize * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawColor;
      ctx.lineWidth   = drawSize;
    }
    setHasDrawing(true);
  }

  function continueDraw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawingNow.current || tab !== "draw") return;
    e.preventDefault();
    const ctx = drawCtxRef.current;
    if (!ctx) return;
    const pt = canvasPoint(e);
    const lp = lastPoint.current ?? pt;
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPoint.current = pt;
  }

  function endDraw() {
    isDrawingNow.current = false;
    lastPoint.current = null;
    if (drawCtxRef.current) {
      drawCtxRef.current.globalCompositeOperation = "source-over";
    }
  }

  // ── Text helpers ─────────────────────────────────────────────────────────
  function commitText() {
    if (!tInput.trim()) { setAddingText(false); return; }
    if (selTextId) {
      setTexts(prev => prev.map(t => t.id === selTextId
        ? { ...t, content: tInput.trim(), color: tColor, size: tSize, font: tFont, bg: tBg, align: tAlign }
        : t
      ));
    } else {
      setTexts(prev => [...prev, {
        id:      Math.random().toString(36).slice(2),
        content: tInput.trim(),
        x: 0.5, y: 0.5,
        color: tColor, size: tSize, font: tFont, bg: tBg, align: tAlign,
      }]);
    }
    setTInput("");
    setSelTextId(null);
    setAddingText(false);
  }

  function selectText(t: TextLayer) {
    setSelTextId(t.id);
    setTInput(t.content);
    setTColor(t.color);
    setTSize(t.size);
    setTFont(t.font);
    setTBg(t.bg);
    setTAlign(t.align);
    setAddingText(true);
  }

  function deleteText(id: string) {
    setTexts(prev => prev.filter(t => t.id !== id));
    setSelTextId(null);
    setAddingText(false);
  }

  // ── Canvas export ─────────────────────────────────────────────────────────
  async function handleApply() {
    if (!imgSrc || !cropArea) { setError("Ajustá el recorte primero."); return; }
    setApplying(true);
    setError("");
    try {
      // 1. Get cropped image at export resolution
      const cropped = await buildCroppedCanvas(imgSrc, cropArea, rotation);
      const W = cropped.width;
      const H = cropped.height;

      // 2. Output canvas
      const out = document.createElement("canvas");
      out.width  = W;
      out.height = H;
      const ctx  = out.getContext("2d")!;

      // 3. Draw image + filter
      try { if (composedFilter) ctx.filter = composedFilter; } catch { /* iOS <18 fallback */ }
      ctx.drawImage(cropped, 0, 0);
      try { ctx.filter = "none"; } catch { /* ignore */ }

      // 3b. Vignette overlay
      if (vignet > 0) {
        const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.3, W/2, H/2, Math.max(W,H)*0.75);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, `rgba(0,0,0,${(vignet / 100) * 0.85})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // 4. Shape layers (SVG rendered via image)
      for (const sh of shapes) {
        const svgStr = makeShapeSVG(sh.type, sh.size, sh.color, sh.filled);
        try {
          const shImg = await svgToImage(svgStr, sh.size);
          ctx.save();
          ctx.globalAlpha = sh.opacity;
          ctx.translate(sh.x * W, sh.y * H);
          ctx.rotate((sh.rotation * Math.PI) / 180);
          ctx.drawImage(shImg, -sh.size / 2, -sh.size / 2, sh.size, sh.size);
          ctx.restore();
        } catch { /* ignore shape render error */ }
      }

      // 5. Drawing layer (scale from PREVIEW to export size)
      const dc = drawCanvasRef.current;
      if (dc && hasDrawing) {
        ctx.drawImage(dc, 0, 0, W, H);
      }

      // 6. Text layers
      for (const t of texts) {
        const fs = t.size;
        ctx.save();
        ctx.font         = `bold ${fs}px ${t.font}`;
        ctx.textAlign    = t.align;
        ctx.textBaseline = "middle";
        const tx = t.x * W;
        const ty = t.y * H;

        if (t.bg) {
          const m   = ctx.measureText(t.content);
          const pad = fs * 0.3;
          const bx  = t.align === "center" ? tx - m.width / 2 - pad
                    : t.align === "left"   ? tx - pad
                    : tx - m.width - pad;
          ctx.fillStyle = "rgba(0,0,0,0.62)";
          ctx.fillRect(bx, ty - fs / 2 - pad * 0.4, m.width + pad * 2, fs + pad * 0.8);
        } else {
          ctx.shadowColor   = "rgba(0,0,0,0.9)";
          ctx.shadowBlur    = fs * 0.15;
          ctx.shadowOffsetY = fs * 0.04;
        }
        ctx.fillStyle = t.color;
        ctx.fillText(t.content, tx, ty);
        ctx.restore();
      }

      // 7. toBlob → File
      out.toBlob(blob => {
        if (!blob) { setError("No se pudo exportar la imagen. Intentá de nuevo."); setApplying(false); return; }
        onDone(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        setApplying(false);
      }, "image/jpeg", 0.92);

    } catch (e) {
      console.error("ImageCropFilter export error:", e);
      setError("Error al procesar. Intentá de nuevo.");
      setApplying(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isDrawTab = tab === "draw";
  const isCropTab = tab === "crop";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black select-none" style={{ touchAction: "none" }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0 pt-safe">
        <button onClick={onCancel} className="p-2 text-white/60 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white tracking-wide">Editar foto</h3>
        <button
          onClick={handleApply}
          disabled={applying || !cropArea}
          className="text-amber-400 font-semibold text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40 transition-colors"
        >
          {applying ? "Exportando…" : "Listo"}
        </button>
      </div>

      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-500/20 border-b border-red-500/30 text-red-400 text-xs text-center">
          {error}
        </div>
      )}

      {/* ── Preview area ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-[#080808] overflow-hidden relative">

        {/* Crop tab: react-easy-crop */}
        {isCropTab && imgSrc && (
          <div style={{ position: "relative", width: PREVIEW, height: PREVIEW }}>
            <Cropper
              image={imgSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { width: PREVIEW, height: PREVIEW, borderRadius: 8 },
                cropAreaStyle:  { border: "2px solid rgba(255,255,255,0.85)", borderRadius: 4 },
                mediaStyle:     {},
              }}
              showGrid
              zoomSpeed={0.3}
            />
          </div>
        )}

        {/* Other tabs: static preview + overlays */}
        {!isCropTab && imgSrc && (
          <div
            style={{ width: PREVIEW, height: PREVIEW, position: "relative", overflow: "hidden", background: "#000", borderRadius: 8, flexShrink: 0 }}
            onMouseMove={e => onPreviewPointerMove(e.clientX, e.clientY)}
            onMouseUp={onPreviewPointerUp}
            onMouseLeave={onPreviewPointerUp}
            onTouchMove={e => { const t = e.touches[0]; onPreviewPointerMove(t.clientX, t.clientY); }}
            onTouchEnd={onPreviewPointerUp}
          >
            {/* Base image */}
            <img
              src={imgSrc}
              alt=""
              draggable={false}
              style={{
                position:   "absolute", inset: 0,
                width:      "100%", height: "100%",
                objectFit:  "cover",
                filter:     composedFilter || undefined,
                pointerEvents: "none",
                userSelect: "none",
              }}
            />

            {/* Vignette overlay preview */}
            {vignet > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${(vignet / 100) * 0.85}) 100%)`,
                }}
              />
            )}

            {/* Drawing canvas */}
            <canvas
              ref={drawCanvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="absolute inset-0"
              style={{
                pointerEvents: isDrawTab ? "auto" : "none",
                touchAction:   "none",
                cursor:        isDrawTab ? (eraserMode ? "cell" : "crosshair") : "default",
              }}
              onMouseDown={startDraw}
              onMouseMove={continueDraw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={continueDraw}
              onTouchEnd={endDraw}
            />

            {/* Shape overlays */}
            {shapes.map(sh => {
              const pxSize = sh.size * (PREVIEW / EXPORT);
              const svgStr = makeShapeSVG(sh.type, pxSize, sh.color, sh.filled);
              return (
                <div
                  key={sh.id}
                  onMouseDown={e => { if (!isDrawTab) startShapeDrag(e, sh.id, sh.x, sh.y); }}
                  onTouchStart={e => { if (!isDrawTab) { e.stopPropagation(); startShapeDrag(e, sh.id, sh.x, sh.y); } }}
                  style={{
                    position:    "absolute",
                    left:        `${sh.x * 100}%`,
                    top:         `${sh.y * 100}%`,
                    transform:   `translate(-50%,-50%) rotate(${sh.rotation}deg)`,
                    opacity:     sh.opacity,
                    cursor:      isDrawTab ? "default" : "grab",
                    touchAction: "none",
                    userSelect:  "none",
                    width:       pxSize,
                    height:      pxSize,
                    flexShrink:  0,
                  }}
                  dangerouslySetInnerHTML={{ __html: svgStr }}
                />
              );
            })}

            {/* Text overlays */}
            {texts.map(t => (
              <div
                key={t.id}
                onMouseDown={e => { if (!isDrawTab) startTxtDrag(e, t.id, t.x, t.y); }}
                onTouchStart={e => { if (!isDrawTab) { e.stopPropagation(); startTxtDrag(e, t.id, t.x, t.y); } }}
                onClick={() => { if (!isDrawTab) selectText(t); }}
                style={{
                  position:    "absolute",
                  left:        `${t.x * 100}%`,
                  top:         `${t.y * 100}%`,
                  transform:   "translate(-50%,-50%)",
                  color:       t.color,
                  fontSize:    t.size * (PREVIEW / EXPORT),
                  fontWeight:  "bold",
                  fontFamily:  t.font,
                  textAlign:   t.align,
                  whiteSpace:  "nowrap",
                  cursor:      isDrawTab ? "default" : "grab",
                  touchAction: "none",
                  userSelect:  "none",
                  padding:     t.bg ? "3px 10px" : "0",
                  background:  t.bg ? "rgba(0,0,0,0.62)" : "transparent",
                  borderRadius: t.bg ? "5px" : "0",
                  textShadow:  !t.bg ? "0 1px 6px rgba(0,0,0,0.95)" : "none",
                  outline:     t.id === selTextId ? "2px solid #fbbf24" : "none",
                  outlineOffset: "2px",
                }}
              >
                {t.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Controls panel ───────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#0c0c0c] pb-safe">

        {/* ═══════════ CROP CONTROLS ═══════════ */}
        {isCropTab && (
          <div className="px-4 py-3 space-y-3">
            {/* Aspect ratio */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/40 w-10 flex-shrink-0">Ratio</span>
              <div className="flex gap-1.5 flex-1">
                {ASPECTS.map(a => (
                  <button
                    key={a.label}
                    onClick={() => setAspect(a.value)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                      aspect === a.value
                        ? "border-amber-400 bg-amber-400/15 text-amber-400"
                        : "border-white/15 text-white/50 hover:border-white/30"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRotation(r => r - 90)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <RotateCcw size={16} />
              </button>
              <div className="flex-1 relative">
                <input
                  type="range" min={-180} max={180} step={0.5}
                  value={rotation}
                  onChange={e => setRotation(parseFloat(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
              <span className="text-[10px] text-white/40 w-10 text-right tabular-nums">
                {rotation > 0 ? "+" : ""}{rotation.toFixed(0)}°
              </span>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-3">
              <ZoomIn size={14} className="text-white/40 flex-shrink-0" />
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

        {/* ═══════════ ADJUST CONTROLS ═══════════ */}
        {tab === "adjust" && (
          <div className="px-5 py-3 space-y-2">
            {(
              [
                { label: "Brillo",     emoji: "☀️", val: bright, set: setBright },
                { label: "Contraste",  emoji: "◑",  val: cont,   set: setCont   },
                { label: "Saturación", emoji: "🎨", val: sat,    set: setSat    },
                { label: "Calidez",    emoji: "🌡",  val: warm,   set: setWarm   },
                { label: "Viñeta",     emoji: "⬡",  val: vignet, set: setVignet, min: 0, max: 100 },
                { label: "Desenfoque", emoji: "💧", val: blur,   set: setBlur,   min: 0, max: 20  },
              ] as { label: string; emoji: string; val: number; set: (n: number) => void; min?: number; max?: number }[]
            ).map(({ label, emoji, val, set, min = -100, max = 100 }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="text-base w-6 flex-shrink-0 text-center leading-none">{emoji}</span>
                <span className="text-[10px] text-white/50 w-16 flex-shrink-0">{label}</span>
                <button
                  onClick={() => set(Math.max(min, val - 10))}
                  className="text-white/30 hover:text-white flex-shrink-0"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="range" min={min} max={max} step={1}
                  value={val}
                  onChange={e => set(parseInt(e.target.value))}
                  className="flex-1 accent-amber-400"
                />
                <button
                  onClick={() => set(Math.min(max, val + 10))}
                  className="text-white/30 hover:text-white flex-shrink-0"
                >
                  <PlusIcon size={12} />
                </button>
                <span
                  className="text-[10px] tabular-nums w-8 text-right cursor-pointer"
                  style={{ color: val !== 0 ? "#fbbf24" : "rgba(255,255,255,0.3)" }}
                  onDoubleClick={() => set(0)}
                >
                  {val > 0 && min < 0 ? "+" : ""}{val}
                </span>
              </div>
            ))}
            <p className="text-[9px] text-white/20 text-right pt-0.5">Doble tap en el valor para resetear</p>
          </div>
        )}

        {/* ═══════════ FILTER CONTROLS ═══════════ */}
        {tab === "filter" && imgSrc && (
          <div className="flex gap-2 px-3 py-3 overflow-x-auto scrollbar-none">
            {FILTERS.map((f, i) => (
              <button
                key={i}
                onClick={() => setFilterIdx(i)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
              >
                <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  filterIdx === i ? "border-amber-400 scale-105" : "border-transparent opacity-60 group-hover:opacity-80"
                }`}>
                  <img
                    src={imgSrc}
                    alt={f.name}
                    className="w-full h-full object-cover"
                    style={{ filter: f.css !== "none" ? f.css : undefined }}
                  />
                </div>
                <span className={`text-[9px] font-medium transition-colors ${filterIdx === i ? "text-amber-400" : "text-white/50"}`}>
                  {f.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ═══════════ TEXT CONTROLS ═══════════ */}
        {tab === "text" && (
          <div className="px-4 py-3 space-y-3">
            {addingText ? (
              <>
                {/* Edit mode */}
                <div className="flex gap-2 items-start">
                  <textarea
                    value={tInput}
                    onChange={e => setTInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); } }}
                    placeholder="Escribí el texto…"
                    rows={2}
                    autoFocus
                    className="flex-1 bg-white/10 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm outline-none border border-white/10 focus:border-amber-400/60 resize-none"
                    style={{ fontSize: "16px" }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <button onClick={commitText}
                      className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center">
                      <Check size={16} className="text-black" />
                    </button>
                    {selTextId && (
                      <button onClick={() => deleteText(selTextId)}
                        className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Font picker */}
                <div className="flex gap-1.5">
                  {TEXT_FONTS.map(f => (
                    <button key={f.value} onClick={() => setTFont(f.value)}
                      style={{ fontFamily: f.value }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] border transition-all ${
                        tFont === f.value
                          ? "border-amber-400 bg-amber-400/15 text-amber-400"
                          : "border-white/15 text-white/60 hover:border-white/30"
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Color + align */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 flex-1">
                    {TEXT_COLORS.map(c => (
                      <button key={c} onClick={() => setTColor(c)}
                        style={{ background: c }}
                        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition-transform ${tColor === c ? "border-amber-400 scale-110" : "border-white/20"}`}
                      />
                    ))}
                  </div>
                  <div className="flex border border-white/15 rounded-lg overflow-hidden flex-shrink-0">
                    {(["left","center","right"] as Align[]).map((a, i) => {
                      const Icon = i === 0 ? AlignLeft : i === 1 ? AlignCenter : AlignRight;
                      return (
                        <button key={a} onClick={() => setTAlign(a)}
                          className={`px-2 py-1.5 transition-colors ${tAlign === a ? "bg-amber-400/20 text-amber-400" : "text-white/40 hover:text-white"}`}>
                          <Icon size={13} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Size + bg */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-white/40 flex-shrink-0">Tamaño</span>
                  <input type="range" min={32} max={128} step={4}
                    value={tSize} onChange={e => setTSize(parseInt(e.target.value))}
                    className="flex-1 accent-amber-400" />
                  <button onClick={() => setTBg(v => !v)}
                    className={`flex-shrink-0 text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors ${tBg ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-white/20 text-white/50"}`}>
                    Fondo
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Quick stickers */}
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Stickers rápidos</p>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                    {["❤️","🔥","✨","😍","💫","🎉","😂","💕","🌙","🦋","⚡","🌊","💎","🎸","🌺","👑","🫶","🥂","🌈","🎭"].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setTexts(prev => [...prev, {
                          id: Math.random().toString(36).slice(2),
                          content: emoji,
                          x: 0.25 + Math.random() * 0.5,
                          y: 0.25 + Math.random() * 0.5,
                          color: "#FFFFFF", size: 96, font: "sans-serif", bg: false, align: "center" as Align,
                        }])}
                        className="text-2xl flex-shrink-0 hover:scale-125 active:scale-110 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => { setSelTextId(null); setTInput(""); setAddingText(true); }}
                  className="w-full py-2.5 rounded-xl border border-dashed border-white/25 text-white/60 text-sm hover:border-amber-400/50 hover:text-amber-400 transition-all flex items-center justify-center gap-2"
                >
                  <Type size={16} /> Agregar texto
                </button>
                {texts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">Textos — tap para editar, arrastrá para mover</p>
                    <div className="flex flex-wrap gap-1.5">
                      {texts.map(t => (
                        <button
                          key={t.id}
                          onClick={() => selectText(t)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 hover:border-amber-400/50 transition-colors max-w-[180px]"
                        >
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                          <span className="text-[11px] text-white truncate">{t.content}</span>
                          <X size={10} className="text-white/30 flex-shrink-0"
                            onClick={e => { e.stopPropagation(); deleteText(t.id); }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════ DRAW CONTROLS ═══════════ */}
        {tab === "draw" && (
          <div className="px-4 py-3 space-y-3">
            {/* Color strip */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-12 flex-shrink-0">Color</span>
              <div className="flex gap-2 flex-1 overflow-x-auto scrollbar-none">
                {BRUSH_COLORS.map((c, i) => (
                  <button key={i}
                    onClick={() => { setDrawColor(c); setEraserMode(false); }}
                    style={{ background: c || "transparent" }}
                    className={`w-8 h-8 rounded-full flex-shrink-0 border-2 transition-transform ${
                      drawColor === c && !eraserMode ? "border-amber-400 scale-110" : "border-white/20"
                    } ${c === "rgba(0,0,0,0)" ? "!border-white/30 relative overflow-hidden" : ""}`}
                  >
                    {c === "rgba(0,0,0,0)" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div style={{ width: "100%", height: 2, background: "red", transform: "rotate(45deg)" }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Brush size + tools */}
            <div className="flex items-center gap-3">
              <Pencil size={13} className="text-white/40 flex-shrink-0" />
              <input type="range" min={2} max={40} step={1}
                value={drawSize} onChange={e => setDrawSize(parseInt(e.target.value))}
                className="flex-1 accent-amber-400" />
              <span className="text-[10px] text-white/40 w-6 tabular-nums">{drawSize}px</span>

              <button
                onClick={() => setEraserMode(v => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-[10px] transition-colors ${eraserMode ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-white/20 text-white/50"}`}
              >
                Borrador
              </button>
              <button
                onClick={undo}
                disabled={undoCount === 0}
                className="p-1.5 text-white/40 hover:text-white disabled:opacity-30 transition-colors"
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={clearDrawing}
                className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <p className="text-[10px] text-white/25 text-center">
              Dibujá directamente sobre la imagen
            </p>
          </div>
        )}

        {/* ═══════════ SHAPES CONTROLS ═══════════ */}
        {tab === "shapes" && (
          <div className="px-4 py-3 space-y-3">
            {/* Shape picker */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {SHAPE_TYPES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSType(s.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    sType === s.id
                      ? "border-amber-400 bg-amber-400/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div
                    style={{ width: 32, height: 32 }}
                    dangerouslySetInnerHTML={{
                      __html: makeShapeSVG(s.id, 32, sType === s.id ? "#fbbf24" : "#ffffff", true),
                    }}
                  />
                  <span className={`text-[8px] font-medium ${sType === s.id ? "text-amber-400" : "text-white/40"}`}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Color */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-12 flex-shrink-0">Color</span>
              <div className="flex gap-2 flex-wrap">
                {SHAPE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSColor(c)}
                    style={{ background: c }}
                    className={`w-7 h-7 rounded-full border-2 flex-shrink-0 transition-transform ${sColor === c ? "border-amber-400 scale-110" : "border-white/20"}`}
                  />
                ))}
              </div>
            </div>

            {/* Fill / outline + opacity */}
            <div className="flex items-center gap-3">
              <div className="flex border border-white/15 rounded-lg overflow-hidden flex-shrink-0">
                <button
                  onClick={() => setSFilled(true)}
                  className={`px-3 py-1.5 text-[10px] transition-colors ${sFilled ? "bg-amber-400/20 text-amber-400" : "text-white/40 hover:text-white"}`}
                >
                  Relleno
                </button>
                <button
                  onClick={() => setSFilled(false)}
                  className={`px-3 py-1.5 text-[10px] transition-colors ${!sFilled ? "bg-amber-400/20 text-amber-400" : "text-white/40 hover:text-white"}`}
                >
                  Contorno
                </button>
              </div>
              <span className="text-[10px] text-white/40 flex-shrink-0">Opac.</span>
              <input type="range" min={0.1} max={1} step={0.05}
                value={sOpacity} onChange={e => setSOpacity(parseFloat(e.target.value))}
                className="flex-1 accent-amber-400" />
              <span className="text-[10px] text-white/40 w-7 tabular-nums">{Math.round(sOpacity * 100)}%</span>
            </div>

            {/* Size + rotation */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40 w-12 flex-shrink-0">Tamaño</span>
              <input type="range" min={40} max={500} step={10}
                value={sSize} onChange={e => setSSize(parseInt(e.target.value))}
                className="flex-1 accent-amber-400" />
              <span className="text-[10px] text-white/40 w-10 tabular-nums">{sSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40 w-12 flex-shrink-0">Rotar</span>
              <input type="range" min={0} max={360} step={1}
                value={sRotation} onChange={e => setSRotation(parseInt(e.target.value))}
                className="flex-1 accent-amber-400" />
              <span className="text-[10px] text-white/40 w-10 tabular-nums">{sRotation}°</span>
            </div>

            {/* Add button */}
            <button
              onClick={addShape}
              className="w-full py-2.5 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-400 text-sm font-semibold hover:bg-amber-400/25 transition-colors flex items-center justify-center gap-2"
            >
              <Shapes size={16} /> Agregar forma
            </button>

            {/* Existing shapes list */}
            {shapes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {shapes.map(sh => (
                  <div key={sh.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/8 border border-white/10">
                    <div
                      style={{ width: 16, height: 16 }}
                      dangerouslySetInnerHTML={{ __html: makeShapeSVG(sh.type, 16, sh.color, sh.filled) }}
                    />
                    <span className="text-[10px] text-white/60">{SHAPE_TYPES.find(s => s.id === sh.type)?.label}</span>
                    <button onClick={() => deleteShape(sh.id)} className="text-white/30 hover:text-red-400 transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[9px] text-white/20 text-center">Arrastrá las formas en la imagen para moverlas</p>
          </div>
        )}

        {/* ═══════════ TAB BAR ═══════════ */}
        <div className="flex border-t border-white/8 overflow-x-auto scrollbar-none">
          {([
            { id: "crop",   label: "Recortar", Icon: Crop              },
            { id: "adjust", label: "Ajustar",  Icon: SlidersHorizontal },
            { id: "filter", label: "Filtros",  Icon: Sparkles          },
            { id: "text",   label: "Texto",    Icon: Type              },
            { id: "shapes", label: "Formas",   Icon: Shapes            },
            { id: "draw",   label: "Dibujar",  Icon: Pencil            },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 min-w-[54px] py-2.5 flex flex-col items-center gap-0.5 text-[9px] font-semibold transition-colors ${
                tab === id ? "text-amber-400" : "text-white/35 hover:text-white/60"
              }`}
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
