#!/usr/bin/env python3
"""
Post a single image to your Instagram professional account (feed) using the official Graph API.

Prerequisites (one-time, Meta / Facebook):
  1. Instagram account is Business or Creator and linked to a Facebook Page.
  2. Facebook Developer: create an app, add "Instagram" product, request permissions:
     instagram_basic, instagram_content_publish, pages_read_engagement, pages_show_list
     (exact set may depend on your app; Instagram Content Publishing may need App Review
     for live users other than the app admin — check current Meta docs).
  3. Get a long-lived Facebook Page access token for the Page connected to that Instagram.
  4. Image must be a public HTTPS URL (JPEG, under ~8MB, feed aspect ratio per Meta rules).
     The API does not accept a path on your laptop; upload the image to your site, S3, or any HTTPS URL.

Usage:
  cp env.example .env   # fill FACEBOOK_PAGE_ID, FACEBOOK_PAGE_ACCESS_TOKEN, optional OPENAI_API_KEY
  python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

  # Post (caption in quotes)
  python post_to_instagram.py --image-url "https://example.com/photo.jpg" --caption "Your caption here"

  # AI-generated caption from a short brief (optional OPENAI_API_KEY)
  python post_to_instagram.py --image-url "https://..." --ai-brief "Announce warm online workshop, emotional empowerment, link in bio"

  DRY_RUN=1 python post_to_instagram.py --image-url "https://..." --caption "test"

Compliance: Meta Platform Terms, Instagram Community Guidelines; no spam; your content and claims are your responsibility.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

DIR = Path(__file__).resolve().parent
load_dotenv(DIR / ".env")

GRAPH = "https://graph.facebook.com/v21.0"
POLL_SEC = 3
POLL_MAX = 40


def env_bool(name: str, default: bool = False) -> bool:
    v = (os.environ.get(name) or "").strip().lower()
    if v in ("1", "true", "yes", "on"):
        return True
    if v in ("0", "false", "no", "off"):
        return False
    return default


def get_ig_user_id(page_id: str, page_token: str) -> str:
    r = requests.get(
        f"{GRAPH}/{page_id}",
        params={"fields": "instagram_business_account", "access_token": page_token},
        timeout=60,
    )
    data = r.json()
    if r.status_code != 200 or "error" in data:
        err = data.get("error", data)
        raise SystemExit(f"Could not read Page/Instagram: {r.status_code} {err}")
    acc = (data or {}).get("instagram_business_account") or {}
    iid = acc.get("id")
    if not iid:
        raise SystemExit(
            "No Instagram professional account on this Facebook Page. "
            "In Instagram, switch to Business or Creator and link it to this Page in Meta settings."
        )
    return str(iid)


def create_image_container(ig_user_id: str, page_token: str, image_url: str, caption: str) -> str:
    r = requests.post(
        f"{GRAPH}/{ig_user_id}/media",
        data={
            "image_url": image_url,
            "caption": (caption or "")[:2200],
            "access_token": page_token,
        },
        timeout=120,
    )
    data = r.json()
    if r.status_code != 200 or "id" not in data:
        err = data.get("error", data)
        raise SystemExit(f"Create media container failed: {r.status_code} {err}")
    return str(data["id"])


def wait_container_ready(creation_id: str, page_token: str) -> None:
    for _ in range(POLL_MAX):
        r = requests.get(
            f"{GRAPH}/{creation_id}",
            params={"fields": "status_code,status", "access_token": page_token},
            timeout=60,
        )
        data = r.json()
        if r.status_code != 200:
            err = data.get("error", data)
            raise SystemExit(f"Status check failed: {r.status_code} {err}")
        code = (data or {}).get("status_code", "")
        if code == "FINISHED":
            return
        if code == "ERROR":
            raise SystemExit(f"Instagram rejected the container: {data}")
        time.sleep(POLL_SEC)
    raise SystemExit("Timeout waiting for image container (FINISHED). Check image_url is public HTTPS JPEG.")


def publish_container(ig_user_id: str, creation_id: str, page_token: str) -> dict:
    r = requests.post(
        f"{GRAPH}/{ig_user_id}/media_publish",
        data={"creation_id": creation_id, "access_token": page_token},
        timeout=120,
    )
    data = r.json()
    if r.status_code != 200 or "id" not in data:
        err = data.get("error", data)
        raise SystemExit(f"Publish failed: {r.status_code} {err}")
    return data


def generate_caption(brief: str) -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise SystemExit("OPENAI_API_KEY is required for --ai-brief. Or pass --caption instead.")
    persona = (os.environ.get("INSTAGRAM_CAPTION_PERSONA") or "").strip()
    base = (
        "You write Instagram feed captions for a healer. One caption under 2200 characters, warm and clear, "
        "no medical promises or 'cure' language, no spam hashtags wall. 2–4 relevant hashtags at end if natural. "
        "Match the language of the brief. Output only the caption text."
    )
    if persona:
        base += f"\nVoice: {persona}"
    from openai import OpenAI

    model = (os.environ.get("OPENAI_MODEL") or "gpt-4o-mini").strip()
    client = OpenAI(api_key=key)
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": base},
            {"role": "user", "content": f"Brief for this post:\n{brief}"},
        ],
        max_tokens=500,
        temperature=0.6,
    )
    return (resp.choices[0].message.content or "").strip() or " "


def main() -> None:
    p = argparse.ArgumentParser(description="Post a single image to Instagram (Graph API).")
    p.add_argument("--image-url", required=True, help="Public HTTPS URL to a JPEG (required by the API).")
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--caption", type=str, default="", help="Post caption (max 2200 chars for IG).")
    group.add_argument("--ai-brief", type=str, default="", help="Short brief; needs OPENAI_API_KEY to draft a caption.")
    p.add_argument("--ig-user-id", type=str, default="", help="Override; else resolved from Facebook Page.")
    args = p.parse_args()

    page_id = (os.environ.get("FACEBOOK_PAGE_ID") or "").strip()
    token = (os.environ.get("FACEBOOK_PAGE_ACCESS_TOKEN") or "").strip()
    if not page_id or not token:
        raise SystemExit("Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in .env")

    dry = env_bool("DRY_RUN", False)

    if (args.ai_brief or "").strip():
        caption = generate_caption(args.ai_brief.strip())
    else:
        caption = (args.caption or "").strip()

    ig_user = (args.ig_user_id or os.environ.get("INSTAGRAM_USER_ID") or "").strip() or get_ig_user_id(page_id, token)

    if dry:
        print(f"DRY_RUN: ig_user_id={ig_user} image_url={args.image_url!r} caption={caption!r}")
        return

    cid = create_image_container(ig_user, token, args.image_url.strip(), caption)
    print(f"Container created id={cid}, waiting for processing…")
    wait_container_ready(cid, token)
    out = publish_container(ig_user, cid, token)
    print(f"Posted. media id={out.get('id')}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
