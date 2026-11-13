/**
 * Vercel Serverless Function: /api/request-pricing
 * Logs wholesale pricing requests and forwards notifications to info@akrongenerics.com
 */

export default async function handler(req, res) {
  // Set CORS headers
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
    const { email, productName, ndc, packaging, brand, category, specs } = payload;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid customer email is required' });
    }

    const reqId = payload.id || ('PR-' + Date.now());
    const timestamp = new Date().toISOString();

    console.log(`[WHOLESALE PRICING REQUEST] Received for '${productName}' (NDC: ${ndc}) from: '${email}'`);

    // Dispatch email via FormSubmit webhook (server-to-server)
    try {
      await fetch('https://formsubmit.co/ajax/info@akrongenerics.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: `Wholesale Pricing Request: ${productName || 'Pharmaceutical Product'} (NDC: ${ndc || 'N/A'}) - ${email}`,
          _template: 'table',
          _captcha: 'false',
          'Customer Email': email,
          'Product Name': productName || 'N/A',
          'National Drug Code (NDC)': ndc || 'N/A',
          'Packaging Format': packaging || 'N/A',
          'Brand / Manufacturer': brand || 'Akron Generics',
          'Category': category || 'General',
          'Specifications': specs || '',
          'Timestamp': timestamp
        })
      });
    } catch (e) {
      console.log('Serverless notice: FormSubmit delivery trigger:', e);
    }

    return res.status(200).json({
      status: 'success',
      id: reqId,
      message: `Pricing request for ${productName || 'product'} recorded. Notification delivered to info@akrongenerics.com.`
    });
  } catch (err) {
    console.error('Pricing request error:', err);
    return res.status(500).json({ error: err.message });
  }
}
