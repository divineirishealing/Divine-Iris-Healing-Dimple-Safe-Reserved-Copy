from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid

# Re-using previous models and extending

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    place_of_birth: Optional[str] = None
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    qualification: Optional[str] = None
    profession: Optional[str] = None
    phone: Optional[str] = None

class EmiPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    program_title: str
    total_amount: float
    currency: str
    total_installments: int
    installments: List[Dict] = []  # [{date, amount, status, proof_url}]
    active: bool = True

class ClientPackage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    program_name: str  # e.g. "Annual Mentorship"
    total_sessions: int = 0
    used_sessions: int = 0
    start_date: str = ""
    end_date: str = ""
    next_session_date: Optional[str] = None
    status: str = "Active"

class JourneyLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    date: str
    title: str  # e.g. "Month 1: Awakening" or "Session 3"
    category: str = "General"  # Health, Wealth, Relationship, etc.
    experience: str
    learning: str
    rating: int = 0  # 1-10
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BulkClientUploadItem(BaseModel):
    name: str
    email: EmailStr
    tier: str = "Dew"
    phone: Optional[str] = ""
    city: Optional[str] = ""
    program_enrolled: Optional[str] = ""
    payment_status: Optional[str] = ""
    emi_plan: Optional[str] = ""  # "3 Months", "6 Months"
    notes: Optional[str] = ""
