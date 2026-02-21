/* ================================================================
   YourPass — server.js  ·  Version CORRIGÉE
   
   CORRECTION PRINCIPALE :
   La clé FedaPay "FMW-P1M-TWK-..." dans votre .env N'EST PAS une
   clé API valide. Les vraies clés FedaPay ont ce format :
     - Sandbox  : sk_sandbox_XXXXXXXXXXXXXXXXXXXX
     - Production: sk_live_XXXXXXXXXXXXXXXXXXXX
   
   Pour obtenir la bonne clé :
   1. Allez sur https://app.fedapay.com
   2. Menu : Paramètres → API Keys
   3. Copiez la clé "Secret Key" (commence par sk_sandbox_ ou sk_live_)
   4. Mettez-la dans backend/.env : FEDAPAY_SECRET_KEY=sk_sandbox_VOTRE_CLE
   
   AUTRES CORRECTIONS :
   - Parsing de la réponse FedaPay amélioré (v1 wrapper)
   - Meilleurs messages d'erreur
   - Validation du format de la clé au démarrage
================================================================ */

'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ────────────────────────────────────────────────────────────────
   CONFIGURATION
──────────────────────────────────────────────────────────────── */
const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;
const FEDAPAY_BASE_URL   = 'https://api.fedapay.com/v1';

// URL de retour après paiement
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://127.0.0.1:5500/success.html';

/* ── Validation de la clé FedaPay ─────────────────────────────── */
if (!FEDAPAY_SECRET_KEY) {
  console.error(`
❌ ERREUR CRITIQUE : FEDAPAY_SECRET_KEY manquant dans backend/.env

  Créez backend/.env avec :
  FEDAPAY_SECRET_KEY=sk_sandbox_VOTRE_CLE_ICI
  PORT=3000
  `);
  process.exit(1);
}

// Vérifier le format de la clé
const IS_SANDBOX    = FEDAPAY_SECRET_KEY.startsWith('sk_sandbox_');
const IS_PRODUCTION = FEDAPAY_SECRET_KEY.startsWith('sk_live_');
const KEY_VALID     = IS_SANDBOX || IS_PRODUCTION;

if (!KEY_VALID) {
  console.error(`
❌ FORMAT DE CLÉ INVALIDE

  Votre clé actuelle : "${FEDAPAY_SECRET_KEY.slice(0, 20)}..."

  ⚠️  Ce format (FMW-P1M-TWK-...) n'est PAS une clé API FedaPay.
      C'est probablement une référence marchande ou un webhook secret.

  ✅ Pour obtenir la VRAIE clé secrète API :
     1. Connectez-vous sur https://app.fedapay.com
     2. Allez dans : Paramètres → API Keys (ou Clés API)
     3. Copiez la "Secret Key" qui commence par sk_sandbox_ (test)
        ou sk_live_ (production)
     4. Mettez-la dans backend/.env

  Le serveur va démarrer MAIS tous les paiements échoueront
  avec une erreur 401 (Unauthorized) de FedaPay.
  `);
  // On continue quand même pour permettre le debug
}

if (KEY_VALID) {
  console.log(`🔑 Mode FedaPay : ${IS_SANDBOX ? '🧪 SANDBOX (test)' : '🚀 PRODUCTION'}`);
} else {
  console.warn('⚠️  Clé FedaPay invalide — voir message ci-dessus');
}

/* ────────────────────────────────────────────────────────────────
   MIDDLEWARES
──────────────────────────────────────────────────────────────── */
app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5501',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/* ────────────────────────────────────────────────────────────────
   CLIENT AXIOS FEDAPAY
──────────────────────────────────────────────────────────────── */
const fedapay = axios.create({
  baseURL: FEDAPAY_BASE_URL,
  headers: {
    Authorization: `Bearer ${FEDAPAY_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 20000
});

/* ────────────────────────────────────────────────────────────────
   HELPER : Validation du corps de la requête
──────────────────────────────────────────────────────────────── */
function validatePaymentBody(body) {
  const { amount, phoneNumber, firstname, lastname } = body;
  const errors = [];

  if (!amount || isNaN(amount) || Number(amount) < 100)
    errors.push('Le montant doit être ≥ 100 XOF.');

  if (!phoneNumber)
    errors.push('Le numéro de téléphone est requis.');
  else if (phoneNumber.replace(/\D/g, '').length < 8)
    errors.push('Numéro de téléphone invalide (min 8 chiffres).');

  if (!firstname || firstname.trim().length < 2)
    errors.push('Le prénom est requis (min 2 caractères).');

  if (!lastname || lastname.trim().length < 2)
    errors.push('Le nom est requis (min 2 caractères).');

  return errors;
}

/* ────────────────────────────────────────────────────────────────
   HELPER : Extraire la transaction de la réponse FedaPay
   L'API FedaPay v1 enveloppe les données dans { v1: { transaction: ... } }
   mais certaines versions renvoient directement l'objet.
──────────────────────────────────────────────────────────────── */
function extractTransaction(responseData) {
  if (responseData?.v1?.transaction) return responseData.v1.transaction;
  if (responseData?.transaction) return responseData.transaction;
  // Parfois FedaPay renvoie directement les données
  if (responseData?.id) return responseData;
  return null;
}

/* ────────────────────────────────────────────────────────────────
   ROUTE 1 : POST /pay-fedapay
   Crée une transaction + retourne l'URL de paiement FedaPay
──────────────────────────────────────────────────────────────── */
app.post('/pay-fedapay', async (req, res) => {
  const { amount, phoneNumber, firstname, lastname, email, eventName } = req.body;

  // Validation
  const errors = validatePaymentBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const amountInt  = Math.round(Number(amount));

  try {
    /* ── Étape 1 : Créer la transaction ─────────────────────── */
    const txResponse = await fedapay.post('/transactions', {
      amount:       amountInt,
      currency:     { iso: 'XOF' },
      description:  `YourPass — ${eventName || 'Ticket événement'}`,
      callback_url: CALLBACK_URL,
      customer: {
        firstname: firstname.trim(),
        lastname:  lastname.trim(),
        email:     email?.trim() || undefined,
        phone_number: {
          number:  cleanPhone,
          country: 'BJ'  // Bénin
        }
      }
    });

    const transaction = extractTransaction(txResponse.data);
    const txId        = transaction?.id;

    if (!txId) {
      console.error('Réponse FedaPay inattendue:', JSON.stringify(txResponse.data, null, 2));
      throw new Error('ID de transaction introuvable dans la réponse FedaPay.');
    }

    /* ── Étape 2 : Générer le token de paiement ─────────────── */
    const tokenResponse = await fedapay.post(`/transactions/${txId}/token`);
    
    // FedaPay peut retourner l'URL dans différents endroits selon la version
    const paymentUrl =
      tokenResponse.data?.url ||
      tokenResponse.data?.token?.url ||
      tokenResponse.data?.v1?.token?.url;

    if (!paymentUrl) {
      console.error('Réponse token FedaPay:', JSON.stringify(tokenResponse.data, null, 2));
      throw new Error('URL de paiement introuvable dans la réponse FedaPay.');
    }

    console.log(`✅ Transaction créée : ID=${txId} | Montant=${amountInt} XOF | Tél=+${cleanPhone}`);

    return res.json({
      success:        true,
      url:            paymentUrl,
      transaction_id: txId
    });

  } catch (err) {
    const fedaError = err.response?.data;
    const status    = err.response?.status || 500;

    console.error(`❌ Erreur FedaPay [HTTP ${status}] :`, fedaError || err.message);

    // Message d'erreur clair pour le client
    let message = 'Erreur lors de la création du paiement.';

    if (status === 401) {
      message = 'Clé API FedaPay invalide. Vérifiez votre fichier .env (la clé doit commencer par sk_sandbox_ ou sk_live_).';
    } else if (status === 422) {
      message = fedaError?.errors?.join(', ') || 'Données de paiement invalides.';
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      message = 'Délai de connexion à FedaPay dépassé. Réessayez.';
    } else if (fedaError?.message) {
      message = fedaError.message;
    } else if (err.message) {
      message = err.message;
    }

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      error:   message
    });
  }
});

/* ────────────────────────────────────────────────────────────────
   ROUTE 2 : GET /verify/:id
   Vérifie le statut d'une transaction FedaPay
──────────────────────────────────────────────────────────────── */
app.get('/verify/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ success: false, error: 'ID de transaction invalide.' });
  }

  try {
    const response    = await fedapay.get(`/transactions/${id}`);
    const transaction = extractTransaction(response.data);

    if (!transaction) {
      throw new Error('Transaction introuvable dans la réponse.');
    }

    return res.json({
      success: true,
      transaction: {
        id:          transaction.id,
        status:      transaction.status,   // approved / declined / pending / canceled
        amount:      transaction.amount,
        description: transaction.description,
        created_at:  transaction.created_at
      }
    });
  } catch (err) {
    const status = err.response?.status || 500;
    console.error(`❌ Vérification TX [${id}] :`, err.response?.data || err.message);
    return res.status(status).json({
      success: false,
      error:   err.response?.data?.message || 'Impossible de vérifier la transaction.'
    });
  }
});

/* ────────────────────────────────────────────────────────────────
   ROUTE 3 : POST /webhook
   Reçoit les callbacks FedaPay (à configurer dans dashboard FedaPay)
──────────────────────────────────────────────────────────────── */
app.post('/webhook', (req, res) => {
  const event = req.body;
  if (!event?.name) return res.status(400).json({ received: false });

  const tx = event.data?.object || {};
  console.log(`📣 Webhook FedaPay — Event: ${event.name} | TX: ${tx.id} | Status: ${tx.status}`);

  switch (event.name) {
    case 'transaction.approved':
      console.log(`💰 Paiement approuvé : TX#${tx.id} (${tx.amount} XOF)`);
      // TODO : marquer le ticket comme confirmé dans votre base de données Supabase
      // Exemple : await supabase.from('tickets').update({ status: 'approved' }).eq('transaction_id', tx.id)
      break;
    case 'transaction.declined':
      console.log(`🚫 Paiement refusé  : TX#${tx.id}`);
      break;
    case 'transaction.canceled':
      console.log(`⛔ Paiement annulé  : TX#${tx.id}`);
      break;
    default:
      console.log(`ℹ️  Événement ignoré : ${event.name}`);
  }

  return res.status(200).json({ received: true });
});

/* ────────────────────────────────────────────────────────────────
   ROUTE 4 : GET /health
──────────────────────────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'YourPass API',
    key_valid: KEY_VALID,
    mode:      IS_SANDBOX ? 'sandbox' : (IS_PRODUCTION ? 'production' : 'INVALID KEY'),
    timestamp: new Date().toISOString()
  });
});

/* ────────────────────────────────────────────────────────────────
   404 + ERREURS GLOBALES
──────────────────────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ error: `Route inconnue : ${req.method} ${req.path}` });
});

app.use((err, req, res, _next) => {
  console.error('💥 Erreur non gérée :', err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

/* ────────────────────────────────────────────────────────────────
   DÉMARRAGE
──────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🚀 YourPass API — Démarré               ║
║   Port  : ${PORT}                             ║
║   Clé   : ${KEY_VALID ? (IS_SANDBOX ? '🧪 SANDBOX OK' : '🚀 LIVE OK  ') : '❌ INVALIDE'}          ║
║                                            ║
║   Endpoints :                              ║
║     POST /pay-fedapay                      ║
║     GET  /verify/:id                       ║
║     POST /webhook                          ║
║     GET  /health                           ║
╚════════════════════════════════════════════╝
${!KEY_VALID ? '\n  ⚠️  ATTENTION : Clé FedaPay invalide !\n  Consultez le message d\'erreur ci-dessus.\n' : ''}
  `);
});
