import axios from 'axios';

/* ════════════════════════════════════════════════════════════════
   YourPass — api/verify/[id].js  (version CORRIGÉE Vercel)
════════════════════════════════════════════════════════════════ */

const fedapay = axios.create({
  baseURL: 'https://api.fedapay.com/v1',
  headers: {
    Authorization:  `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 20000
});

function extractTransaction(data) {
  if (data?.v1?.transaction) return data.v1.transaction;
  if (data?.transaction)     return data.transaction;
  if (data?.id)              return data;
  return null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ success: false, error: 'ID de transaction invalide.' });
  }

  try {
    const response    = await fedapay.get(`/transactions/${id}`);
    const transaction = extractTransaction(response.data);

    if (!transaction) throw new Error('Transaction introuvable dans la réponse.');

    return res.status(200).json({
      success: true,
      transaction: {
        id:          transaction.id,
        status:      transaction.status,
        amount:      transaction.amount,
        description: transaction.description,
        created_at:  transaction.created_at
      }
    });

  } catch (err) {
    const status = err.response?.status || 500;
    console.error('[YourPass] Vérification TX:', id, '— Erreur:', err.response?.data || err.message);

    return res.status(status).json({
      success: false,
      error: err.response?.data?.message || 'Impossible de vérifier la transaction.'
    });
  }
}