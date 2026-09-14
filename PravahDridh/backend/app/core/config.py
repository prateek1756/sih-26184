from typing import List, Union
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "PravahDridh"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # JWT Security
    SECRET_KEY: str = "hermes-ai-super-secret-development-key-change-in-prod-26184"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @validator("SECRET_KEY", pre=True, always=True)
    def validate_secret_key(cls, v, values):
        env = values.get("ENVIRONMENT", "development")
        default_insecure_keys = {
            "hermes-ai-super-secret-production-key-change-in-prod-26184",
            "hermes-ai-super-secret-development-key-change-in-prod-26184",
            "changeme",
            "secret",
        }
        if env == "production":
            if not v or v in default_insecure_keys or len(str(v)) < 32:
                raise ValueError(
                    "CRITICAL SECURITY ERROR: A secure, high-entropy SECRET_KEY (minimum 32 characters) "
                    "must be explicitly configured in the environment for production mode."
                )
        return v or "hermes-ai-super-secret-development-key-change-in-prod-26184"

    # DB Connection
    DATABASE_URL: str = "postgresql+asyncpg://hermes_user:hermes_password@localhost:5500/pravahdridh"
    SYNC_DATABASE_URL: str = "postgresql://hermes_user:hermes_password@localhost:5500/pravahdridh"
    TEST_DATABASE_URL: str = "postgresql+asyncpg://hermes_user:hermes_password@localhost:5500/pravahdridh_test"
    SYNC_TEST_DATABASE_URL: str = "postgresql://hermes_user:hermes_password@localhost:5500/pravahdridh_test"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Default Passwords for development bootstrap
    DEFAULT_ADMIN_PASSWORD: str = "Admin@123"
    DEFAULT_INVESTIGATOR_PASSWORD: str = "Hermes@123"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Phase 4: Transaction Intelligence Configuration
    ANALYSIS_STAGING_WINDOW_HOURS: int = 72
    ANALYSIS_POST_WINDOW_HOURS: int = 24
    ANALYSIS_PROXIMITY_RADIUS_METERS: float = 3000.0  # 3km default spatial radius
    ANALYSIS_HIGH_VELOCITY_THRESHOLD: float = 0.70
    ANALYSIS_HIGH_VALUE_THRESHOLD: float = 50000.0
    ANALYSIS_RELEVANCE_HIGH_SCORE: float = 0.65
    ANALYSIS_RELEVANCE_MEDIUM_SCORE: float = 0.35

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")


settings = Settings()
