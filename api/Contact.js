// api/contact.js — YourPass
// Endpoint manquant référencé par js/Contact.js
// Envoie un email via Resend (ou log en sandbox)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { name, email, subject, message } = req.body || {};

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Champs requis : name, email, message' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  // ── Option A : Resend (recommandé) ───────────────────────────────────────
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const TO_EMAIL       = process.env.CONTACT_EMAIL || 'contact@yourpass.bj';

  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'YourPass Contact <noreply@yourpass.bj>',
          to: [TO_EMAIL],
          reply_to: email,
          subject: `[Contact YourPass] ${subject || 'Nouveau message'}`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#1C4DB8;">Nouveau message de contact</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;font-weight:600;color:#374151;">Nom :</td><td>${name}</td></tr>
                <tr><td style="padding:8px 0;font-weight:600;color:#374151;">Email :</td><td>${email}</td></tr>
                <tr><td style="padding:8px 0;font-weight:600;color:#374151;">Sujet :</td><td>${subject || '—'}</td></tr>
              </table>
              <hr style="margin:16px 0;border-color:#e5e7eb;">
              <p style="color:#374151;line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>
              <hr style="margin:16px 0;border-color:#e5e7eb;">
              <p style="font-size:12px;color:#9ca3af;">Envoyé depuis le formulaire YourPass le ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          `,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erreur Resend');
      return res.status(200).json({ success: true, message: 'Message envoyé avec succès !' });
    } catch (err) {
      console.error('[Contact] Erreur Resend:', err.message);
      // Fall through to log mode
    }
  }

  // ── Option B : Log (mode sandbox / RESEND_API_KEY non configuré) ─────────
  console.log('[Contact] Nouveau message (sandbox mode):', { name, email, subject, message });
  return res.status(200).json({
    success: true,
    message: 'Message reçu (mode sandbox — configurez RESEND_API_KEY sur Vercel pour l\'envoi réel)',
  });
}