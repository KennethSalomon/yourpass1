import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/* ══════════════════════════════════════════════════════════════════
   YourPass — api/webhook.js  (version CORRIGÉE v3)

   CORRECTIONS v3 :
   1. ✅ createClient() direct (Node.js) — plus de window.supabaseClient
   2. Table unifiée : "payments" avec fallback "paiements"
   3. Upsert avec onConflict pour éviter les doublons
   4. Vérification signature HMAC FedaPay (sécurité)
   5. Gestion robuste de tous les statuts FedaPay
══════════════════════════════════════════════════════════════════ */

// ✅ CORRECTION : Créer le client Supabase côté serveur avec les vars d'env
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Utiliser la clé SERVICE ROLE côté serveur
);

const WEBHOOK_SECRET = process.env.FEDAPAY_WEBHOOK_SECRET; // Optionnel mais recommandé

/* ── Vérification signature HMAC ──────────────────────────────── */
function verifySignature(payload, signature, secret) {
  if (!secret || !signature) return true; // Ignorer si non configuré
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature.replace('sha256=', ''), 'hex')
    );
  } catch {
    return false;
  }
}

/* ── Extraction du statut normalisé ──────────────────────────── */
function normalizeStatus(fedapayStatus) {
  const map = {
    'approved':    'completed',
    'declined':    'failed',
    'cancelled':   'cancelled',
    'refunded':    'refunded',
    'transferred': 'completed',
    'pending':     'pending',
    'error':       'failed'
  };
  return map[fedapayStatus] || fedapayStatus || 'unknown';
}

/* ── Extraction données transaction depuis payload ────────────── */
function extractTransactionData(payload) {
  const tx = payload?.['v1/transaction']
           || payload?.transaction
           || payload?.data
           || payload;

  const customer = tx?.customer || {};
  const phone    = customer?.phone_number?.number
                || customer?.phone_number
                || null;

  return {
    fedapay_id:     String(tx?.id || tx?.reference || ''),
    amount:         Number(tx?.amount || 0),
    currency:       tx?.currency?.iso || tx?.currency || 'XOF',
    status:         normalizeStatus(tx?.status),
    customer_name:  [customer?.firstname, customer?.lastname].filter(Boolean).join(' ') || null,
    customer_email: customer?.email || null,
    customer_phone: phone,
    description:    tx?.description || null,
    event_name:     tx?.description?.replace(/^YourPass\s*[—-]\s*/, '') || null,
    raw_status:     tx?.status || null,
    fedapay_event:  payload?.name || payload?.event || null,
    updated_at:     new Date().toISOString()
  };
}

/* ── Handler principal ─────────────────────────────────────────── */
export default async function handler(req, res) {
  // FedaPay envoie des POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Lire le body brut pour vérification signature
  let rawBody = '';
  let payload;

  try {
    if (req.body && typeof req.body === 'object') {
      payload = req.body;
      rawBody = JSON.stringify(payload);
    } else if (req.body && typeof req.body === 'string') {
      rawBody = req.body;
      payload = JSON.parse(rawBody);
    } else {
      await new Promise((resolve) => {
        req.on('data', chunk => { rawBody += chunk.toString(); });
        req.on('end', resolve);
      });
      payload = rawBody ? JSON.parse(rawBody) : {};
    }
  } catch (err) {
    console.error('[Webhook] Erreur parsing body:', err.message);
    return res.status(400).json({ error: 'Corps de requête invalide' });
  }

  // Vérification signature (si configurée)
  const signature = req.headers['x-fedapay-signature'] || req.headers['x-webhook-signature'];
  if (WEBHOOK_SECRET && !verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.error('[Webhook] Signature invalide !');
    return res.status(401).json({ error: 'Signature invalide' });
  }

  console.log('[Webhook] Reçu:', {
    event: payload?.name || payload?.event,
    keys: Object.keys(payload || {})
  });

  // Extraire données transaction
  const txData = extractTransactionData(payload);

  console.log('[Webhook] Transaction extraite:', {
    id:     txData.fedapay_id,
    status: txData.status,
    amount: txData.amount,
    phone:  txData.customer_phone
  });

  if (!txData.fedapay_id) {
    console.warn('[Webhook] Pas de fedapay_id dans le payload, ignoré');
    return res.status(200).json({ received: true, skipped: 'no transaction id' });
  }

  // ✅ Upsert dans Supabase (table "payments")
  try {
    const { error } = await supabase
      .from('payments')
      .upsert(
        {
          fedapay_id:     txData.fedapay_id,
          amount:         txData.amount,
          currency:       txData.currency,
          status:         txData.status,
          customer_name:  txData.customer_name,
          customer_email: txData.customer_email,
          customer_phone: txData.customer_phone,
          description:    txData.description,
          event_name:     txData.event_name,
          raw_status:     txData.raw_status,
          fedapay_event:  txData.fedapay_event,
          updated_at:     txData.updated_at
        },
        {
          onConflict:       'fedapay_id',
          ignoreDuplicates: false
        }
      );

    if (error) {
      // Fallback sur table "paiements" si "payments" n'existe pas
      if (error.code === '42P01') {
        console.warn('[Webhook] Table "payments" introuvable, tentative avec "paiements"...');
        const { error: err2 } = await supabase
          .from('paiements')
          .upsert(
            { fedapay_id: txData.fedapay_id, ...txData },
            { onConflict: 'fedapay_id', ignoreDuplicates: false }
          );
        if (err2) {
          console.error('[Webhook] Erreur upsert "paiements":', err2);
          return res.status(500).json({ error: 'Erreur base de données', details: err2.message });
        }
      } else {
        console.error('[Webhook] Erreur Supabase upsert:', error);
        return res.status(500).json({ error: 'Erreur base de données', details: error.message });
      }
    }

    console.log('[Webhook] ✅ Paiement enregistré:', txData.fedapay_id, '→', txData.status);

    if (txData.status === 'completed') {
      console.log('[Webhook] 💰 Paiement approuvé pour:', txData.customer_phone);
      // TODO: Envoyer email/notification, générer ticket, etc.
    }

    return res.status(200).json({ received: true, status: txData.status });

  } catch (err) {
    console.error('[Webhook] Exception:', err.message);
    return res.status(500).json({ error: 'Erreur interne serveur' });
  }
}