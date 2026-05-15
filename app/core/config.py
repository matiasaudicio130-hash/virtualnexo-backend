from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


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
    EMAIL_FROM_NAME: str = "VirtualNexo"
    EMAIL_FROM_ADDRESS: str = "noreply@virtualnexo.com"

    FRONTEND_URL: str = "http://localhost:5173"
    ADMIN_MASTER_EMAIL: str = ""

    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def is_dev(self) -> bool:
        return self.APP_ENV == "development"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # pydantic-settings lee de .env en runtime
