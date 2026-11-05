import http.server
import socketserver
import json
import os
import re
import base64
import time
import urllib.parse
import pdf_filler

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SUBMISSIONS_DIR = os.path.join(BASE_DIR, 'submissions')
MAIN_ACCOUNT_DIR = os.path.join(SUBMISSIONS_DIR, 'main_account')
BY_REP_DIR = os.path.join(SUBMISSIONS_DIR, 'by_representative')

os.makedirs(MAIN_ACCOUNT_DIR, exist_ok=True)
os.makedirs(BY_REP_DIR, exist_ok=True)

def sanitize_name(name):
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', str(name).strip().lower())

class AkronHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
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

        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    os.chdir(BASE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), AkronHandler) as httpd:
        print(f"Akron Generics Portal Server running on port {PORT}")
        httpd.serve_forever()
