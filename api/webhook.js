import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/* ================================================================
   YourPass — api/webhook.js  (version FINALE avec Resend)
   
   Variables d'environnement nécessaires sur Vercel :
   - RESEND_API_KEY              ✅ déjà configuré
   - URL_SUPABASE                ✅ déjà configuré  
   - SUPABASE_SERVICE_ROLE_KEY   ⚠️ à ajouter (différent de ANON_KEY)
   - FEDAPAY_WEBHOOK_SECRET      ⚠️ à ajouter (copié depuis FedaPay dashboard)
================================================================ */

/* ── Initialisation ─────────────────────────────────────────── */
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.URL_SUPABASE,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ← Service Role Key, PAS la anon key
);

/* ── Body parser brut (nécessaire pour vérifier la signature) ── */
function getRawBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      // Déjà parsé par Vercel
      const str = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      resolve(Buffer.from(str));
      return;
    }
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(Buffer.alloc(0)));
  });
}

/* ── Vérification signature FedaPay (optionnel mais recommandé) ─ */
function verifySignature(rawBody, signature, secret) {
  if (!secret || !signature) return true; // Passe si pas encore configuré
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/* ── Template email ticket ──────────────────────────────────── */
function buildTicketEmail(data) {
  const { customerName, customerEmail, eventName, ticketType, amount, orderId, date } = data;
  const qrUrl = `https://chart.googleapis.com/chart?chs=180x180&cht=qr&chl=${encodeURIComponent('YourPass:' + orderId)}&choe=UTF-8`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre billet YourPass</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#2d6cff,#4f46e5);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:-0.5px;">YourPass</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Votre billet électronique</p>
    </div>

    <!-- Success banner -->
    <div style="background:#d4f5e2;padding:16px 32px;text-align:center;border-left:4px solid #2ecc71;">
      <p style="color:#1a7a45;font-weight:700;margin:0;font-size:15px;">✅ Paiement confirmé — Billet valide !</p>
    </div>

    <!-- Ticket body -->
    <div style="background:#fff;padding:32px;border:1px solid #e8ecf0;">
      
      <p style="color:#555;margin:0 0 24px;font-size:15px;">
        Bonjour <strong>${customerName}</strong>, votre paiement a bien été reçu. Voici votre billet ci-dessous.
      </p>

      <!-- Event info -->
      <div style="background:#f8faff;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e3e8ff;">
        <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">${eventName}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#888;padding:5px 0;font-size:13px;width:40%;">Type de billet</td>
            <td style="color:#1e293b;font-weight:700;font-size:13px;">${ticketType}</td>
          </tr>
          <tr>
            <td style="color:#888;padding:5px 0;font-size:13px;">Montant payé</td>
            <td style="color:#2d6cff;font-weight:700;font-size:13px;">${Number(amount).toLocaleString('fr-FR')} XOF</td>
          </tr>
          <tr>
            <td style="color:#888;padding:5px 0;font-size:13px;">Date d'achat</td>
            <td style="color:#1e293b;font-weight:700;font-size:13px;">${date}</td>
          </tr>
          <tr>
            <td style="color:#888;padding:5px 0;font-size:13px;">N° de commande</td>
            <td style="color:#1e293b;font-family:monospace;font-size:12px;">${orderId}</td>
          </tr>
        </table>
      </div>

      <!-- QR Code -->
      <div style="text-align:center;padding:20px;border:2px dashed #e3e8ff;border-radius:12px;margin-bottom:24px;">
        <img src="${qrUrl}" alt="QR Code Ticket" width="150" height="150" style="display:block;margin:0 auto 12px;">
        <p style="color:#888;font-size:11px;margin:0;font-family:monospace;">${orderId}</p>
        <p style="color:#555;font-size:12px;margin:8px 0 0;">Présentez ce QR code à l'entrée de l'événement</p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="https://yourpass1.vercel.app/success.html" 
           style="display:inline-block;background:linear-gradient(135deg,#2d6cff,#4f46e5);color:#fff;text-decoration:none;padding:13px 30px;border-radius:10px;font-weight:700;font-size:14px;">
          📥 Voir mon billet en ligne
        </a>
      </div>

      <p style="color:#aaa;font-size:12px;text-align:center;margin:0;line-height:1.8;">
        Ce billet est personnel et non transférable.<br>
        Pour toute question : <a href="mailto:support@yourpass.bj" style="color:#2d6cff;">support@yourpass.bj</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
      <p style="color:#475569;font-size:12px;margin:0;">
        © 2026 YourPass — Plateforme de billetterie du Bénin
      </p>
    </div>

  </div>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════════════
   HANDLER PRINCIPAL
══════════════════════════════════════════════════════════════ */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-FedaPay-Signature');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).end();

  /* ── Lire le body brut ──────────────────────────────────── */
  const rawBody = await getRawBody(req);
  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    console.error('[Webhook] Body JSON invalide');
    return res.status(400).json({ received: false, error: 'JSON invalide' });
  }

  /* ── Vérifier la signature (si configurée) ──────────────── */
  const signature = req.headers['x-fedapay-signature'] || '';
  const secret    = process.env.FEDAPAY_WEBHOOK_SECRET || '';
  if (secret && !verifySignature(rawBody, signature, secret)) {
    console.error('[Webhook] Signature invalide !');
    return res.status(401).json({ received: false, error: 'Signature invalide' });
  }

  /* ── Extraire les données de la transaction ─────────────── */
  const eventName = event?.name;
  const tx = event?.data?.object || event?.data || {};

  console.log(`[Webhook] Événement reçu: ${eventName} | TX: ${tx.id}`);

  /* ── NE TRAITER QUE LES TRANSACTIONS APPROUVÉES ────────── */
  if (eventName !== 'transaction.approved') {
    console.log(`[Webhook] Événement ignoré: ${eventName}`);
    return res.status(200).json({ received: true, processed: false, event: eventName });
  }

  /* ── Extraire toutes les infos ──────────────────────────── */
  const txId          = String(tx.id || '');
  const amount        = tx.amount || 0;
  const customerEmail = tx.customer?.email || null;
  const customerPhone = tx.customer?.phone_number?.number || null;
  const customerFirst = tx.customer?.firstname || 'Client';
  const customerLast  = tx.customer?.lastname  || '';
  const customerName  = [customerFirst, customerLast].filter(Boolean).join(' ');
  const description   = tx.description || 'Ticket YourPass';
  const eventTitle    = description.replace(/^YourPass\s*[—-]\s*/i, '').trim() || 'Événement YourPass';
  const orderId       = `YP-${txId}`;
  const purchaseDate  = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  let dbError   = null;
  let emailSent = false;

  /* ── 1. Enregistrement dans Supabase ────────────────────── */
  try {
    const { error } = await supabase
      .from('payments')                     // ← Table créée par le SQL ci-dessous
      .upsert({
        transaction_id:    txId,
        status:            'approved',
        amount:            amount,
        currency:          'XOF',
        customer_email:    customerEmail,
        customer_phone:    customerPhone,
        customer_name:     customerName,
        description:       description,
        event_name:        eventTitle,
        fedapay_data:      tx,
        confirmed_at:      new Date().toISOString(),
      }, {
        onConflict: 'transaction_id'        // Évite les doublons si webhook renvoyé
      });

    if (error) {
      dbError = error.message;
      console.error('[Webhook] Erreur Supabase:', error);
    } else {
      console.log('[Webhook] ✅ Paiement enregistré en base:', txId);
    }
  } catch (err) {
    dbError = err.message;
    console.error('[Webhook] Exception Supabase:', err);
  }

  /* ── 2. Envoi de l'email de confirmation via Resend ─────── */
  if (customerEmail) {
    try {
      const { error: emailError } = await resend.emails.send({
        from: 'YourPass <onboarding@resend.dev>',  // ← Ton domaine vérifié sur Resend
        // OU pendant les tests : 'YourPass <onboarding@resend.dev>'
        to:      customerEmail,
        subject: `🎫 Votre billet pour ${eventTitle} — YourPass`,
        html:    buildTicketEmail({
          customerName,
          customerEmail,
          eventName:  eventTitle,
          ticketType: 'Standard',
          amount,
          orderId,
          date: purchaseDate
        })
      });

      if (emailError) {
        console.error('[Webhook] Erreur Resend:', emailError);
      } else {
        emailSent = true;
        console.log('[Webhook] ✅ Email envoyé à:', customerEmail);
      }
    } catch (err) {
      console.error('[Webhook] Exception email:', err.message);
    }
  } else {
    console.warn('[Webhook] ⚠️ Pas d\'email client — email non envoyé. TX:', txId);
  }

  /* ── Réponse 200 OBLIGATOIRE pour FedaPay ───────────────── */
  return res.status(200).json({
    received:   true,
    event:      eventName,
    tx_id:      txId,
    db_saved:   !dbError,
    email_sent: emailSent,
    timestamp:  new Date().toISOString()
  });
}