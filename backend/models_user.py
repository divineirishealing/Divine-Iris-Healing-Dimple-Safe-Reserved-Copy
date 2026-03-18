from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid

# --- USER & AUTH MODELS ---

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    role: str = "student"  # "student", "admin"
    tier: int = 1  # 1=New, 2=Grad, 3=3-Month, 4=Annual
    client_id: Optional[str] = None  # Link to existing CRM client
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    role: str
    tier: int

# --- STUDENT TOOLS MODELS ---

class DiaryEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str  # YYYY-MM-DD
    content: str
    mood: Optional[str] = None
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DiaryEntryCreate(BaseModel):
    date: str
    content: str
    mood: Optional[str] = None
    tags: Optional[List[str]] = []

class ProgressReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    month: str  # YYYY-MM
    metrics: Dict[str, int] = Field(default_factory=dict)  # { "inner_peace": 8, "energy": 6, ... }
    file_url: Optional[str] = None  # Uploaded report URL
    status: str = "submitted"  # "submitted", "reviewed"
    admin_feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProgressReportCreate(BaseModel):
    month: str
    metrics: Dict[str, int]
    file_url: Optional[str] = None

class CommunityPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    author_name: str
    content: str
    image_url: Optional[str] = None
    status: str = "pending"  # "pending", "approved", "rejected"
    likes: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommunityPostCreate(BaseModel):
    content: str
    image_url: Optional[str] = None
