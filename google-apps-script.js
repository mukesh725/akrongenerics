/**
 * ==============================================================================
 * AKRON GENERICS - UNIVERSAL GOOGLE APPS SCRIPT DISPATCHER (SECURITY HARDENED)
 * Handles:
 * 1. Wholesale Product Pricing Requests
 * 2. Contact Us Page Inquiries
 * 
 * Delivers directly to:
 * - Primary: info@akrongenerics.com
 * - Secondary (CC): mukesh@akrongenerics.com
 * 
 * Features:
 * - HTML Injection & Stored XSS Prevention (Strict Escaping)
 * - SMTP/Email Header CRLF Injection Prevention
 * - Automated Bot Honeypot Protection
 * - 100% In-House Google Cloud Execution — Zero 3rd Party SaaS Intermediaries
 * ==============================================================================
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanHeader(val) {
  return String(val || '').replace(/[\r\n\t]/g, ' ').trim();
}

function doPost(e) {
  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e.parameter) {
      data = e.parameter;
    }

    // Bot honeypot check: If hidden field is filled, silently discard
    if (data.website || data.honeypot) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Inquiry processed.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Recipients
    var primaryTo = 'info@akrongenerics.com';
    var secondaryCc = 'mukesh@akrongenerics.com';

    var isContactForm = (data.formType === 'contact' || data.message || data.reason || data.pharmacyName);

    var subject = '';
    var htmlBody = '';

    if (isContactForm) {
      // ------------------------------------------------------------------------
      // CONTACT US PAGE INQUIRY
      // ------------------------------------------------------------------------
      var rawFullName = ((data.firstName || '') + ' ' + (data.lastName || '')).trim() || 'Website Visitor';
      var rawEmail = data.email || 'N/A';
      var rawPhone = data.phone || 'N/A';
      var rawRole = data.role || 'N/A';
      var rawPharmacy = data.pharmacyName || 'N/A';
      var rawState = data.state || 'N/A';
      var rawReason = data.reason || 'General Inquiry';
      var rawMessage = data.message || '';
      var smsConsent = data.smsConsent ? 'Yes (Opted In)' : 'No';
      var timestamp = data.submittedAtFormatted || data.submittedAt || (new Date().toLocaleString());

      // Header-safe text
      var cleanFullName = cleanHeader(rawFullName);
      var cleanReason = cleanHeader(rawReason);
      var cleanPharmacy = cleanHeader(rawPharmacy);
      var cleanEmail = cleanHeader(rawEmail);

      subject = '📨 New Contact Inquiry: ' + cleanReason + ' — ' + cleanFullName + ' (' + cleanPharmacy + ')';

      // HTML-safe text
      var escFullName = escapeHtml(cleanFullName);
      var escReason = escapeHtml(cleanReason);
      var escPharmacy = escapeHtml(cleanPharmacy);
      var escEmail = escapeHtml(cleanEmail);
      var escPhone = escapeHtml(cleanHeader(rawPhone));
      var escRole = escapeHtml(cleanHeader(rawRole));
      var escState = escapeHtml(cleanHeader(rawState));
      var escMessage = escapeHtml(rawMessage);
      var escTimestamp = escapeHtml(cleanHeader(timestamp));

      htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
          <div style="background: #9E2235; color: #FFFFFF; padding: 22px 24px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #FECDD3; font-weight: bold; margin-bottom: 4px;">Akron Generics &bull; Contact Center</div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">New Customer Message Submitted</h2>
          </div>
          <div style="padding: 24px; color: #1E293B; line-height: 1.6;">
            <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
              <strong style="color: #991B1B; font-size: 14px;">Reason: ${escReason}</strong>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600; width: 35%;">Contact Name:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0F172A;">${escFullName}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Email Address:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0D498F;"><a href="mailto:${escEmail}" style="color: #0D498F; text-decoration: none;">${escEmail}</a></td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Phone Number:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;"><a href="tel:${escPhone}" style="color: #334155; text-decoration: none;">${escPhone}</a></td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Pharmacy / Practice:</td><td style="padding: 9px 0; font-size: 13.5px; font-weight: 600; color: #0F172A;">${escPharmacy}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Role:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">${escRole}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">State:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">${escState}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">SMS Consent:</td><td style="padding: 9px 0; font-size: 13px; color: #64748B;">${smsConsent}</td></tr>
              <tr><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Submitted Time:</td><td style="padding: 9px 0; font-size: 13px; color: #64748B;">${escTimestamp}</td></tr>
            </table>

            <div style="margin-bottom: 24px;">
              <div style="font-size: 12px; text-transform: uppercase; font-weight: bold; color: #64748B; margin-bottom: 8px;">Customer Message:</div>
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; font-size: 14px; color: #1E293B; white-space: pre-wrap; line-height: 1.6;">${escMessage}</div>
            </div>

            <div style="margin-bottom: 16px;">
              <a href="mailto:${escEmail}?subject=Re:%20Akron%20Generics%20Inquiry%20-%20${encodeURIComponent(cleanReason)}" style="display: inline-block; background: #9E2235; color: #FFFFFF; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 6px; text-decoration: none;">Reply to Customer &rarr;</a>
            </div>

            <div style="font-size: 11.5px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px;">
              Delivered to Primary: ${primaryTo} &bull; CC: ${secondaryCc} &bull; Akron Generics Secure Dispatcher.
            </div>
          </div>
        </div>
      `;
    } else {
      // ------------------------------------------------------------------------
      // WHOLESALE PRODUCT PRICING REQUEST
      // ------------------------------------------------------------------------
      var rawCustomerEmail = data.email || 'N/A';
      var rawProductName   = data.productName || 'Pharmaceutical Product';
      var rawNdc           = data.ndc || 'N/A';
      var rawPackaging     = data.packaging || 'N/A';
      var rawBrand         = data.brand || 'Akron Generics';
      var rawCategory      = data.category || 'General';
      var rawSpecs         = data.specs || '';
      var rawRequestedAt   = data.requestedAtFormatted || (new Date().toLocaleString());
      var rawSourceUrl     = data.sourceUrl || '';

      var cleanProd = cleanHeader(rawProductName);
      var cleanNdcVal = cleanHeader(rawNdc);
      var cleanCustEmail = cleanHeader(rawCustomerEmail);

      subject = '🔒 Wholesale Pricing Request: ' + cleanProd + ' (NDC: ' + cleanNdcVal + ') - ' + cleanCustEmail;

      var escCustomerEmail = escapeHtml(cleanCustEmail);
      var escProductName = escapeHtml(cleanProd);
      var escNdc = escapeHtml(cleanNdcVal);
      var escPackaging = escapeHtml(cleanHeader(rawPackaging));
      var escBrand = escapeHtml(cleanHeader(rawBrand));
      var escCategory = escapeHtml(cleanHeader(rawCategory));
      var escSpecs = escapeHtml(cleanHeader(rawSpecs));
      var escRequestedAt = escapeHtml(cleanHeader(rawRequestedAt));
      var escSourceUrl = escapeHtml(cleanHeader(rawSourceUrl));

      htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
          <div style="background: #0B2240; color: #FFFFFF; padding: 22px 24px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #93C5FD; font-weight: bold; margin-bottom: 4px;">Akron Generics &bull; Private In-House Alert</div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Wholesale Product Pricing Request</h2>
          </div>
          <div style="padding: 24px; color: #1E293B; line-height: 1.6;">
            <p style="margin-top: 0; font-size: 14.5px; color: #334155;">A pharmacy customer has requested official wholesale pricing:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 24px;">
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600; width: 38%;">Customer Email:</td><td style="padding: 10px 0; font-size: 14px; font-weight: 700; color: #0D498F;"><a href="mailto:${escCustomerEmail}" style="color: #0D498F; text-decoration: none;">${escCustomerEmail}</a></td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Product Requested:</td><td style="padding: 10px 0; font-size: 14px; font-weight: 700; color: #0F172A;">${escProductName}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">NDC:</td><td style="padding: 10px 0; font-size: 13px; font-family: monospace; color: #1E293B;">${escNdc}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Packaging Format:</td><td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${escPackaging}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Brand / Manufacturer:</td><td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${escBrand}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Category:</td><td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${escCategory}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Specifications:</td><td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${escSpecs}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Request Timestamp:</td><td style="padding: 10px 0; font-size: 13px; color: #64748B;">${escRequestedAt}</td></tr>
              <tr><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Source Page:</td><td style="padding: 10px 0; font-size: 12px; color: #64748B;">${escSourceUrl}</td></tr>
            </table>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
              <a href="mailto:${escCustomerEmail}?subject=Akron%20Generics%20Wholesale%20Pricing%3A%20${encodeURIComponent(cleanProd)}" style="display: inline-block; background: #16A34A; color: #FFFFFF; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 6px; text-decoration: none;">Reply to Customer &rarr;</a>
            </div>
            <div style="font-size: 11.5px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px;">
              Delivered to Primary: ${primaryTo} &bull; CC: ${secondaryCc} &bull; Akron Generics Secure Dispatcher.
            </div>
          </div>
        </div>
      `;
    }

    // Send email with Primary TO and Secondary CC
    MailApp.sendEmail({
      to: primaryTo,
      cc: secondaryCc,
      subject: subject,
      htmlBody: htmlBody
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Delivered to ' + primaryTo + ' and ' + secondaryCc
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
