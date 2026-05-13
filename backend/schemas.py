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


class VitalSigns(BaseModel):
    temperature_f: Optional[float] = Field(default=None, ge=90.0, le=115.0)
    heart_rate: Optional[int] = Field(default=None, ge=20, le=300)
    systolic_bp: Optional[int] = Field(default=None, ge=50, le=300)
    diastolic_bp: Optional[int] = Field(default=None, ge=20, le=200)
    oxygen_saturation: Optional[int] = Field(default=None, ge=50, le=100)
    respiratory_rate: Optional[int] = Field(default=None, ge=4, le=60)


class SymptomCheckRequest(BaseModel):
    symptoms: List[str] = Field(..., min_length=1, max_length=30)
    duration: Optional[str] = Field(default=None, max_length=100)
    severity: Optional[str] = Field(default=None, pattern="^(mild|moderate|severe)$")
    additional_context: Optional[str] = Field(default=None, max_length=1000)
    patient_id: str = Field(default="demo-patient", max_length=100)
    # Enhanced personalization
    age: Optional[int] = Field(default=None, ge=1, le=120)
    sex: Optional[str] = Field(default=None, pattern="^(male|female|other)$")
    vital_signs: Optional[VitalSigns] = None


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


class FollowupRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    analysis_context: str = Field(default="", max_length=8000)
    symptoms: List[str] = Field(default_factory=list)


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
