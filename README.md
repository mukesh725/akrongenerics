# Akron Generics & AIRO Group Platform

> Enterprise B2B wholesale pharmaceutical customer onboarding, automated legal PDF dossier compilation, and sales representative dashboard.

---

## 1. System Architecture

The project is structured into a modern full-stack decoupled architecture:

```
airo group/
├── backend/                       # Python REST API & PDF Rendering Engine
│   ├── data/
│   │   └── submissions/           # Storage for applications & dossiers (git-ignored)
│   ├── templates/                 # Akron Generics official PDF forms (5 standard forms)
│   ├── pdf_filler.py              # ReportLab & PyPDF vector overlay and compilation engine
│   ├── server.py                  # HTTP API server & static asset router
│   ├── requirements.txt           # Python dependencies (pypdf, reportlab, Pillow)
│   └── README.md
│
├── frontend/                      # Modular Frontend Application Architecture
│   ├── public/                    # Static root assets
│   ├── src/
│   │   ├── assets/                # Logos, hero images, product category graphics, videos
│   │   ├── components/            # Reusable UI components (Header, Footer, SubmissionModal)
│   │   ├── context/               # Global state context (AppContext.js)
│   │   ├── css/                   # Stylesheets (akron.css)
│   │   ├── data/                  # Static data models & representative catalogs (reps.json)
│   │   ├── hooks/                 # Lifecycle and reactive hooks (useFormDraft, useSignature)
│   │   ├── js/                    # Client libraries (pdf-lib.min.js, akron.js)
│   │   ├── pages/                 # Application views & workflows
│   │   │   ├── airogroup.html     # Main corporate homepage
│   │   │   ├── become-a-customer.html # 4-step onboarding intake form
│   │   │   ├── dashboard.html     # Sales representative management portal
│   │   │   └── print-dossier.html # Browser print preview for filled dossier
│   │   ├── redux/                 # State store and slice reducers (store.js, applicationSlice.js)
│   │   ├── services/              # API client integration (api.js)
│   │   └── utils/                 # Formatters, signature controllers, validators
│   ├── index.html                 # Frontend entry point
│   └── package.json               # Node package configuration & development scripts
│
├── docs/                          # Comprehensive Technical & Security Documentation
│   └── security/
│       ├── threat-model.md        # Threat model & attack scenario matrix
│       ├── secrets.md             # Secret handling, PCI-DSS & environment exposure audit
│       ├── attack-surface.md      # External/internal attack surface catalog
│       └── security-checklist.md  # 20-category security verification checklist
│
├── .env.example                   # Environment configuration template
├── .gitignore                     # Git rules (protecting submissions PII & build files)
└── README.md                      # Project documentation
```

---

## 2. Getting Started

### Prerequisites
- Python 3.9+ (Python 3.11+ recommended)
- `pip` package manager

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running Locally

Start the local server from the project root or backend directory:
```bash
python3 backend/server.py
```

The application will be live at:
- **Homepage:** `http://localhost:3000/` (or `http://localhost:3000/src/pages/airogroup.html`)
- **Customer Onboarding Form:** `http://localhost:3000/src/pages/become-a-customer.html`
- **Sales Representative Dashboard:** `http://localhost:3000/src/pages/dashboard.html`

---

## 3. Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/become-a-customer` | Ingests new pharmacy onboarding applications, saves customer records into main/representative stores, and triggers background PDF dossier compilation. |
| `GET` | `/api/applications` | Retrieves submitted onboarding records for the representative and admin review dashboard. |
| `GET` | `/api/download-official-pdf?id={ref_id}` | Streams the completed official 5-page PDF dossier overlaid with customer signatures, plus uploaded license and check attachments. |
| `POST` | `/api/generate-official-pdf` | Generates a compiled official PDF on-the-fly from an incoming JSON payload. |

---

## 4. PDF Compilation Engine

[`backend/pdf_filler.py`](file:///Users/mukesh/Desktop/airo%20group/backend/pdf_filler.py) processes customer data into standard legal templates located in `backend/templates/`:
1. **Credit Application** (`Akron-Generics-Account-Set-Up-documents-Credit-Application.pdf`)
2. **Credit Card Authorization** (`Akron-Generics-Account-Set-Up-documents-Credit-Card-Authorization-form.pdf`)
3. **ACH Payment Authorization** (`Akron-Generics-Account-Set-Up-documents-ACH-Payment-Authorization-Form.pdf`)
4. **Terms and Conditions Agreement** (`Akron-Generics-Account-Set-Up-documents-Terms-and-Conditions-form.pdf`)
5. **Letter of Responsibility** (`Akron-Generics-Letter-of-Responsibility.pdf`)
6. **Customer Attachments**: Decodes and appends pharmacy state licenses, DEA certificates, and voided checks directly into the merged output file.

---

## 5. Security & Privacy

This codebase has undergone a comprehensive internal security assessment. See detailed reports in [`docs/security/`](file:///Users/mukesh/Desktop/airo%20group/docs/security/):
- [`threat-model.md`](file:///Users/mukesh/Desktop/airo%20group/docs/security/threat-model.md)
- [`secrets.md`](file:///Users/mukesh/Desktop/airo%20group/docs/security/secrets.md)
- [`attack-surface.md`](file:///Users/mukesh/Desktop/airo%20group/docs/security/attack-surface.md)
- [`security-checklist.md`](file:///Users/mukesh/Desktop/airo%20group/docs/security/security-checklist.md)

> **Important**: The `.gitignore` is pre-configured to strictly exclude all customer records in `backend/data/submissions/` to prevent committing customer financial data or PII into version control.
