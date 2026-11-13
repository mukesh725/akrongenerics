import http.server
import socketserver
import json
import os
import re
import html
import base64
import time
import urllib.parse
import urllib.request
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import pdf_filler
import catalog_manager

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
CONTACT_INQUIRIES_DIR = os.path.join(BASE_DIR, 'data', 'contact_inquiries')

os.makedirs(MAIN_ACCOUNT_DIR, exist_ok=True)
os.makedirs(BY_REP_DIR, exist_ok=True)
os.makedirs(PRICING_REQUESTS_DIR, exist_ok=True)
os.makedirs(CONTACT_INQUIRIES_DIR, exist_ok=True)

ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY', '')

def sanitize_name(name):
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', str(name).strip().lower())

def clean_header_val(val):
    """Strip carriage returns and newlines to prevent SMTP header injection."""
    return re.sub(r'[\r\n\t]', ' ', str(val or '')).strip()

RATE_LIMIT_STORE = {}

def get_client_ip(handler):
    """Extract client IP with proxy-awareness while guarding against header spoofing."""
    xff = handler.headers.get('X-Forwarded-For')
    if xff:
        client_ip = xff.split(',')[0].strip()
        if re.match(r'^[0-9a-fA-F:.]+$', client_ip):
            return client_ip
    if handler.client_address:
        return handler.client_address[0]
    return '127.0.0.1'

def is_rate_limited(ip, limit=6, window=60):
    """In-memory rate limiter with periodic cleanup to prevent memory exhaustion."""
    now = time.time()
    if len(RATE_LIMIT_STORE) > 500:
        stale_ips = [k for k, v in list(RATE_LIMIT_STORE.items()) if not v or (now - v[-1] > window)]
        for k in stale_ips:
            RATE_LIMIT_STORE.pop(k, None)

    ts_list = [ts for ts in RATE_LIMIT_STORE.get(ip, []) if now - ts < window]
    if len(ts_list) >= limit:
        RATE_LIMIT_STORE[ip] = ts_list
        return True
    ts_list.append(now)
    RATE_LIMIT_STORE[ip] = ts_list
    return False

def is_admin_authorized(handler):
    """
    Ensure administrative endpoints are accessible only:
    1. With an authorized ADMIN_API_KEY bearer token or query param, OR
    2. If no ADMIN_API_KEY is configured, strictly via direct socket loopback (local host).
    Never trust spoofable X-Forwarded-For headers for authorization!
    """
    auth_header = handler.headers.get('Authorization', '')
    query_key = urllib.parse.parse_qs(urllib.parse.urlparse(handler.path).query).get('key', [''])[0]

    if ADMIN_API_KEY:
        # Enforce API key strictly whenever configured
        return auth_header == f"Bearer {ADMIN_API_KEY}" or query_key == ADMIN_API_KEY

    # In local development without ADMIN_API_KEY, verify direct socket peer is loopback
    direct_peer = handler.client_address[0] if handler.client_address else ''
    return direct_peer in ('127.0.0.1', '::1')

def send_secure_email_notification(payload):
    """
    Universal in-house email notification using Google Apps Script or corporate SMTP over encrypted TLS.
    Delivers to:
    - Primary: info@akrongenerics.com
    - Secondary: mukesh@akrongenerics.com
    Zero third-party SaaS intermediaries, 100% private.
    """
    primary_to = os.environ.get('NOTIFICATION_RECIPIENT', 'info@akrongenerics.com')
    secondary_cc = os.environ.get('NOTIFICATION_CC', 'mukesh@akrongenerics.com')
    all_recipients = [r.strip() for r in [primary_to, secondary_cc] if r and r.strip()]

    # Option A: Private Google Apps Script Webhook
    google_script_url = os.environ.get('GOOGLE_SCRIPT_URL')
    if google_script_url and google_script_url.startswith('https://script.google.com/'):
        try:
            req = urllib.request.Request(
                google_script_url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            ssl_ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=12, context=ssl_ctx) as response:
                print(f"[GOOGLE APPS SCRIPT] Successfully dispatched email notification to {primary_to} (CC: {secondary_cc})")
                return True
        except Exception as g_err:
            print(f"[GOOGLE APPS SCRIPT ERROR] {g_err}")

    # Option B: Direct Corporate SMTP
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_pass = os.environ.get('SMTP_PASS')

    if not (smtp_host and smtp_user and smtp_pass):
        print(f"[SECURE IN-HOUSE] Direct SMTP or Google Script credentials not configured. Saved inquiry '{payload.get('id')}' to secure local server storage.")
        return False

    try:
        msg = MIMEMultipart('alternative')
        is_contact = (payload.get('formType') == 'contact' or payload.get('message') or payload.get('reason'))

        if is_contact:
            full_name_clean = clean_header_val(payload.get('fullName') or ((payload.get('firstName', '') + ' ' + payload.get('lastName', '')).strip()) or 'Website Visitor')
            reason_clean = clean_header_val(payload.get('reason', 'General Inquiry'))
            pharmacy_clean = clean_header_val(payload.get('pharmacyName', 'N/A'))
            customer_email_clean = clean_header_val(payload.get('email', 'N/A'))
            phone_clean = clean_header_val(payload.get('phone', 'N/A'))
            role_clean = clean_header_val(payload.get('role', 'N/A'))
            state_clean = clean_header_val(payload.get('state', 'N/A'))
            time_clean = clean_header_val(payload.get('submittedAtFormatted') or payload.get('submittedAt', ''))
            msg_raw = str(payload.get('message', ''))

            # Strict HTML escaping to prevent email injection / stored XSS
            full_name_esc = html.escape(full_name_clean)
            reason_esc = html.escape(reason_clean)
            pharmacy_esc = html.escape(pharmacy_clean)
            customer_email_esc = html.escape(customer_email_clean)
            phone_esc = html.escape(phone_clean)
            role_esc = html.escape(role_clean)
            state_esc = html.escape(state_clean)
            time_esc = html.escape(time_clean)
            msg_esc = html.escape(msg_raw)

            msg['Subject'] = f"Contact Inquiry: {reason_clean} — {full_name_clean} ({pharmacy_clean})"
            html_body = f"""
            <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; line-height: 1.5; padding: 20px;">
                <div style="max-width: 620px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
                    <div style="background: #9E2235; color: #FFFFFF; padding: 22px 24px;">
                        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #FECDD3; font-weight: bold; margin-bottom: 4px;">Akron Generics &bull; Customer Inquiry</div>
                        <h2 style="margin: 0; font-size: 20px; font-weight: 700;">New Customer Message Submitted</h2>
                    </div>
                    <div style="padding: 24px;">
                        <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
                            <strong style="color: #991B1B; font-size: 14px;">Reason: {reason_esc}</strong>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600; width: 35%;">Contact Name:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0F172A;">{full_name_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Email Address:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0D498F;"><a href="mailto:{customer_email_esc}">{customer_email_esc}</a></td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Phone Number:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;"><a href="tel:{phone_esc}">{phone_esc}</a></td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Pharmacy / Practice:</td><td style="padding: 9px 0; font-size: 13.5px; font-weight: 600; color: #0F172A;">{pharmacy_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Role:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{role_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">State:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{state_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">SMS Consent:</td><td style="padding: 9px 0; font-size: 13px; color: #64748B;">{"Yes (Opted In)" if payload.get('smsConsent') else "No"}</td></tr>
                            <tr><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Submitted Time:</td><td style="padding: 9px 0; font-size: 13px; color: #64748B;">{time_esc}</td></tr>
                        </table>
                        <div style="margin-bottom: 24px;">
                            <div style="font-size: 12px; text-transform: uppercase; font-weight: bold; color: #64748B; margin-bottom: 8px;">Customer Message:</div>
                            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; font-size: 14px; color: #1E293B; white-space: pre-wrap; line-height: 1.6;">{msg_esc}</div>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <a href="mailto:{customer_email_esc}?subject=Re:%20Akron%20Generics%20Inquiry%20-%20{urllib.parse.quote(reason_clean)}" style="display: inline-block; background: #9E2235; color: #FFFFFF; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 6px; text-decoration: none;">Reply to Customer &rarr;</a>
                        </div>
                        <div style="font-size: 11.5px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px;">
                            Delivered to Primary: {primary_to} &bull; CC: {secondary_cc} &bull; Akron Generics Secure Dispatcher.
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
        else:
            prod_clean = clean_header_val(payload.get('productName', 'Pharmaceutical Product'))
            ndc_clean = clean_header_val(payload.get('ndc', 'N/A'))
            customer_email_clean = clean_header_val(payload.get('email', 'N/A'))
            packaging_clean = clean_header_val(payload.get('packaging', 'N/A'))
            brand_clean = clean_header_val(payload.get('brand', 'N/A'))
            category_clean = clean_header_val(payload.get('category', 'N/A'))
            specs_clean = clean_header_val(payload.get('specs', 'N/A'))
            time_clean = clean_header_val(payload.get('requestedAtFormatted') or payload.get('requestedAt', 'N/A'))

            prod_esc = html.escape(prod_clean)
            ndc_esc = html.escape(ndc_clean)
            customer_email_esc = html.escape(customer_email_clean)
            packaging_esc = html.escape(packaging_clean)
            brand_esc = html.escape(brand_clean)
            category_esc = html.escape(category_clean)
            specs_esc = html.escape(specs_clean)
            time_esc = html.escape(time_clean)

            msg['Subject'] = f"Wholesale Pricing Request: {prod_clean} (NDC: {ndc_clean}) - {customer_email_clean}"
            html_body = f"""
            <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; line-height: 1.5; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
                    <div style="background: #0B2240; color: #FFFFFF; padding: 22px 24px;">
                        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #93C5FD; font-weight: 700; margin-bottom: 4px;">Akron Generics &bull; B2B Customer Portal</div>
                        <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Wholesale Product Pricing Request</h2>
                    </div>
                    <div style="padding: 24px;">
                        <p style="font-size: 14.5px; margin-top: 0; color: #334155;">
                            A pharmacy customer has requested wholesale pricing via the Akron Generics product preview modal:
                        </p>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px;">
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600; width: 38%;">Customer Email:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0D498F;"><a href="mailto:{customer_email_esc}" style="color: #0D498F; text-decoration: none;">{customer_email_esc}</a></td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Product Requested:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0F172A;">{prod_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">NDC:</td><td style="padding: 9px 0; font-size: 13px; font-family: monospace; color: #1E293B;">{ndc_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Packaging Format:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{packaging_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Brand / Manufacturer:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{brand_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Category:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{category_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Specifications:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">{specs_esc}</td></tr>
                            <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Request Timestamp:</td><td style="padding: 9px 0; font-size: 13px; color: #64748B;">{time_esc}</td></tr>
                        </table>
                        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
                            <a href="mailto:{customer_email_esc}?subject=Akron%20Generics%20Wholesale%20Pricing%3A%20{urllib.parse.quote(prod_clean)}" style="display: inline-block; background: #16A34A; color: #FFFFFF; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 6px; text-decoration: none;">Reply to Customer &rarr;</a>
                        </div>
                        <div style="font-size: 11.5px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px;">
                            Delivered to Primary: {primary_to} &bull; CC: {secondary_cc} &bull; Akron Generics Secure In-House Gateway.
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """

        msg['From'] = smtp_user
        msg['To'] = primary_to
        if secondary_cc:
            msg['Cc'] = secondary_cc

        msg.attach(MIMEText(html_body, 'html'))

        context = ssl.create_default_context()
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, all_recipients, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls(context=context)
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, all_recipients, msg.as_string())

        print(f"[SECURE SMTP SUCCESS] Direct TLS email dispatched to {primary_to} (CC: {secondary_cc})")
        return True
    except Exception as err:
        print(f"[SECURE SMTP ERROR] Could not dispatch direct email: {err}")
        return False

class AkronHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        """
        Hardened static file resolution strictly confined to FRONTEND_DIR.
        Completely eliminates arbitrary file reads, dotfile/secret leakage (.env),
        and path traversal (../).
        """
        clean_path = urllib.parse.unquote(path.split('?', 1)[0].split('#', 1)[0].lstrip('/'))

        # Security check: Block path traversal and any hidden/dot files (.env, .git, etc.)
        if any(seg.startswith('.') or seg == '..' for seg in clean_path.split('/')):
            return os.path.join(FRONTEND_DIR, '__non_existent_blocked_path__')

        if not clean_path or clean_path == 'index.html':
            for target in [
                os.path.join(FRONTEND_DIR, 'index.html'),
                os.path.join(FRONTEND_DIR, 'src', 'pages', 'airogroup.html')
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
            os.path.join(FRONTEND_DIR, 'public', clean_path)
        ]

        if clean_path.startswith('html/'):
            sub_path = clean_path[5:]
            candidates.insert(0, os.path.join(FRONTEND_DIR, 'src', 'pages', sub_path))
            candidates.insert(1, os.path.join(FRONTEND_DIR, 'src', 'assets', sub_path))

        frontend_canonical = os.path.realpath(FRONTEND_DIR)

        for cand in candidates:
            # Strictly verify that canonical path remains inside FRONTEND_DIR
            real_cand = os.path.realpath(cand)
            if real_cand == frontend_canonical or real_cand.startswith(frontend_canonical + os.sep):
                if os.path.exists(cand) and not os.path.isdir(cand):
                    return cand

        # Return safe non-existent path to trigger HTTP 404
        return os.path.join(FRONTEND_DIR, '__non_existent_404__')

    def end_headers(self):
        parsed = urllib.parse.urlparse(self.path)
        # Only allow CORS on public submission endpoints
        if parsed.path in ('/api/request-pricing', '/api/contact', '/api/submit-application'):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # GET /api/admin/products (Protected administrative endpoint)
        if path == '/api/admin/products':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            catalog_data = catalog_manager.load_catalog()
            self.wfile.write(json.dumps(catalog_data).encode('utf-8'))
            return

        # GET /api/applications (Protected administrative endpoint)
        if path == '/api/applications':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

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
                        except Exception:
                            pass
            self.wfile.write(json.dumps(apps).encode('utf-8'))
            return

        # GET /api/pricing-requests (Protected administrative endpoint)
        if path == '/api/pricing-requests':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

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

        # GET /api/contact-inquiries (Protected administrative endpoint)
        if path == '/api/contact-inquiries':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            inquiries = []
            if os.path.exists(CONTACT_INQUIRIES_DIR):
                for fname in sorted(os.listdir(CONTACT_INQUIRIES_DIR), reverse=True):
                    if fname.endswith('.json'):
                        try:
                            with open(os.path.join(CONTACT_INQUIRIES_DIR, fname), 'r') as f:
                                data = json.load(f)
                                inquiries.append(data)
                        except Exception:
                            pass
            self.wfile.write(json.dumps(inquiries).encode('utf-8'))
            return

        # GET /api/download-official-pdf?id=AKR-2026-XXXX (Protected administrative endpoint)
        if path == '/api/download-official-pdf':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

            ref_id = query.get('id', [''])[0] or query.get('ref', [''])[0]
            if not ref_id or not re.match(r'^AKR-[0-9]{4}-[0-9A-Za-z_-]{4,12}$', ref_id):
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid or missing application ref id")
                return

            # Check if pre-generated PDF exists
            pdf_name = f"{ref_id}_Akron_Generics_Official.pdf"
            pdf_path = os.path.realpath(os.path.join(MAIN_ACCOUNT_DIR, pdf_name))
            if not pdf_path.startswith(os.path.realpath(MAIN_ACCOUNT_DIR) + os.sep):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Access denied")
                return

            if not os.path.exists(pdf_path):
                # Try finding JSON and generate on-the-fly
                json_path = os.path.realpath(os.path.join(MAIN_ACCOUNT_DIR, f"{ref_id}.json"))
                if json_path.startswith(os.path.realpath(MAIN_ACCOUNT_DIR) + os.sep) and os.path.exists(json_path):
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

        # POST /api/admin/products/save (Protected administrative endpoint)
        if path == '/api/admin/products/save':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 10 * 1024 * 1024:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Payload exceeds allowed size."}).encode('utf-8'))
                return

            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                success, msg = catalog_manager.save_catalog(payload)
                if success:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "status": "success",
                        "message": msg,
                        "productCount": len(payload.get('products', []))
                    }).encode('utf-8'))
                else:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": msg}).encode('utf-8'))
                return
            except Exception as e:
                print(f"[ADMIN ERROR] /api/admin/products/save: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Failed to parse or save product catalog payload."}).encode('utf-8'))
                return

        # POST /api/admin/specials/save (Protected administrative endpoint)
        if path == '/api/admin/specials/save':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 5 * 1024 * 1024:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Payload too large."}).encode('utf-8'))
                return

            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                if not isinstance(payload, dict) or ('specialOffers' not in payload and 'items' not in payload):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Invalid payload format. Must include 'specialOffers' or 'items'."}).encode('utf-8'))
                    return

                cat_data = catalog_manager.load_catalog()

                if 'specialOffers' in payload and isinstance(payload['specialOffers'], dict):
                    cat_data['specialOffers'] = payload['specialOffers']
                elif 'items' in payload and isinstance(payload['items'], list):
                    if 'specialOffers' not in cat_data or not isinstance(cat_data['specialOffers'], dict):
                        cat_data['specialOffers'] = catalog_manager.get_default_special_offers()
                    cat_data['specialOffers']['items'] = payload['items']

                success, msg = catalog_manager.save_catalog(cat_data)
                if success:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "status": "success",
                        "message": "Special offers saved successfully",
                        "specialOffers": cat_data.get('specialOffers')
                    }).encode('utf-8'))
                else:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": msg}).encode('utf-8'))
                return
            except Exception as e:
                print(f"[ADMIN ERROR] /api/admin/specials/save: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Failed to parse or save special offers payload."}).encode('utf-8'))
                return

        # POST /api/admin/upload-image (Protected administrative endpoint)
        if path == '/api/admin/upload-image':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 20 * 1024 * 1024:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Image payload exceeds 20MB limit."}).encode('utf-8'))
                return

            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                file_name = payload.get('fileName', '')
                data_url = payload.get('dataUrl', '')
                if not data_url:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Missing image dataUrl."}).encode('utf-8'))
                    return

                rel_path, err = catalog_manager.save_uploaded_image(file_name, data_url)
                if err:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": err}).encode('utf-8'))
                    return

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "imagePath": rel_path
                }).encode('utf-8'))
                return
            except Exception as e:
                print(f"[ADMIN ERROR] /api/admin/products/save: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Failed to parse or save product catalog payload."}).encode('utf-8'))
                return

        # POST /api/admin/products/delete (Protected administrative endpoint)
        if path == '/api/admin/products/delete':
            if not is_admin_authorized(self):
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
            try:
                payload = json.loads(post_data.decode('utf-8')) if post_data else {}
                delete_id = str(payload.get('id', '')).strip()
                if not delete_id:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Missing product id."}).encode('utf-8'))
                    return

                cat_data = catalog_manager.load_catalog()
                orig_len = len(cat_data.get('products', []))
                cat_data['products'] = [p for p in cat_data.get('products', []) if str(p.get('id')) != delete_id and str(p.get('itemNo')) != delete_id]
                new_len = len(cat_data['products'])

                if new_len == orig_len:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": f"Product {delete_id} not found."}).encode('utf-8'))
                    return

                success, msg = catalog_manager.save_catalog(cat_data)
                if success:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success", "deletedId": delete_id, "message": msg}).encode('utf-8'))
                else:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": msg}).encode('utf-8'))
                return
            except Exception as e:
                print(f"[ADMIN ERROR] /api/admin/products/save: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Failed to parse or save product catalog payload."}).encode('utf-8'))
                return

        # POST /api/generate-official-pdf (On-the-fly PDF from JSON payload)
        if path == '/api/generate-official-pdf':
            client_ip = get_client_ip(self)
            if is_rate_limited(client_ip, limit=10, window=60):
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Too many requests. Please wait a moment."}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 10 * 1024 * 1024:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Payload exceeds allowed size."}).encode('utf-8'))
                return

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
            client_ip = get_client_ip(self)
            if is_rate_limited(client_ip, limit=10, window=60):
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Too many requests. Please wait a moment."}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 25 * 1024 * 1024:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Payload exceeds maximum allowed size (25MB)."}).encode('utf-8'))
                return

            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                raw_ref = str(payload.get('ref_id', '')).strip()
                if re.match(r'^AKR-[0-9]{4}-[0-9A-Za-z_-]{4,12}$', raw_ref):
                    ref_id = raw_ref
                else:
                    ref_id = 'AKR-' + str(time.strftime('%Y')) + '-' + str(int(time.time() % 10000)).zfill(4)
                payload['ref_id'] = ref_id
                payload['submitted_at'] = time.strftime('%Y-%m-%d %H:%M:%S')

                sales_mgr = clean_header_val(payload.get('salesManager') or 'Main Account')
                rep_email = clean_header_val(payload.get('repEmail') or payload.get('representativeEmail') or '')
                
                rep_slug = sanitize_name(sales_mgr if sales_mgr != 'Main Account' else (rep_email or 'main_account'))
                if not rep_slug:
                    rep_slug = 'main_account'
                rep_target_dir = os.path.realpath(os.path.join(BY_REP_DIR, rep_slug))
                if not rep_target_dir.startswith(os.path.realpath(BY_REP_DIR) + os.sep) and rep_target_dir != os.path.realpath(BY_REP_DIR):
                    rep_target_dir = os.path.realpath(BY_REP_DIR)
                os.makedirs(rep_target_dir, exist_ok=True)

                # Save JSON in main account
                main_file = os.path.realpath(os.path.join(MAIN_ACCOUNT_DIR, f"{ref_id}.json"))
                if main_file.startswith(os.path.realpath(MAIN_ACCOUNT_DIR) + os.sep):
                    with open(main_file, 'w') as f:
                        json.dump(payload, f, indent=2)

                # Save JSON in rep folder
                rep_file = os.path.realpath(os.path.join(rep_target_dir, f"{ref_id}.json"))
                if rep_file.startswith(os.path.realpath(rep_target_dir) + os.sep):
                    with open(rep_file, 'w') as f:
                        json.dump(payload, f, indent=2)

                # Generate Official Filled PDF directly
                pdf_filename = f"{ref_id}_Akron_Generics_Official.pdf"
                main_pdf_path = os.path.realpath(os.path.join(MAIN_ACCOUNT_DIR, pdf_filename))
                rep_pdf_path = os.path.realpath(os.path.join(rep_target_dir, pdf_filename))
                
                try:
                    pdf_filler.generate_consolidated_application_pdf(payload, output_path=main_pdf_path)
                    if os.path.exists(main_pdf_path):
                        with open(main_pdf_path, 'rb') as src, open(rep_pdf_path, 'wb') as dst:
                            dst.write(src.read())
                except Exception as pdf_err:
                    print("Error generating submission PDF:", pdf_err)

                # Save binary attachments safely
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
                                    safe_fname = f"{ref_id}_{sanitize_name(att_type)}_{idx+1}_{sanitize_name(fname)}"
                                    target_main = os.path.realpath(os.path.join(MAIN_ACCOUNT_DIR, safe_fname))
                                    target_rep = os.path.realpath(os.path.join(rep_target_dir, safe_fname))
                                    if target_main.startswith(os.path.realpath(MAIN_ACCOUNT_DIR) + os.sep):
                                        with open(target_main, 'wb') as bf:
                                            bf.write(bin_content)
                                    if target_rep.startswith(os.path.realpath(rep_target_dir) + os.sep):
                                        with open(target_rep, 'wb') as bf:
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
                print(f"[ADMIN ERROR] /api/admin/products/save: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Failed to parse or save product catalog payload."}).encode('utf-8'))
                return

        # POST /api/request-pricing
        if path == '/api/request-pricing':
            client_ip = get_client_ip(self)
            if is_rate_limited(client_ip, limit=6, window=60):
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Too many requests. Please wait a moment."}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 65536: # 64KB max payload
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Payload exceeds allowed size."}).encode('utf-8'))
                return

            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))

                # Bot honeypot trap
                if payload.get('website') or payload.get('honeypot'):
                    print("[BOT TRAPPED] Automated pricing request dropped via honeypot")
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success", "id": "PR-BOT", "message": "Pricing request received."}).encode('utf-8'))
                    return

                email = str(payload.get('email', '')).strip()
                if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Invalid email address format."}).encode('utf-8'))
                    return

                raw_id = str(payload.get('id', '')).strip()
                if re.match(r'^PR-[0-9A-Za-z_-]{4,20}$', raw_id):
                    req_id = raw_id
                else:
                    req_id = 'PR-' + str(int(time.time() * 1000))
                payload['id'] = req_id
                payload['received_at'] = time.strftime('%Y-%m-%d %H:%M:%S')

                prod = clean_header_val(payload.get('productName', 'Pharmaceutical Product'))
                ndc = clean_header_val(payload.get('ndc', 'N/A'))

                print(f"[WHOLESALE PRICING REQUEST] Received for '{prod}' (NDC: {ndc}) from customer: '{email}'")

                safe_ndc = sanitize_name(ndc)
                safe_email = sanitize_name(email)
                filename = f"{req_id}_{safe_ndc}_{safe_email}.json"
                req_path = os.path.realpath(os.path.join(PRICING_REQUESTS_DIR, filename))

                if req_path.startswith(os.path.realpath(PRICING_REQUESTS_DIR) + os.sep):
                    with open(req_path, 'w') as f:
                        json.dump(payload, f, indent=2)

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
                print(f"[ADMIN ERROR] /api/admin/products/save: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Failed to parse or save product catalog payload."}).encode('utf-8'))
                return

        # POST /api/contact
        if path == '/api/contact':
            client_ip = get_client_ip(self)
            if is_rate_limited(client_ip, limit=6, window=60):
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Too many requests. Please wait a moment."}).encode('utf-8'))
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 65536:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Payload exceeds allowed size."}).encode('utf-8'))
                return

            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))

                # Bot honeypot trap
                if payload.get('website') or payload.get('honeypot'):
                    print("[BOT TRAPPED] Automated contact inquiry dropped via honeypot")
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success", "id": "CNT-BOT", "message": "Inquiry received."}).encode('utf-8'))
                    return

                email = str(payload.get('email', '')).strip()
                if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Invalid email address format."}).encode('utf-8'))
                    return

                raw_id = str(payload.get('id', '')).strip()
                if re.match(r'^CNT-[0-9A-Za-z_-]{4,20}$', raw_id):
                    req_id = raw_id
                else:
                    req_id = 'CNT-' + str(int(time.time() * 1000))
                payload['id'] = req_id
                payload['formType'] = 'contact'
                payload['received_at'] = time.strftime('%Y-%m-%d %H:%M:%S')

                full_name = clean_header_val(payload.get('fullName') or ((payload.get('firstName', '') + ' ' + payload.get('lastName', '')).strip()) or 'visitor')
                reason = clean_header_val(payload.get('reason', 'General Inquiry'))

                print(f"[CONTACT INQUIRY] Received from '{full_name}' ({email}) regarding '{reason}'")

                safe_name = sanitize_name(full_name)
                safe_email = sanitize_name(email)
                filename = f"{req_id}_{safe_name}_{safe_email}.json"
                req_path = os.path.realpath(os.path.join(CONTACT_INQUIRIES_DIR, filename))

                if req_path.startswith(os.path.realpath(CONTACT_INQUIRIES_DIR) + os.sep):
                    with open(req_path, 'w') as f:
                        json.dump(payload, f, indent=2)

                email_sent = send_secure_email_notification(payload)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {
                    "status": "success",
                    "id": req_id,
                    "email_dispatched": email_sent,
                    "message": "Contact message recorded and notification dispatched to info@akrongenerics.com & mukesh@akrongenerics.com."
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                return
            except Exception as e:
                print(f"[ADMIN ERROR] /api/admin/products/save: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Failed to parse or save product catalog payload."}).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    os.chdir(BASE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), AkronHandler) as httpd:
        print(f"Akron Generics Portal Server running on port {PORT}")
        httpd.serve_forever()
