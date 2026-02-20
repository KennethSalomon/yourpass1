
/* ================================================================
   YourPass — server.js  ·  Version BOOST
   Routes :
     POST /pay-fedapay   → Crée une transaction FedaPay
     GET  /verify/:id    → Vérifie le statut d'une transaction
     POST /webhook       → Reçoit les callbacks FedaPay
     GET  /health        → Healthcheck
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
const IS_SANDBOX         = FEDAPAY_SECRET_KEY?.startsWith('sk_sandbox_');

// URL de retour après paiement (adapter selon votre environnement)
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://127.0.0.1:5500/success.html';

if (!FEDAPAY_SECRET_KEY) {
  console.error('❌ ERREUR : FEDAPAY_SECRET_KEY manquant dans le fichier .env');
  process.exit(1);
}

console.log(`🔑 Mode : ${IS_SANDBOX ? 'SANDBOX (test)' : 'PRODUCTION'}`);

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
    // Ajoutez votre domaine de prod ici
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' }));

// Logger simple
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

/* ────────────────────────────────────────────────────────────────
   HELPER : client Axios FedaPay
──────────────────────────────────────────────────────────────── */
const fedapay = axios.create({
  baseURL: FEDAPAY_BASE_URL,
  headers: {
    Authorization: `Bearer ${FEDAPAY_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000
});

/* ────────────────────────────────────────────────────────────────
   HELPER : Validation
──────────────────────────────────────────────────────────────── */
function validatePaymentBody(body) {
  const { amount, phoneNumber, firstname, lastname } = body;
  const errors = [];

  if (!amount || isNaN(amount) || Number(amount) < 100)
    errors.push('Le montant doit être un nombre ≥ 100 XOF.');

  if (!phoneNumber)
    errors.push('Le numéro de téléphone est requis.');
  else if (phoneNumber.replace(/\D/g, '').length < 8)
    errors.push('Le numéro de téléphone est invalide (min. 8 chiffres).');

  if (!firstname || firstname.trim().length < 2)
    errors.push('Le prénom est requis (min. 2 caractères).');

  if (!lastname || lastname.trim().length < 2)
    errors.push('Le nom est requis (min. 2 caractères).');

  return errors;
}

/* ────────────────────────────────────────────────────────────────
   ROUTE 1 : POST /pay-fedapay
   Crée une transaction FedaPay et retourne l'URL de paiement.
──────────────────────────────────────────────────────────────── */
app.post('/pay-fedapay', async (req, res) => {
  const { amount, phoneNumber, firstname, lastname, email, eventName } = req.body;

  // Validation
  const errors = validatePaymentBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const cleanPhone = phoneNumber.replace(/\D/g, '');

  try {
    // 1. Créer la transaction
    const txResponse = await fedapay.post('/transactions', {
      amount:       Math.round(Number(amount)),
      currency:     { iso: 'XOF' },
      description:  `YourPass — ${eventName || 'Ticket événement'}`,
      callback_url: CALLBACK_URL,
      customer: {
        firstname: firstname.trim(),
        lastname:  lastname.trim(),
        email:     email || undefined,
        phone_number: {
          number:  cleanPhone,
          country: 'BJ'
        }
      }
    });

    const transaction = txResponse.data?.v1?.transaction || txResponse.data;
    const txId        = transaction?.id;

    if (!txId) throw new Error('ID de transaction introuvable dans la réponse FedaPay.');

    // 2. Générer le token de paiement
    const tokenResponse = await fedapay.post(`/transactions/${txId}/token`);
    const paymentUrl    = tokenResponse.data?.url || tokenResponse.data?.token?.url;

    if (!paymentUrl) throw new Error('URL de paiement introuvable.');

    console.log(`✅ Transaction créée : ID=${txId} | Montant=${amount} XOF | Tél=${cleanPhone}`);

    return res.json({
      success:        true,
      url:            paymentUrl,
      transaction_id: txId
    });

  } catch (err) {
    const fedaError = err.response?.data;
    const status    = err.response?.status || 500;

    console.error(`❌ Erreur FedaPay [${status}] :`, fedaError || err.message);

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      error:   fedaError?.message || err.message || 'Erreur interne lors de la création de la transaction.'
    });
  }
});

/* ────────────────────────────────────────────────────────────────
   ROUTE 2 : GET /verify/:id
   Vérifie le statut d'une transaction FedaPay.
──────────────────────────────────────────────────────────────── */
app.get('/verify/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ success: false, error: 'ID de transaction invalide.' });
  }

  try {
    const response    = await fedapay.get(`/transactions/${id}`);
    const transaction = response.data?.v1?.transaction || response.data;

    return res.json({
      success: true,
      transaction: {
        id:     transaction.id,
        status: transaction.status,        // approved / declined / pending / etc.
        amount: transaction.amount,
        description: transaction.description
      }
    });
  } catch (err) {
    const status = err.response?.status || 500;
    console.error(`❌ Vérification transaction [${id}] :`, err.response?.data || err.message);
    return res.status(status).json({
      success: false,
      error:   err.response?.data?.message || 'Impossible de vérifier la transaction.'
    });
  }
});

/* ────────────────────────────────────────────────────────────────
   ROUTE 3 : POST /webhook
   Reçoit les notifications FedaPay (paiement réussi, échoué…).
   À configurer dans le dashboard FedaPay.
──────────────────────────────────────────────────────────────── */
app.post('/webhook', (req, res) => {
  const event = req.body;

  if (!event || !event.name) {
    return res.status(400).json({ received: false });
  }

  const { name, data } = event;
  const tx = data?.object || {};

  console.log(`📣 Webhook FedaPay — Event: ${name} | TX: ${tx.id} | Status: ${tx.status}`);

  switch (name) {
    case 'transaction.approved':
      // Ticket payé — mettre à jour votre base de données ici
      console.log(`💰 Paiement approuvé : TX#${tx.id} (${tx.amount} XOF)`);
      break;
    case 'transaction.declined':
      console.log(`🚫 Paiement refusé  : TX#${tx.id}`);
      break;
    case 'transaction.canceled':
      console.log(`⛔ Paiement annulé  : TX#${tx.id}`);
      break;
    default:
      console.log(`ℹ️  Événement ignoré : ${name}`);
  }

  // Toujours répondre 200 pour que FedaPay ne re-tente pas
  return res.status(200).json({ received: true });
});

/* ────────────────────────────────────────────────────────────────
   ROUTE 4 : GET /health
──────────────────────────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'YourPass API',
    mode:      IS_SANDBOX ? 'sandbox' : 'production',
    timestamp: new Date().toISOString()
  });
});

/* ────────────────────────────────────────────────────────────────
   GESTION 404 + ERREURS GLOBALES
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
╔══════════════════════════════════════════╗
║   🚀 YourPass API — démarré             ║
║   Port    : ${PORT}                         ║
║   Mode    : ${IS_SANDBOX ? 'SANDBOX (test)     ' : 'PRODUCTION        '} ║
║   Routes  :                              ║
║     POST /pay-fedapay                    ║
║     GET  /verify/:id                     ║
║     POST /webhook                        ║
║     GET  /health                         ║
╚══════════════════════════════════════════╝
  `);
});
