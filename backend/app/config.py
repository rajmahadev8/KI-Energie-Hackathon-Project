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
    # Optional: enables the LangChain agent's web-search tool (Tavily) for the chat/answer.
    tavily_api_key: str = ""

    # Cost-optimized Chinese models (see memory: prefer-cheap-chinese-llms).
    # text_model must support tool-calling (used by the LangChain ReAct agent).
    text_model: str = "xiaomi/mimo-v2.5"
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
