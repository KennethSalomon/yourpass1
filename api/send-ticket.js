
// api/send-ticket.js — YourPass
// Appelé par success.html après confirmation du paiement
// Génère et envoie le billet par email (avec QR code en base64)

import QRCode from 'qrcode';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { transactionId, email, name, eventName, eventDate, eventVenue, ticketType, amount } = req.body || {};

  if (!transactionId || !email || !eventName) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }

  // Générer un ID de billet unique
  const ticketId = `YP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Données encodées dans le QR
  const qrData = JSON.stringify({
    ticketId,
    transactionId,
    event: eventName,
    date: eventDate,
    type: ticketType || 'Standard',
    holder: name,
    issued: new Date().toISOString(),
  });

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: { dark: '#1C4DB8', light: '#ffffff' },
    });
  } catch (err) {
    console.error('[Ticket] Erreur QR Code:', err.message);
    qrCodeDataUrl = '';
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (RESEND_API_KEY) {
    try {
      const emailHtml = buildTicketEmail({
        ticketId, transactionId, name, eventName,
        eventDate, eventVenue, ticketType, amount, qrCodeDataUrl,
      });

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'YourPass Billets <tickets@yourpass.bj>',
          to: [email],
          subject: `🎫 Votre billet — ${eventName}`,
          html: emailHtml,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erreur Resend');

      return res.status(200).json({
        success: true,
        ticketId,
        message: `Billet envoyé à ${email}`,
      });
    } catch (err) {
      console.error('[Ticket] Erreur envoi email:', err.message);
    }
  }

  // Mode sandbox
  console.log('[Ticket] Billet généré (sandbox):', { ticketId, transactionId, email, eventName });
  return res.status(200).json({
    success: true,
    ticketId,
    message: 'Billet généré (configurez RESEND_API_KEY pour l\'envoi réel)',
    sandbox: true,
  });
}

function buildTicketEmail({ ticketId, transactionId, name, eventName, eventDate, eventVenue, ticketType, amount, qrCodeDataUrl }) {
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1C4DB8,#4988C4);padding:32px 24px;text-align:center;color:#fff;">
      <div style="font-size:48px;margin-bottom:8px;">🎫</div>
      <h1 style="margin:0;font-size:26px;font-weight:800;">Votre billet est prêt !</h1>
      <p style="margin:8px 0 0;opacity:0.85;font-size:15px;">Merci pour votre achat sur YourPass</p>
    </div>

    <!-- Ticket Body -->
    <div style="padding:32px 24px;">
      <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">${eventName}</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${formattedDate}${eventVenue ? ' · ' + eventVenue : ''}</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-size:13px;color:#6b7280;border-radius:6px 0 0 6px;">Titulaire</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#111827;">${name || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;color:#6b7280;">Type de billet</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#111827;">${ticketType || 'Standard'}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-size:13px;color:#6b7280;">Montant payé</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#1C4DB8;">${amount ? Number(amount).toLocaleString('fr-FR') + ' XOF' : '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;color:#6b7280;">N° de billet</td>
          <td style="padding:10px 14px;font-size:13px;font-family:monospace;color:#374151;">${ticketId}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-size:13px;color:#6b7280;">Transaction</td>
          <td style="padding:10px 14px;font-size:13px;font-family:monospace;color:#374151;">${transactionId}</td>
        </tr>
      </table>

      <!-- QR Code -->
      ${qrCodeDataUrl ? `
      <div style="text-align:center;padding:24px;background:#f9fafb;border-radius:12px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;">Présentez ce QR code à l'entrée</p>
        <img src="${qrCodeDataUrl}" alt="QR Code billet" style="width:160px;height:160px;border-radius:8px;">
        <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">Valable uniquement pour ${eventName}</p>
      </div>
      ` : ''}

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;font-size:13px;color:#1d4ed8;">
        💡 <strong>Important :</strong> Conservez ce billet et présentez ce QR code (ou votre numéro de billet) à l'entrée de l'événement.
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 YourPass · La billetterie événementielle du Bénin</p>
      <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">En cas de problème, contactez-nous : <a href="mailto:support@yourpass.bj" style="color:#4988C4;">support@yourpass.bj</a></p>
    </div>
  </div>
</body>
</html>
  `;
}