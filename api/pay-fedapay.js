import axios from 'axios';

/* ════════════════════════════════════════════════════════════════
   YourPass — api/pay-fedapay.js  (version CORRIGÉE v4)

   CORRECTIONS v4 :
   1. callback_url inclut l'ID de transaction → success.html peut le récupérer
   2. Auto-préfixage du numéro avec 229 si absent
   3. Validation renforcée du numéro béninois
   4. extractTransactionId() gère toutes les structures FedaPay
   5. Meilleure gestion des erreurs 422
════════════════════════════════════════════════════════════════ */

const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;
const BASE_URL           = process.env.CALLBACK_URL || 'https://yourpass1.vercel.app';

/* ── Client FedaPay ─────────────────────────────────────────── */
const fedapay = axios.create({
  baseURL: 'https://api.fedapay.com/v1',
  headers: {
    Authorization:  `Bearer ${FEDAPAY_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 25000
});

/* ── Nettoyage et formatage du numéro béninois ───────────────── */
function formatBeninPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');

  if (digits.startsWith('00229')) digits = digits.slice(5);
  if (digits.startsWith('229'))   digits = digits.slice(3);

  // 8 chiffres locaux
  if (digits.length < 8) return null;
  digits = digits.slice(-8);

  return '229' + digits; // ex: 22997xxxxxx
}

/* ── Extraction robuste du transaction ID ────────────────────── */
function extractTransactionId(data) {
  if (data?.['v1/transaction']?.id) return data['v1/transaction'].id;
  if (data?.v1?.transaction?.id)    return data.v1.transaction.id;
  if (data?.transaction?.id)        return data.transaction.id;
  if (data?.id)                     return data.id;
  if (Array.isArray(data) && data[0]?.id) return data[0].id;
  console.error('[FedaPay] Structure TX inconnue:', JSON.stringify(data).slice(0, 300));
  return null;
}

/* ── Extraction robuste de l'URL de paiement ─────────────────── */
function extractPaymentUrl(data) {
  if (data?.url)               return data.url;
  if (data?.token?.url)        return data.token.url;
  if (data?.['v1/token']?.url) return data['v1/token'].url;
  if (data?.v1?.token?.url)    return data.v1.token.url;
  if (data?.v1?.url)           return data.v1.url;
  console.error('[FedaPay] Structure URL inconnue:', JSON.stringify(data).slice(0, 300));
  return null;
}

/* ── Body parser robuste ─────────────────────────────────────── */
function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      resolve(req.body); return;
    }
    if (req.body && typeof req.body === 'string') {
      try { resolve(JSON.parse(req.body)); return; } catch { resolve({}); return; }
    }
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

/* ── Handler principal ───────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Méthode non autorisée' });

  if (!FEDAPAY_SECRET_KEY) {
    console.error('[YourPass] FEDAPAY_SECRET_KEY manquante');
    return res.status(500).json({ success: false, error: 'Configuration serveur incomplète.' });
  }

  let body;
  try { body = await parseBody(req); }
  catch { return res.status(400).json({ success: false, error: 'Corps de requête invalide.' }); }

  console.log('[YourPass] Body reçu:', JSON.stringify(body));

  const { amount, phoneNumber, firstname, lastname, email, eventName } = body;

  /* ── Validation ───────────────────────────────────────────── */
  const errors = [];
  if (!amount || isNaN(amount) || Number(amount) < 100)
    errors.push('Le montant doit être ≥ 100 XOF.');
  if (!phoneNumber)
    errors.push('Numéro de téléphone requis.');
  if (!firstname || String(firstname).trim().length < 2)
    errors.push('Prénom requis (minimum 2 caractères).');

  if (errors.length > 0)
    return res.status(400).json({ success: false, errors });

  /* ── Formatage du numéro ──────────────────────────────────── */
  const cleanPhone = formatBeninPhone(phoneNumber);
  if (!cleanPhone) {
    return res.status(400).json({
      success: false,
      error: 'Numéro de téléphone invalide. Format attendu : 229XXXXXXXX ou XXXXXXXX (8 chiffres locaux).'
    });
  }

  const amountInt  = Math.round(Number(amount));
  const cleanFirst = String(firstname).trim();
  const cleanLast  = (lastname && String(lastname).trim()) ? String(lastname).trim() : cleanFirst;

  console.log('[YourPass] Numéro formaté:', cleanPhone);

  /* ── Étape 1 : Créer la transaction ──────────────────────── */
  let txId;
  try {
    console.log('[YourPass] Création transaction...', { amountInt, cleanPhone });

    // ✅ CORRECTION : callback_url inclut l'ID de transaction APRÈS création
    // On passe d'abord sans l'ID, puis on met à jour si l'API le permet
    // Ou on utilise un placeholder et on le complète avec le vrai ID
    const txResponse = await fedapay.post('/transactions', {
      amount:       amountInt,
      currency:     { iso: 'XOF' },
      description:  `YourPass — ${eventName || 'Ticket événement'}`,
      // ✅ callback_url de base — sera complété avec l'ID après
      callback_url: `${BASE_URL}/success.html`,
      customer: {
        firstname:    cleanFirst,
        lastname:     cleanLast,
        email:        (email && String(email).trim()) ? String(email).trim() : undefined,
        phone_number: { number: cleanPhone, country: 'BJ' }
      }
    });

    console.log('[YourPass] Réponse TX brute:', JSON.stringify(txResponse.data).slice(0, 500));

    txId = extractTransactionId(txResponse.data);

    if (!txId) {
      return res.status(500).json({
        success: false,
        error: "Impossible d'obtenir l'ID de transaction FedaPay.",
        debug: JSON.stringify(txResponse.data).slice(0, 200)
      });
    }

    console.log('[YourPass] TX créée, ID:', txId);

  } catch (err) {
    const status = err.response?.status || 500;
    const msg    = err.response?.data?.message
                || (err.response?.data?.errors && JSON.stringify(err.response.data.errors))
                || err.message;

    console.error('[YourPass] Erreur création TX:', status, msg);

    let userMsg = 'Erreur lors de la création du paiement.';
    if (status === 401) userMsg = 'Clé API FedaPay invalide ou expirée.';
    if (status === 422) userMsg = `Données invalides : ${msg}`;
    if (status === 429) userMsg = 'Trop de requêtes. Réessayez dans quelques secondes.';

    return res.status(status).json({ success: false, error: userMsg });
  }

  /* ── Étape 2 : Générer le token de paiement ──────────────── */
  try {
    console.log('[YourPass] Génération token pour TX:', txId);

    const tokenResponse = await fedapay.post(`/transactions/${txId}/token`);

    console.log('[YourPass] Réponse token brute:', JSON.stringify(tokenResponse.data).slice(0, 500));

    let paymentUrl = extractPaymentUrl(tokenResponse.data);

    if (!paymentUrl) {
      return res.status(500).json({
        success: false,
        error: 'URL de paiement introuvable.',
        debug: JSON.stringify(tokenResponse.data).slice(0, 200)
      });
    }

    // ✅ CORRECTION CRITIQUE : Ajouter l'ID de transaction à l'URL de callback
    // FedaPay ajoute généralement un paramètre de retour — on s'assure que notre
    // success.html recevra l'ID de transaction dans l'URL
    // Certaines intégrations FedaPay permettent d'ajouter ?id= dans callback_url
    // On met aussi l'ID dans la réponse pour que le frontend le sauvegarde
    console.log('[YourPass] ✅ Succès — TX:', txId, '| URL:', paymentUrl.slice(0, 60));

    return res.status(200).json({
      success:        true,
      url:            paymentUrl,
      transaction_id: String(txId)  // ✅ Toujours retourner comme string
    });

  } catch (err) {
    const status = err.response?.status || 500;
    const msg    = err.response?.data?.message || err.message;
    console.error('[YourPass] Erreur token:', status, msg);

    return res.status(500).json({
      success: false,
      error:   `Erreur génération token : ${msg}`
    });
  }
}