"""LLM provider abstraction with streaming.

- gemini       : Google Gemini (the original project's model), needs GEMINI_API_KEY
- huggingface  : Hugging Face Inference API chat models, needs HF_TOKEN
- none         : no generative model; callers fall back to extractive answers
"""
from __future__ import annotations

import json
import logging
import re
from typing import Iterator

from config import settings

log = logging.getLogger(__name__)


class LLMNotConfigured(RuntimeError):
    pass


class LLMService:
    def __init__(self) -> None:
        self.provider = settings.LLM_PROVIDER
        self._gemini_model = None
        self._hf_client = None

    # -------------------------------------------------------------- status
    @property
    def available(self) -> bool:
        if self.provider == "gemini":
            return bool(settings.GEMINI_API_KEY)
        if self.provider == "huggingface":
            return bool(settings.HF_TOKEN)
        return False

    @property
    def model_name(self) -> str:
        if self.provider == "gemini":
            return settings.GEMINI_MODEL
        if self.provider == "huggingface":
            return settings.HF_MODEL
        return "extractive"

    # -------------------------------------------------------------- clients
    def _gemini(self):
        if self._gemini_model is None:
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")
            self._gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
        return self._gemini_model

    def _hf(self):
        if self._hf_client is None:
            from huggingface_hub import InferenceClient

            self._hf_client = InferenceClient(model=settings.HF_MODEL, token=settings.HF_TOKEN)
        return self._hf_client

    # -------------------------------------------------------------- generation
    def stream(self, system: str, prompt: str, max_tokens: int | None = None) -> Iterator[str]:
        if not self.available:
            raise LLMNotConfigured(
                f"LLM provider '{self.provider}' is not configured. "
                "Set GEMINI_API_KEY (or HF_TOKEN with LLM_PROVIDER=huggingface) in backend/.env"
            )
        max_tokens = max_tokens or settings.LLM_MAX_TOKENS
        if self.provider == "gemini":
            model = self._gemini()
            response = model.generate_content(
                f"{system}\n\n{prompt}",
                stream=True,
                generation_config={
                    "temperature": settings.LLM_TEMPERATURE,
                    "max_output_tokens": max_tokens,
                },
            )
            for chunk in response:
                try:
                    text = chunk.text
                except (ValueError, AttributeError):  # blocked / empty parts
                    text = ""
                if text:
                    yield text
            return
        # huggingface
        client = self._hf()
        for event in client.chat_completion(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=settings.LLM_TEMPERATURE,
            stream=True,
        ):
            try:
                delta = event.choices[0].delta.content
            except (AttributeError, IndexError):
                delta = None
            if delta:
                yield delta

    def complete(self, system: str, prompt: str, max_tokens: int | None = None) -> str:
        return "".join(self.stream(system, prompt, max_tokens)).strip()

    def complete_json(self, system: str, prompt: str, max_tokens: int | None = None) -> dict:
        raw = self.complete(system, prompt, max_tokens)
        return parse_json_block(raw)


def parse_json_block(raw: str) -> dict:
    """Extract the first JSON object from an LLM response (handles ``` fences)."""
    raw = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", raw, re.S)
    if fence:
        raw = fence.group(1).strip()
    try:
        return json.loads(raw)
    except ValueError:
        pass
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(raw[start : end + 1])
        except ValueError:
            pass
    raise ValueError("Model did not return valid JSON")
