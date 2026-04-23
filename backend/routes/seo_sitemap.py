"""Dynamic sitemap for search engines — uses seo_site_url from site settings."""
from fastapi import APIRouter
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv
from xml.sax.saxutils import escape as xml_escape

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

router = APIRouter(prefix="/api", tags=["SEO"])

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

STATIC_PATHS = [
    "/",
    "/programs",
    "/services",
    "/contact",
    "/about",
    "/transformations",
    "/sponsor",
    "/terms",
    "/privacy",
    "/cart",
    "/login",
]


def _full_url(base: str, path: str) -> str:
    p = path if path.startswith("/") else f"/{path}"
    return f"{base.rstrip('/')}{p}"


@router.get("/sitemap.xml")
async def sitemap_xml():
    raw = await db.site_settings.find_one({"id": "site_settings"}) or {}
    base = (raw.get("seo_site_url") or "").strip().rstrip("/")
    if not base:
        base = (os.environ.get("SEO_PUBLIC_SITE_URL") or "").strip().rstrip("/")
    if not base:
        # Valid minimal sitemap so the endpoint never returns broken XML
        base = "https://example.com"

    urls: list[tuple[str, str]] = []  # (loc, changefreq hint)
    for path in STATIC_PATHS:
        urls.append((_full_url(base, path), "weekly" if path != "/" else "daily"))

    if raw.get("sessions_page_visible", True):
        urls.append((_full_url(base, "/sessions"), "weekly"))
    if raw.get("blog_page_visible"):
        urls.append((_full_url(base, "/blog"), "weekly"))
    if raw.get("media_page_visible"):
        urls.append((_full_url(base, "/media"), "monthly"))

    programs = await db.programs.find({"visible": True}, {"id": 1}).to_list(500)
    for p in programs:
        pid = p.get("id")
        if pid:
            urls.append((_full_url(base, f"/program/{pid}"), "weekly"))

    sessions = await db.sessions.find({"visible": True, "token": {"$exists": False}}, {"id": 1}).to_list(500)
    for s in sessions:
        sid = s.get("id")
        if sid:
            urls.append((_full_url(base, f"/session/{sid}"), "weekly"))

    # Dedupe locs while preserving order
    seen = set()
    unique_urls = []
    for loc, ch in urls:
        if loc in seen:
            continue
        seen.add(loc)
        unique_urls.append((loc, ch))

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, changefreq in unique_urls:
        parts.append("<url>")
        parts.append(f"<loc>{xml_escape(loc)}</loc>")
        parts.append(f"<changefreq>{changefreq}</changefreq>")
        parts.append("</url>")
    parts.append("</urlset>")
    xml = "\n".join(parts)

    return Response(content=xml, media_type="application/xml")
