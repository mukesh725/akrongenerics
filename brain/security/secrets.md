# Secrets & Sensitive Data Exposure Analysis

**Assessment Date:** November 5, 2026  
**Target Environment:** `/Users/mukesh/Desktop/airo group`  
**Classification:** Confidential Security Evaluation  

---

## 1. Executive Summary

This document details the handling of operational secrets, cryptographic keys, authentication tokens, and customer financial authentication data across the Akron Generics portal and AIRO platform.

The primary secret exposure risks identified in the codebase are not traditional third-party API keys (e.g., AWS or Stripe tokens), but rather:
1. **Direct Storage of Unencrypted Customer Payment Secrets (PCI-DSS & NACHA Data)**: Full Primary Account Numbers (PAN), Card Verification Values (CVV), corporate bank routing numbers, and bank account numbers are stored as plaintext JSON on the server filesystem and inside browser `localStorage`.
2. **Absence of a Secrets Management Mechanism**: The backend application (`server.py`) has no environment variable loader (`.env`, `os.environ`), secrets manager integration, or key management service (KMS) for data encryption at rest.

---

## 2. Inventory of Expected vs. Actual Secrets

| Secret / Data Category | Expected Storage Mechanism | Actual Implementation | Risk Level | Evidence in Codebase |
| :--- | :--- | :--- | :--- | :--- |
| **Payment Card Verification Values (CVV)** | **Never stored** under any circumstance (PCI-DSS Requirement 3.2.2). | Stored in plaintext JSON files and in client `localStorage`. | **CRITICAL** | `submissions/main_account/*.json` (`"cardCvv": "..."`) and `become-a-customer.html:L1817-1822`. |
| **Credit Card Numbers (PAN)** | Tokenized via Payment Gateway (Stripe, Authorize.net) or stored with AES-256 encryption. | Stored as raw plaintext strings on server and client. | **CRITICAL** | `submissions/main_account/*.json` (`"cardNumber": "..."`) and `localStorage`. |
| **Bank Account & Routing Numbers** | Encrypted at rest (AES-GCM); masked display in UI. | Stored in plaintext; displayed unmasked in UI drawer. | **CRITICAL** | `server.py:L71-80`, `dashboard.html:L849`, and `pdf_filler.py:L268-278`. |
| **Federal Tax IDs (EIN) & DEA Numbers** | Encrypted at rest, access controlled via RBAC. | Plaintext in filesystem, accessible via public GET endpoint. | **HIGH** | `submissions/main_account/*.json` (`"taxId": "..."`). |
| **Digital Signature Assets** | Non-repudiable cryptographic signatures, time-stamped, stored in secured blob store. | Base64 PNGs stored directly in JSON and in public directories. | **HIGH** | `submissions/main_account/*.json` (`"sigResp": "data:image/png;base64,..."`). |
| **Database & API Credentials** | Environment variables or Secret Manager (`.env`, HashiCorp Vault). | None used (Application uses flat filesystem rather than authenticated database). | **MEDIUM** | `server.py:L9-16` (hardcoded directory paths). |
| **TLS/HTTPS Private Keys** | PEM certificates in `/etc/ssl/` or reverse proxy configuration. | Non-existent; application operates over plaintext HTTP. | **HIGH** | `server.py:L127-133` (plain TCP server). |

---

## 3. Environment & Configuration Handling

### 3.1. Absence of Environment Variable Management
- **Current State:** A scan of `server.py` and `pdf_filler.py` reveals that zero environment variables (`os.environ.get(...)`) are read. Port numbers (`PORT = 3000`), directory structures (`SUBMISSIONS_DIR`), and paths (`PDF_TEMPLATES`) are all hardcoded directly into source files.
- **Security Implication:** The system lacks configuration isolation between development, staging, and production. If API keys or external services are introduced, developers are prone to hardcoding them into Python scripts or frontend files.

---

## 4. Hardcoded-Secret Risks

- **Static Secret Scan Results:** Automated scanning using regex patterns for known cloud providers (AWS, Google Cloud, Stripe, GitHub, generic bearer tokens) yielded **0 matches**. No operational cloud API keys or passwords are currently hardcoded in `.py` or `.js` files.
- **Corporate & Executive Metadata Exposure:**
  - Company contact information, corporate address (`47 Mall Dr, Unit 1 & 2, Commack, NY 11725`), corporate email addresses (`sales@akrongenerics.com`), and employee designations are statically hardcoded in HTML files (`airogroup.html`, `become-a-customer.html`) and PDF templates. While public marketing info is expected, internal operational routing rules are visible in client-side source code.

---

## 5. Client-Side Exposure Risks

### 5.1. Unencrypted `localStorage` Storage of Full Applications
- **Affected File:** `html/become-a-customer.html:L1864-1872` and `full/become-a-customer.html:L1864-1872`:
  ```javascript
  var stored = JSON.parse(localStorage.getItem('akron_submitted_applications') || '[]');
  ...
  stored.unshift(appData);
  localStorage.setItem('akron_submitted_applications', JSON.stringify(stored));
  ```
- **Evidence:** `appData` contains full credit card numbers, CVVs, bank routing numbers, account numbers, and base64 signature images.
- **Vulnerability:** `localStorage` is accessible to **any JavaScript** executing on the origin. Any Cross-Site Scripting (XSS) vulnerability or rogue browser extension can dump the entire history of submitted applications.

### 5.2. Client-Side Exposure of State in URL Query Strings
- **Affected File:** `full/assets/airo.js:L9-19`:
  ```javascript
  AIRO.get = function (k, d) {
    var v = new URLSearchParams(location.search).get(k);
    return v === null ? (d === undefined ? null : d) : v;
  };
  ```
- **Evidence:** Prototype medical portals pass patient symptoms, age, weight, and condition status as URL parameters (`?meds=...&weight=...`).
- **Risk:** Sensitive user parameters leak through browser history, proxy server logs, and HTTP `Referer` headers.

---

## 6. Git & Version Control Exposure Risks

### 6.1. Lack of `.gitignore` Protection for Submissions Directory
- **Finding:** A `.gitignore` file is **absent** from `/Users/mukesh/Desktop/airo group`.
- **Evidence:** The `submissions/` directory sits inside the working directory:
  - `submissions/main_account/` contains actual customer submission files (`AKR-2026-9999.json`, `AKR-2026-TESTORIG.json`, etc.) and rendered PDF files containing sensitive mock and test applicant data.
  - Attachment files such as `AKR-2026-9901_licenses_1_heritage_pharmacy_license_png` are stored alongside project assets.
- **Risk:** If a Git repository is initialized or pushed to GitHub/GitLab, customer banking details and licenses will be committed to source control history, causing permanent data leakage.

---

## 7. Logging & Error Exposure Risks

### 7.1. Internal Exception Details Exposed to Client
- **Affected File:** `server.py:L117-122`:
  ```python
  except Exception as e:
      self.send_response(400)
      self.send_header('Content-Type', 'application/json')
      self.end_headers()
      self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
  ```
- **Risk:** Internal Python exceptions, filesystem errors, and stack traces are reflected back to the client, providing attackers with detailed insight into server directory structure, library versions, and execution state.

---

## 8. Secret Rotation & Incident Response Requirements

In the event of suspected compromise of the `submissions/` directory or server instance:

1. **Cardholder Data Containment Protocol (PCI Incident):**
   - Identify all `.json` records in `submissions/main_account/`.
   - Extract affected Primary Account Numbers (PANs).
   - Coordinate with merchant acquiring bank to notify card issuers for account monitoring or cancellation.
   - Immediately purge CVV values from all disk files and local storage.
2. **Corporate Banking Notification Protocol (NACHA):**
   - Notify corporate banking partner (JPMorgan Chase / TD Bank) of exposed routing and account numbers to place fraud alerts on accounts.
3. **Regulatory Reporting (DEA / State Boards):**
   - If real pharmacy DEA licenses or state board certificates were exposed via static file traversal, report potential identity theft to the state Board of Pharmacy and DEA field office.
4. **Credential Rotation Requirements:**
   - Any future database passwords, JWT signing keys, or cloud storage keys must be generated with cryptographically secure pseudo-random number generators (CSPRNG &ge; 256 bits), stored strictly in environment variables, and rotated every 90 days.
