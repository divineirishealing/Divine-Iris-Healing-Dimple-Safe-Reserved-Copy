#!/usr/bin/env python3
"""
Seed short rotating testimonials on homepage upcoming program cards.

Inserts 25 visible quotes each for the first two visible programs where is_upcoming=True.
Skips a program if it already has any upcoming_card_quotes (idempotent for re-runs).

Run from backend folder:
  python scripts/seed_upcoming_card_quotes.py

Requires MONGO_URL and DB_NAME (e.g. in backend/.env).
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass

from pymongo import MongoClient

# Two sets of 25 short lines (generic wellness / transformation; not medical claims).
QUOTE_SET_A = [
    ("I finally felt heard—gentle, clear, and deeply human.", "Ananya", "Mumbai"),
    ("The pace respected my nervous system. I didn’t have to perform healing.", "Rahul", "Dubai"),
    ("Small shifts stacked up; I’m kinder to myself day to day.", "Meera", "Bengaluru"),
    ("I came scattered and left with a sense of inner order.", "Kabir", "Hyderabad"),
    ("The practices fit real life—not another overwhelming routine.", "Sonia", "Pune"),
    ("I noticed my sleep and boundaries improving within weeks.", "Vikram", "Chennai"),
    ("Dimple’s presence is steady; the space feels impeccably safe.", "Fatima", "Abu Dhabi"),
    ("I understood my patterns without being judged for them.", "Arjun", "Delhi NCR"),
    ("For the first time in years I could exhale in a group setting.", "Leela", "Jaipur"),
    ("The mix of structure and soul landed perfectly for me.", "Nikhil", "Singapore"),
    ("I felt lighter—not forced positivity, just honest release.", "Ishita", "Kolkata"),
    ("My family noticed I was calmer before I even said anything.", "Omar", "Sharjah"),
    ("The container made it possible to go deeper than I expected.", "Tara", "Goa"),
    ("I learned to meet myself with curiosity instead of criticism.", "Dev", "Ahmedabad"),
    ("Practical tools I still use when work stress spikes.", "Priya", "London"),
    ("I valued the clarity—no fluff, but plenty of heart.", "Sanjay", "Toronto"),
    ("Something unknotted; I move through the day with more ease.", "Ritu", "Indore"),
    ("I felt supported between sessions, not dropped after payment.", "Aman", "Noida"),
    ("The energy work met me where I was, without hype.", "Kavita", "Muscat"),
    ("I rebuilt trust in my own intuition step by step.", "Hassan", "Doha"),
    ("My inner dialogue softened; that alone changed everything.", "Neha", "Chandigarh"),
    ("I appreciated the respect for different belief backgrounds.", "Chris", "Sydney"),
    ("The journey felt sacred but grounded—very rare combo.", "Divya", "Mysuru"),
    ("I could show up messy and still be welcomed fully.", "Zara", "Karachi"),
    ("Grateful for a path that honors both spirit and common sense.", "Ethan", "Auckland"),
]

QUOTE_SET_B = [
    ("I didn’t expect this much emotional clarity so quickly.", "Pallavi", "Surat"),
    ("The sessions helped me close loops I’d carried for years.", "Imran", "Mumbai"),
    ("I felt reconnected to purpose without burning out.", "Sneha", "Bengaluru"),
    ("Gentle accountability—exactly what I didn’t know I needed.", "Rohan", "Dubai"),
    ("My body felt less braced; I could breathe deeper.", "Aditi", "Pune"),
    ("I learned to regulate before reacting—game changer at home.", "Manish", "Delhi"),
    ("The community aspect was warm, never competitive.", "Lakshmi", "Chennai"),
    ("I stopped waiting for a perfect moment to begin.", "Sameer", "Hyderabad"),
    ("Insights landed in a way therapy alone hadn’t touched.", "Juhi", "Gurgaon"),
    ("I felt dignity in the process, not pressure to be fixed.", "Farah", "Kuwait"),
    ("The work met both mind and body—I needed both.", "Kunal", "Jaipur"),
    ("I finally grieved what I’d been rushing past.", "Anika", "Kolkata"),
    ("My confidence returned in quiet, sustainable ways.", "Varun", "Singapore"),
    ("I appreciated honesty over empty reassurance.", "Shreya", "Bahrain"),
    ("The rhythm of the program matched real recovery.", "Bilal", "Abu Dhabi"),
    ("I could ask questions without feeling silly.", "Maya", "London"),
    ("Something opened that I’d been guarding for a long time.", "Gaurav", "Noida"),
    ("I felt seen as a whole person, not a checklist.", "Tanvi", "Indore"),
    ("The practices are simple enough to keep using.", "Raj", "Toronto"),
    ("I reconnected with joy in small everyday moments.", "Nandini", "Mysuru"),
    ("I learned boundaries that didn’t feel like walls.", "Yusuf", "Doha"),
    ("The space held both tears and laughter beautifully.", "Elena", "Melbourne"),
    ("I’m showing up differently at work and at home.", "Harish", "Visakhapatnam"),
    ("This felt like coming home to myself.", "Amrita", "Chandigarh"),
    ("I’m glad I didn’t talk myself out of starting.", "Noah", "Perth"),
]


def main() -> None:
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("Set MONGO_URL and DB_NAME (e.g. backend/.env).", file=sys.stderr)
        sys.exit(1)

    client = MongoClient(mongo_url)
    db = client[db_name]

    programs = list(
        db.programs.find({"is_upcoming": True, "visible": True}, {"_id": 0, "id": 1, "title": 1, "order": 1}).sort(
            [("order", 1), ("id", 1)]
        )
    )[:2]

    if not programs:
        print("No visible programs with is_upcoming=True. Nothing to seed.")
        return

    sets = [QUOTE_SET_A, QUOTE_SET_B]
    now = datetime.now(timezone.utc).isoformat()

    for idx, prog in enumerate(programs):
        pid = str(prog.get("id") or "").strip()
        title = prog.get("title") or pid
        if not pid:
            continue
        existing = db.upcoming_card_quotes.count_documents({"program_id": pid})
        if existing > 0:
            print(f"Skip {title!r} ({pid}): already has {existing} quote(s).")
            continue

        rows = sets[min(idx, len(sets) - 1)]
        base = db.upcoming_card_quotes.count_documents({})
        docs = []
        for order, (text, author, role) in enumerate(rows):
            docs.append(
                {
                    "id": str(uuid.uuid4()),
                    "program_id": pid,
                    "text": text,
                    "author": author,
                    "role": role,
                    "visible": True,
                    "order": base + order,
                    "created_at": now,
                }
            )
        if docs:
            db.upcoming_card_quotes.insert_many(docs)
            print(f"Inserted {len(docs)} quotes for {title!r} ({pid}).")


if __name__ == "__main__":
    main()
