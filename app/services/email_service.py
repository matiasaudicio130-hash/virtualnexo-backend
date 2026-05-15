import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import get_settings
from app.core.branding import APP_NAME

settings = get_settings()
logger = logging.getLogger(__name__)


def _build_email(to: str, subject: str, html_body: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{APP_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))
    return msg


def _send(to: str, subject: str, html_body: str) -> None:
    if settings.is_dev and not settings.SMTP_USER:
        logger.info(f"[EMAIL SIMULADO] To: {to} | Subject: {subject}")
        logger.info(html_body)
        return
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(_build_email(to, subject, html_body))
    except Exception as e:
        logger.error(f"Error enviando email a {to}: {e}")


def send_verification_email(to_email: str, first_name: str, token: str) -> None:
    verify_url = f"{settings.FRONTEND_URL}/verificar-email?token={token}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0F;color:#F8F8FF;padding:40px;border-radius:12px;">
      <h1 style="color:#8B5CF6;margin-bottom:8px;">{APP_NAME}</h1>
      <h2>¡Hola, {first_name}!</h2>
      <p>Gracias por registrarte. Hacé click en el botón para verificar tu email.</p>
      <a href="{verify_url}"
         style="display:inline-block;background:#8B5CF6;color:white;padding:14px 28px;
                border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;">
        Verificar Email
      </a>
      <p style="color:#9CA3AF;font-size:12px;">Este link expira en 24 horas.<br>
      Si no creaste esta cuenta, ignorá este email.</p>
    </div>
    """
    _send(to_email, f"Verificá tu email - {APP_NAME}", html)


def send_kyc_approved_email(to_email: str, first_name: str) -> None:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0F;color:#F8F8FF;padding:40px;border-radius:12px;">
      <h1 style="color:#8B5CF6;">{APP_NAME}</h1>
      <h2>¡Tu cuenta fue verificada! ✓</h2>
      <p>Hola {first_name}, tu identidad fue verificada exitosamente.</p>
      <p>Ya podés acceder a la plataforma con todos los beneficios de tu membresía.</p>
      <a href="{settings.FRONTEND_URL}/login"
         style="display:inline-block;background:#10B981;color:white;padding:14px 28px;
                border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;">
        Ingresar ahora
      </a>
    </div>
    """
    _send(to_email, f"¡Cuenta verificada! - {APP_NAME}", html)


def send_kyc_rejected_email(to_email: str, first_name: str, reason: str = "") -> None:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0F;color:#F8F8FF;padding:40px;border-radius:12px;">
      <h1 style="color:#8B5CF6;">{APP_NAME}</h1>
      <h2>Verificación no exitosa</h2>
      <p>Hola {first_name}, lamentablemente no pudimos verificar tu identidad.</p>
      {f'<p style="color:#EF4444;">Motivo: {reason}</p>' if reason else ''}
      <p>Contactá a soporte si creés que es un error: <a href="mailto:{settings.EMAIL_FROM_ADDRESS}" style="color:#8B5CF6;">{settings.EMAIL_FROM_ADDRESS}</a></p>
    </div>
    """
    _send(to_email, f"Verificación no exitosa - {APP_NAME}", html)


def send_manual_approval_email(to_email: str, first_name: str) -> None:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0F;color:#F8F8FF;padding:40px;border-radius:12px;">
      <h1 style="color:#8B5CF6;">{APP_NAME}</h1>
      <h2>Registro recibido ✓</h2>
      <p>Hola {first_name}, recibimos tu solicitud de registro.</p>
      <p>Tu cuenta está en revisión manual y recibirás una respuesta en las próximas 24-48hs.</p>
    </div>
    """
    _send(to_email, f"Solicitud recibida - {APP_NAME}", html)
