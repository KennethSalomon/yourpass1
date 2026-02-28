// api/pay-fedapay.js — YourPass
// Crée une transaction FedaPay et retourne l'URL de paiement

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  // ── Variables d'environnement ─────────────────────────────────────────
  const FEDAPAY_SECRET = process.env.FEDAPAY_SECRET_KEY;
  const BASE_URL       = process.env.CALLBACK_URL || 'https://yourpass.vercel.app';
  const FEDAPAY_ENV    = process.env.FEDAPAY_ENV  || 'sandbox'; // 'sandbox' ou 'live'
  const FEDAPAY_BASE   = FEDAPAY_ENV === 'live'
    ? 'https://api.fedapay.com/v1'
    : 'https://sandbox-api.fedapay.com/v1';

  if (!FEDAPAY_SECRET) {
    console.error('[FedaPay] FEDAPAY_SECRET_KEY non défini');
    return res.status(500).json({ error: 'Configuration serveur manquante (clé API)' });
  }

  // ── Validation du corps ───────────────────────────────────────────────
  const { amount, currency = 'XOF', description, customer } = req.body || {};

  if (!amount || isNaN(parseInt(amount))) {
    return res.status(400).json({ error: 'Montant invalide ou manquant' });
  }
  if (!customer || !customer.firstname) {
    return res.status(400).json({ error: 'Informations client manquantes' });
  }

  const amountInt = parseInt(amount);
  if (amountInt < 100) {
    return res.status(400).json({ error: 'Montant minimum : 100 XOF' });
  }

  try {
    // ── 1. Créer la transaction ────────────────────────────────────────
    const txPayload = {
      description: description || 'Billet YourPass',
      amount:      amountInt,
      currency:    { iso: currency || 'XOF' },
      callback_url: `${BASE_URL}/success.html`,
      customer: {
        firstname: customer.firstname,
        lastname:  customer.lastname  || '',
        email:     customer.email     || undefined,
        phone_number: customer.phone_number || undefined,
      },
    };

    // Supprimer les champs undefined
    if (!txPayload.customer.email)        delete txPayload.customer.email;
    if (!txPayload.customer.phone_number) delete txPayload.customer.phone_number;

    console.log('[FedaPay] Création transaction:', {
      amount: amountInt, env: FEDAPAY_ENV, customer: customer.firstname
    });

    const txResponse = await fetch(`${FEDAPAY_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({ transaction: txPayload }),
    });

    const txData = await txResponse.json();

    if (!txResponse.ok) {
      const errMsg = txData?.message || txData?.error || JSON.stringify(txData);
      console.error('[FedaPay] Erreur création TX:', errMsg);
      return res.status(txResponse.status).json({
        error: `FedaPay: ${errMsg}`,
        details: txData,
      });
    }

    const transaction = txData.v1?.transaction || txData.transaction || txData;
    const txId        = transaction.id || transaction.klass?.id;

    if (!txId) {
      console.error('[FedaPay] ID transaction introuvable dans la réponse:', JSON.stringify(txData));
      return res.status(500).json({ error: 'ID de transaction non reçu de FedaPay' });
    }

    console.log('[FedaPay] Transaction créée, ID:', txId);

    // ── 2. Générer le token de paiement ───────────────────────────────
    const tokenResponse = await fetch(`${FEDAPAY_BASE}/transactions/${txId}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET}`,
        'Accept':        'application/json',
      },
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      const errMsg = tokenData?.message || tokenData?.error || JSON.stringify(tokenData);
      console.error('[FedaPay] Erreur génération token:', errMsg);
      return res.status(tokenResponse.status).json({
        error: `FedaPay token: ${errMsg}`,
        transaction_id: txId,
      });
    }

    const token      = tokenData.token;
    const paymentUrl = tokenData.url
      || (token ? `https://checkout${FEDAPAY_ENV === 'sandbox' ? '-sandbox' : ''}.fedapay.com/payment-pages/checkout/${token}` : null);

    if (!paymentUrl) {
      console.error('[FedaPay] URL de paiement introuvable:', JSON.stringify(tokenData));
      return res.status(500).json({ error: 'URL de paiement non générée', transaction_id: txId });
    }

    console.log('[FedaPay] URL générée pour TX:', txId);

    return res.status(200).json({
      success:     true,
      payment_url: paymentUrl,
      token,
      transaction_id: txId,
    });

  } catch (err) {
    console.error('[FedaPay] Erreur inattendue:', err.message);
    return res.status(500).json({ error: `Erreur serveur: ${err.message}` });
  }
}