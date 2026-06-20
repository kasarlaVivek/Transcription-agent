"""
Authentication module — JWT-based user auth with registration and login.
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
import jwt

from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS
from app.database import create_user, get_user_by_email, get_user_by_id

# ── Password hashing ─────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Request / Response schemas ────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    plan: str
    meetings_used: int
    created_at: str


# ── JWT utilities ─────────────────────────────────────────────────

def _create_token(user_id: str) -> str:
    """Generate a JWT access token for a user."""
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")


def _user_to_profile(user: dict) -> dict:
    """Strip sensitive fields from user dict for API responses."""
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "plan": user["plan"],
        "meetings_used": user["meetings_used"],
        "created_at": user["created_at"],
    }


# ── Dependency: get current user from JWT ─────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency that extracts and validates the JWT from the
    Authorization header, then returns the full user dict.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")

    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found.")

    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict | None:
    """
    Like get_current_user, but returns None instead of raising
    if no token is provided. Useful for endpoints that work for
    both authenticated and anonymous users.
    """
    if credentials is None:
        return None

    try:
        payload = _decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id:
            return get_user_by_id(user_id)
    except HTTPException:
        pass
    return None


# ── Routes ────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    """Register a new user account."""

    # Check if email already exists
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    # Hash password and create user
    password_hash = pwd_context.hash(req.password)
    user = create_user(
        email=req.email,
        password_hash=password_hash,
        name=req.name,
    )

    token = _create_token(user["id"])
    return AuthResponse(token=token, user=_user_to_profile(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """Log in with email and password."""

    user = get_user_by_email(req.email)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = _create_token(user["id"])
    return AuthResponse(token=token, user=_user_to_profile(user))


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return _user_to_profile(user)
