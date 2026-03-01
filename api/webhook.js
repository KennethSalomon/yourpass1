// api/webhook.js — YourPass
// Reçoit les notifications FedaPay (IPN), enregistre en DB et envoie l'email

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialisation des clients avec les variables d'environnement Vercel
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const WEBHOOK_SECRET = process.env.FEDAPAY_WEBHOOK_SECRET;
  const rawBody = req.body;

  // 1. ── Vérification signature (Sécurité) ───────────────────────
  if (WEBHOOK_SECRET) {
    const signature = req.headers['x-fedapay-signature'] || req.headers['x-signature'];
    if (!signature) {
      console.warn('[Webhook] Signature manquante');
      return res.status(401).json({ error: 'Signature manquante' });
    }

    const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(bodyString)
      .digest('hex');

    const provided = signature.replace('sha256=', '');
    
    try {
      if (!crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        console.warn('[Webhook] Signature invalide');
        return res.status(401).json({ error: 'Signature invalide' });
      }
    } catch (e) {
      return res.status(401).json({ error: 'Erreur de vérification' });
    }
  }

  // 2. ── Extraction des données ──────────────────────────────────
  const event = req.body;
  const eventName = event.name;
  const eventData = event.data;

  if (!eventName || !eventData) {
    return res.status(400).json({ error: 'Format d\'événement invalide' });
  }

  const tx = eventData.object || eventData;
  const txId = tx.id;
  const status = tx.status;
  const amount = tx.amount;
  const metadata = tx.custom_metadata || {};

  console.log(`[Webhook] Événement reçu: ${eventName} pour TX #${txId}`);

  // 3. ── Gestion des types d'événements ──────────────────────────
  switch (eventName) {
    case 'transaction.approved':
    case 'transaction.paid':
      console.log(`[Webhook] ✅ Paiement confirmé — TX #${txId}, montant: ${amount} XOF`);

      // A. Enregistrement dans Supabase (Table: tickets)
      const { error: dbError } = await supabaseAdmin
        .from('tickets')
        .insert([{
          payment_id: txId,
          user_email: tx.customer?.email || metadata.customer_email,
          customer_name: metadata.customer_name || 'Client',
          amount: amount,
          status: 'paid',
          event_id: metadata.event_id,
          created_at: new Date().toISOString()
        }]);

      if (dbError) {
        console.error("[Webhook] Erreur Supabase:", dbError.message);
      } else {
        console.log("[Webhook] Ticket enregistré avec succès en base de données.");

        // B. Envoi de l'email via Resend
        try {
          await resend.emails.send({
            from: 'YourPass <billetterie@yourpass.bj>',
            to: tx.customer?.email || metadata.customer_email,
            subject: `Confirmation de votre ticket - YourPass`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #2563eb;">Merci pour votre achat !</h2>
                <p>Votre paiement pour l'événement <strong>${metadata.event_id || 'votre commande'}</strong> a été validé.</p>
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                  <p><strong>ID Transaction :</strong> ${txId}</p>
                  <p><strong>Montant :</strong> ${amount} XOF</p>
                  <p><strong>Nom :</strong> ${metadata.customer_name || 'Client'}</p>
                </div>
                <p style="margin-top: 20px;">Présentez ce message à l'entrée de l'événement.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #6b7280;">YourPass - Le pass numérique de vos événements.</p>
              </div>
            `
          });
          console.log("[Webhook] Email de confirmation envoyé.");
        } catch (mailError) {
          console.error("[Webhook] Erreur Resend:", mailError.message);
        }
      }
      break;

    case 'transaction.declined':
    case 'transaction.cancelled':
      console.log(`[Webhook] ❌ Paiement refusé ou annulé — TX #${txId}`);
      // Optionnel : mettre à jour le statut en base si le ticket existe déjà
      break;

    case 'transaction.refunded':
      console.log(`[Webhook] 💸 Remboursement effectué — TX #${txId}`);
      break;

    default:
      console.log(`[Webhook] Événement non géré: ${eventName}`);
  }

  // Toujours renvoyer 200 à FedaPay
  return res.status(200).json({ received: true });
}