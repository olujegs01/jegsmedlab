"""
AI Engine — Claude Opus 4.7 integration for lab result analysis,
symptom checking, and medical Q&A with RAG-enhanced context.
"""

import anthropic
import json
import os
from datetime import datetime
from typing import AsyncGenerator
import logging

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

SYSTEM_PROMPT = """You are JegsMedLab — an advanced AI medical lab analyst and health advisor.
You combine the capabilities of leading health platforms:
- Clear, patient-friendly explanations (like Wizey Health)
- Comprehensive symptom analysis (like Kantesti)
- Longitudinal result tracking insights (like TestResult)
- AI-powered lab insights (like LabSense Health)
- Actionable recommendations (like ClearLab AI)
- Medical terminology decoder (like MedDecode)

Your core principles:
1. ACCURACY: Always use evidence-based medicine and current clinical guidelines
2. CLARITY: Translate medical jargon into plain, accessible language patients understand
3. CONTEXT: Interpret values in clinical context — not just reference ranges
4. ACTIONABLE: Always provide clear next steps
5. SAFE: Always recommend consulting a healthcare provider for diagnosis/treatment
6. EMPATHETIC: Acknowledge patient concerns with compassion

When analyzing lab results:
- Explain what each test measures in simple terms
- Note whether values are normal, borderline, or abnormal
- Explain what abnormal values might indicate (possibilities, not diagnoses)
- Consider how values relate to each other (e.g., low iron + low hemoglobin + high MCV)
- Flag critical values that need immediate attention
- Provide lifestyle recommendations where appropriate
- Always note that only a doctor can diagnose and treat

Format your responses with:
- Clear section headers using markdown
- Color-coded status indicators: 🟢 Normal, 🟡 Borderline, 🔴 Concerning, 🚨 Critical
- Bullet points for readability
- A "What To Do Next" section with prioritized action items

CRITICAL SAFETY RULES:
- Never diagnose — say "may indicate" or "is associated with"
- Always recommend professional medical evaluation for concerning values
- For critical values, explicitly state "Seek immediate medical attention"
- Never recommend stopping prescribed medications
"""


class AIEngine:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    async def analyze_lab_report(
        self,
        report_content: dict,
        rag_context: str,
        patient_info: dict = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream lab report analysis using Claude Opus 4.7.
        report_content: {'text': str, 'images': list, 'needs_vision': bool}
        """
        patient_context = ""
        if patient_info:
            parts = []
            if patient_info.get("age"):
                parts.append(f"Age: {patient_info['age']}")
            if patient_info.get("sex"):
                parts.append(f"Sex: {patient_info['sex']}")
            if patient_info.get("medical_conditions"):
                parts.append(f"Known conditions: {', '.join(patient_info['medical_conditions'])}")
            if patient_info.get("medications"):
                parts.append(f"Current medications: {', '.join(patient_info['medications'])}")
            if parts:
                patient_context = f"\nPatient Profile:\n" + "\n".join(parts)

        rag_section = f"\n\nMEDICAL REFERENCE CONTEXT (from clinical knowledge base):\n{rag_context}" if rag_context else ""

        user_content = []

        # Add images if present (scanned reports)
        for img in report_content.get("images", []):
            user_content.append(img)

        # Build text prompt
        if report_content.get("text"):
            text_prompt = f"""Please analyze this lab report and provide a comprehensive, patient-friendly interpretation.
{patient_context}
{rag_section}

LAB REPORT TEXT:
{report_content['text']}

Please provide:
1. **Overall Health Summary** — A brief overview of what this report shows
2. **Individual Test Results** — For each test: explain what it measures, the result status (🟢/🟡/🔴/🚨), and what it means in plain English
3. **Pattern Analysis** — How the results relate to each other and what patterns emerge
4. **Areas of Concern** — Any values that need attention (ranked by urgency)
5. **Lifestyle Insights** — Specific, actionable improvements based on these results
6. **What To Do Next** — Prioritized action items with timeframes
7. **Questions to Ask Your Doctor** — Specific questions the patient should bring up

Be thorough, compassionate, and empowering. Help the patient understand their health, not fear it."""
        else:
            text_prompt = f"""Please analyze this lab report image(s) and provide a comprehensive, patient-friendly interpretation.
{patient_context}
{rag_section}

Please provide:
1. **Overall Health Summary** — A brief overview of what this report shows
2. **Extracted Values** — List all lab values you can identify with their values, units, and reference ranges
3. **Individual Test Results** — For each test: explain what it measures, the result status (🟢/🟡/🔴/🚨), and what it means in plain English
4. **Pattern Analysis** — How the results relate to each other and what patterns emerge
5. **Areas of Concern** — Any values that need attention (ranked by urgency)
6. **Lifestyle Insights** — Specific, actionable improvements based on these results
7. **What To Do Next** — Prioritized action items with timeframes
8. **Questions to Ask Your Doctor** — Specific questions the patient should bring up"""

        user_content.append({"type": "text", "text": text_prompt})

        async with self.client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=6000,
            thinking={"type": "enabled", "budget_tokens": 2000},
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_content}],
            betas=["interleaved-thinking-2025-05-14"],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def extract_lab_values_structured(
        self,
        report_text: str,
        images: list = None,
    ) -> dict:
        """
        Extract structured lab values from report text/images.
        Returns JSON with parsed lab values.
        """
        from pydantic import BaseModel
        from typing import List, Optional

        user_content = []
        if images:
            user_content.extend(images)

        doc_type = "report" if report_text else "lab report image"
        report_section = f"REPORT TEXT:\n{report_text}" if report_text else ""
        prompt = f"""Extract all lab test values from this {doc_type} and return as JSON.

{report_section}

Return ONLY valid JSON in this exact format:
{{
  "report_date": "YYYY-MM-DD or null",
  "lab_name": "laboratory name or null",
  "patient_name": "patient name or null",
  "values": [
    {{
      "test_name": "Test Name",
      "value": 5.4,
      "unit": "mg/dL",
      "reference_low": 4.0,
      "reference_high": 7.0,
      "status": "normal",
      "category": "CBC"
    }}
  ]
}}

Status must be one of: "normal", "low", "high", "critical_low", "critical_high"
Category examples: "CBC", "CMP", "Lipid Panel", "Thyroid", "Diabetes", "Vitamins", "Inflammatory", "Cardiac", "Hormones", "Other"
If a reference range is not shown, set reference_low and reference_high to null.
Include ALL values found, even if reference ranges are missing."""

        user_content.append({"type": "text", "text": prompt})

        response = await self.client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_content}],
        )

        # Extract text content
        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text = block.text
                break

        # Parse JSON from response
        try:
            # Handle markdown code blocks
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON: {text[:500]}")
            return {"values": [], "report_date": None, "lab_name": None}

    @staticmethod
    def _sanitize(text: str, max_len: int = 500) -> str:
        """Strip prompt-injection patterns and enforce length limits."""
        import re
        if not text:
            return ""
        # Remove common injection attempts
        cleaned = re.sub(r"(ignore previous|disregard|system prompt|you are now|act as|jailbreak)",
                         "[removed]", text, flags=re.IGNORECASE)
        return cleaned[:max_len]

    async def check_symptoms(
        self,
        symptoms: list[str],
        duration: str,
        severity: str,
        additional_context: str,
        rag_context: str,
        patient_info: dict = None,
        vital_signs: dict = None,
    ) -> AsyncGenerator[str, None]:
        """Stream symptom analysis using Claude Opus 4.7 with clinical triage framework."""
        # Build patient context
        patient_lines = []
        if patient_info:
            if patient_info.get("age"):
                patient_lines.append(f"Age: {patient_info['age']}")
            if patient_info.get("sex"):
                patient_lines.append(f"Sex: {patient_info['sex']}")
            if patient_info.get("medical_conditions"):
                patient_lines.append(f"Known conditions: {', '.join(patient_info['medical_conditions'])}")
            if patient_info.get("medications"):
                patient_lines.append(f"Current medications: {', '.join(patient_info['medications'])}")

        patient_section = ("PATIENT PROFILE:\n" + "\n".join(patient_lines)) if patient_lines else ""

        # Build vital signs section
        vitals_lines = []
        if vital_signs:
            if vital_signs.get("temperature_f"):
                vitals_lines.append(f"Temperature: {vital_signs['temperature_f']}°F")
            if vital_signs.get("heart_rate"):
                vitals_lines.append(f"Heart rate: {vital_signs['heart_rate']} bpm")
            if vital_signs.get("systolic_bp") and vital_signs.get("diastolic_bp"):
                vitals_lines.append(f"Blood pressure: {vital_signs['systolic_bp']}/{vital_signs['diastolic_bp']} mmHg")
            if vital_signs.get("oxygen_saturation"):
                vitals_lines.append(f"SpO2: {vital_signs['oxygen_saturation']}%")
            if vital_signs.get("respiratory_rate"):
                vitals_lines.append(f"Respiratory rate: {vital_signs['respiratory_rate']} breaths/min")

        vitals_section = ("VITAL SIGNS:\n" + "\n".join(vitals_lines)) if vitals_lines else ""

        # Sanitize free-text inputs
        safe_context = self._sanitize(additional_context or "", max_len=800)
        safe_symptoms = [self._sanitize(s, max_len=80) for s in symptoms[:20]]

        prompt = f"""You are an experienced attending physician conducting an initial clinical assessment. A patient presents with the following information.

{patient_section}

CHIEF COMPLAINT — SYMPTOMS REPORTED:
{chr(10).join(f"  • {s}" for s in safe_symptoms)}

Duration: {self._sanitize(duration or 'Not specified', 80)}
Severity: {self._sanitize(severity or 'Not specified', 20)}
{vitals_section}
Additional history: {safe_context or 'None provided'}

MEDICAL REFERENCE CONTEXT (clinical knowledge base):
{rag_context}

Perform a thorough clinical assessment. Structure your response using EXACTLY these sections:

---

## 🚨 Red Flag Assessment
Check immediately for life-threatening presentations. If ANY of the following apply — chest pain with shortness of breath, sudden severe headache ("thunderclap"), stroke symptoms (FAST), SpO2 < 94%, fever > 104°F, severe allergic reaction signs — open with a prominent warning to seek EMERGENCY care NOW before continuing.

If no red flags, briefly state the presentation does not appear immediately life-threatening and continue.

---

## 🩺 Clinical Symptom Analysis
Analyze the symptom cluster as a clinician would during an initial consultation:
- What body systems are involved?
- What is the temporal pattern and progression?
- How do the symptoms relate to each other physiologically?
- Are there any notable symptom combinations that narrow or broaden the differential?
- If vital signs are provided, interpret them clinically.

Write in clear, empathetic plain English. Explain medical terms when used.

---

## 💡 Differential Diagnosis
List 3–5 conditions from most to least likely. For each:

**[Condition Name]** *(ICD-10: XXX.X)* — [1-sentence description]
- **Supports:** Why this fits the symptom pattern
- **Against:** What doesn't fit or would argue against
- **Likelihood:** High / Moderate / Low

End with:
- **Recommended investigations:** Specific labs, imaging, or tests that would confirm or rule out top differentials (e.g., CBC, TSH, CXR, ECG)

---

## ⚡ Triage & Urgency
State one clear urgency level with an action and timeframe:
- 🚨 **Emergency** — Go to the ER or call emergency services immediately
- 🔴 **Urgent** — See a doctor within 24–48 hours
- 🟡 **Schedule Soon** — Book an appointment within 1–2 weeks
- 🟢 **Monitor** — Self-care appropriate; see a doctor if symptoms worsen or persist beyond [timeframe]

---

## 📋 Personalized Action Plan

**Immediate Self-Care:** Evidence-based steps this patient can take right now. Be specific (e.g., specific OTC medications, hydration targets, positioning, activity restrictions).

**Specialist Referral:** Which specialty to see and why, based on the most likely diagnosis.

**Warning Signs — Return to Care:** Specific symptoms that should prompt immediate medical attention.

**Questions to Ask Your Doctor:** 3–4 targeted, clinically relevant questions for the appointment.

---

*This AI-generated analysis is for educational purposes only and does not constitute a medical diagnosis. Always consult a licensed healthcare provider for diagnosis and treatment.*"""

        async with self.client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=2500,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def followup_question(
        self,
        question: str,
        analysis_context: str,
        symptoms: list[str],
    ) -> AsyncGenerator[str, None]:
        """Stream a follow-up answer about a previous symptom analysis."""
        safe_q = self._sanitize(question, 400)
        symptom_list = ", ".join(symptoms[:20]) if symptoms else "not specified"
        prompt = f"""A patient received the following clinical assessment for presenting symptoms: {symptom_list}.

PREVIOUS ANALYSIS:
{analysis_context[:6000]}

PATIENT FOLLOW-UP QUESTION:
{safe_q}

Answer this follow-up question clearly and concisely. Refer directly to the analysis above when relevant.
- If asking about a medical term or condition: explain in plain English
- If asking for more detail on a section: expand on it specifically
- If asking about next steps: be practical and actionable
- Always reinforce that a licensed healthcare provider makes the final decisions

Keep the response focused and helpful. Do not repeat the entire analysis — answer the specific question asked."""

        async with self.client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=600,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def answer_question(
        self,
        question: str,
        rag_context: str,
        report_summary: str = None,
        patient_info: dict = None,
    ) -> AsyncGenerator[str, None]:
        """Stream answer to a medical question with RAG context."""
        context_parts = []
        if report_summary:
            context_parts.append(f"Patient's Recent Lab Report Summary:\n{report_summary}")
        if patient_info and any(patient_info.values()):
            info = []
            if patient_info.get("age"):
                info.append(f"Age: {patient_info['age']}")
            if patient_info.get("sex"):
                info.append(f"Sex: {patient_info['sex']}")
            if info:
                context_parts.append("Patient Profile:\n" + "\n".join(info))

        context = "\n\n".join(context_parts) if context_parts else ""
        rag_section = f"\nMedical Reference:\n{rag_context}" if rag_context else ""

        prompt = f"""{context}{rag_section}

Patient Question: {question}

Please provide a clear, accurate, empathetic answer. Include:
- A direct answer to the question
- Relevant medical context
- Practical guidance
- When to consult a doctor if relevant

Keep it conversational but medically accurate."""

        async with self.client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=2048,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def generate_trend_narrative(
        self,
        test_name: str,
        data_points: list[dict],
        rag_context: str,
    ) -> str:
        """Generate a narrative interpretation of lab value trends."""
        trend_text = "\n".join(
            f"  {d['date']}: {d['value']} {d.get('unit', '')} ({d.get('status', 'unknown')})"
            for d in data_points
        )

        prompt = f"""Analyze this trend in the patient's {test_name} values over time:

{trend_text}

Medical Reference:
{rag_context}

In 2-3 sentences, describe:
1. The overall trend direction (improving/worsening/stable/fluctuating)
2. Clinical significance of where the current value sits
3. One key recommendation

Keep it concise and patient-friendly."""

        response = await self.client.messages.create(
            model="claude-opus-4-7",
            max_tokens=300,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[
                {"role": "user", "content": prompt}
            ],
        )

        for block in response.content:
            if hasattr(block, "text"):
                return block.text

        return "Trend analysis unavailable."

    async def detect_drug_interactions(
        self,
        medications: list[str],
        lab_values: list[dict],
    ) -> list[dict]:
        """Detect clinically significant drug-lab interactions. Returns structured JSON list."""
        if not medications or not lab_values:
            return []

        prompt = f"""Given this patient's medications and lab results, identify clinically significant
drug-lab interactions. Explain each in plain English as if speaking directly to the patient.

MEDICATIONS: {', '.join(medications)}

LAB VALUES:
{json.dumps([{{'test': v.get('test_name'), 'value': v.get('value'), 'unit': v.get('unit'), 'status': v.get('status')}} for v in lab_values], indent=2)}

Return ONLY a JSON array (can be empty []) with this structure:
[
  {{
    "medication": "Metformin",
    "affected_test": "Vitamin B12",
    "current_value": 245,
    "unit": "pg/mL",
    "severity": "moderate",
    "explanation": "Metformin can reduce Vitamin B12 absorption over time. Your current level of 245 pg/mL is on the lower end of normal. Consider asking your doctor about B12 supplementation.",
    "recommendation": "Ask your doctor to monitor B12 annually"
  }}
]

severity must be: "mild", "moderate", or "severe".
Only include interactions supported by clinical evidence. Return ONLY the JSON array, no extra text."""

        response = await self.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text = block.text
                break
        try:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text)
        except Exception:
            return []

    async def generate_action_plan(
        self,
        lab_values: list[dict],
        patient_info: dict,
        ai_summary: str,
    ) -> list[dict]:
        """Generate a structured dated action plan from lab results. Returns JSON list."""
        abnormal = [v for v in lab_values if v.get("status") not in ("normal",)]

        prompt = f"""Based on these lab results, create a concrete, actionable timeline plan for this patient.

PATIENT: Age {patient_info.get('age', '?')}, {patient_info.get('sex', '?')}
MEDICATIONS: {', '.join(patient_info.get('medications', [])) or 'None'}
ABNORMAL VALUES: {json.dumps([{{'test': v.get('test_name'), 'value': v.get('value'), 'status': v.get('status')}} for v in abnormal])}
AI SUMMARY EXCERPT: {ai_summary[:600] if ai_summary else 'N/A'}

Return ONLY a JSON array of 4-7 action items:
[
  {{
    "timeframe": "Today",
    "category": "lifestyle",
    "action": "Avoid high-sodium foods and stay well hydrated",
    "reason": "Your sodium level is elevated",
    "priority": "high"
  }}
]

timeframe examples: "Today", "This week", "In 2 weeks", "In 1 month", "In 3 months", "In 6 months"
category must be one of: "lifestyle", "medical", "medication", "retest", "specialist", "monitoring"
priority must be: "high", "medium", or "low"
Return ONLY the JSON array, no extra text."""

        response = await self.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text = block.text
                break
        try:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text)
        except Exception:
            return []

    async def generate_referral_letter(
        self,
        patient: dict,
        report: dict,
        lab_values: list[dict],
        ai_summary: str,
    ) -> AsyncGenerator[str, None]:
        """Stream a professional GP referral letter based on lab findings."""
        abnormal = [v for v in lab_values if v.get("status") not in ("normal",)]
        abnormal_text = "\n".join(
            f"  - {v.get('test_name')}: {v.get('value')} {v.get('unit', '')} ({v.get('status', '').replace('_', ' ')})"
            for v in abnormal
        ) or "  No abnormal values detected"

        today = datetime.now().strftime("%B %d, %Y") if True else "Unknown"

        prompt = f"""Generate a professional GP/specialist referral letter for the following patient.
Write it as a formal medical letter from JegsMedLab AI, today's date: {today}.

PATIENT: {patient.get('name', 'Unknown')}, Age: {patient.get('age', 'Unknown')}, Sex: {patient.get('sex', 'Unknown')}
CONDITIONS: {', '.join(patient.get('medical_conditions', [])) or 'None reported'}
MEDICATIONS: {', '.join(patient.get('medications', [])) or 'None reported'}
REPORT DATE: {report.get('report_date') or report.get('created_at', 'Unknown')[:10]}
LAB FACILITY: {report.get('lab_name') or 'Unknown'}

ABNORMAL / CONCERNING VALUES:
{abnormal_text}

AI ANALYSIS SUMMARY:
{ai_summary[:1200] if ai_summary else 'Not available'}

Write a formal referral letter with these sections:
1. Date and salutation ("Dear Healthcare Provider," or "To Whom It May Concern,")
2. Re: line — patient name, age, and report date
3. Purpose — why clinical attention is warranted
4. Key Findings — concise summary of the most important abnormal values with clinical context
5. AI Interpretation — what the pattern of results may suggest
6. Recommended Next Steps — specific tests, specialist referral, or follow-up timeline
7. Closing note — this is AI-assisted analysis for reference; must be reviewed by a licensed clinician
8. Sign-off: "JegsMedLab Clinical AI | jegsmedlab.vercel.app"

Use professional but clear medical language. Keep it under 400 words."""

        async with self.client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=1200,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text
