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

# We will patch this into the existing Client model by extending the schema dynamically in routes if needed
# but better to have it defined. Since Client is a dict in current code (not strict Pydantic everywhere in routes), 
# we can just add fields. But for validation let's define:

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
