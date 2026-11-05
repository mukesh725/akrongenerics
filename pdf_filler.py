import os
import io
import base64
import pypdf
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from PIL import Image

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PDF_TEMPLATES = {
    "credit_app": os.path.join(BASE_DIR, "customer pdfs", "Akron-Generics-Account-Set-Up-documents-Credit-Application.pdf"),
    "credit_card": os.path.join(BASE_DIR, "customer pdfs", "Akron-Generics-Account-Set-Up-documents-Credit-Card-Authorization-form.pdf"),
    "ach": os.path.join(BASE_DIR, "customer pdfs", "Akron-Generics-Account-Set-Up-documents-ACH-Payment-Authorization-Form.pdf"),
    "terms": os.path.join(BASE_DIR, "customer pdfs", "Akron-Generics-Account-Set-Up-documents-Terms-and-Conditions-form.pdf"),
    "letter_resp": os.path.join(BASE_DIR, "customer pdfs", "Akron-Generics-Letter-of-Responsibility.pdf")
}

# Exact signature bounding boxes (x, y, width, height) in 72dpi points
SIG_BOXES = {
    "credit_app": (88.0, 63.0, 140.0, 22.0),
    "credit_card": (49.0, 120.0, 170.0, 25.0),
    "ach": (121.0, 83.0, 230.0, 24.0),
    "terms": (347.0, 158.0, 190.0, 22.0),
    "letter_resp": (128.0, 170.0, 250.0, 18.0)
}

def create_sig_overlay(sig_data_url, x, y, w, h):
    """Generate a 1-page PDF overlay containing the signature image at (x, y, w, h)"""
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    if sig_data_url and "," in sig_data_url:
        try:
            _, b64 = sig_data_url.split(",", 1)
            img_bytes = base64.b64decode(b64)
            img = Image.open(io.BytesIO(img_bytes))
            png_io = io.BytesIO()
            img.save(png_io, format='PNG')
            png_io.seek(0)
            from reportlab.lib.utils import ImageReader
            can.drawImage(ImageReader(png_io), x, y, width=w, height=h, mask='auto', preserveAspectRatio=True)
        except Exception as e:
            print("Notice: Signature overlay draw:", e)
    can.showPage()
    can.save()
    packet.seek(0)
    reader = pypdf.PdfReader(packet)
    if len(reader.pages) > 0:
        return reader.pages[0]
    return None

def fill_form_page(template_path, field_values, sig_data_url=None, sig_box=None):
    """Fill AcroForm fields and optionally stamp digital signature overlay"""
    reader = pypdf.PdfReader(template_path)
    writer = pypdf.PdfWriter()
    writer.append(reader)
    
    # Fill fields on page 0
    writer.update_page_form_field_values(writer.pages[0], field_values, flags=0)
    
    # If signature provided, stamp onto page 0
    if sig_data_url and sig_box:
        sig_overlay = create_sig_overlay(sig_data_url, *sig_box)
        if sig_overlay:
            writer.pages[0].merge_page(sig_overlay)
        
    out_io = io.BytesIO()
    writer.write(out_io)
    out_io.seek(0)
    return pypdf.PdfReader(out_io).pages[0]

def image_to_pdf_page(data_url, title="Attached Document"):
    """Convert uploaded image (data URL) to a clean 8.5x11 PDF page with header"""
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    
    # Header bar
    can.setFont("Helvetica-Bold", 13)
    can.setFillColorRGB(0.05, 0.28, 0.56) # Akron Royal Blue
    can.drawString(40, 755, "Akron Generics — Customer Onboarding Document")
    
    can.setFont("Helvetica", 10)
    can.setFillColorRGB(0.3, 0.3, 0.3)
    can.drawString(40, 738, f"Attachment: {title}")
    can.setStrokeColorRGB(0.8, 0.8, 0.8)
    can.setLineWidth(1)
    can.line(40, 730, 572, 730)
    
    # Draw image centered
    if data_url and "," in data_url:
        try:
            _, b64 = data_url.split(",", 1)
            img_bytes = base64.b64decode(b64)
            img = Image.open(io.BytesIO(img_bytes))
            
            # Max width 510, max height 650
            max_w, max_h = 510, 650
            img_w, img_h = img.size
            ratio = min(max_w / img_w, max_h / img_h, 1.0)
            target_w = img_w * ratio
            target_h = img_h * ratio
            target_x = 40 + (max_w - target_w) / 2
            target_y = 700 - target_h
            
            png_io = io.BytesIO()
            img.save(png_io, format='PNG')
            png_io.seek(0)
            from reportlab.lib.utils import ImageReader
            can.drawImage(ImageReader(png_io), target_x, target_y, width=target_w, height=target_h, preserveAspectRatio=True)
        except Exception as e:
            print("Notice: Attachment image embedding fallback:", e)
            can.drawString(40, 600, f"[Attached Document: {title}]")
    else:
        can.drawString(40, 600, f"[Attached Document: {title}]")
        
    can.showPage()
    can.save()
    packet.seek(0)
    reader = pypdf.PdfReader(packet)
    if len(reader.pages) > 0:
        return reader.pages[0]
    return None

def generate_consolidated_application_pdf(data, output_path=None):
    """
    Takes JSON application data, fills all 5 original Akron Generics PDF templates,
    applies the applicant's digital signature, appends uploaded licenses as sequential pages,
    and returns bytes (or writes to output_path).
    """
    writer = pypdf.PdfWriter()
    
    # Helper extractors
    business_name = data.get("legalBusinessName") or data.get("pharmacyName") or data.get("businessName") or "New Pharmacy Account"
    today_str = data.get("signatureDate") or data.get("submissionDate")
    if not today_str:
        import datetime
        today_str = datetime.date.today().strftime("%m/%d/%Y")
        
    officer_name = data.get("authOfficerName") or data.get("contactName") or "Authorized Pharmacist"
    officer_title = data.get("authOfficerTitle") or data.get("contactTitle") or "Supervising Pharmacist / Owner"
    sales_mgr = data.get("salesManager") or "Main Account"
    rep_email = data.get("repEmail") or data.get("representativeEmail") or ""
    rep_info = f"{sales_mgr} ({rep_email})" if (rep_email and sales_mgr != "Main Account") else sales_mgr
    
    # Signatures
    sig_resp = data.get("sigResp") or data.get("signatureImage")
    sig_ach = data.get("sigAch") or sig_resp
    sig_cc = data.get("sigCc") or sig_resp
    sig_terms = data.get("sigTerms") or sig_resp
    
    # Billing address
    b_addr = data.get("billingAddress1") or data.get("billingAddress") or ""
    b_city = data.get("billingCity") or ""
    b_state = data.get("billingState") or ""
    b_zip = data.get("billingZip") or ""
    
    # Shipping address
    s_addr = data.get("shippingAddress1") or data.get("shippingAddress") or b_addr
    s_city = data.get("shippingCity") or b_city
    s_state = data.get("shippingState") or b_state
    s_zip = data.get("shippingZip") or b_zip
    
    # Phones & emails
    b_phone = data.get("businessPhone") or ""
    b_fax = data.get("businessFax") or ""
    b_email = data.get("businessEmail") or ""
    c_name = data.get("contactName") or officer_name
    c_phone = data.get("contactPhone") or b_phone
    c_email = data.get("contactEmail") or b_email
    
    # Bank info
    bank_name = data.get("bankName") or ""
    bank_acct = data.get("bankAccountNumber") or ""
    bank_rout = data.get("bankRouting") or ""
    bank_addr = data.get("bankAddress") or ""
    bank_city = data.get("bankCity") or ""
    bank_state = data.get("bankState") or ""
    bank_zip = data.get("bankZip") or ""
    bank_contact = data.get("bankContactName") or ""
    bank_phone = data.get("bankPhone") or ""
    
    # Trade ref 1
    t1_name = data.get("tradeRef1Name") or ""
    t1_phone = data.get("tradeRef1Phone") or ""
    t1_fax = data.get("tradeRef1Fax") or ""
    t1_email = data.get("tradeRef1Email") or ""
    t1_addr = data.get("tradeRef1Address") or ""
    t1_city = data.get("tradeRef1City") or ""
    t1_state = data.get("tradeRef1State") or ""
    t1_zip = data.get("tradeRef1Zip") or ""
    
    # Trade ref 2
    t2_name = data.get("tradeRef2Name") or ""
    t2_phone = data.get("tradeRef2Phone") or ""
    t2_fax = data.get("tradeRef2Fax") or ""
    t2_email = data.get("tradeRef2Email") or ""
    t2_addr = data.get("tradeRef2Address") or ""
    t2_city = data.get("tradeRef2City") or ""
    t2_state = data.get("tradeRef2State") or ""
    t2_zip = data.get("tradeRef2Zip") or ""

    # ---------------- 1. CREDIT APPLICATION ----------------
    credit_fields = {
        'Business Name': business_name,
        'Address': b_addr,
        'City': b_city,
        'State': b_state,
        'Zip': b_zip,
        'Phone Number': b_phone,
        'Fax': b_fax,
        'Email': b_email,
        'Address_2': s_addr,
        'City_2': s_city,
        'State_2': s_state,
        'Zip_2': s_zip,
        'No of employees': str(data.get("employeeCount") or "1-10"),
        'Year Business Started': str(data.get("yearStarted") or "2020"),
        'Main Contact Name': c_name,
        'Phone Number_2': c_phone,
        'Email_2': c_email,
        'Bank Name': bank_name,
        'Account': bank_acct,
        'Address_3': bank_addr,
        'City_3': bank_city,
        'State_3': bank_state,
        'Zip_3': bank_zip,
        'Contact Name': bank_contact,
        'Phone Number_3': bank_phone,
        'Company Name': t1_name,
        'Phone': t1_phone,
        'Fax_2': t1_fax,
        'Address_4': t1_addr,
        'Email_3': t1_email,
        'City_4': t1_city,
        'State_4': t1_state,
        'Zip_4': t1_zip,
        'Company Name_2': t2_name,
        'Phone_2': t2_phone,
        'Fax_3': t2_fax,
        'Address_5': t2_addr,
        'Email_4': t2_email,
        'City_5': t2_city,
        'State_5': t2_state,
        'Zip_5': t2_zip,
        'Name': officer_name,
        'Title': officer_title,
        'Date': today_str
    }
    p1 = fill_form_page(PDF_TEMPLATES["credit_app"], credit_fields, sig_resp, SIG_BOXES["credit_app"])
    writer.add_page(p1)
    
    # ---------------- 2. CREDIT CARD AUTHORIZATION ----------------
    cc_billing = data.get("cardBillingAddress") or b_addr
    cc_city = data.get("cardCity") or b_city
    cc_state = data.get("cardState") or b_state
    cc_zip = data.get("cardZip") or b_zip
    
    cc_fields = {
        'Invoice Numbers': "Ongoing Wholesale Purchases / Invoices",
        'Payment': data.get("creditLimitRequested") or "As Invoiced / Due",
        'Name That Appears on the Card': data.get("cardholderName") or officer_name,
        'Credit Card Number': data.get("cardNumber") or "",
        'exp 1': data.get("cardExpMonth") or "",
        'exp 2': data.get("cardExpYear") or "",
        'CVV': data.get("cardCvv") or "",
        'Credit Card Billing Address': cc_billing,
        'City State Zip': f"{cc_city}, {cc_state} {cc_zip}",
        'state 10': cc_state,
        'xip 10': cc_zip,
        'Name_2': officer_name,
        'Title_2': officer_title,
        'Email_5': c_email,
        'Phone': c_phone,
        'undefined_2': today_str
    }
    p2 = fill_form_page(PDF_TEMPLATES["credit_card"], cc_fields, sig_cc, SIG_BOXES["credit_card"])
    writer.add_page(p2)
    
    # ---------------- 3. ACH AUTHORIZATION ----------------
    ach_fields = {
        'Customer Name': business_name,
        'Customer Account': data.get("ref_id", "NEW ACCOUNT"),
        'I': officer_name,
        'Billing Address': f"{b_addr}, {b_city}, {b_state} {b_zip}",
        'Phone Email': f"{b_phone} / {b_email}",
        'Name on Acct': data.get("bankAccountName") or business_name,
        'Bank Name_2': bank_name,
        'Account Number': bank_acct,
        'Bank Routing': bank_rout,
        'BankCityState': f"{bank_city}, {bank_state}",
        'DATE': today_str,
        'email 10': b_email
    }
    p3 = fill_form_page(PDF_TEMPLATES["ach"], ach_fields, sig_ach, SIG_BOXES["ach"])
    writer.add_page(p3)
    
    # ---------------- 4. TERMS & CONDITIONS ----------------
    terms_fields = {
        'Duly authorized for and on behalf of': business_name,
        'Print Name': officer_name,
        'Date_2': today_str
    }
    p4 = fill_form_page(PDF_TEMPLATES["terms"], terms_fields, sig_terms, SIG_BOXES["terms"])
    writer.add_page(p4)
    
    # ---------------- 5. LETTER OF RESPONSIBILITY ----------------
    tax_id = data.get("taxId") or data.get("ein") or data.get("federalTaxId") or ""
    letter_fields = {
        'Please note that': business_name,
        'TAX ID NUMBER': tax_id,
        'Pharmacy Name': business_name,
        'Name': data.get("owner1Name") or officer_name,
        'Title': data.get("owner1Title") or officer_title,
        'Phone': data.get("owner1Phone") or b_phone,
        'Email': data.get("owner1Email") or b_email,
        'Name_2': data.get("owner2Name") or "",
        'Title_2': data.get("owner2Title") or "",
        'Phone_2': data.get("owner2Phone") or "",
        'Email_2': data.get("owner2Email") or "",
        'Address': b_addr,
        'SuiteBuilding': data.get("billingAddress2") or "",
        'City': b_city,
        'State': b_state,
        'Zip Code': b_zip,
        'Phone_3': b_phone,
        'Email_3': b_email,
        'Name_3': officer_name,
        'Title_3': officer_title,
        'Date': today_str,
        'Sales Representative Name 1': rep_info,
        'Sales Representative Name 2': ""
    }
    p5 = fill_form_page(PDF_TEMPLATES["letter_resp"], letter_fields, sig_resp, SIG_BOXES["letter_resp"])
    writer.add_page(p5)
    
    # ---------------- 6. ATTACHED DOCUMENTS ----------------
    # Check both direct properties and attachments dictionary
    attached_items = []
    
    if data.get("stateLicenseFile"):
        attached_items.append(("State Board of Pharmacy License", data["stateLicenseFile"]))
    if data.get("deaLicenseFile"):
        attached_items.append(("DEA Registration Certificate", data["deaLicenseFile"]))
    if data.get("voidedCheckFile"):
        attached_items.append(("Voided Check / Bank Letter", data["voidedCheckFile"]))
        
    attachments_dict = data.get("attachments") or {}
    for cat, flist in attachments_dict.items():
        if isinstance(flist, list):
            for item in flist:
                if isinstance(item, dict) and item.get("dataUrl"):
                    attached_items.append((item.get("name") or f"Attachment ({cat})", item["dataUrl"]))
                    
    for title, file_data in attached_items:
        if not file_data:
            continue
        if "data:application/pdf;base64," in file_data:
            try:
                b64 = file_data.split(",", 1)[1]
                pdf_bytes = base64.b64decode(b64)
                sub_reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
                for page in sub_reader.pages:
                    writer.add_page(page)
            except Exception as e:
                print(f"Notice: Appending PDF attachment {title}:", e)
        elif "data:image/" in file_data:
            page = image_to_pdf_page(file_data, title)
            if page:
                writer.add_page(page)

    # Enable NeedAppearances so all standard PDF viewers render form field text cleanly
    try:
        if "/AcroForm" not in writer._root_object:
            writer._root_object.update({
                pypdf.generic.NameObject("/AcroForm"): pypdf.generic.DictionaryObject()
            })
        writer._root_object["/AcroForm"].update({
            pypdf.generic.NameObject("/NeedAppearances"): pypdf.generic.BooleanObject(True)
        })
    except Exception as e:
        pass

    out_io = io.BytesIO()
    writer.write(out_io)
    out_bytes = out_io.getvalue()
    
    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(out_bytes)
            
    return out_bytes
