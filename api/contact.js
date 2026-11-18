/**
 * Vercel Serverless Function: /api/contact
 * Handles Contact Us page submissions and forwards notifications to info@akrongenerics.com & mukesh@akrongenerics.com
 */

const ALLOWED_ORIGIN_PATTERNS = process.env.NODE_ENV === 'production'
  ? [/^https:\/\/([a-zA-Z0-9-]+\.)?akrongenerics\.com$/]
  : [
      /^https:\/\/([a-zA-Z0-9-]+\.)?akrongenerics\.com$/,
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/
    ];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGIN_PATTERNS.some(pat => pat.test(origin));
  
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : 'https://www.akrongenerics.com');
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
    const { email, firstName, lastName, phone, role, pharmacyName, state, reason, message } = payload;

    // 1. Bot Honeypot Protection: catches automated script population
    if (payload.website || payload.honeypot || payload.company_fax) {
      return res.status(200).json({ status: 'success', id: 'CNT-BOT', message: 'Inquiry received.' });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.length > 254) {
      return res.status(400).json({ error: 'Valid customer email is required' });
    }

    const cleanEmail = email.trim();
    const cleanFirstName = String(firstName || '').slice(0, 100).replace(/[\r\n]/g, ' ').trim();
    const cleanLastName = String(lastName || '').slice(0, 100).replace(/[\r\n]/g, ' ').trim();
    const cleanPharmacy = String(pharmacyName || '').slice(0, 150).replace(/[\r\n]/g, ' ').trim();
    const cleanReason = String(reason || 'General Inquiry').slice(0, 150).replace(/[\r\n]/g, ' ').trim();

    // 2. Dot-Stuffed Gmail Spambot Check (e.g. bo.le.m.o.m.ex.12.1@gmail.com)
    const emailLower = cleanEmail.toLowerCase();
    if (emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com')) {
      const userPart = emailLower.split('@')[0];
      const dotCount = (userPart.match(/\./g) || []).length;
      if (dotCount >= 3) {
        console.warn(`[BOT BLOCKED] Dropping dot-stuffed Gmail spam: ${cleanEmail}`);
        return res.status(200).json({ status: 'success', id: 'CNT-BOT-GMAIL', message: 'Inquiry received.' });
      }
    }

    // 3. Pure Numeric Dummy Message Check (e.g. "7481402532")
    const cleanMsgDigits = String(message || '').replace(/[\s\-_]/g, '');
    if (cleanMsgDigits.length >= 6 && /^\d+$/.test(cleanMsgDigits)) {
      console.warn(`[BOT BLOCKED] Dropping dummy numeric-only message: ${cleanMsgDigits}`);
      return res.status(200).json({ status: 'success', id: 'CNT-BOT-NUM', message: 'Inquiry received.' });
    }

    // 4. Gibberish Name / Practice Filter (Consonant clusters with zero vowels)
    if (cleanPharmacy.length >= 5 && !/[aeiouy]/i.test(cleanPharmacy)) {
      console.warn(`[BOT BLOCKED] Dropping consonant-only gibberish practice: ${cleanPharmacy}`);
      return res.status(200).json({ status: 'success', id: 'CNT-BOT-GIBBERISH', message: 'Inquiry received.' });
    }

    const reqId = payload.id || ('CNT-' + Date.now());
    payload.id = reqId;
    payload.email = cleanEmail;
    payload.formType = 'contact';

    console.log(`[CONTACT INQUIRY] Received from '${cleanFirstName} ${cleanLastName}' (${cleanEmail}) for '${cleanReason}'`);

    // If Google Apps Script URL is configured in environment, dispatch to it (with active default)
    const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxaQ9hXd_jnFuA35yqS_hVIGoVd8VAFEQ6NBUNj7cwsbdsVg_8eiJSfbYUFrmWrX_fc/exec';
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL;
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
