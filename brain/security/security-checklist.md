# Security Checklist & Detailed Findings Report

**Assessment Date:** November 5, 2026  
**Target Environment:** `/Users/mukesh/Desktop/airo group`  
**Classification:** Defensive Security Audit & Hardening Matrix  

---

## 1. Project-Specific Security Checklist (20 Domains)

| Domain | Status | Control Item Description | Current Implementation Status in Codebase |
| :--- | :---: | :--- | :--- |
| **1. Authentication** | ❌ **FAIL** | User login, identity verification, MFA | **Zero authentication.** No credentials or tokens checked on any endpoint. |
| **2. Authorization & RBAC** | ❌ **FAIL** | Role segregation (Applicant vs Rep vs Admin) | **No RBAC.** `dashboard.html` accessible anonymously; displays all accounts. |
| **3. Session & Token Security** | ❌ **FAIL** | Secure session cookies, JWT validation | **No sessions exist.** Stateless endpoints serve requests without cookies or headers. |
| **4. Input Validation** | ⚠️ **POOR** | Schema validation, type/length bounds | Client HTML form has basic `required` attrs; backend has **no schema validation**. |
| **5. Injection Prevention** | ❌ **FAIL** | SQL / Path Traversal / Command Injection | Path traversal possible via unsanitized `ref_id` in `server.py:L105`. |
| **6. XSS & CSRF Defense** | ❌ **FAIL** | Output encoding, anti-CSRF tokens | **Stored XSS** in `dashboard.html:L811`; **no CSRF tokens** on POST routes. |
| **7. API Security** | ❌ **FAIL** | Endpoint authentication, route protection | All `/api/*` routes are publicly callable without credentials. |
| **8. Rate Limiting & Abuse** | ❌ **FAIL** | Request throttling, brute-force defense | **No rate limiting.** Unlimited requests accepted by `server.py`. |
| **9. File Upload Security** | ⚠️ **POOR** | Extension whitelisting, magic byte check | Basic filename regex applied; **no MIME-type verification or size limit**. |
| **10. Database Security** | ❌ **FAIL** | Access controls, parameterized queries | Flat unencrypted JSON storage on local filesystem in web root. |
| **11. Secrets Management** | ⚠️ **POOR** | Environment variables, secret store | No API keys hardcoded, but **no secret manager or .env used**. |
| **12. Cryptography & Encryption** | ❌ **FAIL** | Data at rest & in transit encryption | **Plaintext HTTP/1.0.** Plaintext storage of PAN, CVVs, and bank accounts. |
| **13. CORS Configuration** | ❌ **FAIL** | Origin whitelisting, method restriction | `Access-Control-Allow-Origin: *` wildcard set on all responses. |
| **14. Dependency Security** | ⚠️ **NEEDS AUDIT** | SCA vulnerability scanning | Packages installed via pip (`pypdf`, `reportlab`, `pillow`) need periodic audit. |
| **15. Logging & Monitoring** | ⚠️ **POOR** | Audit trails, intrusion detection | Basic stdout access logging from `SimpleHTTPRequestHandler`; no security alerts. |
| **16. Admin Surface Security** | ❌ **FAIL** | Network isolation, admin auth | Admin dashboard served as public static page with direct API binding. |
| **17. Infrastructure & Deployment** | ❌ **FAIL** | Reverse proxy, daemon isolation | Server runs directly via standard library `socketserver` binding `0.0.0.0`. |
| **18. Data Privacy & Compliance** | ❌ **FAIL** | PCI-DSS, NACHA, HIPAA compliance | Non-compliant storage of CVV, unencrypted cardholder and banking data. |
| **19. Error Handling** | ⚠️ **POOR** | Safe error responses, no stack traces | Raw Python exception strings returned to client in `server.py:L121`. |
| **20. Backup & Disaster Recovery** | ❌ **FAIL** | Automated encrypted offsite backups | No automated backup or replication for `submissions/` directory. |

---

## 2. Detailed Findings (Categorized by Vulnerability Type)

---

### Category A: Confirmed Vulnerabilities

#### FINDING-01: Unauthenticated Information Disclosure of Complete Customer Onboarding Database
- **Severity:** **CRITICAL** (CVSS 9.8)
- **Evidence:** `server.py:L33-50`:
  ```python
  if path == '/api/applications':
      apps = []
      if os.path.exists(MAIN_ACCOUNT_DIR):
          for fname in sorted(os.listdir(MAIN_ACCOUNT_DIR), reverse=True):
              if fname.endswith('.json'):
                  with open(os.path.join(MAIN_ACCOUNT_DIR, fname), 'r') as f:
                      apps.append(json.load(f))
      self.wfile.write(json.dumps(apps).encode('utf-8'))
  ```
- **Risk:** Any anonymous remote user can send `GET /api/applications` and receive an array of all pharmacy applications ever submitted, including corporate banking details, credit card numbers, tax IDs, and owner contact details.
- **Affected Location:** [`server.py:L33-50`](file:///Users/mukesh/Desktop/airo%20group/server.py#L33-L50)
- **Why It Matters:** Immediate, complete breach of customer confidentiality and regulatory non-compliance.
- **Recommended Fix:** Enforce session-based authentication or signed JWT tokens on `/api/applications`. Restrict access strictly to authorized administrators or authenticated sales representatives.

---

#### FINDING-02: Direct Storage of Card Verification Value (CVV) & Plaintext Credit Card Numbers (PCI-DSS Violation)
- **Severity:** **CRITICAL** (CVSS 9.1)
- **Evidence:** 
  1. `become-a-customer.html:L1817-1822` collects `cardCvv` and `cardNumber`.
  2. `server.py:L71-80` writes raw JSON payload to disk without tokenization or masking:
     ```python
     with open(main_file, 'w') as f:
         json.dump(payload, f, indent=2)
     ```
  3. `submissions/main_account/*.json` files contain plaintext CVVs and full PANs.
- **Risk:** Plaintext card data and CVVs stored on disk can be harvested by any local user, backup script, or file traversal vulnerability. Storing CVV post-authorization is a direct violation of PCI-DSS Requirement 3.2.2 and carries immediate card association sanctions.
- **Affected Location:** [`html/become-a-customer.html:L1817`](file:///Users/mukesh/Desktop/airo%20group/html/become-a-customer.html#L1817), [`server.py:L71-80`](file:///Users/mukesh/Desktop/airo%20group/server.py#L71-L80)
- **Why It Matters:** Severe legal liability, loss of merchant processing capabilities, and risk of mass cardholder fraud.
- **Recommended Fix:** Integrate a PCI-DSS certified payment gateway (e.g., Stripe Elements, Authorize.net) using tokenization. **Never transmit or store raw credit card numbers or CVVs on your own server or filesystem.**

---

#### FINDING-03: Stored Cross-Site Scripting (XSS) via Unsanitized Data Insertion in Admin Dashboard
- **Severity:** **HIGH** (CVSS 8.2)
- **Evidence:** `html/dashboard.html:L810-825` and `full/dashboard.html:L810-825`:
  ```javascript
  tr.innerHTML = 
    '<td>' + (app.submitted_at || '--') + '</td>' +
    '<td><strong>' + (app.businessName || '--') + '</strong><br>...' +
    '<td>' + repDisplay + '</td>' +
    '<td>' + (app.mainContactName || app.buyer1Name || '--') + '...';
  ```
- **Risk:** If an applicant submits an onboarding application with JavaScript payload in `businessName` (e.g., `<img src=x onerror=alert(1)>`), the payload executes automatically inside the browser of any sales representative or executive viewing `dashboard.html`.
- **Affected Location:** [`html/dashboard.html:L810-825`](file:///Users/mukesh/Desktop/airo%20group/html/dashboard.html#L810-L825)
- **Why It Matters:** Attackers can hijack representative sessions, execute unauthorized approvals, or exfiltrate client-side `localStorage`.
- **Recommended Fix:** Use `document.createElement()`, `element.textContent`, or an HTML entity encoding function before inserting untrusted user data into the DOM.

---

#### FINDING-04: Arbitrary File Overwrite & Path Traversal via Unsanitized `ref_id`
- **Severity:** **HIGH** (CVSS 8.5)
- **Evidence:** `server.py:L60-74`:
  ```python
  ref_id = payload.get('ref_id') or (...)
  main_file = os.path.join(MAIN_ACCOUNT_DIR, f"{ref_id}.json")
  with open(main_file, 'w') as f:
      json.dump(payload, f, indent=2)
  ```
- **Risk:** An attacker supplying a crafted `ref_id` such as `../../evil` in the JSON request body can escape `MAIN_ACCOUNT_DIR` and write JSON files into arbitrary server directories writable by the server process.
- **Affected Location:** [`server.py:L60-74`](file:///Users/mukesh/Desktop/airo%20group/server.py#L60-L74)
- **Why It Matters:** File tampering, potential code execution if existing configuration or template files are overwritten.
- **Recommended Fix:** Strictly validate `ref_id` against a strict regex whitelist (`^AKR-\d{4}-\d{4}$`) or always generate the ID exclusively on the server side, ignoring client-supplied IDs.

---

### Category B: Security Weaknesses

#### FINDING-05: Wildcard Cross-Origin Resource Sharing (CORS) Configuration
- **Severity:** **HIGH** (CVSS 7.5)
- **Evidence:** `server.py:L23-26`:
  ```python
  self.send_header('Access-Control-Allow-Origin', '*')
  self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  self.send_header('Access-Control-Allow-Headers', 'Content-Type')
  ```
- **Risk:** Combining wildcard CORS with unauthenticated sensitive GET endpoints allows any malicious external webpage to execute cross-origin `fetch('http://localhost:3000/api/applications')` and exfiltrate internal records.
- **Affected Location:** [`server.py:L23`](file:///Users/mukesh/Desktop/airo%20group/server.py#L23)
- **Why It Matters:** Completely defeats the browser Same-Origin Policy (SOP).
- **Recommended Fix:** Restrict `Access-Control-Allow-Origin` to trusted production domains (e.g., `https://akrongenerics.com`). Never use `*` on endpoints serving authenticated or sensitive data.

---

#### FINDING-06: Direct Web Root Exposure of Server Code & Database via Static Handler
- **Severity:** **HIGH** (CVSS 7.5)
- **Evidence:** `server.py:L51,L124` calls `super().do_GET()` for any non-API path. `os.chdir(BASE_DIR)` sets the working directory to the project root.
- **Risk:** Anyone requesting `http://localhost:3000/server.py` or `/submissions/main_account/AKR-2026-9999.json` directly downloads the file from the static server handler.
- **Affected Location:** [`server.py:L51,L124`](file:///Users/mukesh/Desktop/airo%20group/server.py#L51)
- **Why It Matters:** Source code leakage, directory reconnaissance, and direct access to raw customer JSON records bypassing API controls.
- **Recommended Fix:** Move all public static frontend assets into a dedicated `public/` directory and ensure the static file server cannot serve files from parent, backend, or storage folders.

---

#### FINDING-07: Unencrypted Client-Side Storage of Application Records (`localStorage`)
- **Severity:** **MEDIUM** (CVSS 6.5)
- **Evidence:** `html/become-a-customer.html:L1864-1872`:
  ```javascript
  localStorage.setItem('akron_submitted_applications', JSON.stringify(stored));
  ```
- **Risk:** `localStorage` persists indefinitely without expiration or `HttpOnly` protection. Any script running on the page can access full submission records.
- **Affected Location:** [`html/become-a-customer.html:L1864-1872`](file:///Users/mukesh/Desktop/airo%20group/html/become-a-customer.html#L1864-L1872)
- **Why It Matters:** Breaches data minimization principles; exposes customer data on shared computers.
- **Recommended Fix:** Do not store sensitive completed application dossiers in `localStorage`. If draft saving is necessary, save only non-financial metadata and purge immediately upon form submission.

---

### Category C: Missing Controls

#### FINDING-08: Absence of Transport Layer Security (TLS / HTTPS)
- **Severity:** **HIGH** (CVSS 7.4)
- **Evidence:** `server.py:L127-133` initializes a standard `socketserver.TCPServer` on plain HTTP port 3000.
- **Risk:** All traffic (PII, SSN/EIN, banking information, passwords) travels in cleartext over the network, subject to interception, eavesdropping, and Man-in-the-Middle (MitM) packet inspection.
- **Affected Location:** [`server.py:L130`](file:///Users/mukesh/Desktop/airo%20group/server.py#L130)
- **Why It Matters:** Mandatory compliance baseline for any medical, wholesale, or financial transaction.
- **Recommended Fix:** Deploy behind an enterprise reverse proxy (Nginx, Caddy, Cloudflare, or AWS ALB) enforcing HTTPS with TLS 1.3 and HSTS headers.

---

#### FINDING-09: Lack of Rate Limiting & Denial of Service (DoS) Protections
- **Severity:** **MEDIUM** (CVSS 5.3)
- **Evidence:** `server.py` has no request counting, IP tracking, or token bucket rate limiting. `pdf_filler.py` compiles multi-page PDFs synchronously in the request handler thread.
- **Risk:** An automated attacker can flood `/api/submit-application` or `/api/generate-official-pdf` with heavy base64 payloads, exhausting server CPU and memory, starving legitimate pharmacy users.
- **Affected Location:** [`server.py:L100`](file:///Users/mukesh/Desktop/airo%20group/server.py#L100), [`pdf_filler.py:L150`](file:///Users/mukesh/Desktop/airo%20group/pdf_filler.py#L150)
- **Why It Matters:** Application availability and operational resilience.
- **Recommended Fix:** Implement rate limiting (e.g., maximum 5 submissions per IP per hour) and offload PDF compilation to an asynchronous worker queue (Celery, Redis Queue).

---

#### FINDING-10: Lack of Server-Side File Upload Verification (MIME-Type & Magic Bytes)
- **Severity:** **MEDIUM** (CVSS 6.2)
- **Evidence:** `server.py:L140-155` decodes base64 strings and saves attachments using `.dat` or the client-supplied extension without verifying file headers (magic bytes) or inspecting for malicious embedded content.
- **Risk:** Users could upload executable binaries, web shells, or Polyglot files disguised as PDF or PNG documents.
- **Affected Location:** [`server.py:L140-155`](file:///Users/mukesh/Desktop/airo%20group/server.py#L140-L155)
- **Why It Matters:** Storage integrity and defense-in-depth against malicious attachment propagation.
- **Recommended Fix:** Inspect file magic bytes (`python-magic` or `filetype`), validate against a strict whitelist (`application/pdf`, `image/png`, `image/jpeg`), and enforce a 10MB maximum file size limit.

---

### Category D: Potential Risks Requiring Verification

#### FINDING-11: Prototype Clinical Portals Leaking Health Data in Query Parameters
- **Severity:** **LOW** (CVSS 3.7)
- **Evidence:** `full/assets/airo.js:L9-19` and `full/portals/doctor.html` pass patient condition schemas and questionnaire answers via URL query parameters (`?meds=...&weight=...`).
- **Risk:** If prototype files are deployed to a production domain, Protected Health Information (PHI) would be logged in intermediate web proxies, server access logs, and browser history.
- **Affected Location:** [`full/assets/airo.js:L9-19`](file:///Users/mukesh/Desktop/airo%20group/full/assets/airo.js#L9-L19)
- **Why It Matters:** HIPAA Security Rule violations if real patient consultations are conducted using this prototype URL state model.
- **Verification Needed:** Verify whether `full/` prototype directories are intended for deployment or should be segregated/purged from production builds.

---

### Category E: Architectural Recommendations

1. **Adopt a Micro-Framework or ASGI/WSGI Production Server:**
   - Migrate from Python's standard library `http.server.SimpleHTTPRequestHandler` (which Python documentation explicitly warns is not suitable for production use) to a production-grade framework such as **FastAPI** or **Flask** running behind **Gunicorn / Uvicorn**.
2. **Implement Enterprise Authentication & RBAC:**
   - Protect `/html/dashboard.html` behind a secure login portal using PBKDF2/Argon2 password hashing, secure session cookies (`HttpOnly`, `Secure`, `SameSite=Strict`), and role-based access checks.
3. **Segregate Public Assets from Storage & Backend Code:**
   - Move `submissions/`, `customer pdfs/`, `server.py`, and `pdf_filler.py` completely outside the document root of the web server.
4. **Implement Data-at-Rest Encryption (AES-GCM):**
   - Encrypt all stored pharmacy records on disk using AES-256 with keys managed by a secure Key Management Service (AWS KMS, Google Cloud KMS, or HashiCorp Vault).
5. **Establish a Content Security Policy (CSP):**
   - Add a robust CSP header:
     `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-src 'self';`
