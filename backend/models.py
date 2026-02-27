from sqlalchemy import Column, String, Float, DateTime, Text, JSON, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Stripe billing
    stripe_customer_id = Column(String, nullable=True)
    plan = Column(String, default="free")          # "free" | "pro"
    plan_expires_at = Column(DateTime, nullable=True)
    # Free tier usage tracking (reset monthly)
    uploads_this_month = Column(Integer, default=0)
    questions_this_month = Column(Integer, default=0)
    usage_reset_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="user", uselist=False)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String, default="Demo Patient")
    age = Column(Integer, nullable=True)
    sex = Column(String, nullable=True)
    medical_conditions = Column(JSON, default=list)
    medications = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="patient")
    reports = relationship("LabReport", back_populates="patient")
    sessions = relationship("DiagnosticSession", back_populates="patient")
    alerts = relationship("Alert", back_populates="patient")


class LabReport(Base):
    __tablename__ = "lab_reports"
    id = Column(String, primary_key=True, default=gen_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    filename = Column(String)
    report_date = Column(DateTime, nullable=True)
    lab_name = Column(String, nullable=True)
    raw_text = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    overall_status = Column(String, default="normal")
    drug_interactions = Column(Text, nullable=True)   # JSON list of interaction warnings
    action_plan = Column(Text, nullable=True)          # JSON list of action plan items
    referral_letter = Column(Text, nullable=True)      # Cached referral letter text
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="reports")
    lab_values = relationship("LabValue", back_populates="report")
    share_tokens = relationship("ShareToken", back_populates="report")


class LabValue(Base):
    __tablename__ = "lab_values"
    id = Column(String, primary_key=True, default=gen_uuid)
    report_id = Column(String, ForeignKey("lab_reports.id"), nullable=False)
    test_name = Column(String, nullable=False)
    value = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    reference_low = Column(Float, nullable=True)
    reference_high = Column(Float, nullable=True)
    status = Column(String, default="normal")
    interpretation = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    report_date = Column(DateTime, nullable=True)

    report = relationship("LabReport", back_populates="lab_values")


class DiagnosticSession(Base):
    __tablename__ = "diagnostic_sessions"
    id = Column(String, primary_key=True, default=gen_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    symptoms = Column(JSON, default=list)
    ai_analysis = Column(Text, nullable=True)
    possible_conditions = Column(JSON, default=list)
    recommendations = Column(JSON, default=list)
    urgency_level = Column(String, default="routine")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="sessions")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, default=gen_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    report_id = Column(String, ForeignKey("lab_reports.id"), nullable=True)
    test_name = Column(String, nullable=False)
    value = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    status = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="alerts")


class ShareToken(Base):
    __tablename__ = "share_tokens"
    id = Column(String, primary_key=True, default=gen_uuid)
    token = Column(String, unique=True, nullable=False, index=True)
    report_id = Column(String, ForeignKey("lab_reports.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    report = relationship("LabReport", back_populates="share_tokens")
