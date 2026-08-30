# MediKiosk - Multimodal AI Medical Intake & Document Digitization System

MediKiosk is an intelligent, bilingual/multimodal medical kiosk platform designed to streamline outpatient intake, clinical triage, document digitization, entity extraction, and clinician handover.

---

## 🏗️ System Architecture

The repository is organized into three microservices:

```
medikiosk/
├── kiosk-frontend/        # Next.js 14 Web Application (Patient & Doctor UI)
├── conversation-engine/   # Express + Gemini Live multimodal voice/text triage
└── document-engine/       # Express + OCR & Gemini entity extraction & summary generator
```

### 1. [kiosk-frontend](./kiosk-frontend)
- **Port:** `3000`
- **Tech:** Next.js 14, React 18, Tailwind CSS, Lucide Icons, Canvas Signature
- **Features:**
  - **Patient Kiosk Mode**: Multi-step patient intake (Identification, Multimodal Voice & Text Interview, Document Upload/Capture, Consent & Signature, Review).
  - **Doctor Dashboard**: Real-time triage overview, patient records, FHIR export, red-flag emergency alerts, extracted clinical entities.

### 2. [conversation-engine](./conversation-engine)
- **Port:** `4000`
- **Tech:** Node.js, Express, WebSocket (`ws`), Google GenAI SDK (`@google/genai`)
- **Features:**
  - Adaptive dynamic dialogue engine & state machine.
  - Real-time red flag & critical symptom detection.
  - WebSocket proxy for Gemini Multimodal Live API.

### 3. [document-engine](./document-engine)
- **Port:** `4001`
- **Tech:** Node.js, Express, OCR (Tesseract / Gemini Vision), Google GenAI SDK
- **Features:**
  - Medical prescription and lab report digitization.
  - Clinical entity extraction (medications, dosages, diagnoses, vitals).
  - Unified clinical summary generation combining interview history and digitized documents.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### 1. Environment Setup

Copy example environment files and configure your API keys:

```bash
# Conversation Engine
cp conversation-engine/.env.example conversation-engine/.env

# Document Engine
cp document-engine/.env.example document-engine/.env

# Kiosk Frontend
cp kiosk-frontend/.env.local.example kiosk-frontend/.env.local
```

### 2. Install Dependencies & Run

#### Terminal 1 — Conversation Engine
```bash
cd conversation-engine
npm install
npm run dev
```

#### Terminal 2 — Document Engine
```bash
cd document-engine
npm install
npm run dev
```

#### Terminal 3 — Kiosk Frontend
```bash
cd kiosk-frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security & Privacy
- Environment variables containing API keys (`.env`, `.env.local`) are excluded from version control.
- Patient biometric signatures and intake records are handled securely.
