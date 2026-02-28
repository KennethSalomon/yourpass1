// api/verify/[id].js — YourPass
// Vérifie le statut d'une transaction FedaPay par son ID
// Appelé par success.html en polling jusqu'à confirmation

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID de transaction manquant' });
  }

  const FEDAPAY_SECRET = process.env.FEDAPAY_SECRET_KEY;
  const FEDAPAY_ENV    = process.env.FEDAPAY_ENV || 'sandbox';
  const FEDAPAY_BASE   = FEDAPAY_ENV === 'live'
    ? 'https://api.fedapay.com/v1'
    : 'https://sandbox-api.fedapay.com/v1';

  if (!FEDAPAY_SECRET) {
    return res.status(500).json({ error: 'Configuration serveur manquante' });
  }

  try {
    const response = await fetch(`${FEDAPAY_BASE}/transactions/${id}`, {
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET}`,
        'Accept':        'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.message || data?.error || `HTTP ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    const tx     = data.v1?.transaction || data.transaction || data;
    const status = tx.status || 'unknown';

    // Générer un ID de billet si la transaction est approuvée
    const ticketId = (status === 'approved' || status === 'paid' || status === 'successful')
      ? `YP-${tx.id}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      : undefined;

    return res.status(200).json({
      id:             tx.id,
      status,
      amount:         tx.amount,
      currency:       tx.currency?.iso || 'XOF',
      description:    tx.description,
      ticketId,
      created_at:     tx.created_at,
      approved_at:    tx.approved_at,
    });

  } catch (err) {
    console.error('[Verify] Erreur:', err.message);
    return res.status(500).json({ error: `Erreur serveur: ${err.message}` });
  }
}