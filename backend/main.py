"""
JegsMedLab — FastAPI Backend
Comprehensive AI-powered lab result interpretation platform.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
import logging

from database import engine, Base, get_db
import models
from models import Patient, LabReport, LabValue, DiagnosticSession, Alert, ShareToken, User
from schemas import (
    PatientProfile, LabReportOut, LabValueOut,
    SymptomCheckRequest, AskRequest, TrendData, TrendPoint
)
from ai_engine import AIEngine
from rag_system import RAGSystem
from ocr_parser import LabReportParser
from auth import (
    hash_password, verify_password, create_token,
    get_current_user, get_optional_user, get_patient_id_for_user
)
from cache import (
    get_stats_cache, set_stats_cache,
    get_trends_cache, set_trends_cache,
    get_history_cache, set_history_cache,
    get_alerts_cache, set_alerts_cache,
    invalidate_patient_cache,
)
from scheduler import setup_scheduler, get_last_update_result
from billing import (
    create_checkout_session, create_billing_portal_session,
    handle_webhook, get_subscription_status, is_stripe_configured,
)
from email_service import send_welcome_email, send_critical_alert_email, send_report_ready_email

# ── Setup ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

# Run safe column migrations (adds new columns if they don't exist yet)
def run_migrations():
    import sqlite3
    db_path = os.getenv("DATABASE_URL", "sqlite:///./medlab.db").replace("sqlite:///", "")
    if not db_path.startswith("/"):
        db_path = "./" + db_path.lstrip("./")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        new_columns = [
            ("lab_reports", "drug_interactions", "TEXT"),
            ("lab_reports", "action_plan",       "TEXT"),
            ("lab_reports", "referral_letter",   "TEXT"),
        ]
        for table, column, col_type in new_columns:
            try:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                logger.info(f"Migration: added column {column} to {table}")
            except sqlite3.OperationalError:
                pass  # Column already exists
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Migration warning: {e}")

run_migrations()

app = FastAPI(
    title="JegsMedLab",
    description="AI-Powered Lab Result Interpretation Platform",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ai_engine = AIEngine()
rag_system = RAGSystem()
parser = LabReportParser()

DEMO_PATIENT_ID = "demo-patient"


def get_or_create_demo_patient(db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.id == DEMO_PATIENT_ID).first()
    if not patient:
        patient = Patient(
            id=DEMO_PATIENT_ID,
            name="Demo Patient",
            age=None,
            sex=None,
            medical_conditions=[],
            medications=[],
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
    return patient


def resolve_patient_id(user: User | None, query_patient_id: str, db: Session) -> str:
    """Get effective patient_id: authenticated user's patient, or demo."""
    if user:
        return get_patient_id_for_user(user, db)
    get_or_create_demo_patient(db)
    return query_patient_id or DEMO_PATIENT_ID


def generate_alerts_for_values(
    values: list[dict],
    patient_id: str,
    report_id: str,
    db: Session,
):
    """Create Alert records for any abnormal lab values."""
    ALERT_MESSAGES = {
        "critical_high": lambda t, v, u: (
            f"{t} is critically elevated at {v} {u or ''}. "
            "This requires immediate medical attention."
        ),
        "critical_low": lambda t, v, u: (
            f"{t} is critically low at {v} {u or ''}. "
            "This requires immediate medical attention."
        ),
        "high": lambda t, v, u: (
            f"{t} is above the normal range at {v} {u or ''}. "
            "Please discuss this with your healthcare provider."
        ),
        "low": lambda t, v, u: (
            f"{t} is below the normal range at {v} {u or ''}. "
            "Please discuss this with your healthcare provider."
        ),
    }
    for v in values:
        status = v.get("status", "normal")
        if status in ALERT_MESSAGES:
            msg_fn = ALERT_MESSAGES[status]
            alert = Alert(
                patient_id=patient_id,
                report_id=report_id,
                test_name=v.get("test_name", "Unknown"),
                value=float(v["value"]) if v.get("value") is not None else None,
                unit=v.get("unit"),
                status=status,
                message=msg_fn(
                    v.get("test_name", "Unknown"),
                    v.get("value", ""),
                    v.get("unit", ""),
                ),
            )
            db.add(alert)
    db.commit()

    # Send critical alert email if patient has a linked user with email
    critical_alerts = [v for v in values if "critical" in v.get("status", "")]
    if critical_alerts:
        try:
            patient = db.query(Patient).filter(Patient.id == patient_id).first()
            if patient and patient.user_id:
                user = db.query(User).filter(User.id == patient.user_id).first()
                if user and user.email:
                    alert_data = [{
                        "test_name": v.get("test_name"),
                        "value": v.get("value"),
                        "unit": v.get("unit"),
                        "status": v.get("status"),
                        "message": ALERT_MESSAGES[v["status"]](v.get("test_name", ""), v.get("value", ""), v.get("unit", "")),
                    } for v in critical_alerts if v.get("status") in ALERT_MESSAGES]
                    send_critical_alert_email(user.email, user.full_name or "", alert_data)
        except Exception as e:
            logger.error(f"Failed to send critical alert email: {e}")


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "JegsMedLab", "version": "2.0.0"}


# ── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/auth/register", tags=["Auth"])
async def register(
    email: str,
    password: str,
    full_name: str = "",
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        full_name=full_name or email.split("@")[0],
    )
    db.add(user)
    db.flush()

    patient = Patient(
        user_id=user.id,
        name=full_name or email.split("@")[0],
    )
    db.add(patient)
    db.commit()
    db.refresh(user)
    db.refresh(patient)

    token = create_token(user.id, patient.id)
    # Send welcome email in background (non-blocking)
    try:
        send_welcome_email(user.email, user.full_name or "")
    except Exception:
        pass
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
        "patient_id": patient.id,
    }


@app.post("/auth/login", tags=["Auth"])
async def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.patient:
        patient = Patient(user_id=user.id, name=user.full_name or email.split("@")[0])
        db.add(patient)
        db.commit()
        db.refresh(patient)
        patient_id = patient.id
    else:
        patient_id = user.patient.id

    token = create_token(user.id, patient_id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
        "patient_id": patient_id,
    }


@app.get("/auth/me", tags=["Auth"])
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "patient_id": current_user.patient.id if current_user.patient else None,
    }


# ── Patient Endpoints ────────────────────────────────────────────────────────

@app.get("/api/patient", tags=["Patient"])
async def get_patient(
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    effective_id = resolve_patient_id(user, patient_id, db)
    patient = db.query(Patient).filter(Patient.id == effective_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "sex": patient.sex,
        "medical_conditions": patient.medical_conditions or [],
        "medications": patient.medications or [],
    }


@app.put("/api/patient", tags=["Patient"])
async def update_patient(
    profile: PatientProfile,
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    effective_id = resolve_patient_id(user, patient_id, db)
    patient = db.query(Patient).filter(Patient.id == effective_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.name = profile.name
    patient.age = profile.age
    patient.sex = profile.sex
    patient.medical_conditions = profile.medical_conditions
    patient.medications = profile.medications
    db.commit()
    return {"message": "Profile updated successfully"}


# ── Lab Report Upload & Analysis ─────────────────────────────────────────────

@app.post("/api/upload-lab", tags=["Lab Analysis"])
async def upload_lab_report(
    file: UploadFile = File(...),
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    allowed_types = {
        "application/pdf", "image/jpeg", "image/png", "image/gif",
        "image/webp", "text/plain", "text/csv"
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}."
        )

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    effective_patient_id = resolve_patient_id(user, patient_id, db)

    filepath = await parser.save_upload(content, file.filename)
    report_content = parser.prepare_for_claude(filepath, file.filename)

    patient = db.query(Patient).filter(Patient.id == effective_patient_id).first()
    patient_info = {}
    if patient:
        patient_info = {
            "age": patient.age,
            "sex": patient.sex,
            "medical_conditions": patient.medical_conditions or [],
            "medications": patient.medications or [],
        }

    query = report_content.get("text", "")[:500] or "lab report blood test results"
    rag_context = rag_system.retrieve(query, n_results=8)

    report_id = str(uuid.uuid4())
    report = LabReport(
        id=report_id,
        patient_id=effective_patient_id,
        filename=file.filename,
        raw_text=report_content.get("text", "")[:10000],
        overall_status="pending",
    )
    db.add(report)
    db.commit()

    async def extract_and_store():
        try:
            structured = await ai_engine.extract_lab_values_structured(
                report_text=report_content.get("text", ""),
                images=report_content.get("images", []),
            )

            report_obj = db.query(LabReport).filter(LabReport.id == report_id).first()
            if report_obj:
                if structured.get("report_date"):
                    try:
                        report_obj.report_date = datetime.strptime(
                            structured["report_date"], "%Y-%m-%d"
                        )
                    except Exception:
                        pass
                report_obj.lab_name = structured.get("lab_name")

            statuses = []
            extracted_values = []
            for v in structured.get("values", []):
                val = float(v["value"]) if v.get("value") is not None else None
                lv = LabValue(
                    report_id=report_id,
                    test_name=v.get("test_name", "Unknown"),
                    value=val,
                    unit=v.get("unit"),
                    reference_low=float(v["reference_low"]) if v.get("reference_low") is not None else None,
                    reference_high=float(v["reference_high"]) if v.get("reference_high") is not None else None,
                    status=v.get("status", "normal"),
                    category=v.get("category", "Other"),
                    report_date=report_obj.report_date if report_obj else None,
                )
                db.add(lv)
                statuses.append(v.get("status", "normal"))
                extracted_values.append(v)

            if "critical_high" in statuses or "critical_low" in statuses:
                overall = "critical"
            elif "high" in statuses or "low" in statuses:
                overall = "concerning"
            else:
                overall = "normal"

            if report_obj:
                report_obj.overall_status = overall
            db.commit()

            # Generate alerts for abnormal values
            generate_alerts_for_values(extracted_values, effective_patient_id, report_id, db)

        except Exception as e:
            logger.error(f"Background extraction failed: {e}")

    async def generate():
        summary_buffer = []
        yield f"data: {json.dumps({'type': 'report_id', 'report_id': report_id})}\n\n"

        async for chunk in ai_engine.analyze_lab_report(
            report_content=report_content,
            rag_context=rag_context,
            patient_info=patient_info,
        ):
            summary_buffer.append(chunk)
            yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"

        full_summary = "".join(summary_buffer)
        report_obj = db.query(LabReport).filter(LabReport.id == report_id).first()
        if report_obj:
            report_obj.ai_summary = full_summary[:20000]
            db.commit()

        await extract_and_store()

        # Fetch extracted values for post-processing
        saved_values = db.query(LabValue).filter(LabValue.report_id == report_id).all()
        values_list = [
            {"test_name": v.test_name, "value": v.value, "unit": v.unit, "status": v.status, "category": v.category}
            for v in saved_values
        ]

        # Emit emergency alert if life-threatening values detected
        emergencies = detect_emergency_values(values_list)
        if emergencies:
            yield f"data: {json.dumps({'type': 'emergency', 'values': emergencies})}\n\n"

        # Run drug interactions and action plan in parallel (background AI calls)
        import asyncio
        interactions_result, plan_result = await asyncio.gather(
            ai_engine.detect_drug_interactions(
                medications=patient_info.get("medications", []),
                lab_values=values_list,
            ),
            ai_engine.generate_action_plan(
                lab_values=values_list,
                patient_info=patient_info,
                ai_summary=full_summary[:800],
            ),
            return_exceptions=True,
        )

        report_obj = db.query(LabReport).filter(LabReport.id == report_id).first()
        if report_obj:
            if isinstance(interactions_result, list) and interactions_result:
                report_obj.drug_interactions = json.dumps(interactions_result)
                yield f"data: {json.dumps({'type': 'drug_interactions', 'data': interactions_result})}\n\n"
            if isinstance(plan_result, list) and plan_result:
                report_obj.action_plan = json.dumps(plan_result)
                yield f"data: {json.dumps({'type': 'action_plan', 'data': plan_result})}\n\n"
            db.commit()

        invalidate_patient_cache(effective_patient_id)
        yield f"data: {json.dumps({'type': 'done', 'report_id': report_id})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── History & Reports ────────────────────────────────────────────────────────

@app.get("/api/history", tags=["History"])
async def get_history(
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    effective_id = resolve_patient_id(user, patient_id, db)
    reports = (
        db.query(LabReport)
        .filter(LabReport.patient_id == effective_id)
        .order_by(LabReport.created_at.desc())
        .all()
    )

    result = []
    for r in reports:
        values = db.query(LabValue).filter(LabValue.report_id == r.id).all()
        result.append({
            "id": r.id,
            "filename": r.filename,
            "report_date": r.report_date.isoformat() if r.report_date else None,
            "lab_name": r.lab_name,
            "overall_status": r.overall_status,
            "created_at": r.created_at.isoformat(),
            "value_count": len(values),
            "summary_preview": (r.ai_summary or "")[:200] + "..." if r.ai_summary else None,
        })
    return result


@app.get("/api/report/{report_id}", tags=["History"])
async def get_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    values = db.query(LabValue).filter(LabValue.report_id == report_id).all()

    return {
        "id": report.id,
        "filename": report.filename,
        "report_date": report.report_date.isoformat() if report.report_date else None,
        "lab_name": report.lab_name,
        "ai_summary": report.ai_summary,
        "overall_status": report.overall_status,
        "created_at": report.created_at.isoformat(),
        "lab_values": [
            {
                "id": v.id,
                "test_name": v.test_name,
                "value": v.value,
                "unit": v.unit,
                "reference_low": v.reference_low,
                "reference_high": v.reference_high,
                "status": v.status,
                "category": v.category,
            }
            for v in values
        ],
    }


# ── PDF Export ───────────────────────────────────────────────────────────────

@app.get("/api/report/{report_id}/pdf", tags=["Export"])
async def export_report_pdf(
    report_id: str,
    db: Session = Depends(get_db),
):
    """Generate and download a professional PDF of the lab report."""
    from pdf_generator import generate_report_pdf

    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
    values = db.query(LabValue).filter(LabValue.report_id == report_id).all()

    patient_dict = {
        "name": patient.name if patient else "Unknown",
        "age": patient.age if patient else None,
        "sex": patient.sex if patient else None,
    }
    report_dict = {
        "filename": report.filename,
        "lab_name": report.lab_name,
        "report_date": report.report_date.isoformat() if report.report_date else None,
        "created_at": report.created_at.isoformat(),
        "overall_status": report.overall_status,
        "ai_summary": report.ai_summary,
    }
    values_list = [
        {
            "test_name": v.test_name,
            "value": v.value,
            "unit": v.unit,
            "reference_low": v.reference_low,
            "reference_high": v.reference_high,
            "status": v.status,
            "category": v.category,
        }
        for v in values
    ]

    pdf_bytes = generate_report_pdf(report_dict, values_list, patient_dict)
    safe_name = (report.filename or "report").replace(" ", "_").replace(".pdf", "")
    filename = f"JegsMedLab_{safe_name}_{report_id[:8]}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Share Tokens ─────────────────────────────────────────────────────────────

@app.post("/api/report/{report_id}/share", tags=["Share"])
async def create_share_link(
    report_id: str,
    db: Session = Depends(get_db),
):
    """Generate a shareable token for a report."""
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    from datetime import timedelta
    # Check if a valid (non-expired) share token already exists for this report
    existing = db.query(ShareToken).filter(ShareToken.report_id == report_id).first()
    if existing:
        if existing.expires_at and existing.expires_at < datetime.utcnow():
            db.delete(existing)
            db.commit()
        else:
            return {
                "token": existing.token,
                "share_url": f"/shared/{existing.token}",
                "expires_at": existing.expires_at.isoformat() if existing.expires_at else None,
            }

    token = str(uuid.uuid4()).replace("-", "")
    share = ShareToken(
        token=token,
        report_id=report_id,
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db.add(share)
    db.commit()

    return {"token": token, "share_url": f"/shared/{token}", "expires_at": share.expires_at.isoformat()}


@app.get("/api/shared/{token}", tags=["Share"])
async def get_shared_report(token: str, db: Session = Depends(get_db)):
    """View a publicly shared report via token."""
    share = db.query(ShareToken).filter(ShareToken.token == token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    if share.expires_at and share.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This share link has expired")

    report = db.query(LabReport).filter(LabReport.id == share.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    values = db.query(LabValue).filter(LabValue.report_id == report.id).all()

    return {
        "id": report.id,
        "filename": report.filename,
        "report_date": report.report_date.isoformat() if report.report_date else None,
        "lab_name": report.lab_name,
        "ai_summary": report.ai_summary,
        "overall_status": report.overall_status,
        "created_at": report.created_at.isoformat(),
        "lab_values": [
            {
                "id": v.id,
                "test_name": v.test_name,
                "value": v.value,
                "unit": v.unit,
                "reference_low": v.reference_low,
                "reference_high": v.reference_high,
                "status": v.status,
                "category": v.category,
            }
            for v in values
        ],
    }


# ── Alerts ────────────────────────────────────────────────────────────────────

@app.get("/api/alerts", tags=["Alerts"])
async def get_alerts(
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    unread_only: bool = Query(default=False),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    effective_id = resolve_patient_id(user, patient_id, db)
    query = db.query(Alert).filter(Alert.patient_id == effective_id)
    if unread_only:
        query = query.filter(Alert.is_read == False)
    alerts = query.order_by(Alert.created_at.desc()).limit(50).all()

    return [
        {
            "id": a.id,
            "report_id": a.report_id,
            "test_name": a.test_name,
            "value": a.value,
            "unit": a.unit,
            "status": a.status,
            "message": a.message,
            "is_read": a.is_read,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


@app.put("/api/alerts/{alert_id}/read", tags=["Alerts"])
async def mark_alert_read(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"message": "Alert marked as read"}


@app.put("/api/alerts/read-all", tags=["Alerts"])
async def mark_all_alerts_read(
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    effective_id = resolve_patient_id(user, patient_id, db)
    db.query(Alert).filter(
        Alert.patient_id == effective_id,
        Alert.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All alerts marked as read"}


# ── Trends ──────────────────────────────────────────────────────────────────

@app.get("/api/trends", tags=["Trends"])
async def get_trends(
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    effective_id = resolve_patient_id(user, patient_id, db)
    report_ids = [
        r.id for r in db.query(LabReport.id).filter(LabReport.patient_id == effective_id).all()
    ]
    if not report_ids:
        return []

    all_values = (
        db.query(LabValue)
        .filter(
            LabValue.report_id.in_(report_ids),
            LabValue.value.isnot(None),
        )
        .join(LabReport, LabValue.report_id == LabReport.id)
        .order_by(LabReport.created_at)
        .all()
    )

    from collections import defaultdict
    groups = defaultdict(list)
    for v in all_values:
        report = db.query(LabReport).filter(LabReport.id == v.report_id).first()
        date = report.report_date or report.created_at if report else datetime.utcnow()
        groups[v.test_name].append({
            "date": date.isoformat(),
            "value": v.value,
            "status": v.status,
            "unit": v.unit,
            "reference_low": v.reference_low,
            "reference_high": v.reference_high,
            "category": v.category,
        })

    trends = []
    for test_name, points in groups.items():
        direction = "stable"
        if len(points) >= 2:
            first_val = points[0]["value"]
            last_val = points[-1]["value"]
            ref_low = points[-1].get("reference_low")
            ref_high = points[-1].get("reference_high")
            change = last_val - first_val

            if abs(change) > 0.05 * abs(first_val or 1):
                if ref_low is not None and ref_high is not None:
                    mid = (ref_low + ref_high) / 2
                    if change > 0:
                        direction = "improving" if last_val <= mid else "worsening"
                    else:
                        direction = "improving" if last_val >= mid else "worsening"
                else:
                    direction = "increasing" if change > 0 else "decreasing"

        trends.append({
            "test_name": test_name,
            "unit": points[-1].get("unit"),
            "data_points": points,
            "reference_low": points[-1].get("reference_low"),
            "reference_high": points[-1].get("reference_high"),
            "trend_direction": direction,
            "current_status": points[-1]["status"],
            "category": points[-1].get("category", "Other"),
        })

    return trends


# ── Symptom Checker ──────────────────────────────────────────────────────────

@app.post("/api/symptom-check", tags=["Symptom Analysis"])
async def check_symptoms(request: SymptomCheckRequest, db: Session = Depends(get_db)):
    if not request.symptoms:
        raise HTTPException(status_code=400, detail="Please provide at least one symptom")

    patient = db.query(Patient).filter(Patient.id == request.patient_id).first()
    patient_info = {}
    if patient:
        patient_info = {
            "age": patient.age,
            "sex": patient.sex,
            "medical_conditions": patient.medical_conditions or [],
            "medications": patient.medications or [],
        }

    rag_context = rag_system.retrieve_for_symptoms(request.symptoms)

    async def generate():
        analysis_buffer = []
        session_id = str(uuid.uuid4())

        async for chunk in ai_engine.check_symptoms(
            symptoms=request.symptoms,
            duration=request.duration,
            severity=request.severity,
            additional_context=request.additional_context,
            rag_context=rag_context,
            patient_info=patient_info,
        ):
            analysis_buffer.append(chunk)
            yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"

        session = DiagnosticSession(
            id=session_id,
            patient_id=request.patient_id,
            symptoms=request.symptoms,
            ai_analysis="".join(analysis_buffer)[:10000],
        )
        db.add(session)
        db.commit()

        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Q&A / Ask AI ────────────────────────────────────────────────────────────

@app.post("/api/ask", tags=["Q&A"])
async def ask_question(request: AskRequest, db: Session = Depends(get_db)):
    rag_context = rag_system.retrieve(request.question, n_results=5)

    report_summary = None
    if request.report_id:
        report = db.query(LabReport).filter(LabReport.id == request.report_id).first()
        if report and report.ai_summary:
            report_summary = report.ai_summary[:3000]

    patient = db.query(Patient).filter(Patient.id == request.patient_id).first()
    patient_info = {}
    if patient:
        patient_info = {"age": patient.age, "sex": patient.sex}

    async def generate():
        async for chunk in ai_engine.answer_question(
            question=request.question,
            rag_context=rag_context,
            report_summary=report_summary,
            patient_info=patient_info,
        ):
            yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Dashboard Stats ──────────────────────────────────────────────────────────

@app.get("/api/dashboard-stats", tags=["Dashboard"])
async def get_dashboard_stats(
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    effective_id = resolve_patient_id(user, patient_id, db)
    cached = get_stats_cache(effective_id)
    if cached:
        return cached

    report_ids = [
        r.id for r in db.query(LabReport.id).filter(LabReport.patient_id == effective_id).all()
    ]

    total_reports = len(report_ids)
    unread_alerts = db.query(Alert).filter(
        Alert.patient_id == effective_id,
        Alert.is_read == False,
    ).count()

    if not report_ids:
        return {
            "total_reports": 0,
            "total_values": 0,
            "critical_count": 0,
            "concerning_count": 0,
            "normal_count": 0,
            "last_report_date": None,
            "overall_health_score": None,
            "unread_alerts": unread_alerts,
        }

    all_values = db.query(LabValue).filter(LabValue.report_id.in_(report_ids)).all()

    critical = sum(1 for v in all_values if "critical" in v.status)
    concerning = sum(1 for v in all_values if v.status in ("high", "low"))
    normal = sum(1 for v in all_values if v.status == "normal")

    last_report = (
        db.query(LabReport)
        .filter(LabReport.patient_id == effective_id)
        .order_by(LabReport.created_at.desc())
        .first()
    )

    total = len(all_values) or 1
    health_score = int((normal / total) * 100) if all_values else None

    # Compute per-system health scores
    SYSTEM_CATEGORY_MAP = {
        "Cardiovascular": ["Cardiac", "Lipid Panel", "BNP", "Troponin"],
        "Metabolic":      ["CMP", "Diabetes", "HbA1c", "Glucose"],
        "Kidney":         ["Kidney", "Creatinine", "BUN", "eGFR"],
        "Liver":          ["Liver", "LFT", "Hepatic", "ALT", "AST"],
        "Blood / CBC":    ["CBC"],
        "Thyroid":        ["Thyroid", "Hormones", "TSH"],
    }
    system_scores = {}
    for system, categories in SYSTEM_CATEGORY_MAP.items():
        matched = [
            v for v in all_values
            if any(
                cat.lower() in (v.category or "").lower() or cat.lower() in v.test_name.lower()
                for cat in categories
            )
        ]
        if not matched:
            system_scores[system] = None
        else:
            n = sum(1 for v in matched if v.status == "normal")
            system_scores[system] = int((n / len(matched)) * 100)

    result = {
        "total_reports": total_reports,
        "total_values": len(all_values),
        "critical_count": critical,
        "concerning_count": concerning,
        "normal_count": normal,
        "last_report_date": last_report.created_at.isoformat() if last_report else None,
        "overall_health_score": health_score,
        "unread_alerts": unread_alerts,
        "system_scores": system_scores,
    }
    set_stats_cache(effective_id, result)
    return result


# ── Emergency Detection ───────────────────────────────────────────────────────

EMERGENCY_THRESHOLDS = {
    "troponin":      {"critical_high": 0.04},
    "potassium":     {"critical_high": 6.0,   "critical_low": 2.5},
    "sodium":        {"critical_high": 160,    "critical_low": 120},
    "glucose":       {"critical_high": 500,    "critical_low": 40},
    "hemoglobin":    {"critical_low": 7.0},
    "platelet":      {"critical_low": 20000},
    "creatinine":    {"critical_high": 10.0},
    "inr":           {"critical_high": 5.0},
    "ammonia":       {"critical_high": 150},
    "calcium":       {"critical_high": 13.0,  "critical_low": 6.5},
    "lactate":       {"critical_high": 4.0},
    "bnp":           {"critical_high": 900},
    "ph":            {"critical_high": 7.6,   "critical_low": 7.2},
}


def detect_emergency_values(values: list[dict]) -> list[dict]:
    """Return values that exceed life-threatening emergency thresholds."""
    emergencies = []
    for v in values:
        name = (v.get("test_name") or "").lower()
        val = v.get("value")
        if val is None:
            continue
        for key, thresholds in EMERGENCY_THRESHOLDS.items():
            if key not in name:
                continue
            if "critical_high" in thresholds and val >= thresholds["critical_high"]:
                emergencies.append({
                    **v,
                    "emergency_reason": f"{v.get('test_name')} is critically elevated — seek emergency care immediately",
                })
                break
            if "critical_low" in thresholds and val <= thresholds["critical_low"]:
                emergencies.append({
                    **v,
                    "emergency_reason": f"{v.get('test_name')} is critically low — seek emergency care immediately",
                })
                break
    return emergencies


# ── Value Deltas (vs. previous report) ────────────────────────────────────────

@app.get("/api/report/{report_id}/deltas", tags=["History"])
async def get_report_deltas(report_id: str, db: Session = Depends(get_db)):
    """For each lab value in a report, return % delta vs. the same test in the previous report."""
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    current_values = db.query(LabValue).filter(LabValue.report_id == report_id).all()

    prev_report = (
        db.query(LabReport)
        .filter(
            LabReport.patient_id == report.patient_id,
            LabReport.created_at < report.created_at,
        )
        .order_by(LabReport.created_at.desc())
        .first()
    )
    if not prev_report:
        return {}

    prev_values = db.query(LabValue).filter(LabValue.report_id == prev_report.id).all()
    prev_map = {v.test_name.lower(): v for v in prev_values}

    deltas = {}
    for cv in current_values:
        if cv.value is None:
            continue
        pv = prev_map.get(cv.test_name.lower())
        if pv is None or pv.value is None or pv.value == 0:
            continue
        delta_pct = ((cv.value - pv.value) / abs(pv.value)) * 100
        deltas[cv.test_name] = {
            "delta_pct": round(delta_pct, 1),
            "direction": "up" if delta_pct > 0.5 else "down" if delta_pct < -0.5 else "same",
            "prev_value": pv.value,
            "prev_date": prev_report.report_date.isoformat() if prev_report.report_date else prev_report.created_at.isoformat()[:10],
        }
    return deltas


# ── Drug-Lab Interactions ─────────────────────────────────────────────────────

@app.get("/api/report/{report_id}/interactions", tags=["Lab Analysis"])
async def get_drug_interactions(report_id: str, db: Session = Depends(get_db)):
    """Return stored drug-lab interaction warnings for a report."""
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.drug_interactions:
        return []
    return json.loads(report.drug_interactions)


# ── Action Plan ───────────────────────────────────────────────────────────────

@app.get("/api/report/{report_id}/action-plan", tags=["Lab Analysis"])
async def get_action_plan(report_id: str, db: Session = Depends(get_db)):
    """Return stored action plan for a report."""
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.action_plan:
        return []
    return json.loads(report.action_plan)


# ── Referral Letter ───────────────────────────────────────────────────────────

@app.get("/api/report/{report_id}/referral-letter", tags=["Export"])
async def generate_referral_letter_stream(report_id: str, db: Session = Depends(get_db)):
    """Stream a professional referral letter for a report. Caches the result."""
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
    values = db.query(LabValue).filter(LabValue.report_id == report_id).all()

    patient_dict = {
        "name": patient.name if patient else "Unknown",
        "age": patient.age if patient else None,
        "sex": patient.sex if patient else None,
        "medical_conditions": (patient.medical_conditions or []) if patient else [],
        "medications": (patient.medications or []) if patient else [],
    }
    report_dict = {
        "report_date": report.report_date.isoformat() if report.report_date else None,
        "created_at": report.created_at.isoformat(),
        "lab_name": report.lab_name,
    }
    values_list = [
        {"test_name": v.test_name, "value": v.value, "unit": v.unit, "status": v.status}
        for v in values
    ]

    letter_buffer = []

    async def generate():
        async for chunk in ai_engine.generate_referral_letter(
            patient=patient_dict,
            report=report_dict,
            lab_values=values_list,
            ai_summary=report.ai_summary or "",
        ):
            letter_buffer.append(chunk)
            yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"

        full_letter = "".join(letter_buffer)
        report.referral_letter = full_letter
        db.commit()
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/report/{report_id}/referral-letter/pdf", tags=["Export"])
async def download_referral_letter_pdf(report_id: str, db: Session = Depends(get_db)):
    """Download cached referral letter as PDF (must generate first)."""
    from pdf_generator import generate_letter_pdf
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report or not report.referral_letter:
        raise HTTPException(status_code=404, detail="Generate the referral letter first")
    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
    pdf_bytes = generate_letter_pdf(
        report.referral_letter,
        {"name": patient.name if patient else "Unknown"},
        {"report_date": report.report_date.isoformat()[:10] if report.report_date else "Unknown"},
    )
    filename = f"Referral_Letter_{report_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Symptom History ───────────────────────────────────────────────────────────

@app.get("/api/symptom-history", tags=["Symptom Analysis"])
async def get_symptom_history(
    patient_id: str = Query(default=DEMO_PATIENT_ID),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Return past diagnostic sessions for a patient."""
    effective_id = resolve_patient_id(user, patient_id, db)
    sessions = (
        db.query(DiagnosticSession)
        .filter(DiagnosticSession.patient_id == effective_id)
        .order_by(DiagnosticSession.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": s.id,
            "symptoms": s.symptoms or [],
            "urgency_level": s.urgency_level or "routine",
            "ai_analysis_preview": (s.ai_analysis or "")[:400],
            "ai_analysis": s.ai_analysis or "",
            "created_at": s.created_at.isoformat(),
        }
        for s in sessions
    ]


# ── Startup / Shutdown ────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Start the daily knowledge base update scheduler on server boot."""
    setup_scheduler(rag_system)
    logger.info("JegsMedLab v2.0 started with daily knowledge updater.")


@app.on_event("shutdown")
async def shutdown_event():
    from scheduler import get_scheduler
    sched = get_scheduler()
    if sched and sched.running:
        sched.shutdown(wait=False)


# ── Admin / Knowledge Base ────────────────────────────────────────────────────

@app.post("/api/admin/update-knowledge", tags=["Admin"])
async def trigger_knowledge_update(background_tasks: BackgroundTasks):
    """
    Manually trigger a knowledge base update from all public data sources.
    Runs in the background — returns immediately.
    """
    async def run():
        from data_updater import MedicalDataUpdater
        updater = MedicalDataUpdater(rag_system)
        result = await updater.run_full_update()
        logger.info(f"Manual update complete: {result}")

    background_tasks.add_task(run)
    return {
        "message": "Knowledge base update started in background",
        "sources": ["NIH MedlinePlus (LOINC)", "PubMed/NCBI", "MedlinePlus RSS", "OpenFDA"],
        "note": "Check /api/admin/knowledge-stats after a few minutes for results.",
    }


@app.get("/api/admin/knowledge-stats", tags=["Admin"])
async def get_knowledge_stats():
    """Return current RAG knowledge base statistics."""
    collection_size = rag_system.collection.count()
    last_update = get_last_update_result()

    from scheduler import get_scheduler
    sched = get_scheduler()
    next_run = None
    if sched:
        job = sched.get_job("daily_kb_update")
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()

    return {
        "collection_size": collection_size,
        "scheduler_running": sched.running if sched else False,
        "next_scheduled_update": next_run,
        "last_update": last_update,
    }


# ── Billing / Stripe ─────────────────────────────────────────────────────────

@app.get("/api/billing/status", tags=["Billing"])
async def billing_status(user: User = Depends(get_current_user)):
    """Get current user's plan and usage."""
    from datetime import datetime
    # Reset monthly usage if needed
    now = datetime.utcnow()
    if user.usage_reset_at and (now - user.usage_reset_at).days >= 30:
        user.uploads_this_month = 0
        user.questions_this_month = 0
        user.usage_reset_at = now

    stripe_status = {}
    if user.stripe_customer_id and is_stripe_configured():
        stripe_status = get_subscription_status(user.stripe_customer_id)
        if stripe_status.get("plan") == "pro" and user.plan != "pro":
            user.plan = "pro"

    return {
        "plan": user.plan or "free",
        "uploads_this_month": user.uploads_this_month or 0,
        "questions_this_month": user.questions_this_month or 0,
        "limits": {"uploads_per_month": 3, "questions_per_month": 10} if user.plan == "free" else None,
        "stripe": stripe_status,
    }


@app.post("/api/billing/checkout", tags=["Billing"])
async def create_checkout(user: User = Depends(get_current_user)):
    """Create Stripe Checkout session for Pro upgrade."""
    if not is_stripe_configured():
        raise HTTPException(status_code=503, detail="Billing not configured yet. Add STRIPE_SECRET_KEY to .env")

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    try:
        url = create_checkout_session(
            user_email=user.email,
            user_id=user.id,
            success_url=f"{frontend_url}/app?upgraded=true",
            cancel_url=f"{frontend_url}/app",
        )
        return {"checkout_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/billing/portal", tags=["Billing"])
async def billing_portal(user: User = Depends(get_current_user)):
    """Create Stripe Customer Portal session."""
    if not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found.")

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    try:
        url = create_billing_portal_session(user.stripe_customer_id, f"{frontend_url}/app")
        return {"portal_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/billing/webhook", tags=["Billing"])
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = handle_webhook(payload, sig)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    obj = event["data"]
    event_type = event["type"]

    if event_type == "checkout.session.completed":
        user_id = obj.get("metadata", {}).get("user_id")
        customer_id = obj.get("customer")
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.plan = "pro"
                user.stripe_customer_id = customer_id
                db.commit()
                logger.info(f"User {user_id} upgraded to Pro")

    elif event_type in ("customer.subscription.deleted", "customer.subscription.paused"):
        customer_id = obj.get("customer")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.plan = "free"
            db.commit()
            logger.info(f"User {user.id} downgraded to Free")

    elif event_type == "customer.subscription.updated":
        customer_id = obj.get("customer")
        status = obj.get("status")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.plan = "pro" if status == "active" else "free"
            db.commit()

    return {"received": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
