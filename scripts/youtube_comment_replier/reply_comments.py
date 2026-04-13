#!/usr/bin/env python3
"""
Reply to YouTube comments your channel has not yet answered (one public reply per thread).

Personalized replies: set OPENAI_API_KEY in .env. Each reply is drafted from the comment + video title (OpenAI).
YT_REPLY_TEMPLATE is still used if the API fails or when OPENAI_API_KEY is unset.

Setup (one time):
  1. Google Cloud Console: create a project, enable "YouTube Data API v3".
  2. OAuth consent screen (External is fine for your own channel) + add your Google account as test user if in Testing.
  3. Credentials → Create OAuth client ID → Desktop app → download JSON as client_secret.json in this folder.
  4. python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
  5. cp env.example .env  # OPENAI_API_KEY + YT_REPLY_TEMPLATE (fallback)
  6. python reply_comments.py   # opens browser once to authorize; saves token.json

Schedule 11:00 IST daily: see crontab-ist.example (CRON_TZ=Asia/Kolkata or 05:30 UTC fallback).

Compliance: Automated replies must follow YouTube API / community guidelines; avoid misleading or spammy patterns.
"""
from __future__ import annotations

import html
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from personalize import generate_reply

SCOPES = ("https://www.googleapis.com/auth/youtube.force-ssl",)
DEFAULT_TEMPLATE_FALLBACK = "Thank you for your comment — I really appreciate you being here."
DIR = Path(__file__).resolve().parent
CLIENT_SECRET = DIR / "client_secret.json"
TOKEN_PATH = DIR / "token.json"


def env_int(name: str, default: int) -> int:
    v = os.environ.get(name)
    if v is None or v.strip() == "":
        return default
    return int(v)


def get_youtube():
    if not CLIENT_SECRET.is_file():
        print(f"Missing {CLIENT_SECRET.name} — download OAuth Desktop client JSON from Google Cloud Console.", file=sys.stderr)
        sys.exit(1)

    creds = None
    if TOKEN_PATH.is_file():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_PATH.write_text(creds.to_json())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET), SCOPES)
            creds = flow.run_local_server(port=0)
            TOKEN_PATH.write_text(creds.to_json())

    return build("youtube", "v3", credentials=creds)


def video_titles(youtube, video_ids: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        if not batch:
            break
        resp = youtube.videos().list(part="snippet", id=",".join(batch)).execute()
        for it in resp.get("items") or []:
            vid = it.get("id")
            title = (it.get("snippet") or {}).get("title") or ""
            if vid:
                out[vid] = title
    return out


def channel_upload_video_ids(youtube, max_videos: int) -> list[str]:
    ch = youtube.channels().list(part="contentDetails", mine=True).execute()
    items = ch.get("items") or []
    if not items:
        return []
    uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
    out: list[str] = []
    page_token = None
    while len(out) < max_videos:
        resp = (
            youtube.playlistItems()
            .list(part="contentDetails", playlistId=uploads, maxResults=min(50, max_videos - len(out)), pageToken=page_token)
            .execute()
        )
        for it in resp.get("items") or []:
            vid = it.get("contentDetails", {}).get("videoId")
            if vid:
                out.append(vid)
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return out


def channel_id(youtube) -> str | None:
    ch = youtube.channels().list(part="id", mine=True).execute()
    items = ch.get("items") or []
    return items[0]["id"] if items else None


def top_level_threads(youtube, video_id: str):
    page_token = None
    while True:
        resp = (
            youtube.commentThreads()
            .list(part="snippet,replies", videoId=video_id, maxResults=100, textFormat="plainText", pageToken=page_token)
            .execute()
        )
        for item in resp.get("items") or []:
            yield item
        page_token = resp.get("nextPageToken")
        if not page_token:
            break


def channel_replied_to_thread(my_channel_id: str, thread: dict) -> bool:
    top = thread.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
    if top.get("authorChannelId", {}).get("value") == my_channel_id:
        return True
    replies = thread.get("replies", {}).get("comments") or []
    for r in replies:
        if r.get("snippet", {}).get("authorChannelId", {}).get("value") == my_channel_id:
            return True
    return False


def channel_replied_fetched(youtube, my_channel_id: str, thread: dict) -> bool:
    """Accurate when a thread has many replies (embedded replies may be truncated)."""
    if channel_replied_to_thread(my_channel_id, thread):
        return True
    total = int(thread.get("snippet", {}).get("totalReplyCount") or 0)
    if total == 0:
        return False
    top_id = thread.get("snippet", {}).get("topLevelComment", {}).get("id")
    if not top_id:
        return False
    page_token = None
    while True:
        resp = youtube.comments().list(part="snippet", parentId=top_id, maxResults=100, textFormat="plainText", pageToken=page_token).execute()
        for c in resp.get("items") or []:
            if c.get("snippet", {}).get("authorChannelId", {}).get("value") == my_channel_id:
                return True
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return False


def post_reply(youtube, parent_comment_id: str, text: str, dry_run: bool) -> None:
    if dry_run:
        print(f"  [dry-run] would reply to {parent_comment_id}: {text[:80]}...")
        return
    youtube.comments().insert(part="snippet", body={"snippet": {"parentId": parent_comment_id, "textOriginal": text}}).execute()


def main() -> None:
    load_dotenv(DIR / ".env")
    template = (os.environ.get("YT_REPLY_TEMPLATE") or "").strip()
    use_ai = bool((os.environ.get("OPENAI_API_KEY") or "").strip())
    fallback_text = template or (DEFAULT_TEMPLATE_FALLBACK if use_ai else "")
    dry_run = os.environ.get("DRY_RUN", "0").strip() in ("1", "true", "yes")
    max_videos = env_int("MAX_VIDEOS_PER_RUN", 30)
    max_replies = env_int("MAX_REPLIES_PER_RUN", 25)

    if not fallback_text and not dry_run:
        print("Set OPENAI_API_KEY (personalized) and/or YT_REPLY_TEMPLATE in .env.", file=sys.stderr)
        sys.exit(1)

    youtube = get_youtube()
    my_id = channel_id(youtube)
    if not my_id:
        print("Could not resolve channel id (is this account a channel owner?).", file=sys.stderr)
        sys.exit(1)

    video_ids = channel_upload_video_ids(youtube, max_videos)
    titles = video_titles(youtube, video_ids)
    posted = 0
    for vid in video_ids:
        if posted >= max_replies:
            break
        try:
            for thread in top_level_threads(youtube, vid):
                if posted >= max_replies:
                    break
                if channel_replied_fetched(youtube, my_id, thread):
                    continue
                tid = thread.get("snippet", {}).get("topLevelComment", {}).get("id")
                if not tid:
                    continue
                top_snip = thread.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
                if top_snip.get("moderationStatus") not in (None, "published", ""):
                    continue
                comment_body = html.unescape((top_snip.get("textDisplay") or top_snip.get("textOriginal") or "").strip())
                if len(comment_body) < 1:
                    continue
                author_name = (top_snip.get("authorDisplayName") or "").strip()
                vtitle = titles.get(vid, "")
                if use_ai:
                    reply_text = generate_reply(
                        comment_text=comment_body,
                        video_title=vtitle,
                        author_display_name=author_name,
                        fallback=fallback_text,
                    )
                else:
                    reply_text = fallback_text
                if not (reply_text or "").strip():
                    continue
                print(f"Replying on video {vid} to comment {tid}")
                post_reply(youtube, tid, reply_text.strip(), dry_run)
                posted += 1
        except HttpError as e:
            if e.resp.status in (403, 404):
                print(f"Skip video {vid}: {e.reason}", file=sys.stderr)
                continue
            raise

    print(f"Done. {'Would post' if dry_run else 'Posted'} {posted} repl(ies).")


if __name__ == "__main__":
    main()
