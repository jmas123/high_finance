import warnings

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULTS = {"CHANGE-ME-IN-PRODUCTION", "your_secret_key", "secret", ""}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str = "redis://redis:6379/0"

    # Security settings
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    ALGORITHM: str = "HS256"

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        if self.SECRET_KEY in _INSECURE_DEFAULTS or len(self.SECRET_KEY) < 32:
            if not self.DEBUG:
                raise ValueError(
                    "SECRET_KEY is insecure. Set a random 32+ char key in your .env "
                    "(generate one with: python -c \"import secrets; print(secrets.token_hex(32))\")"
                )
            warnings.warn(
                "SECRET_KEY is using an insecure default. "
                "This is OK for local dev but MUST be changed before deploying.",
                stacklevel=2,
            )
        return self

    # CORS - comma-separated list of allowed origins
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"

    # Debug mode
    DEBUG: bool = False

    # Admin API (required if scheduler enabled)
    ADMIN_API_KEY: str | None = None

    # Scheduler settings
    SCHEDULER_ENABLED: bool = True

    # Alerting (optional)
    SLACK_WEBHOOK_URL: str | None = None

    # AI features (memo generation)
    ANTHROPIC_API_KEY: str | None = None
    AI_MONTHLY_BUDGET_USD: float = 20.0

    # Optional in dev; required only when you use those features
    SEC_API_KEY: str | None = None

    S3_BUCKET: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_REGION: str | None = None
    S3_ENDPOINT_URL: str | None = None  # useful for MinIO/R2

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
