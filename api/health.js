export default function handler(req, res) {
  const key  = process.env.FEDAPAY_SECRET_KEY || '';
  const mode = key.startsWith('sk_live_')    ? 'production'
             : key.startsWith('sk_sandbox_') ? 'sandbox'
             : 'INVALID';
  res.json({ status: 'ok', service: 'YourPass API', mode, timestamp: new Date().toISOString() });
}
