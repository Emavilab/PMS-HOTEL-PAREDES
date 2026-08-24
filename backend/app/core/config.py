from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "Hotel Paredes PMS"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite:///./hotel_paredes.db"

    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None

    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8000"]

    HOTEL_NAME: str = "Hotel Paredes"
    HOTEL_ADDRESS: str = ""
    HOTEL_PHONE: str = ""
    HOTEL_EMAIL: str = ""
    DEFAULT_CHECKIN_TIME: str = "15:00"
    DEFAULT_CHECKOUT_TIME: str = "12:00"
    DEFAULT_CURRENCY: str = "HNL"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
