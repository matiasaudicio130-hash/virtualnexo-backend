import logging
from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import List
from functools import lru_cache

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    METAMAP_CLIENT_ID: str = ""
    METAMAP_CLIENT_SECRET: str = ""
    METAMAP_FLOW_ID: str = ""
    METAMAP_WEBHOOK_SECRET: str = ""
    METAMAP_SIMULATION_MODE: bool = True

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM_NAME: str = "Aura SW"
    EMAIL_FROM_ADDRESS: str = "noreply@aurasw.club"

    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY:  str = ""
    VAPID_SUBJECT:     str = "mailto:soporte@aurasw.club"

    FRONTEND_URL: str = "http://localhost:5173"
    ADMIN_MASTER_EMAIL: str = ""

    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def is_dev(self) -> bool:
        return self.APP_ENV == "development"

    @model_validator(mode="after")
    def _check_secrets(self):
        """
        Defensa en profundidad: avisa (sin crashear) si faltan secretos importantes.
        NO usamos `raise` para no tirar abajo producción en un deploy — solo logueamos.
        Los secretos verdaderamente críticos (JWT/SUPABASE_*) ya fallan al arrancar
        porque no tienen valor por defecto.
        """
        avisos: list[str] = []

        if len(self.JWT_SECRET_KEY) < 32:
            avisos.append(
                "JWT_SECRET_KEY es corto (<32 chars): riesgo de forja de tokens. "
                "Generá uno fuerte: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )

        if self.APP_ENV == "production":
            opcionales = {
                "SMTP_PASSWORD":     self.SMTP_PASSWORD,      # emails de verificación
                "VAPID_PRIVATE_KEY": self.VAPID_PRIVATE_KEY,  # push notifications
                "STRIPE_SECRET_KEY": self.STRIPE_SECRET_KEY,  # pagos (aún no activo)
            }
            faltantes = [k for k, v in opcionales.items() if not v]
            if not self.METAMAP_SIMULATION_MODE and not self.METAMAP_CLIENT_SECRET:
                faltantes.append("METAMAP_CLIENT_SECRET")  # KYC real activado pero sin secreto
            if faltantes:
                avisos.append(
                    "Secretos opcionales sin configurar (sus features no funcionarán): "
                    + ", ".join(faltantes)
                )

        for aviso in avisos:
            logger.warning("⚠️  Config: %s", aviso)

        return self

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # pydantic-settings lee de .env en runtime
