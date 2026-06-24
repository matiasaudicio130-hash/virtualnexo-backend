import { useRef } from "react";
import { toast } from "@/store/toastStore";
import { X, DownloadSimple, ShareNetwork } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  userId:   string;
  userName: string;
  onClose:  () => void;
}

const BASE_URL = "https://aurasw.club";

export function ProfileQRModal({ userId, userName, onClose }: Props) {
  const profileUrl = `${BASE_URL}/profile/${userId}`;
  const svgRef     = useRef<SVGSVGElement>(null);

  // Descarga el QR como PNG usando un canvas temporal
  function handleDownload() {
    const svg  = svgRef.current;
    if (!svg) return;

    const SIZE  = 400;
    const PAD   = 24;
    const TOTAL = SIZE + PAD * 2;

    const canvas  = document.createElement("canvas");
    canvas.width  = TOTAL;
    canvas.height = TOTAL + 56;   // espacio extra para el nombre debajo
    const ctx     = canvas.getContext("2d")!;

    // Fondo oscuro (Aura brand)
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Borde dorado
    ctx.strokeStyle = "rgba(201,162,39,0.4)";
    ctx.lineWidth   = 1.5;
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 16);
    ctx.stroke();

    // Convertir SVG a imagen
    const svgData = new XMLSerializer().serializeToString(svg);
    const img     = new Image();
    img.onload = () => {
      ctx.drawImage(img, PAD, PAD, SIZE, SIZE);

      // Nombre y URL debajo del QR
      ctx.font      = "bold 16px Manrope, sans-serif";
      ctx.fillStyle = "#C9A227";
      ctx.textAlign = "center";
      ctx.fillText(userName, canvas.width / 2, TOTAL + 28);

      ctx.font      = "11px Manrope, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText("aurasw.club", canvas.width / 2, TOTAL + 48);

      const link    = document.createElement("a");
      link.download = `aura_qr_${userName.replace(/\s+/g, "_")}.png`;
      link.href     = canvas.toDataURL("image/png", 1.0);
      link.click();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Perfil de ${userName} en Aura SW`, url: profileUrl });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(profileUrl);
      toast.success("¡Link copiado al portapapeles!");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-bg-card border border-border rounded-3xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-semibold text-sm">Mi código QR</p>
            <p className="text-[10px] text-text-muted mt-0.5">Compartilo para que te encuentren</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* QR code */}
        <div className="flex flex-col items-center gap-4 px-5 py-6">
          {/* Contenedor con borde dorado */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "#fff", border: "3px solid var(--gold,#C9A227)" }}
          >
            <QRCodeSVG
              ref={svgRef}
              value={profileUrl}
              size={200}
              bgColor="#ffffff"
              fgColor="#0a0a0f"
              level="M"
              includeMargin={false}
              imageSettings={{
                src: "/icons/icon-192.png",
                x:   undefined,
                y:   undefined,
                height: 30,
                width:  30,
                excavate: true,
              }}
            />
          </div>

          {/* Nombre y URL */}
          <div className="text-center">
            <p className="font-semibold" style={{ color: "var(--gold,#C9A227)" }}>{userName}</p>
            <p className="text-[11px] text-text-muted mt-0.5 font-mono">
              aurasw.club/profile/…
            </p>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 w-full">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm text-text-secondary hover:bg-bg-muted transition-colors"
            >
              <DownloadSimple size={15} />
              Guardar
            </button>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "var(--gold,#C9A227)", color: "#0a0a0f" }}
            >
              <ShareNetwork size={15} />
              Compartir
            </button>
          </div>

          <p className="text-[10px] text-text-muted text-center">
            Cualquier persona que escanee este QR irá directo a tu perfil
          </p>
        </div>
      </div>
    </div>
  );
}
