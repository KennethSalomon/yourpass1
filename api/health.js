export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key  = process.env.FEDAPAY_SECRET_KEY || '';
  const mode = key.startsWith('sk_live_')    ? 'production'
             : key.startsWith('sk_sandbox_') ? 'sandbox'
             : 'INVALID_KEY';
  const callback = process.env.CALLBACK_URL || 'NON DÉFINIE';
  res.json({
    status: 'ok',
    service: 'YourPass API',
    mode,
    callback_url: callback,
    key_preview: key ? key.slice(0, 12) + '...' : 'MANQUANTE',
    timestamp: new Date().toISOString()
  });
}