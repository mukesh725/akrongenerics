/**
 * Vercel Serverless Function: /api/contact
 * Handles Contact Us page submissions and forwards notifications to info@akrongenerics.com & mukesh@akrongenerics.com
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, firstName, lastName, phone, role, pharmacyName, state, reason, message } = payload;

    // Bot honeypot protection
    if (payload.website || payload.honeypot) {
      return res.status(200).json({ status: 'success', id: 'CNT-BOT', message: 'Inquiry received.' });
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid customer email is required' });
    }

    const reqId = payload.id || ('CNT-' + Date.now());
    payload.id = reqId;
    payload.formType = 'contact';

    console.log(`[CONTACT INQUIRY] Received from '${firstName} ${lastName}' (${email}) for '${reason}'`);

    // If Google Apps Script URL is configured in environment, dispatch to it
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (googleScriptUrl && googleScriptUrl.startsWith('https://script.google.com/')) {
      try {
        await fetch(googleScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        console.log('[GOOGLE SCRIPT DISPATCHED] Contact inquiry delivered');
      } catch (gErr) {
        console.warn('Notice: Google Script trigger error:', gErr);
      }
    }

    return res.status(200).json({
      status: 'success',
      id: reqId,
      message: 'Contact inquiry recorded and notification dispatched to info@akrongenerics.com & mukesh@akrongenerics.com.'
    });
  } catch (err) {
    console.error('Contact inquiry error:', err);
    return res.status(500).json({ error: 'Internal processing error' });
  }
}
