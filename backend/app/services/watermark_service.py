"""
Servicio de marcas de agua para imágenes.

MARCA VISIBLE:
  ID del usuario (ej: "VNX·A1B2C3") en esquina inferior izquierda.
  Texto blanco con sombra negra, semitransparente, sobre overlay oscuro.
  Imposible quitar sin degradar notablemente la imagen.

MARCA INVISIBLE (LSB Steganography):
  Incrusta user_id + timestamp en los bits menos significativos del canal azul.
  Invisible a simple vista. Recuperable con extract_stealth_watermark().
  IMPORTANTE: salvar siempre como PNG para preservar (JPEG destruye LSB).
"""
import io
import struct
import hashlib
from datetime import datetime, timezone
from typing import cast
from PIL import Image, ImageDraw, ImageFont
from pillow_heif import register_heif_opener

# Permite que Image.open() decodifique HEIC/HEIF (formato por defecto de fotos
# de iPhone) — sin esto, Pillow lanza UnidentifiedImageError con esos archivos.
register_heif_opener()


# ── Constantes ────────────────────────────────────────────────
WM_COLOR        = (255, 255, 255, 180)   # Blanco 70% opacidad
WM_SHADOW       = (0, 0, 0, 120)         # Sombra 47% opacidad
WM_OVERLAY      = (0, 0, 0, 60)          # Banda oscura detrás del texto
WM_FONT_SIZE_PCT= 0.028                  # ~2.8% del alto de la imagen
MAX_DIMENSION   = 1920                   # Redimensionar si es mayor
STEALTH_MARKER  = b"\xAE\xA5\xBE\xEF"  # Firma AURA para detectar watermark


def _get_font(size: int):
    """Intenta cargar una fuente monoespaciada. Fallback a default."""
    candidates = [
        "DejaVuSansMono.ttf", "cour.ttf", "Courier New.ttf",
        "LiberationMono-Regular.ttf", "NotoMono-Regular.ttf",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            pass
    return ImageFont.load_default(size=size)


def _wm_label(user_id: str) -> str:
    """Genera la etiqueta visible: 'AURA·XXXXXX' (primeros 8 chars del ID sin guiones)."""
    short = user_id.replace("-", "").upper()[:8]
    return f"AURA·{short}"


def apply_visible_watermark(img: Image.Image, user_id: str) -> Image.Image:
    """
    Aplica marca de agua VISIBLE al ángulo inferior izquierdo.
    Devuelve RGBA. El caller decide el formato final.
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Redimensionar si es muy grande (mantiene aspect ratio)
    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
        w, h = img.size

    label = _wm_label(user_id)
    font_size = max(12, int(h * WM_FONT_SIZE_PCT))
    font = _get_font(font_size)

    # Medir texto
    tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bbox = tmp.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    # Overlay semitransparente detrás del texto
    pad_x, pad_y = int(font_size * 0.6), int(font_size * 0.3)
    overlay_x1 = 0
    overlay_y1 = h - th - pad_y * 3
    overlay_x2 = tw + pad_x * 4
    overlay_y2 = h

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle(
        [(overlay_x1, overlay_y1), (overlay_x2, overlay_y2)],
        fill=WM_OVERLAY,
    )
    img = Image.alpha_composite(img, overlay)

    # Sombra del texto
    draw = ImageDraw.Draw(img)
    tx = pad_x * 2
    ty = h - th - pad_y * 2
    for dx, dy in [(1, 1), (2, 2), (-1, 1), (1, -1)]:
        draw.text((tx + dx, ty + dy), label, font=font, fill=WM_SHADOW)

    # Texto principal
    draw.text((tx, ty), label, font=font, fill=WM_COLOR)

    return img


def apply_stealth_watermark(img: Image.Image, payload: str) -> Image.Image:
    """
    Incrusta una cadena en los bits menos significativos del canal azul (LSB).
    SOLO funciona si la imagen se guarda como PNG (JPEG destruye los LSBs).
    payload: string a incrustar (ej: user_id + timestamp)
    """
    if img.mode != "RGB":
        img = img.convert("RGB")

    # Codificar: MARKER + longitud (4 bytes big-endian) + datos UTF-8
    data_bytes = payload.encode("utf-8")
    encoded = STEALTH_MARKER + struct.pack(">I", len(data_bytes)) + data_bytes
    bits = []
    for byte in encoded:
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)

    pixels = cast(list[tuple[int, int, int]], list(img.getdata()))  # type: ignore[arg-type]
    if len(bits) > len(pixels):
        raise ValueError(f"Imagen demasiado pequeña para incrustar {len(data_bytes)} bytes")

    new_pixels = []
    for i, px in enumerate(pixels):
        if i < len(bits):
            r, g, b = px
            b = (b & 0xFE) | bits[i]   # Reemplaza LSB del canal azul
            new_pixels.append((r, g, b))
        else:
            new_pixels.append(px)

    result = Image.new("RGB", img.size)
    result.putdata(new_pixels)
    return result


def extract_stealth_watermark(img: Image.Image) -> str | None:
    """
    Extrae la marca de agua invisible. Devuelve el payload o None.
    Usar para verificar filtraciones: extract_stealth_watermark(imagen_filtrada).
    """
    if img.mode != "RGB":
        img = img.convert("RGB")

    pixels = cast(list[tuple[int, int, int]], list(img.getdata()))  # type: ignore[arg-type]
    bits = [(px[2] & 1) for px in pixels]  # LSB del canal azul

    def bits_to_bytes(start: int, n: int) -> bytes:
        result = bytearray()
        for i in range(n):
            byte = 0
            for j in range(8):
                byte = (byte << 1) | bits[start + i * 8 + j]
            result.append(byte)
        return bytes(result)

    # Verificar marker (primeros 4 bytes = 32 bits)
    if len(bits) < 64:
        return None
    marker = bits_to_bytes(0, 4)
    if marker != STEALTH_MARKER:
        return None

    # Leer longitud (4 bytes)
    length_bytes = bits_to_bytes(32, 4)
    length = struct.unpack(">I", length_bytes)[0]
    if length > 10000 or 64 + length * 8 > len(bits):
        return None

    # Leer payload
    payload_bytes = bits_to_bytes(64, length)
    try:
        return payload_bytes.decode("utf-8")
    except Exception:
        return None


def build_stealth_payload(user_id: str) -> str:
    """Payload estándar: user_id + timestamp + hash parcial."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    sig = hashlib.sha256(f"{user_id}:{ts}".encode()).hexdigest()[:8]
    return f"AURA:{user_id}:{ts}:{sig}"


class WatermarkService:

    def process_avatar(self, image_data: bytes, user_id: str) -> tuple[bytes, dict]:
        """
        Procesa un avatar:
        1. Resize a max 800px
        2. Aplica marca VISIBLE
        3. Aplica marca INVISIBLE
        4. Devuelve PNG bytes + metadata
        """
        img = Image.open(io.BytesIO(image_data))
        w, h = img.size

        # Paso 1: Visible watermark
        img_wm = apply_visible_watermark(img.copy(), user_id)
        img_wm = img_wm.convert("RGB")  # Quitar alpha para PNG limpio

        # Paso 2: Stealth watermark
        payload = build_stealth_payload(user_id)
        img_final = apply_stealth_watermark(img_wm, payload)

        # Redimensionar a max 800 para avatars
        aw, ah = img_final.size
        if max(aw, ah) > 800:
            ratio = 800 / max(aw, ah)
            img_final = img_final.resize((int(aw * ratio), int(ah * ratio)), Image.Resampling.LANCZOS)

        # Exportar como PNG (obligatorio para preservar LSB)
        buf = io.BytesIO()
        img_final.save(buf, format="PNG", optimize=True)
        buf.seek(0)
        png_bytes = buf.read()

        fw, fh = img_final.size
        return png_bytes, {
            "original_size": (w, h),
            "final_size": (fw, fh),
            "has_visible_wm": True,
            "has_stealth_wm": True,
            "wm_payload": payload,
            "mime_type": "image/png",
            "size_bytes": len(png_bytes),
        }

    def process_post_image(self, image_data: bytes, user_id: str) -> tuple[bytes, dict]:
        """
        Procesa imagen de publicación:
        Igual que avatar pero a max 1920px y sin recorte cuadrado.
        """
        img = Image.open(io.BytesIO(image_data))
        w, h = img.size

        img_wm = apply_visible_watermark(img.copy(), user_id)
        img_wm = img_wm.convert("RGB")

        payload = build_stealth_payload(user_id)
        img_final = apply_stealth_watermark(img_wm, payload)

        buf = io.BytesIO()
        img_final.save(buf, format="PNG", optimize=True)
        buf.seek(0)
        png_bytes = buf.read()

        fw, fh = img_final.size
        return png_bytes, {
            "original_size": (w, h),
            "final_size": (fw, fh),
            "has_visible_wm": True,
            "has_stealth_wm": True,
            "wm_payload": payload,
            "mime_type": "image/png",
            "size_bytes": len(png_bytes),
        }

    def verify_leak(self, image_data: bytes) -> dict:
        """
        Herramienta de investigación: extrae el watermark de una imagen filtrada.
        Devuelve user_id y timestamp si se encuentra.
        """
        try:
            img = Image.open(io.BytesIO(image_data)).convert("RGB")
            payload = extract_stealth_watermark(img)
            if not payload:
                return {"found": False}
            parts = payload.split(":")
            if len(parts) >= 4 and parts[0] in ("AURA", "VNX"):  # VNX por retrocompatibilidad
                return {
                    "found": True,
                    "user_id": parts[1],
                    "timestamp": parts[2],
                    "signature": parts[3],
                    "raw_payload": payload,
                }
            return {"found": True, "raw_payload": payload}
        except Exception as e:
            return {"found": False, "error": str(e)}


watermark_service = WatermarkService()
