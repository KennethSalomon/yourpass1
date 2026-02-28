// api/webhook-fedapay.js — YourPass
// Reçoit les notifications FedaPay (IPN) et enregistre les paiements confirmés
// URL à configurer dans le dashboard FedaPay : https://yourpass.vercel.app/api/webhook-fedapay

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const WEBHOOK_SECRET = process.env.FEDAPAY_WEBHOOK_SECRET;
  const rawBody = req.body;

  // ── Vérification signature (si secret configuré) ───────────────────────
  if (WEBHOOK_SECRET) {
    const signature = req.headers['x-fedapay-signature'] || req.headers['x-signature'];
    if (!signature) {
      console.warn('[Webhook] Signature manquante');
      return res.status(401).json({ error: 'Signature manquante' });
    }

    const bodyString = typeof rawBody === 'string'
      ? rawBody
      : JSON.stringify(rawBody);

    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(bodyString)
      .digest('hex');

    const provided = signature.replace('sha256=', '');
    if (!crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      console.warn('[Webhook] Signature invalide');
      return res.status(401).json({ error: 'Signature invalide' });
    }
  }

  // ── Traitement de l'événement ──────────────────────────────────────────
  const event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const { name: eventName, data: eventData } = event;

  console.log(`[Webhook] Événement reçu: ${eventName}`);

  if (!eventName || !eventData) {
    return res.status(400).json({ error: 'Format d\'événement invalide' });
  }

  const tx     = eventData.object || eventData;
  const txId   = tx.id;
  const status = tx.status;
  const amount = tx.amount;

  // ── Gestion des types d'événements ────────────────────────────────────
  switch (eventName) {
    case 'transaction.approved':
    case 'transaction.paid':
      console.log(`[Webhook] ✅ Paiement confirmé — TX #${txId}, montant: ${amount} XOF`);
      // TODO : enregistrer en base Supabase
      // await supabaseAdmin.from('transactions').upsert({ id: txId, status: 'paid', amount, updated_at: new Date().toISOString() });
      break;

    case 'transaction.declined':
    case 'transaction.cancelled':
      console.log(`[Webhook] ❌ Paiement refusé — TX #${txId}, statut: ${status}`);
      // TODO : marquer comme échoué en base
      break;

    case 'transaction.refunded':
      console.log(`[Webhook] 💸 Remboursement — TX #${txId}`);
      break;

    default:
      console.log(`[Webhook] Événement non géré: ${eventName}`);
  }

  // FedaPay attend un 200 pour ne pas retenter
  return res.status(200).json({ received: true, txId, status });
}

// ── Configuration Vercel : désactiver bodyParser pour accès au raw body ──
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};