# JegsMedLab — Intelligent Lab Result Interpreter

An AI-powered medical lab result interpretation platform combining features from Wizey Health, Kantesti, TestResult, LabSense Health, ClearLab AI, and MedDecode.

## Features

| Feature | Description |
|---|---|
| **Lab Report Analysis** | Upload PDF/image reports — AI extracts and interprets every value |
| **Symptom Checker** | Describe symptoms → differential diagnosis + recommended tests |
| **Trend Charts** | Track lab values over time with interactive visualizations |
| **Patient History** | Browse past reports with structured value comparison |
| **Ask AI** | Conversational Q&A about results and health topics |
| **RAG System** | ChromaDB knowledge base with 30+ lab test profiles |
| **Vision AI** | Claude Vision reads scanned/handwritten lab reports |
| **Streaming** | Real-time AI response streaming |
| **Structured Extraction** | Auto-extracts and stores lab values from reports |

## Tech Stack

- **AI**: Claude Opus 4.6 (Anthropic) with adaptive thinking + streaming
- **RAG**: ChromaDB vector database with medical knowledge base
- **Backend**: FastAPI (Python) with async support
- **Database**: SQLite (SQLAlchemy ORM)
- **PDF Parsing**: PyMuPDF + pdfplumber
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Charts**: Recharts

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Anthropic API key

### 1. Setup
```bash
cd jegsmedlab
chmod +x setup.sh && ./setup.sh
```

### 2. Configure API Key
```bash
# Edit backend/.env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Start Servers

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
python main.py
# → Running on http://localhost:8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → Running on http://localhost:3000
```

### 4. Open App
Visit **http://localhost:3000**

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/patient` | Get patient profile |
| `PUT` | `/api/patient` | Update patient profile |
| `POST` | `/api/upload-lab` | Upload + analyze lab report (streaming) |
| `GET` | `/api/history` | List all reports |
| `GET` | `/api/report/{id}` | Get report with lab values |
| `GET` | `/api/trends` | Get trend data |
| `POST` | `/api/symptom-check` | Symptom analysis (streaming) |
| `POST` | `/api/ask` | Medical Q&A (streaming) |
| `GET` | `/api/dashboard-stats` | Dashboard statistics |

Interactive API docs: **http://localhost:8000/docs**

## Medical Knowledge Base

The RAG system includes profiles for 30+ lab tests across categories:
- **CBC**: WBC, RBC, Hemoglobin, Hematocrit, MCV, Platelets, Neutrophils, Lymphocytes
- **CMP**: Glucose, BUN, Creatinine, eGFR, Sodium, Potassium, ALT, AST, ALP, Bilirubin, Albumin, Calcium
- **Lipid Panel**: Total Cholesterol, LDL, HDL, Triglycerides
- **Thyroid**: TSH, Free T4, Free T3
- **Diabetes**: HbA1c, Fasting Glucose
- **Inflammatory**: CRP, ESR, Ferritin
- **Cardiac**: Troponin I/T, BNP/NT-proBNP
- **Vitamins**: B12, Vitamin D, Folate
- **Iron Studies**: Serum Iron, TIBC, Transferrin Saturation
- **Hormones**: Testosterone, Cortisol

## Disclaimer

This application is for **educational purposes only**. It does not provide medical diagnoses or treatment recommendations. Always consult a qualified healthcare provider for medical decisions.
