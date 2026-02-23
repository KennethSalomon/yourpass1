import axios from 'axios';

/* ════════════════════════════════════════════════════════════════
   YourPass — api/pay-fedapay.js  (version CORRIGÉE Vercel)
   
   CORRECTIONS :
   1. Body parser manuel (Vercel ESM ne parse pas automatiquement)
   2. Validation robuste + fallback lastname
   3. Gestion erreurs FedaPay détaillée
   4. CALLBACK_URL avec fallback automatique
════════════════════════════════════════════════════════════════ */

const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;
const CALLBACK_URL       = process.env.CALLBACK_URL || 'https://yourpass1.vercel.app/success.html';

/* ── Client FedaPay ─────────────────────────────────────────── */
const fedapay = axios.create({
  baseURL: 'https://api.fedapay.com/v1',
  headers: {
    Authorization:  `Bearer ${FEDAPAY_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 25000
});

/* ── Helpers ─────────────────────────────────────────────────── */
function extractTransaction(data) {
  if (data?.v1?.transaction) return data.v1.transaction;
  if (data?.transaction)     return data.transaction;
  if (data?.id)              return data;
  return null;
}

/**
 * Vercel ESM Serverless Functions ne parsent PAS automatiquement le body.
 * Cette fonction lit le stream brut et parse le JSON manuellement.
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    // Si déjà parsé (parfois Vercel le fait en CommonJS)
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }

    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

/* ── Handler principal ───────────────────────────────────────── */
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  /* ── Vérification clé API ─────────────────────────────────── */
  if (!FEDAPAY_SECRET_KEY) {
    console.error('[YourPass] FEDAPAY_SECRET_KEY manquante dans les variables d\'environnement');
    return res.status(500).json({
      success: false,
      error: 'Configuration serveur incomplète. Contactez le support.'
    });
  }

  /* ── Parse body (CORRECTION PRINCIPALE) ──────────────────── */
  let body;
  try {
    body = await parseBody(req);
  } catch (parseErr) {
    console.error('[YourPass] Erreur parse body:', parseErr);
    return res.status(400).json({ success: false, error: 'Corps de requête invalide.' });
  }

  const { amount, phoneNumber, firstname, lastname, email, eventName } = body;

  console.log('[YourPass] Paiement reçu:', {
    amount, phoneNumber: phoneNumber?.replace(/\d(?=\d{4})/g, '*'),
    firstname, eventName,
    mode: FEDAPAY_SECRET_KEY.startsWith('sk_live_') ? 'PRODUCTION' : 'SANDBOX'
  });

  /* ── Validation des champs ────────────────────────────────── */
  const errors = [];
  if (!amount || isNaN(amount) || Number(amount) < 100)
    errors.push('Le montant doit être ≥ 100 XOF.');
  if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 8)
    errors.push('Numéro de téléphone invalide (minimum 8 chiffres).');
  if (!firstname || firstname.trim().length < 2)
    errors.push('Prénom requis (minimum 2 caractères).');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  /* ── Préparation des données ──────────────────────────────── */
  const cleanPhone  = phoneNumber.replace(/\D/g, '');
  const amountInt   = Math.round(Number(amount));
  const cleanFirst  = firstname.trim();
  // CORRECTION : lastname ne peut pas être vide pour FedaPay
  const cleanLast   = (lastname && lastname.trim().length >= 1)
    ? lastname.trim()
    : cleanFirst; // si pas de nom, on duplique le prénom

  /* ── Création de la transaction FedaPay ──────────────────── */
  try {
    console.log('[YourPass] Création transaction FedaPay...', {
      amount: amountInt,
      phone: cleanPhone,
      callback: CALLBACK_URL
    });

    const txResponse = await fedapay.post('/transactions', {
      amount:       amountInt,
      currency:     { iso: 'XOF' },
      description:  `YourPass — ${eventName || 'Ticket événement'}`,
      callback_url: CALLBACK_URL,
      customer: {
        firstname:    cleanFirst,
        lastname:     cleanLast,
        email:        (email && email.trim()) ? email.trim() : undefined,
        phone_number: {
          number:  cleanPhone,
          country: 'BJ'
        }
      }
    });

    const transaction = extractTransaction(txResponse.data);
    const txId        = transaction?.id;

    if (!txId) {
      console.error('[YourPass] Transaction ID introuvable. Réponse FedaPay:', JSON.stringify(txResponse.data));
      throw new Error('ID de transaction introuvable dans la réponse FedaPay.');
    }

    console.log('[YourPass] Transaction créée, ID:', txId, '— Génération du token...');

    /* ── Génération du token de paiement ──────────────────── */
    const tokenResponse = await fedapay.post(`/transactions/${txId}/token`);

    // FedaPay peut retourner l'URL sous différentes structures
    const paymentUrl =
      tokenResponse.data?.url ||
      tokenResponse.data?.token?.url ||
      tokenResponse.data?.v1?.token?.url ||
      tokenResponse.data?.v1?.url;

    if (!paymentUrl) {
      console.error('[YourPass] URL de paiement introuvable. Réponse token:', JSON.stringify(tokenResponse.data));
      throw new Error('URL de paiement introuvable dans la réponse FedaPay.');
    }

    console.log('[YourPass] ✅ Succès — TX ID:', txId, '| URL générée');

    return res.status(200).json({
      success:        true,
      url:            paymentUrl,
      transaction_id: txId
    });

  } catch (err) {
    const status       = err.response?.status || 500;
    const fedaData     = err.response?.data;
    const fedaMessage  = fedaData?.message
                      || fedaData?.errors?.[0]?.message
                      || fedaData?.error
                      || err.message;

    console.error('[YourPass] Erreur FedaPay:', {
      status,
      message: fedaMessage,
      data: JSON.stringify(fedaData || {}).slice(0, 500)
    });

    let userMessage = 'Erreur lors de la création du paiement.';
    if (status === 401)           userMessage = 'Clé API FedaPay invalide ou expirée.';
    else if (status === 422)      userMessage = `Données invalides : ${fedaMessage}`;
    else if (status === 429)      userMessage = 'Trop de requêtes. Réessayez dans un instant.';
    else if (fedaMessage)         userMessage = fedaMessage;

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      error:   userMessage
    });
  }
}