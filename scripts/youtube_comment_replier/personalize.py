"""Generate a short, human YouTube reply from comment context via OpenAI."""
from __future__ import annotations

import os
import re

from openai import OpenAI

DEFAULT_SYSTEM = """You are the channel owner replying publicly on YouTube. Write ONE short reply (under 600 characters).
Rules:
- Sound warm, genuine, and specific to what they wrote (no generic thank-you spam).
- Use the commenter's display name naturally at most once if it fits; skip if the name looks like a bot or random string.
- Do not give medical diagnoses, promises of cures, or legal/financial advice.
- Do not claim you are an AI or automated system.
- No URLs unless the viewer's comment clearly invites one.
- Match the language of the comment when possible (if they wrote in Hindi, reply mostly in Hindi; if English, English).
- If the comment is harassment, spam, or unsafe, reply briefly and neutrally: thank them and wish them well, without engaging with abuse."""


def _one_line(text: str, max_chars: int) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip())
    if len(t) > max_chars:
        t = t[: max_chars - 1].rsplit(" ", 1)[0] + "…"
    return t


def generate_reply(
    *,
    comment_text: str,
    video_title: str,
    author_display_name: str,
    fallback: str,
) -> str:
    max_out = env_max_chars()
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        return _one_line(fallback, max_out)

    system = (os.environ.get("YT_REPLY_SYSTEM_PROMPT") or DEFAULT_SYSTEM).strip()
    persona = (os.environ.get("YT_REPLY_PERSONA") or "").strip()
    if persona:
        system = f"{system}\n\nSound like this creator (tone, phrases, sign-off — stay specific to each comment):\n{persona}"
    model = (os.environ.get("OPENAI_MODEL") or "gpt-4o-mini").strip()
    temperature = env_temperature()

    user_block = (
        f"Video title: {video_title or '(unknown)'}\n"
        f"Commenter display name: {author_display_name or '(unknown)'}\n"
        f"Comment:\n{comment_text.strip()[:4000]}\n\n"
        "Write the public reply only, no quotes or prefix."
    )

    client = OpenAI(api_key=key)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_block},
            ],
            max_tokens=220,
            temperature=temperature,
        )
        raw = (resp.choices[0].message.content or "").strip()
    except Exception:
        return _one_line(fallback, max_out)

    if not raw or len(raw) < 3:
        return _one_line(fallback, max_out)
    return _one_line(raw, max_out)


def env_max_chars() -> int:
    try:
        return max(80, min(5000, int(os.environ.get("MAX_REPLY_CHARS", "600"))))
    except ValueError:
        return 600


def env_temperature() -> float:
    """0.35–0.9; lower = more consistent voice, higher = more varied wording."""
    raw = (os.environ.get("YT_REPLY_TEMPERATURE") or "").strip()
    if not raw:
        return 0.65
    try:
        return max(0.35, min(0.9, float(raw)))
    except ValueError:
        return 0.65
