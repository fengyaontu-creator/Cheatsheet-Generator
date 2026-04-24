from __future__ import annotations

import pytest

from app.services.llm_client import _resolve_provider


def test_openrouter_stage_model_override(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-test")
    monkeypatch.setenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
    monkeypatch.setenv("OPENROUTER_MODEL_STAGE2", "anthropic/claude-sonnet-4.5")

    provider, base_url, _api_key, model, headers = _resolve_provider("STAGE2")

    assert provider == "openrouter"
    assert base_url == "https://openrouter.ai/api/v1"
    assert model == "anthropic/claude-sonnet-4.5"
    assert headers["X-Title"] == "cheatsheet-app"


def test_stage_provider_can_use_google_key_and_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-test")
    monkeypatch.setenv("GOOGLE_API_KEY", "google-test")
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("LLM_PROVIDER_STAGE0", "google")
    monkeypatch.setenv("LLM_MODEL_STAGE0", "gemini-2.5-flash")
    monkeypatch.setenv("OPENROUTER_MODEL_STAGE0", "google/gemini-2.5-flash")

    provider, base_url, api_key, model, headers = _resolve_provider("STAGE0")

    assert provider == "google"
    assert base_url == "https://generativelanguage.googleapis.com/v1beta/openai/"
    assert api_key == "google-test"
    assert model == "gemini-2.5-flash"
    assert headers == {}


def test_unsupported_provider_is_rejected(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER_STAGE1", "anthropic")

    with pytest.raises(RuntimeError, match="Unsupported LLM_PROVIDER_STAGE1"):
        _resolve_provider("STAGE1")
