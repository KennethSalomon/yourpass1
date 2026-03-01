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
  // Correction de l'URL de base pour éviter le double slash
  const BASE_URL       = (process.env.CALLBACK_URL || 'https://yourpass.vercel.app').replace(/\/$/, '');
  const FEDAPAY_ENV    = process.env.FEDAPAY_ENV  || 'sandbox'; // 'sandbox' ou 'live'
  const FEDAPAY_BASE   = FEDAPAY_ENV === 'live'
    ? 'https://api.fedapay.com/v1'
    : 'https://sandbox-api.fedapay.com/v1';

  if (!FEDAPAY_SECRET) {
    console.error('[FedaPay] FEDAPAY_SECRET_KEY non défini');
    return res.status(500).json({ error: 'Configuration serveur incomplète' });
  }

  try {
    const { amount, customer, event_id } = req.body;

    if (!amount || !customer?.email) {
      return res.status(400).json({ error: 'Montant et email client requis' });
    }

    // ── 1. Création de la transaction ───────────────────────────────────
    const txPayload = {
      amount:      parseInt(amount),
      currency:    { iso: 'XOF' },
      description: `Ticket YourPass - Événement #${event_id || 'Global'}`,
      customer: {
        firstname: customer.firstname || 'Client',
        lastname:  customer.lastname  || 'YourPass',
        email:     customer.email,
      },
      // Métadonnées cruciales pour le webhook
      custom_metadata: {
        event_id:      event_id || 'n/a',
        customer_name: `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
        customer_email: customer.email
      },
      // URL de redirection après paiement avec ID unique pour éviter le cache
      callback_url: `${BASE_URL}/success.html?id=${Date.now()}`
    };

    console.log('[FedaPay] Création TX avec payload:', JSON.stringify(txPayload));

    const response = await fetch(`${FEDAPAY_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(txPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[FedaPay] Erreur création:', JSON.stringify(data));
      return res.status(response.status).json({ error: data.message || 'Erreur FedaPay' });
    }

    const txId = data.v1?.transaction?.id || data.transaction?.id;
    if (!txId) throw new Error('ID de transaction manquant dans la réponse');

    // ── 2. Génération du token de paiement ───────────────────────────────
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
    // Construction de l'URL finale
    const paymentUrl = tokenData.url 
      || (token ? `https://checkout${FEDAPAY_ENV === 'sandbox' ? '-sandbox' : ''}.fedapay.com/v1/checkout/${token}` : null);

    if (!paymentUrl) {
      console.error('[FedaPay] URL de paiement introuvable');
      return res.status(500).json({ error: 'URL de paiement non générée', transaction_id: txId });
    }

    console.log('[FedaPay] Succès! URL générée pour TX:', txId);

    return res.status(200).json({
      success:        true,
      transaction_id: txId,
      payment_url:    paymentUrl
    });

  } catch (error) {
    console.error('[FedaPay] Erreur Catch:', error.message);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}