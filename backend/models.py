from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
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
    label: str = ""  # e.g., "1 Month", "3 Months", "1 Year", "7 Days"
    duration_value: int = 1
    duration_unit: str = "month"  # month, year, week, day
    price_aed: float = 0.0
    price_inr: float = 0.0
    price_usd: float = 0.0
    offer_price_aed: float = 0.0
    offer_price_inr: float = 0.0
    offer_price_usd: float = 0.0
    offer_text: str = ""
    start_date: str = ""
    end_date: str = ""


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
    enrollment_status: str = "open"  # "open", "closed", "coming_soon"
    is_group_program: bool = False
    replicate_to_flagship: bool = False
    duration_tiers: List[Dict] = []  # list of DurationTier dicts
    whatsapp_group_link: str = ""
    zoom_link: str = ""
    custom_link: str = ""
    custom_link_label: str = ""
    show_whatsapp_link: bool = True
    show_zoom_link: bool = True
    show_custom_link: bool = True
    timing: str = ""  # e.g. "7:00 PM - 8:30 PM"
    time_zone: str = ""  # e.g. "GST Dubai", "IST", "EST"
    show_duration_on_page: bool = False
    show_start_date_on_page: bool = False
    show_timing_on_page: bool = False
    show_duration_on_card: bool = True
    show_pricing_on_card: bool = True
    show_tiers_on_card: bool = True
    exclusive_offer_enabled: bool = False
    exclusive_offer_text: str = "Limited Time Offer"
    closure_text: str = "Registration Closed"
    content_sections: List[Dict] = []  # List of ContentSection dicts
    highlight_label: str = ""  # e.g. "Highly Recommended", "Most Awaited"
    highlight_style: str = "gradient"  # "gradient", "ribbon", "glow"
    show_whatsapp_link_2: bool = False
    whatsapp_group_link_2: str = ""
    show_start_date_on_card: bool = True
    show_end_date_on_card: bool = True
    show_timing_on_card: bool = True
    india_tax_enabled: bool = False
    india_tax_percent: float = 18.0
    india_tax_label: str = "GST"
    india_tax_visible_on_dashboard: bool = True
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
    enrollment_status: Optional[str] = "open"
    is_group_program: Optional[bool] = False
    replicate_to_flagship: Optional[bool] = False
    duration_tiers: Optional[List[Dict]] = []
    whatsapp_group_link: Optional[str] = ""
    zoom_link: Optional[str] = ""
    custom_link: Optional[str] = ""
    custom_link_label: Optional[str] = ""
    show_whatsapp_link: Optional[bool] = True
    show_zoom_link: Optional[bool] = True
    show_custom_link: Optional[bool] = True
    timing: Optional[str] = ""
    time_zone: Optional[str] = ""
    show_duration_on_page: Optional[bool] = False
    show_start_date_on_page: Optional[bool] = False
    show_timing_on_page: Optional[bool] = False
    show_duration_on_card: Optional[bool] = True
    show_pricing_on_card: Optional[bool] = True
    show_tiers_on_card: Optional[bool] = True
    exclusive_offer_enabled: Optional[bool] = False
    exclusive_offer_text: Optional[str] = "Limited Time Offer"
    closure_text: Optional[str] = "Registration Closed"
    content_sections: Optional[List[Dict]] = []
    highlight_label: Optional[str] = ""
    highlight_style: Optional[str] = "gradient"
    show_whatsapp_link_2: Optional[bool] = False
    whatsapp_group_link_2: Optional[str] = ""
    show_start_date_on_card: Optional[bool] = True
    show_end_date_on_card: Optional[bool] = True
    show_timing_on_card: Optional[bool] = True


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
    title: str = ""
    description: str = ""
    description: str
    image: str = ""
    price_usd: float = 0.0
    price_inr: float = 0.0
    price_eur: float = 0.0
    price_gbp: float = 0.0
    price_aed: float = 0.0
    duration: str = "60-90 minutes"
    session_mode: str = "online"  # online / offline / both
    offer_price_aed: float = 0.0
    offer_price_inr: float = 0.0
    offer_price_usd: float = 0.0
    offer_text: str = ""
    available_dates: List[str] = []  # list of ISO date strings
    time_slots: List[str] = []  # e.g. ["10:00 AM", "2:00 PM", "5:00 PM"]
    testimonial_text: str = ""  # 2-5 line testimonial snippet
    title_style: Optional[Dict] = None
    description_style: Optional[Dict] = None
    visible: bool = True
    order: int = 0
    show_pricing: bool = True
    enable_online: bool = True
    enable_offline: bool = True
    enable_in_person: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionCreate(BaseModel):
    title: str = ""
    description: str = ""
    image: Optional[str] = ""
    price_usd: float = 0.0
    price_inr: float = 0.0
    price_eur: float = 0.0
    price_gbp: float = 0.0
    price_aed: float = 0.0
    duration: Optional[str] = "60-90 minutes"
    session_mode: Optional[str] = "online"
    offer_price_aed: Optional[float] = 0.0
    offer_price_inr: Optional[float] = 0.0
    offer_price_usd: Optional[float] = 0.0
    offer_text: Optional[str] = ""
    available_dates: Optional[List[str]] = []
    time_slots: Optional[List[str]] = []
    testimonial_text: Optional[str] = ""
    title_style: Optional[Dict] = None
    description_style: Optional[Dict] = None
    visible: Optional[bool] = True
    order: Optional[int] = 0
    show_pricing: Optional[bool] = True
    enable_online: Optional[bool] = True
    enable_offline: Optional[bool] = True
    enable_in_person: Optional[bool] = False

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
    type: str = "graphic"  # "graphic", "video", or "template"
    name: str = ""
    text: str = ""  # searchable text content / quote for template type
    image: str = ""  # graphic image URL or author photo for template type (legacy)
    before_image: str = ""  # optional before photo for before/after (legacy)
    videoId: str = ""  # YouTube video ID (legacy – derived from video_url)
    video_url: str = ""  # full URL: YouTube / Instagram / Facebook
    thumbnail: str = ""
    photos: List[str] = Field(default_factory=list)  # ordered list of photo URLs (single, before/after, or progressive)
    photo_labels: List[str] = Field(default_factory=list)  # label for each photo, e.g. ["Before", "After"] or ["Week 1", "Week 4", "Week 12"]
    photo_mode: str = "single"  # "single" | "before_after" | "progressive"
    program_id: str = ""  # legacy single program (optional)
    program_name: str = ""  # display name of the program/session
    program_tags: List[str] = []  # multiple program IDs
    session_tags: List[str] = []  # multiple session IDs
    category: str = ""  # e.g. "healing", "transformation", "weight-loss"
    role: str = ""  # author role/location for template type
    rating: int = 5  # star rating 1-5
    visible: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Email of the student to credit points (admin); used when testimonial is public and matches an earn activity
    points_attribution_email: str = ""

class TestimonialCreate(BaseModel):
    type: str = "graphic"
    name: Optional[str] = ""
    text: Optional[str] = ""
    image: Optional[str] = ""
    before_image: Optional[str] = ""
    videoId: Optional[str] = ""
    video_url: Optional[str] = ""
    thumbnail: Optional[str] = ""
    photos: Optional[List[str]] = Field(default_factory=list)
    photo_labels: Optional[List[str]] = Field(default_factory=list)
    photo_mode: Optional[str] = "single"
    program_id: Optional[str] = ""
    program_name: Optional[str] = ""
    program_tags: Optional[List[str]] = []
    session_tags: Optional[List[str]] = []
    category: Optional[str] = ""
    role: Optional[str] = ""
    rating: Optional[int] = 5
    visible: Optional[bool] = True
    order: Optional[int] = 0
    points_attribution_email: Optional[str] = ""
    # Admin-only: when true on PUT, allow clearing template photos (default restore would keep existing URLs).
    clear_template_media: Optional[bool] = None

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
    # Set from server HOST_URL on GET only — not stored in Mongo; helps the static site prefix /api/image URLs
    public_api_base: str = ""
    # GET-only (not in Mongo): when true, frontend rewrites this bucket’s virtual-host S3 URLs to /api/s3-media/...
    s3_media_bucket: str = ""
    s3_proxy_virtual_host_urls: bool = False
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
    hero_title_size: str = "44px"  # matches admin "M" (medium)
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
    transformations_gallery_visible: bool = True  # Transformations page: Gallery tab + graphic section
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
    refund_cancellation_policy_content: str = ""
    # Sender email configuration
    sender_emails: List[Dict] = []  # [{purpose: "receipt", email: "...", label: "Payment Receipts"}, ...]
    # Per-section styles
    sections: Optional[Dict] = {}
    # Program section template — defines section structure for ALL program pages
    program_section_template: List[Dict] = []
    # Footer navigation menu items
    footer_menu_items: List[Dict] = []  # [{label: "Home", href: "/", visible: true}, ...]
    header_nav_items: List[Dict] = []  # [{label: "Home", href: "/", position: "left", visible: true}, ...]
    header_show_programs_dropdown: bool = True
    footer_show_programs: bool = True  # Show programs column in footer
    # Discount & Loyalty Settings (global for all flagship programs)
    enable_referral: bool = True
    enable_group_discount: bool = False
    group_discount_rules: List[Dict] = []  # [{"min_participants": 3, "discount_pct": 10}, ...]
    enable_combo_discount: bool = False
    combo_discount_pct: float = 0  # % off when 2+ programs in cart
    combo_min_programs: int = 2
    # Cart + single-program enrollment: show "Promo code" field (URL ?promo= still works on enrollment when off)
    checkout_promo_code_visible: bool = True
    enable_loyalty: bool = False
    loyalty_discount_pct: float = 0  # % off for returning clients (have existing UID)
    # Program cross-sell (buy A → discount on B); rules in cross_sell_rules
    enable_cross_sell: bool = False
    # Points wallet (earn & burn) — separate from % loyalty discount above
    points_enabled: bool = True
    points_max_basket_pct: float = 20.0  # max % of order payable with points
    points_expiry_months: int = 6
    points_inr_per_point: float = 1.0  # cash value of 1 point when redeeming in INR (100 pts ≈ ₹100)
    points_usd_per_point: float = 0.01
    points_aed_per_point: float = 0.037
    points_earn_per_inr_paid: float = 0.5  # points earned per 1 unit of currency paid (after discounts)
    points_earn_per_usd_paid: float = 0.5
    points_earn_per_aed_paid: float = 0.5
    points_bonus_streak_30: int = 50
    points_bonus_review: int = 50
    points_bonus_referral: int = 500
    points_redeem_excludes_flagship: bool = True  # When true, points cannot pay down flagship program checkouts
    points_activities: List[Dict] = Field(default_factory=list)  # Overrides for earn activities (see points_logic.DEFAULT_POINTS_ACTIVITIES)
    # Payment disclaimer text
    payment_disclaimer: str = "We love aligning our work with the natural solar cycle of where you are. If the pricing you see isn't in your local currency, please reach out\u2014we'd be happy to provide the adjusted rates tailored to your home country."
    payment_disclaimer_enabled: bool = True
    payment_disclaimer_style: Dict = {"font_size": "14px", "font_weight": "600", "font_color": "#991b1b", "bg_color": "#fef2f2", "border_color": "#f87171"}
    # India payment options (alternative links for Indian users)
    india_alt_discount_percent: float = 9  # % discount for choosing alt payment
    india_payment_links: List[Dict] = []  # [{type: "exly"|"gpay"|"bank", label: "...", url: "...", details: "...", enabled: true}]
    # India alternative payment settings
    india_payment_enabled: bool = False
    # Public program/session enrollment: show Razorpay (requires API keys + India IP + INR + booker IN)
    enrollment_razorpay_enabled: bool = True
    india_gst_percent: float = 18  # GST %
    # Annual member dashboard: show estimated GST row on /api/student/dashboard-quote pricing table
    dashboard_annual_quote_show_tax: bool = True
    india_platform_charge_percent: float = 3  # Platform charge %
    india_upi_id: str = ""  # UPI ID for GPay/PhonePe
    india_exly_link: str = ""  # Exly payment link
    india_bank_details: Dict = {}  # {account_name, account_number, ifsc, bank_name, branch}
    receipt_template: Dict = {}  # {bg_color, accent_color, text_color, heading_font, body_font, thank_you_title/message/sign, show_logo, show_duration, show_timing}
    # Global pricing style
    pricing_font: str = "Cinzel, Georgia, serif"
    pricing_color: str = "#D4AF37"
    pricing_weight: str = "700"
    exclusive_offer: Optional[Dict] = None
    dashboard_settings: Dict = {}  # {title, colors: {primary, secondary}, fonts}
    community_whatsapp_link: str = ""
    text_testimonials_style: Optional[Dict] = None
    # SEO & social sharing (Admin → SEO) — no code needed to update titles/descriptions
    seo_site_url: str = ""  # https://yoursite.com (no trailing slash) — used for canonical & sitemap
    seo_default_title: str = "Divine Iris Healing"
    seo_default_description: str = "Transform your life through sacred healing, energy work and spiritual growth with Divine Iris — Soulful Healing Studio."
    seo_keywords: str = ""  # optional comma-separated
    seo_og_image_url: str = ""  # default Open Graph / Twitter image (URL or /api/image/…)
    seo_twitter_handle: str = ""  # without @
    seo_organization_name: str = "Divine Iris Healing"
    seo_organization_description: str = ""
    sanctuary_settings: Dict = {}  # {hero_bg, hero_overlay, greeting_title, greeting_subtitle}
    fraud_alert_email: str = "support@divineirishealing.com"
    enrollment_urgency_quotes: list = []  # [{text, name, program_id?}] — omit program_id for all programs
    combo_rules: list = []  # [{min_programs, discount_pct, code, label}]
    cross_sell_rules: list = []
    special_offers: list = []  # [{id, label, discount_pct, emails:[], phones:[], program_ids:[], code, enabled}]
    inr_whitelist_emails: list = []
    # Per-email pricing hub (inr / aed / usd) — same mechanism as NRI INR list, but for any hub; evaluated before INR whitelist in /currency/detect.
    pricing_hub_email_overrides: list = Field(default_factory=list)  # [{"email":"a@b.com","hub":"inr"}, ...]
    dashboard_bg_video: str = ""
    # Full-bleed loop behind Sacred Home (student dashboard overview + immersive shell) — uploaded in Admin → Dashboard
    dashboard_sanctuary_video_url: str = ""
    # Student Sacred Home: offers shown to annual subscribers vs family (configured in Admin → Dashboard)
    dashboard_offer_annual: Dict = Field(default_factory=dict)  # {enabled, title, body, promo_code, cta_label, cta_path}
    dashboard_offer_family: Dict = Field(default_factory=dict)
    # Friends & extended (non-household) dashboard seats — separate portal rules from immediate family
    dashboard_offer_extended: Dict = Field(default_factory=dict)
    # When non-empty, these program IDs are "included in annual package" (member pays family seats only). Empty = use title keywords (MMM, AWRP, …).
    annual_package_included_program_ids: List[str] = Field(default_factory=list)
    # Sacred Home: prepend this catalog program to `upcoming_programs` for Annual dashboard clients (renewal / Home Coming product).
    dashboard_sacred_home_annual_program_id: str = ""
    # Per-program portal pricing overrides: { program_id: { annual, family, extended, by_tier?: { "0"|"1"|…: { annual, family, extended } } } } merged with globals; tier keys match duration_tier index on Sacred Home
    dashboard_program_offers: Dict[str, Any] = Field(default_factory=dict)
    # Existing AWRP / cohort batches: assign clients (awrp_batch_id) for layered portal pricing in Sacred Home
    awrp_portal_batches: List[Dict] = Field(default_factory=list)  # [{ "id": "2025-01", "label": "…", "notes": "…" }]
    # { batch_id: { program_id: { annual, family, extended, by_tier?: { … } } } } merged after dashboard_program_offers for that client
    awrp_batch_program_offers: Dict[str, Any] = Field(default_factory=dict)
    # Student dashboard: show/hide overview tiles and sidebar links (Admin → Dashboard). Missing keys = visible.
    dashboard_element_visibility: Dict[str, Any] = Field(default_factory=dict)
    # Sacred Home maintenance: blocks /api/student/* for signed-in clients except bypass emails & admin impersonation.
    dashboard_maintenance_enabled: bool = False
    dashboard_maintenance_message: str = (
        "Sacred Home is temporarily unavailable while we make improvements. Please check back soon."
    )
    dashboard_maintenance_bypass_emails: List[str] = Field(default_factory=list)
    india_payment_gateway: dict = {}
    india_bank_accounts: list = []
    # Site-wide GPay / UPI IDs (manual proof flows; same shape as subscriber payment_destinations.gpay rows)
    india_gpay_accounts: List[Dict] = Field(default_factory=list)  # [{id, label, upi_id, qr_image_url?}]
    india_bank_details: dict = {}  # {gateway_type, exly_link, api_key, api_secret, enabled, notes}  # Emails that get INR pricing from abroad  # [{buy_program_id, get_program_id, discount_type, discount_value, code, label, enabled}]
    # Automated enrollment participant report (Excel by email)
    enrollment_auto_report_enabled: bool = False
    enrollment_auto_report_emails: str = ""  # comma-separated
    enrollment_auto_report_interval_hours: int = 24  # clamped 6–168 server-side
    enrollment_auto_report_paid_only: bool = True
    enrollment_auto_report_last_sent_at: str = ""  # ISO UTC; set by server

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
    transformations_gallery_visible: Optional[bool] = None
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
    refund_cancellation_policy_content: Optional[str] = None
    sender_emails: Optional[List[Dict]] = None
    sections: Optional[Dict] = None
    program_section_template: Optional[List[Dict]] = None
    footer_menu_items: Optional[List[Dict]] = None
    header_nav_items: Optional[List[Dict]] = None
    header_show_programs_dropdown: Optional[bool] = None
    footer_show_programs: Optional[bool] = None
    enable_referral: Optional[bool] = None
    enable_group_discount: Optional[bool] = None
    group_discount_rules: Optional[List[Dict]] = None
    enable_combo_discount: Optional[bool] = None
    combo_discount_pct: Optional[float] = None
    combo_min_programs: Optional[int] = None
    checkout_promo_code_visible: Optional[bool] = None
    enable_loyalty: Optional[bool] = None
    loyalty_discount_pct: Optional[float] = None
    enable_cross_sell: Optional[bool] = None
    points_enabled: Optional[bool] = None
    points_max_basket_pct: Optional[float] = None
    points_expiry_months: Optional[int] = None
    points_inr_per_point: Optional[float] = None
    points_usd_per_point: Optional[float] = None
    points_aed_per_point: Optional[float] = None
    points_earn_per_inr_paid: Optional[float] = None
    points_earn_per_usd_paid: Optional[float] = None
    points_earn_per_aed_paid: Optional[float] = None
    points_bonus_streak_30: Optional[int] = None
    points_bonus_review: Optional[int] = None
    points_bonus_referral: Optional[int] = None
    points_redeem_excludes_flagship: Optional[bool] = None
    points_activities: Optional[List[Dict]] = None
    payment_disclaimer: Optional[str] = None
    payment_disclaimer_enabled: Optional[bool] = None
    payment_disclaimer_style: Optional[Dict] = None
    india_payment_links: Optional[List[Dict]] = None
    india_alt_discount_percent: Optional[float] = None
    india_payment_enabled: Optional[bool] = None
    enrollment_razorpay_enabled: Optional[bool] = None
    india_gst_percent: Optional[float] = None
    dashboard_annual_quote_show_tax: Optional[bool] = None
    india_platform_charge_percent: Optional[float] = None
    india_upi_id: Optional[str] = None
    india_exly_link: Optional[str] = None
    india_bank_details: Optional[Dict] = None
    india_bank_accounts: Optional[list] = None
    india_gpay_accounts: Optional[list] = None
    receipt_template: Optional[Dict] = None
    pricing_font: Optional[str] = None
    pricing_color: Optional[str] = None
    pricing_weight: Optional[str] = None
    exclusive_offer: Optional[Dict] = None
    community_whatsapp_link: Optional[str] = None
    text_testimonials_style: Optional[Dict] = None
    fraud_alert_email: Optional[str] = None
    enrollment_urgency_quotes: Optional[list] = None
    combo_rules: Optional[list] = None
    cross_sell_rules: Optional[list] = None
    special_offers: Optional[list] = None
    inr_whitelist_emails: Optional[list] = None
    pricing_hub_email_overrides: Optional[list] = None
    dashboard_bg_video: Optional[str] = None
    dashboard_sanctuary_video_url: Optional[str] = None
    india_payment_gateway: Optional[dict] = None
    seo_site_url: Optional[str] = None
    seo_default_title: Optional[str] = None
    seo_default_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    seo_og_image_url: Optional[str] = None
    seo_twitter_handle: Optional[str] = None
    seo_organization_name: Optional[str] = None
    seo_organization_description: Optional[str] = None

    dashboard_settings: Optional[Dict] = None  # {title, colors: {primary, secondary}, fonts}
    dashboard_offer_annual: Optional[Dict] = None
    dashboard_offer_family: Optional[Dict] = None
    dashboard_offer_extended: Optional[Dict] = None
    annual_package_included_program_ids: Optional[List[str]] = None
    dashboard_sacred_home_annual_program_id: Optional[str] = None
    dashboard_program_offers: Optional[Dict[str, Any]] = None
    awrp_portal_batches: Optional[List[Dict]] = None
    awrp_batch_program_offers: Optional[Dict[str, Any]] = None
    dashboard_element_visibility: Optional[Dict[str, Any]] = None
    dashboard_maintenance_enabled: Optional[bool] = None
    dashboard_maintenance_message: Optional[str] = None
    dashboard_maintenance_bypass_emails: Optional[List[str]] = None
    enrollment_auto_report_enabled: Optional[bool] = None
    enrollment_auto_report_emails: Optional[str] = None
    enrollment_auto_report_interval_hours: Optional[int] = None
    enrollment_auto_report_paid_only: Optional[bool] = None

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
