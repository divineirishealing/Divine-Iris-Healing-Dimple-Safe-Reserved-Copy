#!/usr/bin/env python3
"""
Draft Instagram-focused content in one go: feed post, reel script, story, carousel — optional AI image.

This does NOT post to Instagram. You review the file, tweak if needed, then post manually
or use scripts/instagram_poster/post_to_instagram.py when you have a public image URL.

Usage:
  cp env.example .env   # set OPENAI_API_KEY and optional SOCIAL_PERSONA
  python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

  python draft_social.py --brief "Workshop on emotional blocks, online, next Sunday"
  python draft_social.py --brief "..." --image

Output: printed to stdout and saved under drafts/ (gitignored) as a .md with timestamp.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from openai import OpenAI

DIR = Path(__file__).resolve().parent
load_dotenv(DIR / ".env")
DRAFTS = DIR / "drafts"
DEFAULT_SYSTEM = """You are a communications assistant for a professional healer's social media.
Output structure exactly as requested. Rules:
- Warm, clear, specific; no medical diagnoses, cure promises, or "guaranteed results".
- The client offers emotional empowerment and root-level work; do not claim to treat named diseases in marketing copy.
- CTA: invite WhatsApp or the website form (never invent links).
- Match the language of the brief (English/Hindi/mixed) when writing.
- For Instagram, keep each section scannable: short lines, not walls of text."""


def slug_ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%SZ")


def generate_pack(brief: str, persona: str) -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise SystemExit("Set OPENAI_API_KEY in .env")
    system = DEFAULT_SYSTEM
    if (persona or "").strip():
        system += f"\n\nCreator voice and boundaries:\n{persona.strip()}"
    model = (os.environ.get("OPENAI_TEXT_MODEL") or "gpt-4o-mini").strip()
    user = f"""Creative brief (use as the only source of topic; expand tastefully, do not invent events or prices):
---
{brief.strip()}
---
Produce the following sections with these exact Markdown headings and order:

# Feed post
- **Caption** (max ~900 chars, with line breaks; 2–4 optional hashtags at end)
- **Alt text** (one line for screen readers, describe mood/scene, not a sales pitch)

# Reel
- **Hook** (first line on-screen, under ~60 chars)
- **Script** (30–45 seconds when read aloud, short lines, optional [on-screen text] in brackets)
- **Shot ideas** (3–5 bullet points, phone-friendly, no pro gear)

# Story
- 3 **slides** as bullet lines (each slide: one short line + optional minimal sticker note like [link sticker])
- **Sticker note**: what single tap action (poll/question/link) if any, one line

# Carousel
- **Slide 1** title line + 2–3 body lines
- **Slide 2** … (total **5** slides, each slide short for IG carousel readability)

# WhatsApp / form blurb
- One **short** paragraph to paste when someone DMs: warm, one clear next step
"""
    client = OpenAI(api_key=key)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=2500,
        temperature=0.55,
    )
    return (resp.choices[0].message.content or "").strip() or ""


def generate_image_prompt(brief: str, persona: str, style: str) -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    model = (os.environ.get("OPENAI_TEXT_MODEL") or "gpt-4o-mini").strip()
    client = OpenAI(api_key=key)
    sys = (
        "Write ONE DALL·E image prompt, under 900 characters, for a still graphic or soft abstract scene. "
        "No text, letters, or words in the image. No real person's face. Peaceful, professional, not clinical."
    )
    if style.strip():
        sys += f" Style hints: {style.strip()}"
    u = f"Brief for visual mood (align with, do not contradict):\n{brief}\n"
    if persona.strip():
        u += f"Brand feel:\n{persona.strip()}\n"
    u += "Output only the image prompt, no quotes."
    r = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": sys}, {"role": "user", "content": u}],
        max_tokens=400,
        temperature=0.7,
    )
    return (r.choices[0].message.content or "").strip() or "Soft abstract light, natural calm healing mood, no people, no text."


def download_image(url: str, path: Path) -> None:
    with httpx.Client(timeout=120.0) as client:
        r = client.get(url)
        r.raise_for_status()
    path.write_bytes(r.content)


def dalle_image(prompt: str, out: Path) -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    model = (os.environ.get("OPENAI_IMAGE_MODEL") or "dall-e-3").strip()
    client = OpenAI(api_key=key)
    # 1024x1024 is closest to square feed; 1792x1024 for more horizontal
    size = "1024x1024"
    p = re.sub(r"\s+", " ", (prompt or "")[:4000]).strip()
    res = client.images.generate(model=model, prompt=p, size=size, quality="standard", n=1)
    url = res.data[0].url
    if not url:
        raise SystemExit("No image URL returned from API")
    out.parent.mkdir(parents=True, exist_ok=True)
    download_image(url, out)
    return url


def main() -> None:
    ap = argparse.ArgumentParser(description="Draft IG post, reel, story, carousel + optional DALL·E image.")
    ap.add_argument("--brief", required=True, help="What this round of content is about (workshop, theme, CTA).")
    ap.add_argument(
        "--image",
        action="store_true",
        help="Also generate a square PNG via DALL·E-3 and save under drafts/ (for your review, not auto-posted).",
    )
    args = ap.parse_args()

    persona = (os.environ.get("SOCIAL_PERSONA") or "").strip()
    style = (os.environ.get("SOCIAL_IMAGE_STYLE") or "").strip()

    DRAFTS.mkdir(parents=True, exist_ok=True)
    ts = slug_ts()
    body = generate_pack(args.brief, persona)
    image_note = ""
    if args.image:
        ip = generate_image_prompt(args.brief, persona, style)
        img_path = DRAFTS / f"graphic_{ts}.png"
        dalle_image(ip, img_path)
        image_note = f"\n\n---\n\n# Generated image (review before use)\n\n- **Local file:** `{img_path}`\n- **DALL·E prompt used (for your records):** {ip!r}\n"

    header = f"""---
created_utc: {ts}
---

# Content draft

**Your brief:** {args.brief.strip()}

{body}
{image_note}
---
*Review, edit, then post. This file is not published automatically.*
"""
    out = DRAFTS / f"draft_{ts}.md"
    out.write_text(header, encoding="utf-8")
    print(header)
    print(f"\nSaved: {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
