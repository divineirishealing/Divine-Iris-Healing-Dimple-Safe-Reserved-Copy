from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/inbox", tags=["Inbox"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


# ========== CONTACT SUBMISSIONS (quote_requests) ==========

@router.get("/contacts")
async def get_contacts(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    items = await db.quote_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@router.put("/contacts/{cid}/status")
async def update_contact_status(cid: str, data: dict):
    new_status = data.get("status", "read")
    result = await db.quote_requests.update_one({"id": cid}, {"$set": {"status": new_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Status updated"}


@router.delete("/contacts/{cid}")
async def delete_contact(cid: str):
    result = await db.quote_requests.delete_one({"id": cid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Deleted"}


# ========== EXPRESS YOUR INTEREST ==========

@router.get("/interests")
async def get_interests():
    items = await db.notify_me.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@router.put("/interests/{iid}/status")
async def update_interest_status(iid: str, data: dict):
    new_status = data.get("status", "read")
    result = await db.notify_me.update_one({"id": iid}, {"$set": {"status": new_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Interest not found")
    return {"message": "Status updated"}


@router.delete("/interests/{iid}")
async def delete_interest(iid: str):
    result = await db.notify_me.delete_one({"id": iid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Interest not found")
    return {"message": "Deleted"}


# ========== QUESTIONS ==========

@router.get("/questions")
async def get_questions(status: Optional[str] = None):
    query = {}
    if status == "new":
        query["replied"] = False
    elif status == "replied":
        query["replied"] = True
    items = await db.session_questions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


# ========== UNIFIED REPLY ==========

class ReplyRequest(BaseModel):
    message: str
    include_programs: bool = False
    program_ids: List[str] = []
    include_whatsapp: bool = False
    whatsapp_link: str = ""
    include_workshop_updates: bool = False
    include_social_links: bool = True


@router.post("/reply/{collection}/{item_id}")
async def reply_to_item(collection: str, item_id: str, data: ReplyRequest):
    coll_map = {
        "contacts": "quote_requests",
        "interests": "notify_me",
        "questions": "session_questions",
    }
    db_coll = coll_map.get(collection)
    if not db_coll:
        raise HTTPException(status_code=400, detail="Invalid collection")

    item = await db[db_coll].find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    recipient_email = item.get("email", "")
    recipient_name = item.get("name", "Seeker")
    if not recipient_email:
        raise HTTPException(status_code=400, detail="No email address for this entry")

    # Fetch settings for social links
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    settings = settings or {}

    # Fetch program details if needed
    program_cards_html = ""
    if data.include_programs and data.program_ids:
        programs = []
        for pid in data.program_ids:
            p = await db.programs.find_one({"id": pid}, {"_id": 0})
            if p:
                programs.append(p)
        if programs:
            cards = ""
            for p in programs:
                price_text = ""
                if p.get("price_usd"):
                    price_text = f"From ${p['price_usd']}"
                elif p.get("price_aed"):
                    price_text = f"From AED {p['price_aed']}"
                cards += f"""
                <div style="background:#faf8f0;border:1px solid #e8dcc4;border-radius:12px;padding:20px;margin-bottom:12px">
                  <h3 style="color:#D4AF37;font-size:16px;margin:0 0 6px;font-family:'Lato',Arial,sans-serif">{p.get('title','')}</h3>
                  <p style="color:#666;font-size:13px;margin:0 0 8px;line-height:1.5;font-family:'Lato',Arial,sans-serif">{(p.get('description','') or '')[:150]}{'...' if len(p.get('description','') or '') > 150 else ''}</p>
                  {f'<p style="color:#D4AF37;font-size:14px;font-weight:600;margin:0;font-family:Lato,Arial,sans-serif">{price_text}</p>' if price_text else ''}
                </div>"""
            program_cards_html = f"""
            <div style="padding:20px 0">
              <h3 style="color:#1a1a1a;font-size:16px;margin:0 0 12px;font-family:'Lato',Arial,sans-serif">Programs You Might Love</h3>
              {cards}
            </div>"""

    # WhatsApp community block
    whatsapp_html = ""
    if data.include_whatsapp and data.whatsapp_link:
        whatsapp_html = f"""
        <div style="background:#dcf8c6;border-radius:12px;padding:20px;text-align:center;margin:16px 0">
          <p style="color:#075e54;font-size:15px;font-weight:600;margin:0 0 8px">Join Our Community</p>
          <a href="{data.whatsapp_link}" style="display:inline-block;background:#25D366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Join WhatsApp Group</a>
        </div>"""

    # Workshop updates block
    workshop_html = ""
    if data.include_workshop_updates:
        workshop_html = """
        <div style="background:#f0f0ff;border-radius:12px;padding:20px;text-align:center;margin:16px 0">
          <p style="color:#4c1d95;font-size:15px;font-weight:600;margin:0 0 4px">Stay Updated</p>
          <p style="color:#666;font-size:13px;margin:0">We'll keep you informed about our upcoming workshops and healing sessions.</p>
        </div>"""

    # Social links block
    social_html = ""
    if data.include_social_links:
        social_links = []
        if settings.get("show_facebook") and settings.get("social_facebook"):
            social_links.append(f'<a href="{settings["social_facebook"]}" style="color:#D4AF37;text-decoration:none;font-size:13px;margin:0 8px">Facebook</a>')
        if settings.get("show_instagram") and settings.get("social_instagram"):
            social_links.append(f'<a href="{settings["social_instagram"]}" style="color:#D4AF37;text-decoration:none;font-size:13px;margin:0 8px">Instagram</a>')
        if settings.get("show_youtube") and settings.get("social_youtube"):
            social_links.append(f'<a href="{settings["social_youtube"]}" style="color:#D4AF37;text-decoration:none;font-size:13px;margin:0 8px">YouTube</a>')
        if settings.get("show_linkedin") and settings.get("social_linkedin"):
            social_links.append(f'<a href="{settings["social_linkedin"]}" style="color:#D4AF37;text-decoration:none;font-size:13px;margin:0 8px">LinkedIn</a>')
        if social_links:
            social_html = f"""
            <div style="text-align:center;padding:16px 0;border-top:1px solid #eee;margin-top:16px">
              <p style="color:#999;font-size:11px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Follow Us</p>
              {'  |  '.join(social_links)}
            </div>"""

    # Build the reply message HTML (converting newlines to <br>)
    reply_body = data.message.replace('\n', '<br>')

    # Original message context
    original_context = ""
    if collection == "contacts":
        original_context = f'<p style="color:#999;font-size:12px;margin:16px 0 0;padding-top:12px;border-top:1px solid #eee"><em>Regarding your inquiry: {item.get("message", "")[:200]}</em></p>'
    elif collection == "questions":
        original_context = f'<p style="color:#999;font-size:12px;margin:16px 0 0;padding-top:12px;border-top:1px solid #eee"><em>Your question: {item.get("question", "")[:200]}</em></p>'

    # Build logo URL for email
    BACKEND_URL = os.environ.get("BACKEND_URL", "")
    logo_url = settings.get("logo_url", "")
    if logo_url and logo_url.startswith("/api/"):
        logo_url = f"{BACKEND_URL}{logo_url}" if BACKEND_URL else ""
    logo_html = f'<img src="{logo_url}" alt="Divine Iris Healing" style="height:48px;margin-bottom:12px;object-fit:contain" /><br/>' if logo_url else ""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin:0;padding:0;font-family:'Lato',Arial,Helvetica,sans-serif;background:#f4f2ed">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e8e0c8">
        <div style="background:#1a1a1a;padding:28px 24px;text-align:center;border-bottom:3px solid #D4AF37">
          {logo_html}
          <h1 style="color:#D4AF37;margin:0;font-size:20px;font-weight:300;letter-spacing:4px;font-family:'Lato',Arial,sans-serif">DIVINE IRIS HEALING</h1>
        </div>
        <div style="padding:32px 28px">
          <p style="color:#333;font-size:15px;margin:0 0 4px;font-family:'Lato',Arial,sans-serif">Dear {recipient_name},</p>
          <div style="color:#444;font-size:14px;line-height:1.8;margin:16px 0;font-family:'Lato',Arial,sans-serif">{reply_body}</div>
          {original_context}
          {program_cards_html}
          {whatsapp_html}
          {workshop_html}
        </div>
        <div style="padding:0 28px 24px">
          <p style="color:#D4AF37;font-size:14px;margin:0;font-style:italic;font-family:'Lato',Arial,sans-serif">With love and light,</p>
          <p style="color:#333;font-size:14px;margin:4px 0 0;font-weight:600;font-family:'Lato',Arial,sans-serif">Divine Iris Healing</p>
        </div>
        {social_html}
        <div style="background:#1a1a1a;padding:20px;text-align:center;border-top:3px solid #D4AF37">
          <p style="color:#D4AF37;font-size:11px;margin:0;letter-spacing:2px;font-family:'Lato',Arial,sans-serif">DIVINE IRIS HEALING</p>
          <p style="color:#666;font-size:10px;margin:4px 0 0;font-family:'Lato',Arial,sans-serif">Delve into the deeper realm of your soul</p>
        </div>
      </div>
    </body>
    </html>
    """

    # Send email
    try:
        from routes.emails import send_email
        result = await send_email(
            to=recipient_email,
            subject="From Divine Iris Healing - Response to your inquiry",
            html=html
        )
        email_sent = result is not None
    except Exception as e:
        print(f"Email send failed: {e}")
        email_sent = False

    # Update status
    update_data = {
        "status": "replied",
        "replied": True,
        "reply": data.message,
        "replied_at": datetime.now(timezone.utc).isoformat(),
    }
    await db[db_coll].update_one({"id": item_id}, {"$set": update_data})

    # If workshop updates opted in, add to newsletter
    if data.include_workshop_updates and recipient_email:
        existing = await db.subscribers.find_one({"email": recipient_email})
        if not existing:
            await db.subscribers.insert_one({
                "id": str(uuid.uuid4()),
                "email": recipient_email,
                "name": recipient_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "source": "inbox_reply",
            })

    return {"message": "Reply sent", "email_sent": email_sent}


# ========== COUNTS ==========

@router.get("/counts")
async def get_inbox_counts():
    contacts_new = await db.quote_requests.count_documents({"status": "new"})
    contacts_total = await db.quote_requests.count_documents({})
    interests_total = await db.notify_me.count_documents({})
    questions_new = await db.session_questions.count_documents({"replied": False})
    questions_total = await db.session_questions.count_documents({})
    return {
        "contacts_new": contacts_new,
        "contacts_total": contacts_total,
        "interests_total": interests_total,
        "questions_new": questions_new,
        "questions_total": questions_total,
        "total_new": contacts_new + questions_new,
    }


# ========== DOWNLOAD ALL CLIENT DATA ==========

@router.get("/download")
async def download_all_client_data():
    import csv
    import io
    from fastapi.responses import StreamingResponse

    contacts = await db.quote_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    interests = await db.notify_me.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    questions = await db.session_questions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Type", "Status", "Name", "Email", "Phone",
        "Program/Session", "Message/Question", "Reply",
        "Submitted Date", "Replied Date", "Remarks"
    ])

    # Contact submissions
    for c in contacts:
        status = c.get("status", "new")
        remarks = f"Inquiry: {c.get('question_about', '')} > {c.get('specific_selection', '')}" if c.get("question_about") else ""
        writer.writerow([
            "Contact Form", status.upper(), c.get("name", ""), c.get("email", ""),
            c.get("phone", ""), c.get("specific_selection", ""),
            c.get("message", ""), c.get("reply", ""),
            c.get("created_at", ""), c.get("replied_at", ""), remarks
        ])

    # Express your interest
    for i in interests:
        status = i.get("status", "new")
        writer.writerow([
            "Express Interest", status.upper(), i.get("name", ""), i.get("email", ""),
            "", i.get("program_title", ""),
            "", "",
            i.get("created_at", ""), "", f"Program ID: {i.get('program_id', '')}"
        ])

    # Questions
    for q in questions:
        status = "REPLIED" if q.get("replied") else "NEW"
        writer.writerow([
            "Question", status, q.get("name", ""), q.get("email", ""),
            "", q.get("session_title", ""),
            q.get("question", ""), q.get("reply", ""),
            q.get("created_at", ""), q.get("replied_at", ""),
            f"Session: {q.get('session_title', '')}"
        ])

    output.seek(0)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"divine_iris_client_data_{timestamp}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
