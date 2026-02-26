"""
Lab report parser — handles PDF text extraction and image encoding.
Improved OCR with Quest Diagnostics, LabCorp, and hospital format support.
For text-based PDFs uses PyMuPDF + pdfplumber.
For images and scanned PDFs, passes to Claude Vision for AI-powered extraction.
"""

import fitz  # PyMuPDF
import pdfplumber
import base64
import io
import os
import re
from pathlib import Path
from PIL import Image
import logging

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Common lab report vendor header patterns
LAB_VENDOR_PATTERNS = {
    "Quest Diagnostics": [
        r"quest\s+diagnostics", r"questdiagnostics\.com",
    ],
    "LabCorp": [
        r"laboratory\s+corporation", r"labcorp\.com", r"lab\s*corp",
    ],
    "ARUP Laboratories": [
        r"arup\s+laboratories", r"aruplab\.com",
    ],
    "Mayo Clinic Laboratories": [
        r"mayo\s+clinic\s+lab", r"mayocliniclabs\.com",
    ],
    "BioReference Laboratories": [
        r"bioreference", r"bioreferencelaboratories",
    ],
    "Sonora Quest": [
        r"sonora\s+quest",
    ],
}

# Regex to extract structured table rows like "Glucose   95   mg/dL   70-99"
LAB_VALUE_ROW_RE = re.compile(
    r"(?P<name>[A-Za-z][A-Za-z0-9 ,\(\)/\-\.]{2,50}?)\s+"
    r"(?P<value>\d+\.?\d*)\s+"
    r"(?P<unit>[a-zA-Z/%µ*]{1,15}(?:/[a-zA-Z]+)?)\s+"
    r"(?P<ref_low>\d+\.?\d*)\s*[\-–]\s*(?P<ref_high>\d+\.?\d*)",
    re.MULTILINE,
)

# Alternate pattern: name + value + H/L flag (no unit)
LAB_FLAG_ROW_RE = re.compile(
    r"(?P<name>[A-Za-z][A-Za-z0-9 ,\(\)/\-\.]{2,50}?)\s+"
    r"(?P<value>\d+\.?\d*)\s*"
    r"(?P<flag>[HLhCc]\b|HIGH|LOW|CRITICAL)",
    re.MULTILINE,
)


class LabReportParser:
    def __init__(self):
        pass

    async def save_upload(self, file_bytes: bytes, filename: str) -> str:
        """Save uploaded file and return path."""
        safe_name = Path(filename).name
        filepath = os.path.join(UPLOAD_DIR, safe_name)
        with open(filepath, "wb") as f:
            f.write(file_bytes)
        return filepath

    def detect_lab_vendor(self, text: str) -> str | None:
        """Detect which lab company generated the report."""
        text_lower = text.lower()
        for vendor, patterns in LAB_VENDOR_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return vendor
        return None

    def preprocess_text(self, text: str) -> str:
        """Clean and normalize extracted text for better AI parsing."""
        # Normalize whitespace while preserving line breaks
        lines = text.split("\n")
        cleaned = []
        for line in lines:
            # Collapse multiple spaces within a line
            line = re.sub(r" {2,}", "  ", line)
            # Remove lines that are just dashes or underscores (table borders)
            if re.match(r"^[\-_=]{3,}\s*$", line.strip()):
                continue
            cleaned.append(line)
        text = "\n".join(cleaned)

        # Normalize unicode dashes
        text = text.replace("–", "-").replace("—", "-").replace("‐", "-")

        # Remove page numbers and common noise
        text = re.sub(r"Page \d+ of \d+", "", text, flags=re.IGNORECASE)
        text = re.sub(r"Continued on next page", "", text, flags=re.IGNORECASE)

        return text.strip()

    def extract_pdf_text(self, filepath: str) -> str:
        """Extract text from a PDF using PyMuPDF + pdfplumber for structure."""
        text_parts = []
        vendor_detected = None

        # Try pdfplumber first for structured extraction (better for tables)
        try:
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    # Extract tables (common in Quest/LabCorp reports)
                    tables = page.extract_tables()
                    for table in tables:
                        for row in table:
                            if row and any(cell for cell in row if cell):
                                row_text = " | ".join(
                                    str(cell or "").strip() for cell in row
                                )
                                text_parts.append(row_text)
                    # Extract regular text
                    page_text = page.extract_text(
                        x_tolerance=3, y_tolerance=3,
                        layout=True, x_density=7.25, y_density=13
                    )
                    if page_text:
                        text_parts.append(page_text)
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}, falling back to PyMuPDF")

        # Fallback to PyMuPDF
        if not text_parts:
            try:
                doc = fitz.open(filepath)
                for page in doc:
                    # Use dict extraction for better structure
                    blocks = page.get_text("dict")["blocks"]
                    page_lines = []
                    for block in blocks:
                        if block.get("type") == 0:  # text block
                            for line in block.get("lines", []):
                                line_text = " ".join(
                                    span.get("text", "") for span in line.get("spans", [])
                                )
                                if line_text.strip():
                                    page_lines.append(line_text)
                    text_parts.extend(page_lines)
                doc.close()
            except Exception as e:
                logger.error(f"PyMuPDF also failed: {e}")

        full_text = "\n".join(text_parts)
        vendor = self.detect_lab_vendor(full_text)
        if vendor:
            logger.info(f"Detected lab vendor: {vendor}")
            full_text = f"[Lab Report from: {vendor}]\n\n{full_text}"

        return self.preprocess_text(full_text)

    def pdf_has_text(self, filepath: str) -> bool:
        """Check if a PDF contains extractable text (not just scanned images)."""
        try:
            doc = fitz.open(filepath)
            for page in doc:
                text = page.get_text().strip()
                if len(text) > 50:  # More than just noise
                    doc.close()
                    return True
            doc.close()
            return False
        except Exception:
            return False

    def pdf_to_images_base64(self, filepath: str, max_pages: int = 5) -> list[dict]:
        """Convert PDF pages to base64 images for Claude vision."""
        images = []
        try:
            doc = fitz.open(filepath)
            for page_num in range(min(len(doc), max_pages)):
                page = doc[page_num]
                # Render at 200 DPI for better OCR accuracy (up from 150)
                mat = fitz.Matrix(200 / 72, 200 / 72)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                b64 = base64.standard_b64encode(img_bytes).decode("utf-8")
                images.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": b64,
                    },
                })
            doc.close()
        except Exception as e:
            logger.error(f"PDF to image conversion failed: {e}")
        return images

    def image_to_base64(self, filepath: str) -> dict:
        """Convert image file to base64 for Claude vision."""
        try:
            with Image.open(filepath) as img:
                # Convert to RGB if necessary
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")

                # Auto-rotate based on EXIF
                try:
                    from PIL import ImageOps
                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass

                # Resize if too large (max 1568px on longest side per Claude docs)
                max_size = 1568
                if max(img.size) > max_size:
                    ratio = max_size / max(img.size)
                    new_size = (int(img.width * ratio), int(img.height * ratio))
                    img = img.resize(new_size, Image.LANCZOS)

                # Auto-enhance contrast for better OCR
                try:
                    from PIL import ImageEnhance
                    enhancer = ImageEnhance.Contrast(img)
                    img = enhancer.enhance(1.3)
                except Exception:
                    pass

                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=90)
                b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")

            return {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": b64,
                },
            }
        except Exception as e:
            logger.error(f"Image conversion failed: {e}")
            return None

    def prepare_for_claude(self, filepath: str, filename: str) -> dict:
        """
        Prepare a lab report file for Claude analysis.
        Returns {'text': str, 'images': list, 'needs_vision': bool}
        """
        ext = Path(filename).suffix.lower()

        if ext == ".pdf":
            if self.pdf_has_text(filepath):
                text = self.extract_pdf_text(filepath)
                if len(text) > 100:
                    return {"text": text, "images": [], "needs_vision": False}
            # Scanned PDF — use vision
            images = self.pdf_to_images_base64(filepath)
            return {"text": "", "images": images, "needs_vision": True}

        elif ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"):
            img_content = self.image_to_base64(filepath)
            images = [img_content] if img_content else []
            return {"text": "", "images": images, "needs_vision": True}

        elif ext in (".txt", ".csv"):
            with open(filepath, "r", errors="ignore") as f:
                text = f.read()
            return {
                "text": self.preprocess_text(text),
                "images": [],
                "needs_vision": False,
            }

        else:
            return {
                "text": f"Unsupported file type: {ext}",
                "images": [],
                "needs_vision": False,
            }
