import base64
import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_MODEL_OPENROUTER = "anthropic/claude-sonnet-4.5"
DEFAULT_MODEL_GOOGLE = "gemini-2.5-pro"
DEFAULT_MAX_TOKENS = 16000

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _build_user_content(
    text: str, images: list[bytes] | None = None,
) -> str | list[dict[str, Any]]:
    """Build the user message content, adding image parts if provided."""
    if not images:
        return text
    parts: list[dict[str, Any]] = []
    for img_bytes in images:
        b64 = base64.b64encode(img_bytes).decode("ascii")
        parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}"},
        })
    parts.append({"type": "text", "text": text})
    return parts


def _resolve_provider() -> tuple[str, str, str, str, dict[str, str]]:
    """Return (provider, base_url, api_key, default_model, extra_headers)."""
    provider = (os.getenv("LLM_PROVIDER") or "openrouter").strip().lower()
    if provider == "google":
        api_key = os.getenv("GOOGLE_API_KEY") or ""
        if not api_key or api_key.startswith("REPLACE"):
            raise RuntimeError(
                "GOOGLE_API_KEY not set. Fill it in .env or switch LLM_PROVIDER=openrouter."
            )
        default_model = os.getenv("LLM_MODEL") or DEFAULT_MODEL_GOOGLE
        return provider, GOOGLE_BASE_URL, api_key, default_model, {}
    # default: openrouter
    api_key = os.getenv("OPENROUTER_API_KEY") or ""
    if not api_key or api_key.startswith("sk-or-v1-REPLACE"):
        raise RuntimeError(
            "OPENROUTER_API_KEY not set. Copy .env.example to .env and fill in your key."
        )
    default_model = os.getenv("LLM_MODEL") or os.getenv("OPENROUTER_MODEL") or DEFAULT_MODEL_OPENROUTER
    headers = {
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "cheatsheet-app",
    }
    return "openrouter", OPENROUTER_BASE_URL, api_key, default_model, headers


class LLMClient:
    def __init__(self) -> None:
        provider, base_url, api_key, default_model, extra_headers = _resolve_provider()
        self.provider = provider
        self.default_model = default_model
        self.extra_headers = extra_headers
        self.client = OpenAI(base_url=base_url, api_key=api_key)

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        model: str | None = None,
        images: list[bytes] | None = None,
    ) -> str:
        resp = self.client.chat.completions.create(
            model=model or self.default_model,
            temperature=temperature,
            max_tokens=DEFAULT_MAX_TOKENS,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": _build_user_content(user_prompt, images)},
            ],
            extra_headers=self.extra_headers,
        )
        return resp.choices[0].message.content or ""

    def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        model: str | None = None,
        images: list[bytes] | None = None,
    ) -> Any:
        resp = self.client.chat.completions.create(
            model=model or self.default_model,
            temperature=temperature,
            max_tokens=DEFAULT_MAX_TOKENS,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": _build_user_content(user_prompt, images)},
            ],
            extra_headers=self.extra_headers,
        )
        raw = resp.choices[0].message.content or ""
        return _parse_json(raw)


def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / f"{name}.md"
    return path.read_text(encoding="utf-8")


def _parse_json(raw: str) -> Any:
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}\n---raw---\n{raw}") from e
