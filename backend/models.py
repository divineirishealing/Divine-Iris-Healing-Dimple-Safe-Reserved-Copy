from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid

class FontStyle(BaseModel):
    font_family: Optional[str] = None
    font_size: Optional[str] = None
    font_color: Optional[str] = None
    font_weight: Optional[str] = None  # 300, 400, 500, 600, 700, bold
    font_style: Optional[str] = None  # normal, italic
    text_align: Optional[str] = None  # left, center, right

class ContentSection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    section_type: str = "custom"  # hero_subtitle, journey, who_for, experience, cta, custom
    title: str = ""
    subtitle: str = ""
    body: str = ""
    image_url: str = ""
    image_fit: str = "cover"  # cover, contain, fill
    image_position: str = "center"  # center, top, bottom, left, right
    is_enabled: bool = True
    order: int = 0
    title_style: Optional[Dict] = None  # FontStyle dict
    subtitle_style: Optional[Dict] = None
    body_style: Optional[Dict] = None

class DurationTier(BaseModel):
    label: str = ""  # e.g., "1 Month", "3 Months", "1 Year"
    duration_value: int = 1
    duration_unit: str = "month"  # month, year, week, day
    price_aed: float = 0.0
    price_inr: float = 0.0
    price_usd: float = 0.0


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
    session_mode: str = "online"  # online / remote / both
    enable_online: bool = True
    enable_offline: bool = True
    enable_in_person: bool = False
    offer_price_aed: float = 0.0
    offer_price_usd: float = 0.0
    offer_price_inr: float = 0.0
    offer_text: str = ""
    is_upcoming: bool = False
    is_flagship: bool = False
    start_date: str = ""
    end_date: str = ""
    deadline_date: str = ""
    enrollment_open: bool = True
    duration_tiers: List[Dict] = []  # list of DurationTier dicts
    whatsapp_group_link: str = ""
    zoom_link: str = ""
    custom_link: str = ""
    custom_link_label: str = ""
    show_whatsapp_link: bool = True
    show_zoom_link: bool = True
    show_custom_link: bool = True
    content_sections: List[Dict] = []  # List of ContentSection dicts
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
    session_mode: Optional[str] = "online"
    enable_online: Optional[bool] = True
    enable_offline: Optional[bool] = True
    enable_in_person: Optional[bool] = False
    offer_price_aed: Optional[float] = 0.0
    offer_price_usd: Optional[float] = 0.0
    offer_price_inr: Optional[float] = 0.0
    offer_text: Optional[str] = ""
    is_upcoming: Optional[bool] = False
    is_flagship: Optional[bool] = False
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    deadline_date: Optional[str] = ""
    enrollment_open: Optional[bool] = True
    duration_tiers: Optional[List[Dict]] = []
    whatsapp_group_link: Optional[str] = ""
    zoom_link: Optional[str] = ""
    custom_link: Optional[str] = ""
    custom_link_label: Optional[str] = ""
    show_whatsapp_link: Optional[bool] = True
    show_zoom_link: Optional[bool] = True
    show_custom_link: Optional[bool] = True
    content_sections: Optional[List[Dict]] = []


class Promotion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str = ""
    type: str = "coupon"  # coupon / early_bird / limited_time
    discount_type: str = "percentage"  # percentage / fixed
    discount_percentage: float = 0.0
    discount_aed: float = 0.0
    discount_inr: float = 0.0
    discount_usd: float = 0.0
    applicable_to: str = "all"  # all / specific
    applicable_program_ids: List[str] = []
    usage_limit: int = 0  # 0 = unlimited
    used_count: int = 0
    start_date: str = ""
    expiry_date: str = ""
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PromotionCreate(BaseModel):
    name: str
    code: Optional[str] = ""
    type: str = "coupon"
    discount_type: str = "percentage"
    discount_percentage: Optional[float] = 0.0
    discount_aed: Optional[float] = 0.0
    discount_inr: Optional[float] = 0.0
    discount_usd: Optional[float] = 0.0
    applicable_to: Optional[str] = "all"
    applicable_program_ids: Optional[List[str]] = []
    usage_limit: Optional[int] = 0
    start_date: Optional[str] = ""
    expiry_date: Optional[str] = ""
    active: Optional[bool] = True

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    image: str = ""
    price_usd: float = 0.0
    price_inr: float = 0.0
    price_eur: float = 0.0
    price_gbp: float = 0.0
    price_aed: float = 0.0
    duration: str = "60-90 minutes"
    session_mode: str = "online"  # online / offline / both
    available_dates: List[str] = []  # list of ISO date strings
    time_slots: List[str] = []  # e.g. ["10:00 AM", "2:00 PM", "5:00 PM"]
    testimonial_text: str = ""  # 2-5 line testimonial snippet
    title_style: Optional[Dict] = None
    description_style: Optional[Dict] = None
    visible: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionCreate(BaseModel):
    title: str
    description: str
    image: Optional[str] = ""
    price_usd: float = 0.0
    price_inr: float = 0.0
    price_eur: float = 0.0
    price_gbp: float = 0.0
    price_aed: float = 0.0
    duration: Optional[str] = "60-90 minutes"
    session_mode: Optional[str] = "online"
    available_dates: Optional[List[str]] = []
    time_slots: Optional[List[str]] = []
    testimonial_text: Optional[str] = ""
    title_style: Optional[Dict] = None
    description_style: Optional[Dict] = None
    visible: Optional[bool] = True
    order: Optional[int] = 0

class SessionTestimonial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    client_name: str = ""
    client_photo: str = ""
    text: str = ""
    visible: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionTestimonialCreate(BaseModel):
    session_id: str = ""
    client_name: Optional[str] = ""
    client_photo: Optional[str] = ""
    text: Optional[str] = ""
    visible: Optional[bool] = True
    order: Optional[int] = 0

class SessionQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    name: str = ""
    email: str = ""
    question: str = ""
    reply: str = ""
    replied: bool = False
    replied_at: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionQuestionCreate(BaseModel):
    session_id: str = ""
    name: str = ""
    email: str = ""
    question: str = ""

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
    icon: str = ""  # FontAwesome icon class
    value_style: Optional[Dict] = None  # FontStyle dict
    label_style: Optional[Dict] = None  # FontStyle dict

class StatCreate(BaseModel):
    value: str
    label: str
    order: Optional[int] = 0
    icon: Optional[str] = ""
    value_style: Optional[Dict] = None
    label_style: Optional[Dict] = None

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
    hero_title_font: str = "Cinzel"
    hero_title_italic: bool = False
    hero_subtitle_bold: bool = False
    hero_subtitle_size: str = "14px"
    hero_subtitle_font: str = "Lato"
    hero_subtitle_italic: bool = False
    hero_show_lines: bool = True
    # Logo settings
    logo_url: str = ""
    logo_width: int = 96
    # About section
    about_subtitle: str = "Meet the Healer"
    about_name: str = "Dimple Ranawat"
    about_title: str = "Founder, Divine Iris – Soulful Healing Studio"
    about_bio: str = "Dimple Ranawat is an internationally recognised healer, accountability coach, and life transformation mentor whose work is reshaping how the world understands healing, growth, and well-being."
    about_bio_2: str = "Dimple's journey began with a profound question: \"Why do people continue to suffer despite awareness, effort, and access to solutions?\" Her work is rooted in lived experience and deep inquiry."
    about_image: str = ""
    about_button_text: str = "Read Full Bio"
    about_button_link: str = "/about"
    about_image_fit: str = "contain"  # cover, contain, fill
    about_image_position: str = "center top"  # center, top, bottom
    about_philosophy: str = ""
    about_impact: str = ""
    about_mission: str = ""
    about_vision: str = ""
    about_mission_vision_subtitle: str = "Where healing meets awareness, and transformation begins from within."
    # About page font styles
    about_name_style: Optional[Dict] = None
    about_subtitle_style: Optional[Dict] = None
    about_title_style: Optional[Dict] = None
    about_bio_style: Optional[Dict] = None
    about_philosophy_style: Optional[Dict] = None
    about_philosophy_title_style: Optional[Dict] = None
    about_impact_style: Optional[Dict] = None
    about_impact_title_style: Optional[Dict] = None
    about_mission_style: Optional[Dict] = None
    about_mission_title_style: Optional[Dict] = None
    about_vision_style: Optional[Dict] = None
    about_vision_title_style: Optional[Dict] = None
    about_mv_section_title_style: Optional[Dict] = None
    about_mv_section_subtitle_style: Optional[Dict] = None
    # Newsletter section
    newsletter_heading: str = "Join Our Community"
    # Page heroes - centralized hero styles for all pages
    page_heroes: Optional[Dict] = None
    media_page_visible: bool = False
    blog_page_visible: bool = False
    sessions_page_visible: bool = True
    # Sponsor section content & styles
    sponsor_home: Optional[Dict] = None
    sponsor_page: Optional[Dict] = None
    # Homepage sections - title/subtitle/style per section, order, visibility
    homepage_sections: Optional[list] = None
    newsletter_description: str = "Sign up to receive updates on upcoming workshops, new courses and more information"
    newsletter_button_text: str = "Subscribe"
    newsletter_footer_text: str = "By subscribing, you agree to our Privacy Policy and Terms of Use."
    # Footer section
    footer_brand_name: str = "Divine Iris Healing"
    footer_tagline: str = "Delve into the deeper realm of your soul with Divine Iris – Soulful Healing Studio"
    footer_email: str = "support@divineirishealing.com"
    footer_phone: str = "+971553325778"
    footer_copyright: str = "2026 Divine Iris Healing. All Rights Reserved."
    # Social links
    social_facebook: str = "https://facebook.com"
    social_instagram: str = "https://instagram.com"
    social_youtube: str = "https://youtube.com"
    social_linkedin: str = "https://linkedin.com"
    social_spotify: str = ""
    social_pinterest: str = ""
    social_tiktok: str = ""
    social_twitter: str = ""
    social_apple_music: str = ""
    social_soundcloud: str = ""
    # Social toggles (on/off per icon)
    show_facebook: bool = True
    show_instagram: bool = True
    show_youtube: bool = True
    show_linkedin: bool = True
    show_spotify: bool = False
    show_pinterest: bool = False
    show_tiktok: bool = False
    show_twitter: bool = False
    show_apple_music: bool = False
    show_soundcloud: bool = False
    # Legal pages
    terms_content: str = ""
    privacy_content: str = ""
    # Sender email configuration
    sender_emails: List[Dict] = []  # [{purpose: "receipt", email: "...", label: "Payment Receipts"}, ...]
    # Per-section styles
    sections: Optional[Dict] = {}
    # Program section template — defines section structure for ALL program pages
    program_section_template: List[Dict] = []
    # Footer navigation menu items
    footer_menu_items: List[Dict] = []  # [{label: "Home", href: "/", visible: true}, ...]
    footer_show_programs: bool = True  # Show programs column in footer
    # Discount & Loyalty Settings (global for all flagship programs)
    enable_referral: bool = True
    enable_group_discount: bool = False
    group_discount_rules: List[Dict] = []  # [{"min_participants": 3, "discount_pct": 10}, ...]
    enable_combo_discount: bool = False
    combo_discount_pct: float = 0  # % off when 2+ programs in cart
    combo_min_programs: int = 2
    enable_loyalty: bool = False
    loyalty_discount_pct: float = 0  # % off for returning clients (have existing UID)
    # Payment disclaimer text
    payment_disclaimer: str = "We love aligning our work with the natural solar cycle of where you are. If the pricing you see isn't in your local currency, please reach out\u2014we'd be happy to provide the adjusted rates tailored to your home country."
    # India payment options (alternative links for Indian users)
    india_payment_links: List[Dict] = []  # [{type: "exly"|"gpay"|"bank", label: "...", url: "...", details: "...", enabled: true}]

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
    hero_title_font: Optional[str] = None
    hero_title_italic: Optional[bool] = None
    hero_subtitle_bold: Optional[bool] = None
    hero_subtitle_size: Optional[str] = None
    hero_subtitle_font: Optional[str] = None
    hero_subtitle_italic: Optional[bool] = None
    hero_show_lines: Optional[bool] = None
    logo_url: Optional[str] = None
    logo_width: Optional[int] = None
    about_subtitle: Optional[str] = None
    about_name: Optional[str] = None
    about_title: Optional[str] = None
    about_bio: Optional[str] = None
    about_bio_2: Optional[str] = None
    about_image: Optional[str] = None
    about_button_text: Optional[str] = None
    about_button_link: Optional[str] = None
    about_image_fit: Optional[str] = None
    about_image_position: Optional[str] = None
    about_philosophy: Optional[str] = None
    about_impact: Optional[str] = None
    about_mission: Optional[str] = None
    about_vision: Optional[str] = None
    about_mission_vision_subtitle: Optional[str] = None
    about_name_style: Optional[Dict] = None
    about_subtitle_style: Optional[Dict] = None
    about_title_style: Optional[Dict] = None
    about_bio_style: Optional[Dict] = None
    about_philosophy_style: Optional[Dict] = None
    about_philosophy_title_style: Optional[Dict] = None
    about_impact_style: Optional[Dict] = None
    about_impact_title_style: Optional[Dict] = None
    about_mission_style: Optional[Dict] = None
    about_mission_title_style: Optional[Dict] = None
    about_vision_style: Optional[Dict] = None
    about_vision_title_style: Optional[Dict] = None
    about_mv_section_title_style: Optional[Dict] = None
    about_mv_section_subtitle_style: Optional[Dict] = None
    newsletter_heading: Optional[str] = None
    page_heroes: Optional[Dict] = None
    media_page_visible: Optional[bool] = None
    blog_page_visible: Optional[bool] = None
    sessions_page_visible: Optional[bool] = None
    sponsor_home: Optional[Dict] = None
    sponsor_page: Optional[Dict] = None
    homepage_sections: Optional[list] = None
    newsletter_description: Optional[str] = None
    newsletter_button_text: Optional[str] = None
    newsletter_footer_text: Optional[str] = None
    footer_brand_name: Optional[str] = None
    footer_tagline: Optional[str] = None
    footer_email: Optional[str] = None
    footer_phone: Optional[str] = None
    footer_copyright: Optional[str] = None
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_youtube: Optional[str] = None
    social_linkedin: Optional[str] = None
    social_spotify: Optional[str] = None
    social_pinterest: Optional[str] = None
    social_tiktok: Optional[str] = None
    social_twitter: Optional[str] = None
    social_apple_music: Optional[str] = None
    social_soundcloud: Optional[str] = None
    show_facebook: Optional[bool] = None
    show_instagram: Optional[bool] = None
    show_youtube: Optional[bool] = None
    show_linkedin: Optional[bool] = None
    show_spotify: Optional[bool] = None
    show_pinterest: Optional[bool] = None
    show_tiktok: Optional[bool] = None
    show_twitter: Optional[bool] = None
    show_apple_music: Optional[bool] = None
    show_soundcloud: Optional[bool] = None
    terms_content: Optional[str] = None
    privacy_content: Optional[str] = None
    sender_emails: Optional[List[Dict]] = None
    sections: Optional[Dict] = None
    program_section_template: Optional[List[Dict]] = None
    footer_menu_items: Optional[List[Dict]] = None
    footer_show_programs: Optional[bool] = None
    enable_referral: Optional[bool] = None
    enable_group_discount: Optional[bool] = None
    group_discount_rules: Optional[List[Dict]] = None
    enable_combo_discount: Optional[bool] = None
    combo_discount_pct: Optional[float] = None
    combo_min_programs: Optional[int] = None
    enable_loyalty: Optional[bool] = None
    loyalty_discount_pct: Optional[float] = None
    payment_disclaimer: Optional[str] = None
    india_payment_links: Optional[List[Dict]] = None

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
