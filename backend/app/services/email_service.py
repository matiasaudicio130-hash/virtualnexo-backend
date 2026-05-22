import smtplib
import logging
from html import escape
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

BRAND   = settings.EMAIL_FROM_NAME    # "AURA"
FROM    = settings.EMAIL_FROM_ADDRESS # "soporte@aurasw.club"
GOLD    = "#C9A227"
DARK    = "#07070f"
WHITE   = "#F0EDE6"
MUTED   = "#6a6a7a"


def _base(content: str) -> str:
    """Wrapper HTML con branding AURA."""
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{BRAND}</title></head>
<body style="margin:0;padding:0;background:#020207;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:{DARK};border:1px solid #1a1a2a;border-radius:4px;overflow:hidden;">

    <!-- Header -->
    <div style="padding:32px 40px 24px;border-bottom:1px solid #1a1a2a;
                background:linear-gradient(135deg,rgba(201,162,39,.06) 0%,transparent 60%);">
      <p style="margin:0;font-size:11px;letter-spacing:.4em;color:{GOLD};text-transform:uppercase;font-weight:400;">
        {BRAND} &nbsp;&middot;&nbsp; EXCLUSIVE LIFESTYLE
      </p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      {content}
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;border-top:1px solid #111120;text-align:center;">
      <p style="margin:0;font-size:10px;letter-spacing:.15em;color:#2a2a3a;text-transform:uppercase;">
        Solo para mayores de 18 &middot; Argentina &middot;
        <a href="mailto:{FROM}" style="color:#3a3a4a;text-decoration:none;">{FROM}</a>
      </p>
    </div>
  </div>
</body>
</html>"""


def _h2(text: str) -> str:
    return f'<h2 style="margin:0 0 16px;font-size:22px;font-weight:300;color:{WHITE};letter-spacing:.05em;">{text}</h2>'


def _p(text: str, muted: bool = False) -> str:
    color = MUTED if muted else "#9a9aaa"
    return f'<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:{color};">{text}</p>'


def _btn(text: str, url: str) -> str:
    return f"""<div style="margin:28px 0;">
      <a href="{url}" style="display:inline-block;background:linear-gradient(135deg,{GOLD},{GOLD}cc);
         color:#07070f;padding:14px 32px;border-radius:3px;text-decoration:none;
         font-size:11px;letter-spacing:.25em;text-transform:uppercase;font-weight:500;">
        {text}
      </a>
    </div>"""


def _divider() -> str:
    return '<div style="height:1px;background:linear-gradient(to right,transparent,#1a1a2a,transparent);margin:24px 0;"/>'


def _send(to: str, subject: str, html: str) -> None:
    """Envía email via SMTP. En dev sin credenciales, loguea."""
    if not settings.SMTP_USER:
        logger.info(f"[EMAIL SIMULADO] To:{to} | Subject:{subject}")
        logger.info(html[:200])
        return
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"]    = f"{BRAND} <{FROM}>"
            msg["To"]      = to
            msg.attach(MIMEText(html, "html", "utf-8"))
            server.send_message(msg)
            logger.info(f"Email enviado a {to} | {subject}")
    except Exception as e:
        logger.error(f"Error enviando email a {to}: {e}", exc_info=True)


# ── Templates ──────────────────────────────────────────────

def send_verification_email(to_email: str, first_name: str, token: str) -> None:
    verify_url = f"{settings.FRONTEND_URL}/verificar-email?token={token}"
    name = escape(first_name)
    content = (
        _h2(f"Hola, {name}")
        + _p("Gracias por registrarte en AURA. Verificá tu dirección de email para activar tu cuenta.")
        + _btn("Verificar email", verify_url)
        + _divider()
        + _p("Este enlace expira en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.", muted=True)
    )
    _send(to_email, f"Verificá tu email — {BRAND}", _base(content))


def send_kyc_approved_email(to_email: str, first_name: str) -> None:
    name = escape(first_name)
    content = (
        _h2(f"Identidad verificada, {name}")
        + _p("Tu cuenta en AURA fue verificada exitosamente. Ya podés acceder a la plataforma con todos los beneficios de tu membresía.")
        + _btn("Ingresar a AURA", f"{settings.FRONTEND_URL}/login")
    )
    _send(to_email, f"Cuenta verificada — {BRAND}", _base(content))


def send_kyc_rejected_email(to_email: str, first_name: str, reason: str = "") -> None:
    name = escape(first_name)
    motivo = f'<p style="color:#EF4444;font-size:13px;margin:0 0 14px;">Motivo: {escape(reason)}</p>' if reason else ""
    content = (
        _h2("Verificación no exitosa")
        + _p(f"Hola {name}, no pudimos verificar tu identidad.")
        + motivo
        + _p(f'Contactanos si creés que es un error: <a href="mailto:{FROM}" style="color:{GOLD};">{FROM}</a>', muted=True)
    )
    _send(to_email, f"Verificacion no exitosa — {BRAND}", _base(content))


def send_manual_approval_email(to_email: str, first_name: str) -> None:
    name = escape(first_name)
    content = (
        _h2("Solicitud recibida")
        + _p(f"Hola {name}, recibimos tu solicitud de acceso a AURA.")
        + _p("Tu cuenta está en revisión y recibirás una respuesta dentro de las próximas 24–48 horas.")
    )
    _send(to_email, f"Solicitud recibida — {BRAND}", _base(content))
