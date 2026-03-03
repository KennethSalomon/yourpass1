// api/pay-fedapay.js — YourPass ✅ CORRIGÉ
// Corrections :
//   ✅ callback_url sans ?id=Date.now() — FedaPay ajoute lui-même ?id=TX_ID
//   ✅ Extraction robuste de l'ID de transaction
//   ✅ Extraction robuste de l'URL de paiement

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' });

  const FEDAPAY_SECRET = process.env.FEDAPAY_SECRET_KEY;
  const BASE_URL       = (process.env.CALLBACK_URL || 'https://yourpass.vercel.app').replace(/\/$/, '');
  const FEDAPAY_ENV    = process.env.FEDAPAY_ENV || 'sandbox';
  const FEDAPAY_BASE   = FEDAPAY_ENV === 'live'
    ? 'https://api.fedapay.com/v1'
    : 'https://sandbox-api.fedapay.com/v1';

  if (!FEDAPAY_SECRET) {
    return res.status(500).json({ error: 'Configuration serveur incomplète' });
  }

  try {
    const { amount, customer, event_id } = req.body;

    if (!amount || !customer?.email) {
      return res.status(400).json({ error: 'Montant et email client requis' });
    }

    const txPayload = {
      amount:      parseInt(amount),
      currency:    { iso: 'XOF' },
      description: `Ticket YourPass — Événement #${event_id || 'Global'}`,
      customer: {
        firstname: customer.firstname || 'Client',
        lastname:  customer.lastname  || 'YourPass',
        email:     customer.email,
      },
      custom_metadata: {
        event_id:       String(event_id || 'n/a'),
        customer_name:  `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
        customer_email: customer.email,
      },
      // ✅ BUG CORRIGÉ — plus de ?id=Date.now()
      // FedaPay ajoute automatiquement ?id=TX_ID&status=approved à cette URL
      callback_url: `${BASE_URL}/success.html`,
    };

    if (customer.phone_number) {
      txPayload.customer.phone_number = {
        number:  customer.phone_number.replace(/\D/g, '').replace(/^229/, ''),
        country: 'BJ',
      };
    }

    const txResponse = await fetch(`${FEDAPAY_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(txPayload),
    });

    const txData = await txResponse.json();

    if (!txResponse.ok) {
      return res.status(txResponse.status).json({
        error: txData.message || txData.error || 'Erreur FedaPay création',
      });
    }

    // ✅ Extraction robuste — couvre les différentes structures de réponse FedaPay
    const tx   = txData?.v1?.transaction ?? txData?.transaction ?? txData;
    const txId = tx?.id;
    if (!txId) throw new Error('ID de transaction manquant dans la réponse FedaPay');

    // Génération du token de paiement
    const tokenResponse = await fetch(`${FEDAPAY_BASE}/transactions/${txId}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET}`,
        'Accept':        'application/json',
      },
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      const errMsg = tokenData?.message || tokenData?.error || `HTTP ${tokenResponse.status}`;
      return res.status(tokenResponse.status).json({ error: `Token FedaPay : ${errMsg}`, transaction_id: txId });
    }

    // ✅ Extraction robuste de l'URL
    const tokenStr = tokenData?.token ?? tokenData?.v1?.token?.token ?? null;
    const paymentUrl = tokenData?.url
                    ?? tokenData?.v1?.url
                    ?? tokenData?.token?.url
                    ?? (tokenStr
                        ? `https://checkout${FEDAPAY_ENV !== 'live' ? '-sandbox' : ''}.fedapay.com/v1/checkout/${tokenStr}`
                        : null);

    if (!paymentUrl) {
      return res.status(500).json({ error: 'URL de paiement non générée', transaction_id: txId });
    }

    return res.status(200).json({ success: true, transaction_id: txId, payment_url: paymentUrl });

  } catch (error) {
    console.error('[FedaPay] Erreur interne:', error.message);
    return res.status(500).json({ error: 'Erreur interne : ' + error.message });
  }
}