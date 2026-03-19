"""Centralized API key management — reads from MongoDB first, falls back to os.environ."""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
_db = _client[os.environ['DB_NAME']]

# All managed keys with their env var name, label, service, description
KEY_DEFINITIONS = [
    {"name": "stripe_api_key", "env": "STRIPE_API_KEY", "label": "Stripe Secret Key", "service": "Payments", "description": "Payment processing for enrollments and donations (sk_live_... or sk_test_...)"},
    {"name": "smtp_host", "env": "SMTP_HOST", "label": "SMTP Host", "service": "Email", "description": "SMTP server hostname (e.g. smtp.gmail.com)"},
    {"name": "smtp_port", "env": "SMTP_PORT", "label": "SMTP Port", "service": "Email", "description": "SMTP server port (587 for TLS)"},
    {"name": "smtp_user", "env": "SMTP_USER", "label": "SMTP Username", "service": "Email", "description": "Email address used to authenticate with SMTP"},
    {"name": "smtp_pass", "env": "SMTP_PASS", "label": "SMTP Password", "service": "Email", "description": "App password for SMTP authentication"},
    {"name": "sender_email", "env": "SENDER_EMAIL", "label": "Sender Email", "service": "Email Config", "description": "Default sender address for OTP and notifications"},
    {"name": "receipt_email", "env": "RECEIPT_EMAIL", "label": "Receipt Email", "service": "Email Config", "description": "Sender address for payment receipts"},
    {"name": "resend_api_key", "env": "RESEND_API_KEY", "label": "Resend API Key", "service": "Email (backup)", "description": "Backup email service API key"},
    {"name": "razorpay_key_id", "env": "RAZORPAY_KEY_ID", "label": "Razorpay Key ID", "service": "Payments (India)", "description": "Key ID for Razorpay integration"},
    {"name": "razorpay_key_secret", "env": "RAZORPAY_KEY_SECRET", "label": "Razorpay Key Secret", "service": "Payments (India)", "description": "Key Secret for Razorpay integration"},
]


async def get_key(name: str) -> str:
    """Get a key value: MongoDB first, then .env fallback."""
    doc = await _db.api_keys.find_one({"name": name}, {"_id": 0})
    if doc and doc.get("value"):
        return doc["value"]
    defn = next((d for d in KEY_DEFINITIONS if d["name"] == name), None)
    if defn:
        return os.environ.get(defn["env"], "")
    return ""


async def get_all_keys() -> list:
    """Get all keys with current values for admin display."""
    db_keys = {}
    async for doc in _db.api_keys.find({}, {"_id": 0}):
        db_keys[doc["name"]] = doc.get("value", "")

    result = []
    for defn in KEY_DEFINITIONS:
        value = db_keys.get(defn["name"]) or os.environ.get(defn["env"], "")
        result.append({
            "name": defn["name"],
            "label": defn["label"],
            "service": defn["service"],
            "description": defn["description"],
            "value": value,
            "active": bool(value),
            "source": "admin" if defn["name"] in db_keys and db_keys[defn["name"]] else "env",
        })
    return result


async def save_key(name: str, value: str):
    """Save a key to MongoDB."""
    await _db.api_keys.update_one(
        {"name": name},
        {"$set": {"name": name, "value": value}},
        upsert=True,
    )


async def save_all_keys(keys: dict):
    """Save multiple keys at once. keys = {name: value}"""
    for name, value in keys.items():
        await save_key(name, value)
