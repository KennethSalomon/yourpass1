import axios from 'axios';

/* ════════════════════════════════════════════════════════════════
   YourPass — api/pay-fedapay.js  (version CORRIGÉE v2)
   
   CORRECTIONS :
   1. Body parser robuste (gère ESM Vercel en production)
   2. extractTransaction() corrigé pour la vraie structure FedaPay
   3. extractPaymentUrl() corrigé pour le token
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

/* ── Extraction robuste du transaction ID ────────────────────── */
function extractTransactionId(data) {
  // Structure 1 : { v1: { transaction: { id: ... } } }
  if (data?.v1?.transaction?.id) return data.v1.transaction.id;
  // Structure 2 : { transaction: { id: ... } }
  if (data?.transaction?.id)     return data.transaction.id;
  // Structure 3 : { id: ... } directement
  if (data?.id)                  return data.id;
  // Structure 4 : tableau
  if (Array.isArray(data) && data[0]?.id) return data[0].id;

  console.error('[FedaPay] Structure TX inconnue:', JSON.stringify(data).slice(0, 300));
  return null;
}

/* ── Extraction robuste de l'URL de paiement ─────────────────── */
function extractPaymentUrl(data) {
  // Structure 1 : { url: "..." }
  if (data?.url) return data.url;
  // Structure 2 : { token: { url: "..." } }
  if (data?.token?.url) return data.token.url;
  // Structure 3 : { v1: { token: { url: "..." } } }
  if (data?.v1?.token?.url) return data.v1.token.url;
  // Structure 4 : { v1: { url: "..." } }
  if (data?.v1?.url) return data.v1.url;

  console.error('[FedaPay] Structure URL inconnue:', JSON.stringify(data).slice(0, 300));
  return null;
}

/* ── Body parser robuste ─────────────────────────────────────── */
function parseBody(req) {
  return new Promise((resolve) => {
    // Cas 1 : déjà parsé (Vercel CommonJS ou middleware)
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      resolve(req.body);
      return;
    }

    // Cas 2 : body est une string JSON
    if (req.body && typeof req.body === 'string') {
      try { resolve(JSON.parse(req.body)); return; }
      catch { resolve({}); return; }
    }

    // Cas 3 : lire le stream (ESM Vercel en production)
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

/* ── Handler principal ───────────────────────────────────────── */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Méthode non autorisée' });

  /* ── Vérification clé API ─────────────────────────────────── */
  if (!FEDAPAY_SECRET_KEY) {
    console.error('[YourPass] FEDAPAY_SECRET_KEY manquante');
    return res.status(500).json({ success: false, error: 'Configuration serveur incomplète.' });
  }

  /* ── Parse body ───────────────────────────────────────────── */
  let body;
  try { body = await parseBody(req); }
  catch { return res.status(400).json({ success: false, error: 'Corps de requête invalide.' }); }

  console.log('[YourPass] Body reçu:', JSON.stringify(body));

  const { amount, phoneNumber, firstname, lastname, email, eventName } = body;

  /* ── Validation ───────────────────────────────────────────── */
  const errors = [];
  if (!amount || isNaN(amount) || Number(amount) < 100)
    errors.push('Le montant doit être ≥ 100 XOF.');
  if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 8)
    errors.push('Numéro de téléphone invalide.');
  if (!firstname || firstname.trim().length < 2)
    errors.push('Prénom requis.');

  if (errors.length > 0)
    return res.status(400).json({ success: false, errors });

  /* ── Préparation ──────────────────────────────────────────── */
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const amountInt  = Math.round(Number(amount));
  const cleanFirst = firstname.trim();
  const cleanLast  = (lastname && lastname.trim()) ? lastname.trim() : cleanFirst;

  /* ── Étape 1 : Créer la transaction ──────────────────────── */
  let txId;
  try {
    console.log('[YourPass] Création transaction...', { amountInt, cleanPhone });

    const txResponse = await fedapay.post('/transactions', {
      amount:       amountInt,
      currency:     { iso: 'XOF' },
      description:  `YourPass — ${eventName || 'Ticket événement'}`,
      callback_url: CALLBACK_URL,
      customer: {
        firstname:    cleanFirst,
        lastname:     cleanLast,
        email:        (email && email.trim()) ? email.trim() : undefined,
        phone_number: { number: cleanPhone, country: 'BJ' }
      }
    });

    console.log('[YourPass] Réponse TX brute:', JSON.stringify(txResponse.data).slice(0, 500));

    txId = extractTransactionId(txResponse.data);

    if (!txId) {
      return res.status(500).json({
        success: false,
        error: 'Impossible d\'obtenir l\'ID de transaction FedaPay.',
        debug: JSON.stringify(txResponse.data).slice(0, 200)
      });
    }

    console.log('[YourPass] TX créée, ID:', txId);

  } catch (err) {
    const status = err.response?.status || 500;
    const msg    = err.response?.data?.message || err.message;
    console.error('[YourPass] Erreur création TX:', status, msg);

    let userMsg = 'Erreur lors de la création du paiement.';
    if (status === 401) userMsg = 'Clé API FedaPay invalide.';
    if (status === 422) userMsg = `Données invalides : ${msg}`;

    return res.status(status).json({ success: false, error: userMsg });
  }

  /* ── Étape 2 : Générer le token de paiement ──────────────── */
  try {
    console.log('[YourPass] Génération token pour TX:', txId);

    const tokenResponse = await fedapay.post(`/transactions/${txId}/token`);

    console.log('[YourPass] Réponse token brute:', JSON.stringify(tokenResponse.data).slice(0, 500));

    const paymentUrl = extractPaymentUrl(tokenResponse.data);

    if (!paymentUrl) {
      return res.status(500).json({
        success: false,
        error: 'URL de paiement introuvable.',
        debug: JSON.stringify(tokenResponse.data).slice(0, 200)
      });
    }

    console.log('[YourPass] ✅ Succès — TX:', txId, '| URL:', paymentUrl.slice(0, 60));

    return res.status(200).json({
      success:        true,
      url:            paymentUrl,
      transaction_id: txId
    });

  } catch (err) {
    const status = err.response?.status || 500;
    const msg    = err.response?.data?.message || err.message;
    console.error('[YourPass] Erreur token:', status, msg);

    return res.status(500).json({
      success: false,
      error: `Erreur génération token : ${msg}`
    });
  }
}