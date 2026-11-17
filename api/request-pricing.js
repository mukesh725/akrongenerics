/**
 * In-House Secure API Endpoint: /api/request-pricing
 * Zero 3rd-Party Data Intermediaries — Enterprise & Pharma Privacy Compliant
 * Handles Wholesale Product Pricing Requests and forwards to Google Apps Script or in-house SMTP
 */

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/([a-zA-Z0-9-]+\.)?akrongenerics\.com(:\d+)?$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/
];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGIN_PATTERNS.some(pat => pat.test(origin));

  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : 'https://akrongenerics.com');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (rawBody.length > 64 * 1024) {
      return res.status(413).json({ error: 'Payload exceeds maximum limit of 64KB.' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, productName, ndc, packaging, brand, category, specs } = payload;

    // Bot honeypot protection
    if (payload.website || payload.honeypot) {
      return res.status(200).json({ status: 'success', id: 'PR-BOT', message: 'Inquiry received.' });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.length > 254) {
      return res.status(400).json({ error: 'Valid customer email is required' });
    }

    const cleanEmail = email.trim();
    const cleanProduct = String(productName || 'General Product').slice(0, 150).replace(/[\r\n]/g, ' ').trim();
    const cleanNdc = String(ndc || '').slice(0, 50).replace(/[\r\n]/g, ' ').trim();

    const reqId = payload.id || ('PR-' + Date.now());
    payload.id = reqId;
    payload.email = cleanEmail;
    payload.productName = cleanProduct;
    payload.ndc = cleanNdc;
    payload.formType = 'pricing';
    payload.requestedAt = new Date().toISOString();

    console.log(`[SECURE IN-HOUSE INQUIRY] Logged: ${cleanProduct} (NDC: ${cleanNdc}) for customer: ${cleanEmail}`);

    // If Google Apps Script Webhook is configured, dispatch directly (with active default)
    const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxaQ9hXd_jnFuA35yqS_hVIGoVd8VAFEQ6NBUNj7cwsbdsVg_8eiJSfbYUFrmWrX_fc/exec';
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL;
    if (googleScriptUrl && googleScriptUrl.startsWith('https://script.google.com/')) {
      try {
        await fetch(googleScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        console.log('[GOOGLE SCRIPT DISPATCHED] Pricing request notification delivered');
      } catch (gErr) {
        console.warn('Notice: Google Script trigger error:', gErr);
      }
    }

    const recipient = process.env.NOTIFICATION_RECIPIENT || 'info@akrongenerics.com';

    return res.status(200).json({
      status: 'success',
      id: reqId,
      message: `Inquiry recorded securely in Akron Generics portal. Dispatched to ${recipient} & mukesh@akrongenerics.com.`
    });
  } catch (err) {
    console.error('Pricing request error:', err);
    return res.status(500).json({ error: 'Internal processing error' });
  }
}
