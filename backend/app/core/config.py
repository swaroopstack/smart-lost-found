"""
Application configuration.

Every value can be overridden through environment variables or a `.env` file
in the backend root. See `.env.example` for the documented set of keys.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Application ---
    app_name: str = "Smart Lost & Found API"
    environment: str = "development"
    version: str = "1.0.0"
    api_v1_prefix: str = "/api/v1"

    # --- Security ---
    secret_key: str = "dev-secret-key-change-me-before-deploying-0123456789abcdef"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    #: bcrypt cost factor. Lower it in tests to keep the suite fast.
    bcrypt_rounds: int = 12

    # --- Database ---
    database_url: str = "sqlite:///./slf.db"

    # --- Uploads ---
    upload_dir: str = "./uploads"
    media_url_prefix: str = "/media"
    max_upload_mb: int = 5
    allowed_image_types: str = "image/jpeg,image/png,image/webp"

    # --- CORS ---
    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,"
        "http://127.0.0.1:3000,http://127.0.0.1:5173"
    )

    # --- Startup ---
    auto_create_tables: bool = True
    auto_seed_base: bool = True

    # ------------------------------------------------------------------ #
    # Derived helpers
    # ------------------------------------------------------------------ #
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_image_type_list(self) -> list[str]:
        return [t.strip().lower() for t in self.allowed_image_types.split(",") if t.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_test(self) -> bool:
        return self.environment.lower() in {"test", "testing"}


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (import this, do not instantiate Settings directly)."""
    return Settings()


settings = get_settings()
