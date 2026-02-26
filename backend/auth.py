"""
JWT authentication utilities for MedLab AI.
"""

import jwt
import bcrypt
import os
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
import models

SECRET_KEY = os.getenv("SECRET_KEY", "medlab-ai-secret-key-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: str, patient_id: str) -> str:
    payload = {
        "sub": user_id,
        "patient_id": patient_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_token(credentials.credentials)
    user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User | None:
    """Returns user if authenticated, None if no token (demo mode)."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        return db.query(models.User).filter(models.User.id == payload["sub"]).first()
    except HTTPException:
        return None


def get_patient_id_for_user(user: models.User | None, db: Session) -> str:
    """Get the patient ID for an authenticated user, or return demo ID."""
    if user is None:
        return "demo-patient"
    if user.patient:
        return user.patient.id
    # Create patient for this user
    patient = models.Patient(
        user_id=user.id,
        name=user.full_name or user.email.split("@")[0],
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient.id
