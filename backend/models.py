from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid

class Program(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    description: str
    image: str
    link: str = "/program"
    price_usd: float = 0.0
    price_inr: float = 0.0
    price_eur: float = 0.0
    price_gbp: float = 0.0
    price_aed: float = 0.0
    duration: str = "90 days"
    visible: bool = True
    order: int = 0
    program_type: str = "online"  # online / offline / hybrid
    offer_price_usd: float = 0.0
    offer_price_inr: float = 0.0
    offer_text: str = ""
    is_upcoming: bool = False
    start_date: str = ""
    deadline_date: str = ""
    enrollment_open: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProgramCreate(BaseModel):
    title: str
    category: str
    description: str
    image: str
    link: Optional[str] = "/program"
    price_usd: float = 0.0
    price_inr: float = 0.0
    price_eur: float = 0.0
    price_gbp: float = 0.0
    price_aed: float = 0.0
    duration: Optional[str] = "90 days"
    visible: Optional[bool] = True
    order: Optional[int] = 0
    program_type: Optional[str] = "online"
    offer_price_usd: Optional[float] = 0.0
    offer_price_inr: Optional[float] = 0.0
    offer_text: Optional[str] = ""
    is_upcoming: Optional[bool] = False
    start_date: Optional[str] = ""
    deadline_date: Optional[str] = ""
    enrollment_open: Optional[bool] = True

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    image: str
    price_usd: float = 0.0
    price_inr: float = 0.0
    price_eur: float = 0.0
    price_gbp: float = 0.0
    price_aed: float = 0.0
    duration: str = "60-90 minutes"
    visible: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionCreate(BaseModel):
    title: str
    description: str
    image: str
    price_usd: float = 0.0
    price_inr: float = 0.0
    price_eur: float = 0.0
    price_gbp: float = 0.0
    price_aed: float = 0.0
    duration: Optional[str] = "60-90 minutes"
    visible: Optional[bool] = True
    order: Optional[int] = 0

class Testimonial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "graphic"  # "graphic" or "video"
    name: str = ""
    text: str = ""  # searchable text content
    image: str = ""  # graphic image URL
    videoId: str = ""  # YouTube video ID
    thumbnail: str = ""
    program_id: str = ""  # associated program (optional)
    visible: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TestimonialCreate(BaseModel):
    type: str = "graphic"
    name: Optional[str] = ""
    text: Optional[str] = ""
    image: Optional[str] = ""
    videoId: Optional[str] = ""
    thumbnail: Optional[str] = ""
    program_id: Optional[str] = ""
    visible: Optional[bool] = True
    order: Optional[int] = 0

class Stat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    value: str
    label: str
    order: int = 0

class StatCreate(BaseModel):
    value: str
    label: str
    order: Optional[int] = 0

class Newsletter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    subscribed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NewsletterCreate(BaseModel):
    email: str

class SectionStyle(BaseModel):
    font_family: Optional[str] = None
    font_size: Optional[str] = None
    font_color: Optional[str] = None
    font_style: Optional[str] = None  # normal, italic
    font_weight: Optional[str] = None  # 300, 400, 500, 600, 700
    bg_color: Optional[str] = None
    bg_image: Optional[str] = None

class SiteSettings(BaseModel):
    id: str = "site_settings"
    heading_font: str = "Playfair Display"
    body_font: str = "Lato"
    heading_color: str = "#1a1a1a"
    body_color: str = "#4a4a4a"
    accent_color: str = "#D4AF37"
    heading_size: str = "default"
    body_size: str = "default"
    # Hero section
    hero_video_url: str = ""
    hero_title: str = "Divine Iris\nHealing"
    hero_subtitle: str = "ETERNAL HAPPINESS"
    hero_subtitle_color: str = "#ffffff"
    hero_title_color: str = "#ffffff"
    hero_title_align: str = "left"
    hero_title_bold: bool = False
    hero_title_size: str = "70px"
    hero_subtitle_bold: bool = False
    hero_subtitle_size: str = "14px"
    hero_show_lines: bool = True
    # Logo settings
    logo_url: str = ""
    logo_width: int = 96
    # Per-section styles
    sections: Optional[Dict] = {}

class SiteSettingsUpdate(BaseModel):
    heading_font: Optional[str] = None
    body_font: Optional[str] = None
    heading_color: Optional[str] = None
    body_color: Optional[str] = None
    accent_color: Optional[str] = None
    heading_size: Optional[str] = None
    body_size: Optional[str] = None
    hero_video_url: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    hero_subtitle_color: Optional[str] = None
    hero_title_color: Optional[str] = None
    hero_title_align: Optional[str] = None
    hero_title_bold: Optional[bool] = None
    hero_title_size: Optional[str] = None
    hero_subtitle_bold: Optional[bool] = None
    hero_subtitle_size: Optional[str] = None
    hero_show_lines: Optional[bool] = None
    logo_url: Optional[str] = None
    logo_width: Optional[int] = None
    sections: Optional[Dict] = None

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    customer_email: EmailStr
    customer_name: Optional[str] = None
    item_type: str
    item_id: str
    item_title: str
    amount: float
    currency: str
    payment_status: str = "pending"
    stripe_payment_intent: Optional[str] = None
    metadata: Optional[Dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentTransactionCreate(BaseModel):
    session_id: str
    customer_email: EmailStr
    customer_name: Optional[str] = None
    item_type: str
    item_id: str
    item_title: str
    amount: float
    currency: str
    metadata: Optional[Dict] = None

class CheckoutRequest(BaseModel):
    item_type: str
    item_id: str
    currency: str = "usd"
    customer_email: EmailStr
    customer_name: Optional[str] = None
    origin_url: str

class CurrencyInfo(BaseModel):
    currency: str
    symbol: str
    country: str
