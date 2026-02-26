"""
PDF report generator using ReportLab.
Generates a professional MedLab AI report PDF from lab data.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import Flowable
from io import BytesIO
from datetime import datetime
import re

STATUS_COLORS = {
    "normal": colors.HexColor("#10b981"),
    "low": colors.HexColor("#f59e0b"),
    "high": colors.HexColor("#f97316"),
    "critical_low": colors.HexColor("#ef4444"),
    "critical_high": colors.HexColor("#ef4444"),
}

STATUS_LABELS = {
    "normal": "Normal",
    "low": "Low",
    "high": "High",
    "critical_low": "Critical Low",
    "critical_high": "Critical High",
}

BRAND_BLUE = colors.HexColor("#1d4ed8")
BRAND_DARK = colors.HexColor("#1e293b")
LIGHT_GRAY = colors.HexColor("#f8fafc")
BORDER_GRAY = colors.HexColor("#e2e8f0")


def clean_markdown(text: str) -> str:
    """Strip markdown for plain text in PDF."""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'#{1,6}\s+', '', text)
    text = re.sub(r'🟢|🟡|🔴|🚨|⚠️', '', text)
    text = re.sub(r'^\s*[-*]\s+', '• ', text, flags=re.MULTILINE)
    return text.strip()


def generate_report_pdf(
    report: dict,
    lab_values: list[dict],
    patient: dict,
) -> bytes:
    """
    Generate a PDF from a MedLab AI report.
    Returns bytes of the PDF.
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Header ──────────────────────────────────────────────────────────────
    header_style = ParagraphStyle(
        "Header",
        parent=styles["Normal"],
        fontSize=22,
        fontName="Helvetica-Bold",
        textColor=BRAND_BLUE,
        spaceAfter=4,
    )
    sub_style = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=2,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9.5,
        leading=14,
        textColor=BRAND_DARK,
        spaceAfter=6,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Normal"],
        fontSize=12,
        fontName="Helvetica-Bold",
        textColor=BRAND_DARK,
        spaceBefore=14,
        spaceAfter=6,
    )
    small_style = ParagraphStyle(
        "Small",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#94a3b8"),
    )

    story.append(Paragraph("MedLab AI", header_style))
    story.append(Paragraph("AI-Powered Lab Result Report", sub_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", small_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND_BLUE, spaceAfter=12))

    # ── Report Info ──────────────────────────────────────────────────────────
    info_data = [
        ["Patient", patient.get("name") or "—",
         "File", report.get("filename") or "—"],
        ["Lab", report.get("lab_name") or "—",
         "Report Date", (report.get("report_date") or report.get("created_at") or "")[:10]],
        ["Overall Status", (report.get("overall_status") or "—").upper(),
         "Total Values", str(len(lab_values))],
    ]

    info_table = Table(info_data, colWidths=[1.1*inch, 2.4*inch, 1.1*inch, 2.4*inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748b")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#64748b")),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_GRAY, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 12))

    # ── Lab Values Table ──────────────────────────────────────────────────────
    if lab_values:
        story.append(Paragraph("Lab Values", section_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY, spaceAfter=8))

        # Group by category
        from collections import defaultdict
        groups = defaultdict(list)
        for v in lab_values:
            groups[v.get("category") or "Other"].append(v)

        for category, values in groups.items():
            cat_style = ParagraphStyle(
                "Cat", parent=styles["Normal"],
                fontSize=9, fontName="Helvetica-Bold",
                textColor=BRAND_BLUE, spaceBefore=10, spaceAfter=4,
            )
            story.append(Paragraph(category.upper(), cat_style))

            tbl_data = [["Test Name", "Value", "Unit", "Reference", "Status"]]
            for v in values:
                ref = "—"
                if v.get("reference_low") is not None and v.get("reference_high") is not None:
                    ref = f"{v['reference_low']} – {v['reference_high']}"
                status_label = STATUS_LABELS.get(v.get("status", "normal"), v.get("status", "—"))
                tbl_data.append([
                    v.get("test_name", "—"),
                    str(v["value"]) if v.get("value") is not None else "—",
                    v.get("unit") or "—",
                    ref,
                    status_label,
                ])

            col_widths = [2.4*inch, 0.8*inch, 0.8*inch, 1.3*inch, 1.0*inch]
            tbl = Table(tbl_data, colWidths=col_widths)

            # Build row styles
            row_styles = [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.25, BORDER_GRAY),
                ("PADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
            ]

            # Color the status column by value
            for i, v in enumerate(values, start=1):
                st = v.get("status", "normal")
                color = STATUS_COLORS.get(st, colors.HexColor("#64748b"))
                row_styles.append(("TEXTCOLOR", (4, i), (4, i), color))
                row_styles.append(("FONTNAME", (4, i), (4, i), "Helvetica-Bold"))

            tbl.setStyle(TableStyle(row_styles))
            story.append(KeepTogether([tbl, Spacer(1, 4)]))

    # ── AI Summary ───────────────────────────────────────────────────────────
    if report.get("ai_summary"):
        story.append(Spacer(1, 8))
        story.append(Paragraph("AI Analysis Summary", section_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY, spaceAfter=8))

        summary_text = clean_markdown(report["ai_summary"])
        # Split into paragraphs
        for para in summary_text.split("\n\n"):
            para = para.strip()
            if para:
                story.append(Paragraph(para, body_style))

    # ── Footer Disclaimer ────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY, spaceAfter=6))
    disclaimer = (
        "⚠ This report is generated by MedLab AI for educational purposes only. "
        "It does not constitute medical advice, diagnosis, or treatment. "
        "Always consult a qualified healthcare provider for medical decisions."
    )
    story.append(Paragraph(disclaimer, ParagraphStyle(
        "Disc", parent=styles["Normal"],
        fontSize=7.5, textColor=colors.HexColor("#94a3b8"), leading=11,
    )))

    doc.build(story)
    buf.seek(0)
    return buf.read()
