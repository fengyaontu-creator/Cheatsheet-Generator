import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "anthropic/claude-sonnet-4.5"

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


class LLMClient:
    def __init__(self) -> None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key or api_key.startswith("sk-or-v1-REPLACE"):
            raise RuntimeError(
                "OPENROUTER_API_KEY not set. Copy .env.example to .env and fill in your key."
            )
        self.default_model = os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL)
        self.client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        model: str | None = None,
    ) -> str:
        resp = self.client.chat.completions.create(
            model=model or self.default_model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            extra_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "cheatsheet-app",
            },
        )
        return resp.choices[0].message.content or ""

    def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        model: str | None = None,
    ) -> Any:
        resp = self.client.chat.completions.create(
            model=model or self.default_model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            extra_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "cheatsheet-app",
            },
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
