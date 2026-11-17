"""Shared validation for India Razorpay landing checkouts."""
from __future__ import annotations

import re

from pydantic import BaseModel, field_validator

DISPOSABLE_DOMAINS = {
    "tempmail.com",
    "throwaway.email",
    "guerrillamail.com",
    "mailinator.com",
    "yopmail.com",
    "10minutemail.com",
}


class IndiaProgramLandingCheckoutBody(BaseModel):
    name: str
    email: str
    phone: str
    tier_index: int = 0
    attendance_mode: str = "online"
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""
    utm_content: str = ""

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        name = " ".join((v or "").split())
        if len(name) < 2:
            raise ValueError("Please enter your name")
        return name[:200]

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        email = (v or "").strip().lower()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
            raise ValueError("Please enter a valid email")
        domain = email.split("@", 1)[1]
        if domain in DISPOSABLE_DOMAINS:
            raise ValueError("Please use a regular email address")
        return email

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        raw = re.sub(r"[^\d+]", "", (v or "").strip())
        digits = re.sub(r"\D", "", raw)
        if len(digits) < 8 or len(digits) > 15:
            raise ValueError("Please enter a valid phone number")
        if len(digits) == 10:
            return "+91" + digits
        if raw.startswith("+"):
            return "+" + digits
        return "+" + digits

    @field_validator("tier_index")
    @classmethod
    def clean_tier(cls, v: int) -> int:
        try:
            ti = int(v)
        except (TypeError, ValueError):
            ti = 0
        return max(0, ti)

    @field_validator("attendance_mode")
    @classmethod
    def clean_mode(cls, v: str) -> str:
        mode = (v or "").strip().lower()
        if mode not in ("online", "offline"):
            raise ValueError("Choose Online (Zoom) or Offline (Remote)")
        return mode

    @field_validator("utm_source", "utm_medium", "utm_campaign", "utm_content")
    @classmethod
    def clean_utm(cls, v: str) -> str:
        return (v or "").strip()[:200]