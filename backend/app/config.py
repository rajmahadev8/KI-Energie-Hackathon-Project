"""Application configuration loaded from environment / .env."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent  # .../backend/app


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Cost-optimized Chinese models (see memory: prefer-cheap-chinese-llms)
    text_model: str = "deepseek/deepseek-v4-flash"
    vision_model: str = "qwen/qwen3-vl-32b-instruct"

    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    enable_demo_cache: bool = True

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openrouter_api_key)


settings = Settings()
