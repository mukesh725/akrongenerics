/**
 * ==============================================================================
 * AKRON GENERICS - GOOGLE APPS SCRIPT EMAIL & LEADS DISPATCHER
 * 100% In-House Google Cloud Execution — Zero 3rd Party SaaS — Zero Hack Risk
 * ==============================================================================
 * 
 * INSTRUCTIONS TO DEPLOY (Takes 2 minutes):
 * 1. Open https://script.google.com/home/start (log in with any Google account)
 * 2. Click "+ New project"
 * 3. Replace all default code with this entire script.
 * 4. Click "Deploy" (top right) -> "New deployment"
 * 5. Select type: "Web app"
 * 6. Set Description: "Akron Generics Pricing Leads"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone"
 * 9. Click "Deploy" -> "Authorize access"
 * 10. Copy the Web App URL (starts with https://script.google.com/macros/s/...)
 * 11. Paste that URL into your .env file as:
 *     GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
 * 
 * THAT'S IT! Every time a customer requests wholesale pricing on any product,
 * Google will automatically format the email and deliver it directly to info@akrongenerics.com!
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

    var customerEmail = data.email || 'N/A';
    var productName   = data.productName || 'Pharmaceutical Product';
    var ndc           = data.ndc || 'N/A';
    var packaging     = data.packaging || 'N/A';
    var brand         = data.brand || 'Akron Generics';
    var category      = data.category || 'General';
    var specs         = data.specs || '';
    var requestedAt   = data.requestedAtFormatted || (new Date().toLocaleString());
    var sourceUrl     = data.sourceUrl || '';

    // Target inbox: Your GoDaddy corporate email address
    var recipient = 'info@akrongenerics.com';
    var subject = '🔒 Wholesale Pricing Request: ' + productName + ' (NDC: ' + ndc + ') - ' + customerEmail;

    var htmlBody = `
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
            Confidential &bull; Dispatched directly via Akron Generics Private Google Apps Script &bull; No third-party data tracking.
          </div>
        </div>
      </div>
    `;

    // Send email directly to info@akrongenerics.com
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });

    // Optional: If this script is created inside a Google Sheet, auto-log as a row
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet();
      if (sheet) {
        var tab = sheet.getActiveSheet();
        tab.appendRow([new Date(), customerEmail, productName, ndc, packaging, brand, category, specs, sourceUrl]);
      }
    } catch (sheetErr) {}

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Email dispatched successfully' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
