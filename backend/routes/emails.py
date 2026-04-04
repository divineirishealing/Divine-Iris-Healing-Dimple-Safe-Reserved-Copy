import os
import logging
import aiosmtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)


async def _get_smtp_config():
    """Get SMTP config from key_manager (MongoDB) with .env fallback."""
    from key_manager import get_key
    return {
        "host": await get_key("smtp_host") or os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        "port": int(await get_key("smtp_port") or os.environ.get('SMTP_PORT', 587)),
        "user": await get_key("smtp_user") or os.environ.get('SMTP_USER', ''),
        "password": await get_key("smtp_pass") or os.environ.get('SMTP_PASS', ''),
        "sender": await get_key("sender_email") or os.environ.get('SENDER_EMAIL', 'noreply@divineirishealing.com'),
        "receipt": await get_key("receipt_email") or os.environ.get('RECEIPT_EMAIL', 'receipt@divineirishealing.com'),
        "resend_key": await get_key("resend_api_key") or os.environ.get('RESEND_API_KEY', ''),
    }


async def _send_via_resend(to: str, subject: str, html: str, sender: str, api_key: str) -> bool:
    """Send email via Resend API. Returns True on success."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"from": sender, "to": [to], "subject": subject, "html": html},
            )
        if resp.status_code in (200, 201):
            logger.info(f"Email sent to {to} via Resend")
            return True
        logger.error(f"Resend rejected email to {to}: {resp.status_code} {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Resend delivery failed for {to}: {e}")
        return False


async def send_email(to: str, subject: str, html: str, from_email: str = None):
    cfg = await _get_smtp_config()
    sender = from_email or cfg["sender"]

    # Try SMTP when credentials are fully configured
    if cfg["user"] and cfg["password"]:
        msg = MIMEMultipart("alternative")
        msg["From"] = sender
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        try:
            await aiosmtplib.send(
                msg,
                hostname=cfg["host"],
                port=cfg["port"],
                start_tls=True,
                username=cfg["user"],
                password=cfg["password"],
                timeout=15,
            )
            logger.info(f"Email sent to {to} via SMTP")
            return {"id": "smtp_ok"}
        except Exception as e:
            logger.warning(f"SMTP failed for {to}: {e} — trying Resend fallback")

    # Resend fallback (or primary when SMTP credentials are absent)
    if cfg["resend_key"]:
        ok = await _send_via_resend(to, subject, html, sender, cfg["resend_key"])
        if ok:
            return {"id": "resend_ok"}

    logger.error(f"All delivery methods failed for {to}. Configure SMTP password or Resend API key in Admin → API Keys.")
    return None


async def send_otp_email(to: str, otp: str, name: str = ""):
    cfg = await _get_smtp_config()
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:Georgia,'Times New Roman',serif;background:#f8f8f8">
      <div style="max-width:500px;margin:0 auto;background:#ffffff">
        <div style="background:#1a1a1a;padding:28px 24px;text-align:center">
          <h1 style="color:#D4AF37;margin:0;font-size:22px;font-weight:400;letter-spacing:3px">DIVINE IRIS HEALING</h1>
        </div>
        <div style="padding:40px 32px;text-align:center">
          <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 8px;font-weight:400">Email Verification</h2>
          <p style="color:#888;font-size:14px;margin:0 0 24px">Hi{' ' + name if name else ''}, use this code to verify your email:</p>
          <div style="background:#faf8f0;border:2px solid #D4AF37;border-radius:12px;padding:20px;display:inline-block">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a;font-family:monospace">{otp}</span>
          </div>
          <p style="color:#aaa;font-size:12px;margin:20px 0 0">This code expires in 5 minutes. Do not share it with anyone.</p>
        </div>
        <div style="background:#1a1a1a;padding:20px;text-align:center">
          <p style="color:#D4AF37;font-size:11px;margin:0;letter-spacing:2px">DIVINE IRIS HEALING</p>
          <p style="color:#666;font-size:10px;margin:4px 0 0">This is an automated message. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
    """
    return await send_email(to, "Your Verification Code - Divine Iris Healing", html, from_email=cfg["sender"])


async def get_receipt_template():
    """Get receipt template settings from DB"""
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "receipt_template": 1, "logo_url": 1})
    tpl = (settings or {}).get("receipt_template", {})
    logo = (settings or {}).get("logo_url", "")
    return tpl, logo


def enrollment_confirmation_email(booker_name, item_title, participants, total, currency_symbol, attendance_modes, booker_email, phone, program_links=None, program_description="", program_start_date="", program_duration="", program_end_date="", program_timing="", program_timezone="", logo_url="", receipt_template=None, social_links=None, community_whatsapp="", footer_phone="", site_url="", footer_email="", currency_code="", invoice_number=""):
    tpl = receipt_template or {}
    socials = social_links or {}
    tpl = receipt_template or {}
    # Template colors/fonts
    bg_color = tpl.get("bg_color", "#1a1a1a")
    accent_color = tpl.get("accent_color", "#D4AF37")
    text_color = tpl.get("text_color", "#333333")
    heading_font = tpl.get("heading_font", "'Lato', Arial, Helvetica, sans-serif")
    body_font = tpl.get("body_font", "'Lato', Arial, Helvetica, sans-serif")
    thank_you_title = tpl.get("thank_you_title", "Thank You")
    thank_you_message = tpl.get("thank_you_message", "We are truly grateful for your trust in Divine Iris Healing. Your healing journey has now begun, and we are honoured to walk this path with you. May this experience bring you deep peace, clarity, and transformation.")
    thank_you_sign = tpl.get("thank_you_sign", "With love and light")
    show_logo = tpl.get("show_logo", True)

    # GST Section (India payments only)
    gst_section = ""
    if currency_code and currency_code.lower() == "inr" and tpl.get("gst_enabled"):
        try:
            total_num = float(str(total).replace(',', ''))
            gst_rate = float(tpl.get("gst_rate", 18))
            base_amount = round(total_num / (1 + gst_rate / 100), 2)
            gst_amount = round(total_num - base_amount, 2)
            gst_type = tpl.get("gst_type", "IGST")
            sac_code = tpl.get("gst_sac_code", "999319")
            company = tpl.get("gst_company_name", "")
            gstin = tpl.get("gst_gstin", "")
            pan = tpl.get("gst_pan", "")
            address = tpl.get("gst_address", "")
            gst_phone = tpl.get("gst_phone", "")
            terms = tpl.get("gst_terms", "")
            signatory = tpl.get("gst_signatory", "")
            inv_num = invoice_number or ""

            tax_rows = ""
            if gst_type == "IGST":
                tax_rows = f'<tr><td style="padding:4px 8px;font-size:11px;color:#555">IGST ({gst_rate}%)</td><td style="padding:4px 8px;font-size:11px;text-align:right;color:#555">₹{gst_amount:,.2f}</td></tr>'
            else:
                half = round(gst_amount / 2, 2)
                tax_rows = f'<tr><td style="padding:4px 8px;font-size:11px;color:#555">CGST ({gst_rate/2}%)</td><td style="padding:4px 8px;font-size:11px;text-align:right;color:#555">₹{half:,.2f}</td></tr><tr><td style="padding:4px 8px;font-size:11px;color:#555">SGST ({gst_rate/2}%)</td><td style="padding:4px 8px;font-size:11px;text-align:right;color:#555">₹{half:,.2f}</td></tr>'

            gst_section = f'''
            <div style="margin-top:20px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
              <div style="background:#f8f8f8;padding:12px 16px;border-bottom:1px solid #e0e0e0">
                <div style="display:flex;justify-content:space-between">
                  <div>
                    <div style="font-size:13px;font-weight:700;color:#111">{company}</div>
                    <div style="font-size:10px;color:#666;margin-top:2px">{address}</div>
                    <div style="font-size:10px;color:#666">GSTIN: <strong>{gstin}</strong></div>
                    {"<div style='font-size:10px;color:#666'>PAN: " + pan + "</div>" if pan else ""}
                    {"<div style='font-size:10px;color:#666'>Phone: " + gst_phone + "</div>" if gst_phone else ""}
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:12px;font-weight:700;color:{accent_color}">TAX INVOICE</div>
                    {"<div style='font-size:10px;color:#666'>Invoice: " + inv_num + "</div>" if inv_num else ""}
                  </div>
                </div>
              </div>
              <table style="width:100%;border-collapse:collapse">
                <thead><tr style="background:#f0f0f0">
                  <th style="padding:6px 8px;font-size:10px;text-align:left;color:#555">Description</th>
                  <th style="padding:6px 8px;font-size:10px;text-align:right;color:#555">Amount</th>
                </tr></thead>
                <tbody>
                  <tr style="border-bottom:1px solid #eee">
                    <td style="padding:6px 8px;font-size:11px;color:#333">{item_title}<br/><span style="font-size:9px;color:#999">SAC: {sac_code}</span></td>
                    <td style="padding:6px 8px;font-size:11px;text-align:right;color:#333">₹{base_amount:,.2f}</td>
                  </tr>
                  {tax_rows}
                  <tr style="border-top:2px solid #333">
                    <td style="padding:8px;font-size:13px;font-weight:700;color:#111">Total (INR)</td>
                    <td style="padding:8px;font-size:13px;font-weight:700;text-align:right;color:#111">₹{total_num:,.2f}</td>
                  </tr>
                </tbody>
              </table>
              {"<div style='padding:8px 16px;font-size:9px;color:#888;border-top:1px solid #eee'>Terms: " + terms + "</div>" if terms else ""}
              {"<div style='padding:4px 16px 12px;font-size:9px;text-align:right;color:#666'>Authorised Signatory: <strong>" + signatory + "</strong></div>" if signatory else ""}
            </div>'''
        except Exception:
            gst_section = ""

    # Logo HTML
    logo_html = ""
    if show_logo and logo_url:
        logo_html = f'<img src="{logo_url}" alt="Divine Iris Healing" style="max-height:48px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto" />'


    # Community WhatsApp HTML — merged into links section below
    community_whatsapp_html = ""

    # Social links HTML
    social_html_block = _build_social_html(socials, accent_color, body_font)

    # Zoom note HTML - editable from receipt template
    important_note = tpl.get("important_note", "Zoom link will be provided 30 mins prior to session in WhatsApp Group. Hence, please join the group to stay updated with instructions and updates.")
    zoom_note_html = ""
    if important_note:
        zoom_note_html = f"""
        <div style="padding:0 36px 20px">
          <div style="background:#eef6f3;border:1px solid #c8e0d5;border-radius:12px;padding:18px 22px;text-align:center">
            <p style="color:{text_color};font-size:14px;font-weight:600;margin:0 0 8px;font-family:{heading_font}">Important Note</p>
            <p style="color:#555;font-size:13px;margin:0;line-height:1.7;font-family:{body_font}">{important_note}</p>
          </div>
        </div>"""

    # Assistance HTML
    wa_number = footer_phone.replace("+", "").replace(" ", "") if footer_phone else "971553325778"
    support_email = footer_email or "support@divineirishealing.com"
    assistance_html = f"""
        <div style="padding:0 36px 20px">
          <div style="background:#f5f7f9;border:1px solid #dce3e8;border-radius:12px;padding:20px 24px;text-align:center">
            <p style="color:{text_color};font-size:15px;font-weight:600;margin:0 0 8px;font-family:{heading_font}">Need Assistance?</p>
            <p style="color:#666;font-size:13px;margin:0 0 14px;line-height:1.6;font-family:{body_font}">For any assistance, reach out to us</p>
            <a href="https://wa.me/{wa_number}" style="display:inline-block;background:#25D366;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin:4px;font-family:{body_font}">WhatsApp Us</a>
            <a href="mailto:{support_email}?subject=Help%20with%20Enrollment" style="display:inline-block;background:{accent_color};color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin:4px;font-family:{body_font}">Email Us</a>
          </div>
        </div>"""

    # Attachments HTML
    attachments = tpl.get("attachments", [])
    attachments_html = ""
    if attachments:
        att_items = ""
        for att in attachments:
            icon = "&#128196;" if att.get("type") == "document" else "&#127909;"
            att_url = att.get("url", "")
            if att_url.startswith("/api/"):
                base = site_url or "https://divineirishealing.com"
                att_url = f"{base}{att_url}"
            att_items += f'<a href="{att_url}" style="display:inline-block;background:{accent_color}15;border:1px solid {accent_color}33;color:{text_color};padding:10px 20px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;margin:4px;font-family:{body_font}">{icon} {att.get("name", "Attachment")}</a>'
        attachments_html = f"""
        <div style="padding:0 36px 20px">
          <div style="text-align:center">
            <p style="color:{text_color};font-size:14px;font-weight:600;margin:0 0 10px;font-family:{heading_font}">Resources & Documents</p>
            {att_items}
          </div>
        </div>"""

    # Participant rows
    participant_rows = ""
    for p in participants:
        mode = p.get("attendance_mode", "online")
        mode_label = "Online (Zoom)" if mode == "online" else "Remote Healing (Distance)"
        mode_color = "#2563eb" if mode == "online" else "#0d9488"
        uid = p.get("uid", "")
        uid_html = f'<div style="font-size:10px;color:{accent_color};font-weight:600;margin-top:2px">Receipt ID: {uid}</div>' if uid else ""
        referred = p.get("referred_by_name", "")
        ref_html = f'<div style="font-size:9px;color:#999;margin-top:1px">Referred by: {referred}</div>' if referred else ""
        p_phone_code = p.get("phone_code", "")
        p_phone = p.get("phone", "")
        full_phone = f"{p_phone_code}{p_phone}" if p_phone else ""
        p_wa_code = p.get("wa_code", "")
        p_wa = p.get("whatsapp", "")
        full_wa = f"{p_wa_code}{p_wa}" if p_wa else ""
        contact_parts = []
        if full_phone:
            contact_parts.append(f"Ph: {full_phone}")
        if full_wa:
            contact_parts.append(f"WA: {full_wa}")
        contact_html = f'<div style="font-size:9px;color:#888;margin-top:1px">{" | ".join(contact_parts)}</div>' if contact_parts else ""
        first_time = "First Time Joiner" if p.get("is_first_time") else "Soul Tribe"
        ft_color = accent_color if p.get("is_first_time") else "#7c3aed"

        participant_rows += f"""
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #e5ece8;vertical-align:top">
            <div style="font-size:14px;color:{text_color};font-weight:600;font-family:{heading_font}">{p.get('name','')}</div>
            <div style="font-size:11px;color:#888;margin-top:1px">{p.get('relationship','')}</div>
            {uid_html}{ref_html}{contact_html}
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #e5ece8;vertical-align:top;text-align:center">
            <span style="background:{mode_color};color:#fff;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:0.5px;white-space:nowrap;display:inline-block">{mode_label}</span>
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #e5ece8;vertical-align:top;text-align:center">
            <span style="font-size:11px;color:{ft_color};font-weight:600">{first_time}</span>
          </td>
        </tr>"""

    # Links section — combines program links + community link + editable note
    links_note = tpl.get("links_note", "")
    links_html = ""
    if program_links or community_whatsapp:
        link_items = ""
        if program_links and program_links.get("whatsapp_group_link"):
            link_items += f'''<a href="{program_links["whatsapp_group_link"]}" style="display:inline-block;background:#25D366;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:14px;margin:6px;font-weight:600;font-family:{body_font}">WhatsApp Workshop Group</a>'''
        if community_whatsapp:
            link_items += f'''<a href="{community_whatsapp}" style="display:inline-block;background:#128C7E;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:14px;margin:6px;font-weight:600;font-family:{body_font}">WhatsApp Community Group</a>'''
        if program_links and program_links.get("whatsapp_group_link_2"):
            link_items += f'''<a href="{program_links["whatsapp_group_link_2"]}" style="display:inline-block;background:#075e54;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:14px;margin:6px;font-weight:600;font-family:{body_font}">WhatsApp Group 2</a>'''
        if program_links and program_links.get("zoom_link"):
            link_items += f'''<a href="{program_links["zoom_link"]}" style="display:inline-block;background:#2D8CFF;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:14px;margin:6px;font-weight:600;font-family:{body_font}">Join Zoom Meeting</a>'''
        if program_links and program_links.get("custom_link"):
            label = program_links.get("custom_link_label", "View Link")
            link_items += f'''<a href="{program_links["custom_link"]}" style="display:inline-block;background:{accent_color};color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:14px;margin:6px;font-weight:600;font-family:{body_font}">{label}</a>'''
        links_note_html = f'<p style="color:#555;font-size:12px;margin:16px 0 0;line-height:1.7;font-family:{body_font};white-space:pre-line">{links_note}</p>' if links_note else ""
        if link_items:
            links_html = f"""
            <div style="padding:0 36px 28px">
              <div style="background:linear-gradient(135deg, #dcf8c6, #e8f5e9);border:1px solid #b2dfb2;border-radius:14px;padding:28px;text-align:center">
                <p style="color:#075e54;font-size:16px;margin:0 0 6px;font-weight:600;font-family:{heading_font}">Your Session Links</p>
                <p style="color:#888;font-size:12px;margin:0 0 20px;font-family:{body_font}">Save these links for your upcoming sessions</p>
                {link_items}
                {links_note_html}
              </div>
            </div>"""

    # Program details section
    details_items = ""
    if program_start_date:
        details_items += f'<tr><td style="padding:6px 0;color:#999;font-size:12px;width:100px;vertical-align:top">Starts</td><td style="padding:6px 0;color:{text_color};font-size:13px;font-weight:500">{program_start_date}</td></tr>'
    if program_end_date:
        details_items += f'<tr><td style="padding:6px 0;color:#999;font-size:12px;vertical-align:top">Ends</td><td style="padding:6px 0;color:{text_color};font-size:13px;font-weight:500">{program_end_date}</td></tr>'
    if program_timing:
        tz = f" ({program_timezone})" if program_timezone else ""
        details_items += f'<tr><td style="padding:6px 0;color:#999;font-size:12px;vertical-align:top">Timing</td><td style="padding:6px 0;color:{text_color};font-size:13px;font-weight:500">{program_timing}{tz}</td></tr>'
    if program_duration:
        details_items += f'<tr><td style="padding:6px 0;color:#999;font-size:12px;vertical-align:top">Duration</td><td style="padding:6px 0;color:{text_color};font-size:13px;font-weight:500">{program_duration}</td></tr>'

    program_info = ""
    if details_items or program_description:
        desc_html = f'<p style="color:#666;font-size:12px;margin:12px 0 0;line-height:1.7;font-family:{body_font}">{program_description[:400]}</p>' if program_description else ""
        program_info = f"""
        <div style="padding:0 36px 20px">
          <div style="border-left:3px solid {accent_color};padding:16px 20px;background:#f7faf8;border-radius:0 10px 10px 0">
            <table style="width:100%;border-collapse:collapse;font-family:{body_font}">{details_items}</table>
            {desc_html}
          </div>
        </div>"""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lato:wght@300;400;600&display=swap" rel="stylesheet">
    </head>
    <body style="margin:0;padding:0;background:#f2f5f4;font-family:{body_font}">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce3df;border-radius:0">

        <!-- Header -->
        <div style="background:{bg_color};padding:36px 32px;text-align:center;border-bottom:3px solid {accent_color}">
          {logo_html}
          <h1 style="color:{accent_color};margin:0;font-size:26px;font-weight:600;letter-spacing:4px;font-family:{heading_font}">DIVINE IRIS HEALING</h1>
          <div style="width:60px;height:1px;background:{accent_color};margin:12px auto 10px"></div>
          <p style="color:#888;font-size:11px;margin:0;letter-spacing:2px;text-transform:uppercase;font-family:{body_font}">Payment Receipt</p>
        </div>

        <!-- Confirmation -->
        <div style="padding:40px 36px 20px;text-align:center">
          <div style="width:64px;height:64px;background:linear-gradient(135deg, {accent_color}22, {accent_color}11);border:2px solid {accent_color};border-radius:50%;margin:0 auto 18px;line-height:64px;font-size:30px;color:{accent_color}">&#10003;</div>
          <h2 style="color:{text_color};font-size:24px;margin:0 0 8px;font-weight:400;font-family:{heading_font}">Enrollment Confirmed</h2>
          <p style="color:#999;font-size:14px;margin:0;font-family:{body_font}">Thank you for enrolling, {booker_name}!</p>
        </div>

        <!-- Program Card -->
        <div style="padding:0 36px 24px">
          <div style="background:linear-gradient(135deg, #f5f9f7, #eef4f1);border:1px solid #d4ddd8;border-radius:14px;padding:24px;overflow:hidden">
            <div style="display:flex;align-items:center;margin-bottom:4px">
              <div style="width:4px;height:28px;background:{accent_color};border-radius:4px;margin-right:12px"></div>
              <h3 style="color:{accent_color};font-size:18px;margin:0;font-weight:600;font-family:{heading_font}">{item_title}</h3>
            </div>
            <p style="color:#aaa;font-size:11px;margin:4px 0 20px 16px;letter-spacing:0.5px">Booking Status: <span style="color:#27ae60;font-weight:600">Confirmed</span></p>

            <!-- Participants Table -->
            <table style="width:100%;border-collapse:collapse;font-family:{body_font}">
              <thead>
                <tr style="background:{accent_color}12">
                  <th style="padding:10px 14px;text-align:left;font-size:10px;color:{accent_color};text-transform:uppercase;letter-spacing:1.5px;font-weight:600;border-bottom:2px solid {accent_color}33">Participant</th>
                  <th style="padding:10px 14px;text-align:center;font-size:10px;color:{accent_color};text-transform:uppercase;letter-spacing:1.5px;font-weight:600;border-bottom:2px solid {accent_color}33">Mode</th>
                  <th style="padding:10px 14px;text-align:center;font-size:10px;color:{accent_color};text-transform:uppercase;letter-spacing:1.5px;font-weight:600;border-bottom:2px solid {accent_color}33">Member Status</th>
                </tr>
              </thead>
              <tbody>
                {participant_rows}
              </tbody>
            </table>

            <!-- Total -->
            <div style="border-top:2px solid {accent_color};margin-top:16px;padding-top:18px;text-align:right">
              <span style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px">Total Paid</span>
              <div style="font-size:28px;color:{accent_color};font-weight:700;font-family:{heading_font};margin-top:2px">{currency_symbol}{total}</div>
            </div>
            {gst_section}
          </div>
        </div>

        <!-- Program Details -->
        {program_info}

        <!-- Links -->
        {links_html}

        <!-- Zoom Note -->
        {zoom_note_html}

        <!-- Attachments -->
        {attachments_html}

        <!-- Booker Info -->
        <div style="padding:0 36px 24px">
          <div style="background:#fafafa;border-radius:12px;padding:18px 22px;font-size:13px;color:#555;font-family:{body_font};border:1px solid #f0f0f0">
            <p style="margin:0 0 5px"><span style="color:#999;font-size:11px">Booked by</span><br><strong style="color:{text_color}">{booker_name}</strong></p>
            <p style="margin:0 0 5px"><span style="color:#999;font-size:11px">Email</span><br><strong style="color:{text_color}">{booker_email}</strong></p>
            {f'<p style="margin:0"><span style="color:#999;font-size:11px">Phone</span><br><strong style="color:{text_color}">{phone}</strong></p>' if phone else ''}
          </div>
        </div>

        <!-- Thank You -->
        <div style="padding:0 36px 32px">
          <div style="background:linear-gradient(135deg, #f5f9f7, #eef4f1);border:1px solid #d4ddd8;border-radius:14px;padding:28px;text-align:center">
            <div style="width:40px;height:1px;background:{accent_color};margin:0 auto 16px"></div>
            <p style="color:{accent_color};font-size:20px;margin:0 0 10px;font-weight:600;font-family:{heading_font}">{thank_you_title}</p>
            <p style="color:#666;font-size:13px;margin:0;line-height:1.8;font-family:{body_font}">{thank_you_message}</p>
            <div style="width:40px;height:1px;background:{accent_color};margin:16px auto"></div>
            <p style="color:{accent_color};font-size:13px;margin:0;font-style:italic;font-family:{heading_font}">{thank_you_sign}</p>
          </div>
        </div>

        {assistance_html}

        <!-- Subscribe to Future Workshops -->
        <div style="padding:0 36px 20px">
          <div style="background:linear-gradient(135deg, #f0f0ff, #e8e0ff);border-radius:14px;padding:20px;text-align:center">
            <p style="color:#4c1d95;font-size:14px;font-weight:600;margin:0 0 4px;font-family:{heading_font}">Stay Updated</p>
            <p style="color:#666;font-size:12px;margin:0;font-family:{body_font}">You'll be notified about upcoming workshops and healing sessions</p>
          </div>
        </div>

        {social_html_block}

        <!-- Footer -->
        <div style="background:{bg_color};padding:28px;text-align:center;border-top:3px solid {accent_color}">
          <p style="color:{accent_color};font-size:13px;margin:0 0 4px;letter-spacing:3px;font-family:{heading_font}">DIVINE IRIS HEALING</p>
          <p style="color:#666;font-size:11px;margin:0;font-family:{body_font}">Delve into the deeper realm of your soul</p>
          <p style="color:#555;font-size:10px;margin:10px 0 0">support@divineirishealing.com | +971553325778</p>
        </div>
      </div>
    </body>
    </html>
    """
    return html


def _build_social_html(socials, accent_color="#D4AF37", body_font="'Lato', Arial, sans-serif"):
    """Build social media links HTML block from settings."""
    links = []
    if socials.get("show_facebook") and socials.get("social_facebook"):
        links.append(f'<a href="{socials["social_facebook"]}" style="color:{accent_color};text-decoration:none;font-size:13px;margin:0 10px;font-family:{body_font}">Facebook</a>')
    if socials.get("show_instagram") and socials.get("social_instagram"):
        links.append(f'<a href="{socials["social_instagram"]}" style="color:{accent_color};text-decoration:none;font-size:13px;margin:0 10px;font-family:{body_font}">Instagram</a>')
    if socials.get("show_youtube") and socials.get("social_youtube"):
        links.append(f'<a href="{socials["social_youtube"]}" style="color:{accent_color};text-decoration:none;font-size:13px;margin:0 10px;font-family:{body_font}">YouTube</a>')
    if socials.get("show_linkedin") and socials.get("social_linkedin"):
        links.append(f'<a href="{socials["social_linkedin"]}" style="color:{accent_color};text-decoration:none;font-size:13px;margin:0 10px;font-family:{body_font}">LinkedIn</a>')
    if not links:
        return ""
    return f"""
        <div style="padding:0 36px 20px;text-align:center">
          <p style="color:#999;font-size:10px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1.5px;font-family:{body_font}">Follow Us</p>
          {'  |  '.join(links)}
        </div>"""


def participant_notification_email(participant_name, item_title, attendance_mode, booker_name, program_links=None, program_description="", program_start_date="", program_duration="", program_end_date="", program_timing="", program_timezone="", logo_url="", social_links=None, community_whatsapp=""):
    mode_label = "Online (Zoom)" if attendance_mode == "online" else "Remote Healing (Distance)"
    mode_detail = "You will receive session details and links before the session." if attendance_mode == "online" else "This is a remote/distance healing session. The healer will work on your energy remotely."
    body_font = "'Lato', Arial, Helvetica, sans-serif"
    heading_font = "'Lato', Arial, Helvetica, sans-serif"
    accent = "#D4AF37"
    socials = social_links or {}
    p_links = program_links or {}

    # Logo
    logo_html = f'<img src="{logo_url}" alt="Divine Iris" style="max-height:48px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto" />' if logo_url else ""

    # Program details
    details_rows = ""
    if program_start_date:
        details_rows += f'<tr><td style="padding:6px 0;color:#999;font-size:12px;width:100px">Starts</td><td style="padding:6px 0;color:#333;font-size:13px;font-weight:500">{program_start_date}</td></tr>'
    if program_end_date:
        details_rows += f'<tr><td style="padding:6px 0;color:#999;font-size:12px">Ends</td><td style="padding:6px 0;color:#333;font-size:13px;font-weight:500">{program_end_date}</td></tr>'
    if program_duration:
        details_rows += f'<tr><td style="padding:6px 0;color:#999;font-size:12px">Duration</td><td style="padding:6px 0;color:#333;font-size:13px;font-weight:500">{program_duration}</td></tr>'
    if program_timing:
        tz = f" ({program_timezone})" if program_timezone else ""
        details_rows += f'<tr><td style="padding:6px 0;color:#999;font-size:12px">Timing</td><td style="padding:6px 0;color:#333;font-size:13px;font-weight:500">{program_timing}{tz}</td></tr>'

    details_html = ""
    if details_rows or program_description:
        desc = f'<p style="color:#666;font-size:12px;margin:12px 0 0;line-height:1.7;font-family:{body_font}">{program_description[:400]}</p>' if program_description else ""
        details_html = f"""
        <div style="padding:0 32px 20px">
          <div style="border-left:3px solid {accent};padding:16px 20px;background:#f7faf8;border-radius:0 10px 10px 0">
            <table style="width:100%;border-collapse:collapse;font-family:{body_font}">{details_rows}</table>
            {desc}
          </div>
        </div>"""

    # Program links (WhatsApp + Zoom)
    link_items = ""
    if p_links.get("whatsapp_group_link"):
        link_items += f'<a href="{p_links["whatsapp_group_link"]}" style="display:inline-block;background:#25D366;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-size:13px;margin:6px;font-weight:600;font-family:{body_font}">WhatsApp Workshop Group</a>'
    if p_links.get("whatsapp_group_link_2"):
        link_items += f'<a href="{p_links["whatsapp_group_link_2"]}" style="display:inline-block;background:#128C7E;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-size:13px;margin:6px;font-weight:600;font-family:{body_font}">WhatsApp Community Group</a>'
    if p_links.get("zoom_link"):
        link_items += f'<a href="{p_links["zoom_link"]}" style="display:inline-block;background:#2D8CFF;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-size:13px;margin:6px;font-weight:600;font-family:{body_font}">Join Zoom Meeting</a>'
    if p_links.get("custom_link"):
        lbl = p_links.get("custom_link_label", "View Link")
        link_items += f'<a href="{p_links["custom_link"]}" style="display:inline-block;background:{accent};color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-size:13px;margin:6px;font-weight:600;font-family:{body_font}">{lbl}</a>'

    links_html = ""
    if link_items:
        links_html = f"""
        <div style="padding:0 32px 20px">
          <div style="background:linear-gradient(135deg, #f0f7ff, #e8f0ff);border:1px solid #c8d8ef;border-radius:14px;padding:24px;text-align:center">
            <p style="color:#333;font-size:15px;margin:0 0 6px;font-weight:600;font-family:{heading_font}">Your Session Links</p>
            <p style="color:#888;font-size:11px;margin:0 0 16px;font-family:{body_font}">Save these links for your upcoming sessions</p>
            {link_items}
          </div>
        </div>"""

    # Community WhatsApp
    community_html = ""
    if community_whatsapp:
        community_html = f"""
        <div style="padding:0 32px 20px">
          <div style="background:#dcf8c6;border-radius:14px;padding:20px;text-align:center">
            <p style="color:#075e54;font-size:14px;font-weight:600;margin:0 0 8px;font-family:{heading_font}">Join WhatsApp Community Group</p>
            <a href="{community_whatsapp}" style="display:inline-block;background:#25D366;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Join WhatsApp Community</a>
          </div>
        </div>"""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin:0;padding:0;font-family:{body_font};background:#f2f5f4">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dce3df">
        <div style="background:#1a1a1a;padding:32px 24px;text-align:center;border-bottom:3px solid {accent}">
          {logo_html}
          <h1 style="color:{accent};margin:0;font-size:22px;font-weight:300;letter-spacing:4px;font-family:{heading_font}">DIVINE IRIS HEALING</h1>
        </div>
        <div style="padding:40px 32px 20px;text-align:center">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 8px;font-weight:400;font-family:{heading_font}">You've Been Enrolled!</h2>
          <p style="color:#888;font-size:14px;margin:0;font-family:{body_font}">Hi {participant_name}, {booker_name} has enrolled you in:</p>
        </div>
        <div style="padding:0 32px 24px">
          <div style="background:linear-gradient(135deg, #f5f9f7, #eef4f1);border:1px solid #d4ddd8;border-radius:14px;padding:24px;text-align:center">
            <h3 style="color:{accent};font-size:18px;margin:0 0 12px;font-family:{heading_font}">{item_title}</h3>
            <p style="color:#333;font-size:14px;margin:0 0 8px;font-family:{body_font}"><strong>Mode:</strong> {mode_label}</p>
            <p style="color:#666;font-size:13px;margin:0;font-family:{body_font}">{mode_detail}</p>
          </div>
        </div>

        {details_html}
        {links_html}
        {community_html}

        <!-- Subscribe -->
        <div style="padding:0 32px 20px">
          <div style="background:linear-gradient(135deg, #f0f0ff, #e8e0ff);border-radius:14px;padding:18px;text-align:center">
            <p style="color:#4c1d95;font-size:13px;font-weight:600;margin:0 0 4px;font-family:{heading_font}">Stay Updated</p>
            <p style="color:#666;font-size:11px;margin:0;font-family:{body_font}">You'll be notified about upcoming workshops and healing sessions</p>
          </div>
        </div>

        {_build_social_html(socials, accent, body_font)}

        <div style="background:#1a1a1a;padding:24px;text-align:center;border-top:3px solid {accent}">
          <p style="color:{accent};font-size:12px;margin:0 0 4px;letter-spacing:2px;font-family:{heading_font}">DIVINE IRIS HEALING</p>
          <p style="color:#666;font-size:11px;margin:0;font-family:{body_font}">Delve into the deeper realm of your soul</p>
        </div>
      </div>
    </body>
    </html>
    """
    return html
