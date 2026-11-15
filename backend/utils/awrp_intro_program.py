"""Ensure the AWRP Intro Call catalog program exists (separate from the AWRP workshop)."""
from __future__ import annotations

import os
from datetime import datetime, timezone

from models import Program

PROGRAM_TITLE = "AWRP Intro Call"
DEFAULT_PROGRAM_ID = "8c4f1a2e-6d9b-4f12-9e3a-7b5c6d8e9f01"
LANDING_PATH = "/awrp-intro-call"


def awrp_intro_program_id() -> str:
    return (os.environ.get("AWRP_INTRO_PROGRAM_ID") or DEFAULT_PROGRAM_ID).strip()


async def ensure_awrp_intro_program(db) -> str:
    """Insert the intro-call program if missing; never overwrite admin pricing/settings."""
    pid = awrp_intro_program_id()
    existing = await db.programs.find_one(
        {"$or": [{"id": pid}, {"title": PROGRAM_TITLE}]},
        {"_id": 0, "id": 1, "link": 1, "exclude_from_combo_discount": 1},
    )
    if existing:
        program_id = existing.get("id") or pid
        patch: dict = {}
        if not (existing.get("link") or "").strip().startswith("/"):
            patch["link"] = LANDING_PATH
        if not existing.get("exclude_from_combo_discount"):
            patch["exclude_from_combo_discount"] = True
        if patch:
            await db.programs.update_one({"id": program_id}, {"$set": patch})
        return program_id

    count = await db.programs.count_documents({})
    now = datetime.now(timezone.utc)
    program = Program(
        id=pid,
        title=PROGRAM_TITLE,
        category="AWRP",
        description=(
            "Live introductory call on the Atomic Weight Release Program with Dimple Ranawat. "
            "Understand the approach, ask your questions, and decide your next step."
        ),
        image="",
        link=LANDING_PATH,
        price_inr=2500.0,
        price_usd=0.0,
        price_aed=0.0,
        offer_price_inr=0.0,
        duration="20 minutes",
        timing="7:00–8:30 PM",
        time_zone="IST",
        visible=True,
        is_upcoming=True,
        is_flagship=False,
        enrollment_open=True,
        enrollment_status="open",
        program_type="online",
        session_mode="online",
        enable_online=True,
        enable_offline=False,
        enable_in_person=False,
        show_pricing_on_card=True,
        show_duration_on_card=True,
        order=count,
        exclude_from_combo_discount=True,
        created_at=now,
    )
    await db.programs.insert_one(program.model_dump())
    return pid