# Attack Surface Analysis: Akron Generics & AIRO Platform

**Assessment Date:** November 5, 2026  
**Target Environment:** `/Users/mukesh/Desktop/airo group`  
**Classification:** Defensive Attack Surface Mapping  

---

## 1. Network & Deployment Exposure

```
[Untrusted Network / Internet / LAN]
          │
          │ TCP / HTTP (Plaintext :3000)
          ▼
┌────────────────────────────────────────────────────────┐
│ server.py (socketserver.TCPServer on 0.0.0.0:3000)     │
│   ├── AkronHandler.do_GET()                            │
│   ├── AkronHandler.do_POST()                           │
│   └── SimpleHTTPRequestHandler.do_GET() [Fallback]     │
└────────────────────────────────────────────────────────┘
```

- **Host Interface Binding:** `socketserver.TCPServer(("", PORT), AkronHandler)` binds to `""` (`INADDR_ANY` / `0.0.0.0`). This exposes the service to all local and external network interfaces, not just `localhost` (127.0.0.1).
- **Transport Security:** HTTP/1.0 cleartext. No SSL/TLS termination, no certificates, no HTTP Strict Transport Security (HSTS) headers.
- **Cross-Origin Exposure:** Every response from `server.py` injects:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  This permits any malicious external website to issue cross-origin requests to internal endpoints and read responses.

---

## 2. API Endpoints Surface

### 2.1. Publicly Exposed API Endpoints

| Method | Path | Handled In | Intended Purpose | Security Controls Present | Attack Vector / Surface |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/applications` | `server.py:L33-50` | Return list of submitted applications. | **None** | Full customer database dump (PII, banking, credit limits). |
| **GET** | `/api/download-official-pdf` | `server.py:L52-97` | Stream filled official 5–8 page PDF dossier. | **None** | BOLA/IDOR: Parameter tampering on `?id=AKR-2026-XXXX`. |
| **POST** | `/api/submit-application` | `server.py:L100-170` | Ingest onboarding application and trigger PDF creation. | Basic filename regex only | Injection of arbitrary JSON, path traversal via `ref_id`, base64 DoS bombs. |
| **POST** | `/api/generate-official-pdf` | `server.py:L84-98` | Render on-the-fly PDF from JSON. | **None** | Resource exhaustion (PDF generation CPU burn). |
| **OPTIONS** | `*` | `server.py:L28-30` | CORS preflight. | Always returns 200 OK | Preflight reconnaissance. |

### 2.2. Static Fallback Surface (`SimpleHTTPRequestHandler`)
Any URL path not prefixed with `/api/` passes directly to `super().do_GET()`:
- **Source Code Exposure:** Direct requests to `/server.py` and `/pdf_filler.py` return raw Python source code.
- **Direct Submission Database Access:** Direct requests to `/submissions/main_account/` or known paths like `/submissions/main_account/AKR-2026-9999.json` allow unauthenticated downloading of stored submissions and binary licenses.
- **Template Access:** Direct requests to `/customer%20pdfs/*.pdf` return raw official corporate PDF templates.

---

## 3. Authentication & Authorization Surfaces

- **User Authentication:** **Zero (0) authentication mechanisms exist.** There is no login form, session identifier, HTTP cookie, Bearer token, or API key validation anywhere in the backend codebase.
- **Role-Based Access Control (RBAC):**
  - Expected Roles: Pharmacy Applicant, Sales Representative, Admin / Compliance Officer.
  - Actual Implementation: Both the customer form (`become-a-customer.html`) and the executive dashboard (`dashboard.html`) exist as open static HTML pages. Anyone who loads `dashboard.html` has full read and download access to all customer accounts across all sales representatives.
- **Horizontal Privilege Separation:** In `dashboard.html`, representative filtering is purely client-side:
  ```javascript
  // dashboard.html:L782
  if (currentRepFilter !== 'ALL') {
    filtered = filtered.filter(function(a) { ... });
  }
  ```
  The full dataset is already delivered to the client browser in `allApplications`, allowing any sales rep to inspect competitors' client accounts.

---

## 4. User Input Surface & Parsing

| Input Field | Source | Processing Location | Parsing / Sanitization Logic | Vulnerability Surface |
| :--- | :--- | :--- | :--- | :--- |
| `ref_id` | JSON Body | `server.py:L103,115` | None (used directly in `os.path.join`) | Path Traversal / Arbitrary File Overwrite. |
| `salesManager` | JSON Body | `server.py:L107,110` | `sanitize_name` regex (`[^a-zA-Z0-9_\-]`) | Subdirectory injection. |
| `attachments[].name` | JSON Body | `server.py:L139` | `sanitize_name` regex | Filename tampering. |
| `attachments[].dataUrl` | JSON Body | `server.py:L142` | `base64.b64decode` | Memory exhaustion, malformed base64 crash. |
| `businessName`, `mainContactName` | JSON Body | `dashboard.html:L811` | None (rendered via raw string concatenation into `innerHTML`) | Stored Cross-Site Scripting (XSS). |
| `id` / `ref` | URL Query Param | `print-dossier.html:L196` | Passed to `fetch()` and DOM | DOM manipulation, open redirect / phishing context. |

---

## 5. File Upload & Binary Ingestion Surface

1. **Client-Side File Reading (`become-a-customer.html:L1902-1928`)**:
   - Accepts user files from `input#licenseUploadFiles` and `input#voidedCheckFiles`.
   - Uses `FileReader.readAsDataURL()`.
   - **No client-side file type verification** (accepts any extension).
   - **No client-side file size limit** (browser can crash on multi-hundred-megabyte files).
2. **Server-Side Binary Storage (`server.py:L135-155`)**:
   - Decodes base64 payload in memory.
   - Saves file to disk with pattern: `{ref_id}_{att_type}_{idx+1}_{safe_fname}`.
   - **No magic-byte / MIME-type verification**: An attacker can upload an executable (`.exe`, `.sh`, `.php`, `.py`) disguised as a license, and the server saves it to the web root.
3. **PDF Generation Ingestion (`pdf_filler.py:L89-106`)**:
   - Passes base64 payload to `PIL.Image.open(io.BytesIO(img_bytes))`.
   - **Decompression Bomb Risk:** Maliciously crafted PNG/TIFF images with massive dimensions (e.g., 50,000 &times; 50,000 pixels) consume gigabytes of RAM during ReportLab draw operations.

---

## 6. Storage & Database Surface

```
[Project Root]
└── submissions/
    ├── main_account/
    │   ├── AKR-2026-XXXX.json           <-- Unencrypted PII, PAN, CVV, Banking
    │   ├── AKR-2026-XXXX_official.pdf   <-- Unencrypted rendered legal documents
    │   └── AKR-2026-XXXX_licenses_...   <-- Raw uploaded binary files
    └── by_representative/
        └── [rep_slug]/
            └── AKR-2026-XXXX.json       <-- Duplicated unencrypted records
```

- **Database Engine:** Flat filesystem directories (`submissions/main_account` and `submissions/by_representative`).
- **Data at Rest Encryption:** **None.** All sensitive fields (Tax IDs, bank account numbers, routing numbers, credit card numbers, CVVs) are stored in human-readable UTF-8 JSON.
- **Client Storage:** `localStorage` retains full submission records and unsaved form drafts indefinitely on the applicant's machine.

---

## 7. Administrative & Internal Surfaces

- **`html/dashboard.html` / `full/dashboard.html`**:
  - Exposes an interactive tabular view of all applications.
  - Contains features to:
    - View comprehensive pharmacy details, contact info, banking details, and uploaded document badges.
    - Export application data to JSON (`exportData()`).
    - Trigger 1-click downloads of official PDF applications.
  - **Attack Surface:** Any entity on the local network or internet reaching port 3000 can access this dashboard without credentials.

---

## 8. Third-Party Integrations & CDN Dependencies

| Dependency / Service | Source Location | Usage | Security Risk |
| :--- | :--- | :--- | :--- |
| **Google Fonts** | `html/airogroup.html`, `become-a-customer.html`, `print-dossier.html` | Typography (`Inter`, `Manrope`, `Outfit`) | Third-party tracking, IP disclosure to Google CDN, potential CDN compromise if SRI hashes absent. |
| **PDF-Lib** | `js/pdf-lib.min.js` (513KB local file) | Client-side fallback PDF compilation | Supply chain / prototype pollution if bundled library has unpatched vulnerabilities. |
| **PyPDF** | Python package `pypdf 6.21.4` | Server-side PDF template manipulation | PDF parser parsing vulnerabilities (malformed PDF input leading to DoS). |
| **ReportLab** | Python package `reportlab 5.1.0` | PDF overlay drawing | PDF rendering vulnerabilities. |
| **Pillow (PIL)** | Python package `pillow 12.2.0` | Image processing for signature & license stamping | Image format decoding vulnerabilities (CVE-2023-4863, WebP/PNG parsing memory corruption). |
