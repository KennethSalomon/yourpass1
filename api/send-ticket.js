// api/send-ticket.js — YourPass
// Génère un QR Code et envoie le billet final par email via Resend

import QRCode from 'qrcode';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { 
    transactionId, 
    email, 
    name, 
    eventName, 
    eventDate, 
    eventVenue, 
    ticketType, 
    amount 
  } = req.body || {};

  // Validation des champs obligatoires
  if (!transactionId || !email || !eventName) {
    return res.status(400).json({ error: 'Données de billet incomplètes' });
  }

  try {
    // 1. Génération d'un ID de billet unique
    const ticketId = `YP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // 2. Génération du QR Code (Base64)
    // On encode les infos essentielles pour la vérification à l'entrée
    const qrData = JSON.stringify({
      t: ticketId,
      tx: transactionId,
      ev: eventName,
      h: name || 'Client'
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    // 3. Envoi de l'email via Resend
    const { data, error } = await resend.emails.send({
      from: 'YourPass <billetterie@yourpass.bj>',
      to: email,
      subject: `Votre Billet : ${eventName}`,
      html: `
        <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; color: #1f2937;">
          <div style="background: #2563eb; padding: 32px 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800;">YOURPASS</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Confirmation de réservation</p>
          </div>
          
          <div style="padding: 24px;">
            <p style="margin: 0 0 20px; font-size: 16px;">Bonjour <strong>${name || 'Client'}</strong>, voici votre billet pour <strong>${eventName}</strong>.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 13px;">Date</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">${eventDate || 'À consulter'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 13px;">Lieu</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">${eventVenue || 'Cotonou, Bénin'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 13px;">Type</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">${ticketType || 'Standard'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Transaction</td>
                <td style="padding: 10px 0; text-align: right; font-family: monospace; font-size: 12px;">${transactionId}</td>
              </tr>
            </table>

            <div style="text-align: center; background: #f9fafb; padding: 30px; border-radius: 12px; border: 2px dashed #e5e7eb;">
              <p style="margin: 0 0 15px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Scanner à l'entrée</p>
              <img src="${qrCodeDataUrl}" alt="QR Code Billet" style="width: 180px; height: 180px; display: block; margin: auto;">
              <p style="margin: 15px 0 0; font-family: monospace; color: #9ca3af; font-size: 12px;">${ticketId}</p>
            </div>

            <div style="margin-top: 24px; background: #eff6ff; padding: 15px; border-radius: 8px; font-size: 13px; color: #1e40af; line-height: 1.5;">
              <strong>Note :</strong> Ce billet est unique. Présentez ce QR Code sur votre téléphone ou imprimez cet email pour accéder à l'événement.
            </div>
          </div>

          <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #9ca3af;">
            &copy; 2026 YourPass Bénin. Tous droits réservés.
          </div>
        </div>
      `
    });

    if (error) {
      console.error('[Resend Error]:', error);
      return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
    }

    return res.status(200).json({ success: true, message: 'Billet envoyé !', ticketId });

  } catch (err) {
    console.error('[SendTicket Catch]:', err.message);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}