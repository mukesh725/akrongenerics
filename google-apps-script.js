/**
 * ==============================================================================
 * AKRON GENERICS - UNIVERSAL GOOGLE APPS SCRIPT DISPATCHER
 * Handles:
 * 1. Wholesale Product Pricing Requests
 * 2. Contact Us Page Inquiries
 * 
 * Delivers directly to:
 * - Primary: info@akrongenerics.com
 * - Secondary (CC): mukesh@akrongenerics.com
 * 
 * 100% In-House Google Cloud Execution — Zero 3rd Party SaaS — Zero Hack Risk
 * ==============================================================================
 */

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
      var fullName = ((data.firstName || '') + ' ' + (data.lastName || '')).trim() || 'Website Visitor';
      var email = data.email || 'N/A';
      var phone = data.phone || 'N/A';
      var role = data.role || 'N/A';
      var pharmacyName = data.pharmacyName || 'N/A';
      var state = data.state || 'N/A';
      var reason = data.reason || 'General Inquiry';
      var message = data.message || '';
      var smsConsent = data.smsConsent ? 'Yes (Opted In)' : 'No';
      var timestamp = data.submittedAt || (new Date().toLocaleString());

      subject = '📨 New Contact Inquiry: ' + reason + ' — ' + fullName + ' (' + pharmacyName + ')';

      htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
          <div style="background: #9E2235; color: #FFFFFF; padding: 22px 24px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #FECDD3; font-weight: bold; margin-bottom: 4px;">Akron Generics &bull; Contact Center</div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">New Customer Message Submitted</h2>
          </div>
          <div style="padding: 24px; color: #1E293B; line-height: 1.6;">
            <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
              <strong style="color: #991B1B; font-size: 14px;">Reason: ${reason}</strong>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600; width: 35%;">Contact Name:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0F172A;">${fullName}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Email Address:</td><td style="padding: 9px 0; font-size: 14px; font-weight: 700; color: #0D498F;"><a href="mailto:${email}" style="color: #0D498F; text-decoration: none;">${email}</a></td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Phone Number:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;"><a href="tel:${phone}" style="color: #334155; text-decoration: none;">${phone}</a></td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Pharmacy / Practice:</td><td style="padding: 9px 0; font-size: 13.5px; font-weight: 600; color: #0F172A;">${pharmacyName}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Role:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">${role}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">State:</td><td style="padding: 9px 0; font-size: 13.5px; color: #334155;">${state}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">SMS Consent:</td><td style="padding: 9px 0; font-size: 13px; color: #64748B;">${smsConsent}</td></tr>
              <tr><td style="padding: 9px 0; color: #64748B; font-size: 13px; font-weight: 600;">Submitted Time:</td><td style="padding: 9px 0; font-size: 13px; color: #64748B;">${timestamp}</td></tr>
            </table>

            <div style="margin-bottom: 24px;">
              <div style="font-size: 12px; text-transform: uppercase; font-weight: bold; color: #64748B; margin-bottom: 8px;">Customer Message:</div>
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; font-size: 14px; color: #1E293B; white-space: pre-wrap; line-height: 1.6;">${message}</div>
            </div>

            <div style="margin-bottom: 16px;">
              <a href="mailto:${email}?subject=Re:%20Akron%20Generics%20Inquiry%20-%20${encodeURIComponent(reason)}&body=Dear%20${encodeURIComponent(fullName)},%0D%0A%0D%0AThank%20you%20for%20contacting%20Akron%20Generics.%20" style="display: inline-block; background: #9E2235; color: #FFFFFF; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 6px; text-decoration: none;">Reply to Customer &rarr;</a>
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
      var customerEmail = data.email || 'N/A';
      var productName   = data.productName || 'Pharmaceutical Product';
      var ndc           = data.ndc || 'N/A';
      var packaging     = data.packaging || 'N/A';
      var brand         = data.brand || 'Akron Generics';
      var category      = data.category || 'General';
      var specs         = data.specs || '';
      var requestedAt   = data.requestedAtFormatted || (new Date().toLocaleString());
      var sourceUrl     = data.sourceUrl || '';

      subject = '🔒 Wholesale Pricing Request: ' + productName + ' (NDC: ' + ndc + ') - ' + customerEmail;

      htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
          <div style="background: #0B2240; color: #FFFFFF; padding: 22px 24px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #93C5FD; font-weight: bold; margin-bottom: 4px;">Akron Generics &bull; Private In-House Alert</div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Wholesale Product Pricing Request</h2>
          </div>
          <div style="padding: 24px; color: #1E293B; line-height: 1.6;">
            <p style="margin-top: 0; font-size: 14.5px; color: #334155;">A pharmacy customer has requested official wholesale pricing:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 24px;">
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600; width: 38%;">Customer Email:</td><td style="padding: 10px 0; font-size: 14px; font-weight: 700; color: #0D498F;"><a href="mailto:${customerEmail}" style="color: #0D498F; text-decoration: none;">${customerEmail}</a></td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Product Requested:</td><td style="padding: 10px 0; font-size: 14px; font-weight: 700; color: #0F172A;">${productName}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">NDC:</td><td style="padding: 10px 0; font-size: 13px; font-family: monospace; color: #1E293B;">${ndc}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Packaging Format:</td><td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${packaging}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Brand / Manufacturer:</td><td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${brand}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Category:</td><td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${category}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Specifications:</td><td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${specs}</td></tr>
              <tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Request Timestamp:</td><td style="padding: 10px 0; font-size: 13px; color: #64748B;">${requestedAt}</td></tr>
              <tr><td style="padding: 10px 0; color: #64748B; font-size: 13px; font-weight: 600;">Source Page:</td><td style="padding: 10px 0; font-size: 12px; color: #64748B;">${sourceUrl}</td></tr>
            </table>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
              <a href="mailto:${customerEmail}?subject=Akron%20Generics%20Wholesale%20Pricing%3A%20${encodeURIComponent(productName)}&body=Hello,%0D%0A%0D%0AThank%20you%20for%20contacting%20Akron%20Generics.%20Attached%20is%20our%20wholesale%20pricing%20schedule%20for%20${encodeURIComponent(productName)}.%0D%0A%0D%0ABest%20regards,%0D%0AAkron%20Generics%20Sales%20Team" style="display: inline-block; background: #16A34A; color: #FFFFFF; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 6px; text-decoration: none;">Reply to Customer &rarr;</a>
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
