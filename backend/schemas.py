from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class PatientProfile(BaseModel):
    name: str = "Demo Patient"
    age: Optional[int] = None
    sex: Optional[str] = None
    medical_conditions: List[str] = []
    medications: List[str] = []


class LabValueOut(BaseModel):
    id: str
    test_name: str
    value: Optional[float]
    unit: Optional[str]
    reference_low: Optional[float]
    reference_high: Optional[float]
    status: str
    interpretation: Optional[str]
    category: Optional[str]
    report_date: Optional[datetime]

    class Config:
        from_attributes = True


class LabReportOut(BaseModel):
    id: str
    filename: Optional[str]
    report_date: Optional[datetime]
    lab_name: Optional[str]
    ai_summary: Optional[str]
    overall_status: str
    created_at: datetime
    lab_values: List[LabValueOut] = []

    class Config:
        from_attributes = True


class SymptomCheckRequest(BaseModel):
    symptoms: List[str]
    duration: Optional[str] = None
    severity: Optional[str] = None   # mild/moderate/severe
    additional_context: Optional[str] = None
    patient_id: str = "demo-patient"


class SymptomCheckResponse(BaseModel):
    analysis: str
    possible_conditions: List[dict]
    recommended_tests: List[str]
    urgency_level: str
    when_to_seek_care: str
    lifestyle_recommendations: List[str]


class AskRequest(BaseModel):
    question: str
    report_id: Optional[str] = None
    patient_id: str = "demo-patient"


class TrendPoint(BaseModel):
    date: datetime
    value: float
    status: str


class TrendData(BaseModel):
    test_name: str
    unit: Optional[str]
    data_points: List[TrendPoint]
    reference_low: Optional[float]
    reference_high: Optional[float]
    trend_direction: str   # improving/worsening/stable
    narrative: str
