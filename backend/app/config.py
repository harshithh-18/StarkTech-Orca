"""Runtime configuration, loaded from environment / .env.

Owner: B · Phase: P0

Every field here has a matching entry in the repo-root ``.env.example``. If you add one,
add it there too — with a comment saying where to register for the key.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root: backend/app/config.py → backend/app → backend → Orca/
REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── LLM ───────────────────────────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # ── Multilingual ──────────────────────────────────────────────────────
    bhashini_user_id: str = ""
    bhashini_api_key: str = ""
    bhashini_pipeline_id: str = ""
    sarvam_api_key: str = ""

    # ── Copernicus (used by scripts/, not at request time) ────────────────
    copernicus_username: str = ""
    copernicus_password: str = ""

    # ── ORCA runtime ──────────────────────────────────────────────────────
    orca_cache_ttl_seconds: int = 3600
    orca_use_mock_data: bool = False
    """Demo safety switch. True ⇒ serve canned responses from data/mock/."""

    orca_log_level: str = "INFO"
    orca_cors_origins: str = "http://localhost:5173"

    # ── Derived paths ─────────────────────────────────────────────────────
    @property
    def cache_dir(self) -> Path:
        return DATA_DIR / "cache"

    @property
    def mock_dir(self) -> Path:
        return DATA_DIR / "mock"

    @property
    def geojson_dir(self) -> Path:
        return DATA_DIR / "geojson"

    @property
    def copernicus_dir(self) -> Path:
        return DATA_DIR / "copernicus"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.orca_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton. Use as a FastAPI dependency."""
    return Settings()
