import http.server
import socketserver
import json
import os
import re
import base64
import time
import urllib.parse
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import pdf_filler

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')

# Automatically load .env configuration if present
def load_dotenv():
    for env_path in [os.path.join(PROJECT_ROOT, '.env'), os.path.join(BASE_DIR, '.env')]:
        if os.path.exists(env_path):
            try:
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

load_dotenv()

SUBMISSIONS_DIR = os.path.join(BASE_DIR, 'data', 'submissions')
if not os.path.exists(SUBMISSIONS_DIR):
    legacy_dir = os.path.join(PROJECT_ROOT, 'submissions')
    if os.path.exists(legacy_dir):
        SUBMISSIONS_DIR = legacy_dir
    else:
        os.makedirs(SUBMISSIONS_DIR, exist_ok=True)

MAIN_ACCOUNT_DIR = os.path.join(SUBMISSIONS_DIR, 'main_account')
BY_REP_DIR = os.path.join(SUBMISSIONS_DIR, 'by_representative')
PRICING_REQUESTS_DIR = os.path.join(BASE_DIR, 'data', 'pricing_requests')

os.makedirs(MAIN_ACCOUNT_DIR, exist_ok=True)
os.makedirs(BY_REP_DIR, exist_ok=True)
os.makedirs(PRICING_REQUESTS_DIR, exist_ok=True)

def sanitize_name(name):
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', str(name).strip().lower())

def clean_header_val(val):
    """Strip carriage returns and newlines to prevent SMTP header injection."""
    return re.sub(r'[\r\n\t]', ' ', str(val)).strip()

RATE_LIMIT_STORE = {}

def is_rate_limited(ip, limit=6, window=60):
    """In-memory rate limiter to prevent bot spamming and brute-force denial of service."""
    now = time.time()
    ts_list = [ts for ts in RATE_LIMIT_STORE.get(ip, []) if now - ts < window]
    if len(ts_list) >= limit:
        RATE_LIMIT_STORE[ip] = ts_list
        return True
    ts_list.append(now)
    RATE_LIMIT_STORE[ip] = ts_list
    return False

def send_secure_email_notification(payload):
    """
    Direct in-house email notification using corporate SMTP over encrypted TLS.
    Zero third-party services, zero intermediaries, 100% private.
    """
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_pass = os.environ.get('SMTP_PASS')
    recipient = os.environ.get('NOTIFICATION_RECIPIENT', 'info@akrongenerics.com')

    if not (smtp_host and smtp_user and smtp_pass):
        print(f"[SECURE IN-HOUSE] Direct SMTP credentials not set in environment. Saved inquiry '{payload.get('id')}' to secure local server storage.")
        return False

    try:
        msg = MIMEMultipart('alternative')
        prod = clean_header_val(payload.get('productName', 'Pharmaceutical Product'))
        ndc = clean_header_val(payload.get('ndc', 'N/A'))
        customer_email = clean_header_val(payload.get('email', 'N/A'))

        msg['Subject'] = f"Wholesale Pricing Request: {prod} (NDC: {ndc}) - {customer_email}"
        msg['From'] = clean_header_val(smtp_user)
        msg['To'] = clean_header_val(recipient)

        html_body = f"""
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; line-height: 1.5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
                <div style="background: #0B2240; color: #FFFFFF; padding: 22px 24px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #93C5FD; font-weight: 700; margin-bottom: 4px;">Akron Generics &bull; Private In-House Alert</div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Wholesale Product Pricing Request</h2>
                </div>
                <div style="padding: 24px;">
                    <p style="font-size: 14.5px; margin-top: 0; color: #334155;">
                        A pharmacy customer has requested wholesale pricing via the Akron Generics product preview modal:
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px;">
                        <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600; width: 38%;">Customer Email:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0D498F;"><a href="mailto:{customer_email}" style="color: #0D498F; text-decoration: none;">{customer_email}</a></td></tr>
                        <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Product Requested:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0F172A;">{prod}</td></tr>
                        <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">NDC:</td><td style="padding: 9px 0; font-size: 13px; font-family: monospace; color: #1E293B;">{ndc}</td></tr>
                        <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Packaging Format:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{payload.get('packaging', 'N/A')}</td></tr>
                        <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Brand / Manufacturer:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{payload.get('brand', 'N/A')}</td></tr>
                        <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Category:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{payload.get('category', 'N/A')}</td></tr>
                        <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Specifications:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{payload.get('specs', 'N/A')}</td></tr>
                        <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Request Timestamp:</td><td style="padding: 9px 0; font-size: 13px; color: #64748B;">{payload.get('requestedAtFormatted', 'N/A')}</td></tr>
                        <tr><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Internal Request ID:</td><td style="padding: 9px 0; font-size: 12px; font-family: monospace; color: #64748B;">{payload.get('id', 'N/A')}</td></tr>
                    </table>
                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
                        <a href="mailto:{customer_email}?subject=Akron%20Generics%20Wholesale%20Pricing%3A%20{prod}&body=Hello,%0D%0A%0D%0AThank%20you%20for%20contacting%20Akron%20Generics.%20Attached%20is%20our%20wholesale%20pricing%20schedule%20for%20{prod}.%0D%0A%0D%0ABest%20regards,%0D%0AAkron%20Generics%20Sales%20Team" style="display: inline-block; background: #16A34A; color: #FFFFFF; font-weight: 600; font-size: 13px; padding: 8px 16px; border-radius: 6px; text-decoration: none;">Reply to Customer &rarr;</a>
                    </div>
                    <div style="font-size: 11.5px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 14px;">
                        Confidential &bull; Dispatched securely via Akron Generics Direct SMTP &bull; Zero third-party intermediaries.
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_body, 'html'))

        context = ssl.create_default_context()
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [recipient], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls(context=context)
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [recipient], msg.as_string())

        print(f"[SECURE SMTP SUCCESS] Direct TLS email dispatched to {recipient} for '{prod}'")
        return True
    except Exception as err:
        print(f"[SECURE SMTP ERROR] Could not dispatch direct email: {err}")
        return False

class AkronHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Resolve path safely inside frontend or project directories
        clean_path = urllib.parse.unquote(path.split('?', 1)[0].split('#', 1)[0].lstrip('/'))
        if not clean_path or clean_path == 'index.html':
            for target in [
                os.path.join(FRONTEND_DIR, 'index.html'),
                os.path.join(FRONTEND_DIR, 'src', 'pages', 'airogroup.html'),
                os.path.join(PROJECT_ROOT, 'index.html')
            ]:
                if os.path.exists(target):
                    return target

        candidates = [
            os.path.join(FRONTEND_DIR, clean_path),
            os.path.join(FRONTEND_DIR, 'src', 'pages', clean_path),
            os.path.join(FRONTEND_DIR, 'src', clean_path),
            os.path.join(FRONTEND_DIR, 'src', 'assets', clean_path),
            os.path.join(FRONTEND_DIR, 'src', 'css', clean_path),
            os.path.join(FRONTEND_DIR, 'src', 'js', clean_path),
            os.path.join(FRONTEND_DIR, 'public', clean_path),
            os.path.join(PROJECT_ROOT, clean_path)
        ]

        if clean_path.startswith('html/'):
            sub_path = clean_path[5:]
            candidates.insert(0, os.path.join(FRONTEND_DIR, 'src', 'pages', sub_path))
            candidates.insert(1, os.path.join(FRONTEND_DIR, 'src', 'assets', sub_path))

        for cand in candidates:
            if os.path.exists(cand) and not os.path.isdir(cand):
                return cand

        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # GET /api/applications
        if path == '/api/applications':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            apps = []
            if os.path.exists(MAIN_ACCOUNT_DIR):
                for fname in sorted(os.listdir(MAIN_ACCOUNT_DIR), reverse=True):
                    if fname.endswith('.json'):
                        try:
                            with open(os.path.join(MAIN_ACCOUNT_DIR, fname), 'r') as f:
                                data = json.load(f)
                                apps.append(data)
                        except Exception as e:
                            pass
            self.wfile.write(json.dumps(apps).encode('utf-8'))
            return

        # GET /api/pricing-requests
        if path == '/api/pricing-requests':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            pricing_reqs = []
            if os.path.exists(PRICING_REQUESTS_DIR):
                for fname in sorted(os.listdir(PRICING_REQUESTS_DIR), reverse=True):
                    if fname.endswith('.json'):
                        try:
                            with open(os.path.join(PRICING_REQUESTS_DIR, fname), 'r') as f:
                                data = json.load(f)
                                pricing_reqs.append(data)
                        except Exception:
                            pass
            self.wfile.write(json.dumps(pricing_reqs).encode('utf-8'))
            return

        # GET /api/download-official-pdf?id=AKR-2026-XXXX
        if path == '/api/download-official-pdf':
            ref_id = query.get('id', [''])[0] or query.get('ref', [''])[0]
            if not ref_id:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing application ref id")
                return

            # Check if pre-generated PDF exists
            pdf_name = f"{ref_id}_Akron_Generics_Official.pdf"
            pdf_path = os.path.join(MAIN_ACCOUNT_DIR, pdf_name)
            
            if not os.path.exists(pdf_path):
                # Try finding JSON and generate on-the-fly
                json_path = os.path.join(MAIN_ACCOUNT_DIR, f"{ref_id}.json")
                if os.path.exists(json_path):
                    try:
                        with open(json_path, 'r') as jf:
                            app_data = json.load(jf)
                        pdf_filler.generate_consolidated_application_pdf(app_data, output_path=pdf_path)
                    except Exception as err:
                        print("Error generating official PDF:", err)
                        self.send_response(500)
                        self.end_headers()
                        self.wfile.write(f"PDF generation error: {err}".encode('utf-8'))
                        return
                else:
                    self.send_response(404)
                    self.end_headers()
                    self.wfile.write(b"Application not found")
                    return

            if os.path.exists(pdf_path):
                with open(pdf_path, 'rb') as pf:
                    pdf_bytes = pf.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', f'inline; filename="{pdf_name}"')
                self.send_header('Content-Length', str(len(pdf_bytes)))
                self.end_headers()
                self.wfile.write(pdf_bytes)
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # POST /api/generate-official-pdf (On-the-fly PDF from JSON payload)
        if path == '/api/generate-official-pdf':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                pdf_bytes = pdf_filler.generate_consolidated_application_pdf(payload)
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', 'inline; filename="Akron_Generics_Official_Application.pdf"')
                self.send_header('Content-Length', str(len(pdf_bytes)))
                self.end_headers()
                self.wfile.write(pdf_bytes)
                return
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                return

        # POST /api/submit-application
        if path == '/api/submit-application':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                ref_id = payload.get('ref_id') or ('AKR-' + str(time.strftime('%Y')) + '-' + str(int(time.time() % 10000)).zfill(4))
                payload['ref_id'] = ref_id
                payload['submitted_at'] = time.strftime('%Y-%m-%d %H:%M:%S')

                sales_mgr = payload.get('salesManager') or 'Main Account'
                rep_email = payload.get('repEmail') or payload.get('representativeEmail') or ''
                
                rep_slug = sanitize_name(sales_mgr if sales_mgr != 'Main Account' else (rep_email or 'main_account'))
                rep_target_dir = os.path.join(BY_REP_DIR, rep_slug)
                os.makedirs(rep_target_dir, exist_ok=True)

                # Save JSON in main account
                main_file = os.path.join(MAIN_ACCOUNT_DIR, f"{ref_id}.json")
                with open(main_file, 'w') as f:
                    json.dump(payload, f, indent=2)

                # Save JSON in rep folder
                rep_file = os.path.join(rep_target_dir, f"{ref_id}.json")
                with open(rep_file, 'w') as f:
                    json.dump(payload, f, indent=2)

                # Generate Official Filled PDF directly
                pdf_filename = f"{ref_id}_Akron_Generics_Official.pdf"
                main_pdf_path = os.path.join(MAIN_ACCOUNT_DIR, pdf_filename)
                rep_pdf_path = os.path.join(rep_target_dir, pdf_filename)
                
                try:
                    pdf_filler.generate_consolidated_application_pdf(payload, output_path=main_pdf_path)
                    # Copy to rep folder
                    if os.path.exists(main_pdf_path):
                        with open(main_pdf_path, 'rb') as src, open(rep_pdf_path, 'wb') as dst:
                            dst.write(src.read())
                except Exception as pdf_err:
                    print("Error generating submission PDF:", pdf_err)

                # Save binary attachments
                saved_files = []
                attachments = payload.get('attachments', {})
                for att_type, file_list in attachments.items():
                    if isinstance(file_list, list):
                        for idx, item in enumerate(file_list):
                            data_url = item.get('dataUrl', '')
                            fname = item.get('name', f"{att_type}_{idx+1}.dat")
                            if data_url.startswith('data:') and ';base64,' in data_url:
                                header, b64data = data_url.split(';base64,', 1)
                                try:
                                    bin_content = base64.b64decode(b64data)
                                    safe_fname = f"{ref_id}_{att_type}_{idx+1}_{sanitize_name(fname)}"
                                    with open(os.path.join(MAIN_ACCOUNT_DIR, safe_fname), 'wb') as bf:
                                        bf.write(bin_content)
                                    with open(os.path.join(rep_target_dir, safe_fname), 'wb') as bf:
                                        bf.write(bin_content)
                                    saved_files.append(safe_fname)
                                except Exception as err:
                                    print('Error saving attachment:', err)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {
                    "status": "success",
                    "ref_id": ref_id,
                    "representative": sales_mgr,
                    "rep_folder": rep_slug,
                    "official_pdf_url": f"/submissions/main_account/{pdf_filename}",
                    "download_api_url": f"/api/download-official-pdf?id={ref_id}",
                    "saved_files": saved_files
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                return

            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                return

        # POST /api/request-pricing
        if path == '/api/request-pricing':
            # Rate limiting check: max 6 requests per IP per minute
            client_ip = self.client_address[0] if self.client_address else '127.0.0.1'
            if is_rate_limited(client_ip, limit=6, window=60):
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Too many requests. Please wait a moment."}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 65536: # 64KB max payload security guard
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Payload exceeds allowed size."}).encode('utf-8'))
                return

            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                email = str(payload.get('email', '')).strip()

                # Strict email syntax validation
                if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Invalid email address format."}).encode('utf-8'))
                    return

                req_id = payload.get('id') or ('PR-' + str(int(time.time() * 1000)))
                payload['id'] = req_id
                payload['received_at'] = time.strftime('%Y-%m-%d %H:%M:%S')

                prod = clean_header_val(payload.get('productName', 'Pharmaceutical Product'))
                ndc = clean_header_val(payload.get('ndc', 'N/A'))
                email = payload.get('email', 'unknown@pharmacy')

                print(f"[WHOLESALE PRICING REQUEST] Received for '{prod}' (NDC: {ndc}) from customer: '{email}'")

                safe_ndc = sanitize_name(ndc)
                safe_email = sanitize_name(email)
                filename = f"{req_id}_{safe_ndc}_{safe_email}.json"
                req_path = os.path.join(PRICING_REQUESTS_DIR, filename)

                with open(req_path, 'w') as f:
                    json.dump(payload, f, indent=2)

                # Send encrypted direct email via corporate SMTP (Zero 3rd parties)
                email_sent = send_secure_email_notification(payload)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {
                    "status": "success",
                    "id": req_id,
                    "email_dispatched": email_sent,
                    "message": f"Pricing request for {prod} successfully logged. Notification dispatched to sales team."
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                return
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    os.chdir(BASE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), AkronHandler) as httpd:
        print(f"Akron Generics Portal Server running on port {PORT}")
        httpd.serve_forever()
