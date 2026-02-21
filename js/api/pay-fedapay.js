const axios = require('axios');

const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;
const CALLBACK_URL       = process.env.CALLBACK_URL;

const fedapay = axios.create({
  baseURL: 'https://api.fedapay.com/v1',
  headers: { Authorization: `Bearer ${FEDAPAY_SECRET_KEY}`, 'Content-Type': 'application/json' },
  timeout: 20000
});

function extractTransaction(data) {
  if (data?.v1?.transaction) return data.v1.transaction;
  if (data?.transaction)     return data.transaction;
  if (data?.id)              return data;
  return null;
}

export default async function handler(req, res) {
  // Gestion du preflight CORS (OPTIONS)
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Méthode non autorisée' });

  const { amount, phoneNumber, firstname, lastname, email, eventName } = req.body;

  // Validation
  const errors = [];
  if (!amount || isNaN(amount) || Number(amount) < 100)
    errors.push('Le montant doit être ≥ 100 XOF.');
  if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 8)
    errors.push('Numéro de téléphone invalide.');
  if (!firstname || firstname.trim().length < 2)
    errors.push('Prénom requis.');
  if (!lastname || lastname.trim().length < 2)
    errors.push('Nom requis.');
  if (errors.length > 0) return res.status(400).json({ success: false, errors });

  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const amountInt  = Math.round(Number(amount));

  try {
    const txResponse = await fedapay.post('/transactions', {
      amount:       amountInt,
      currency:     { iso: 'XOF' },
      description:  `YourPass — ${eventName || 'Ticket événement'}`,
      callback_url: CALLBACK_URL,
      customer: {
        firstname:    firstname.trim(),
        lastname:     lastname.trim(),
        email:        email?.trim() || undefined,
        phone_number: { number: cleanPhone, country: 'BJ' }
      }
    });

    const transaction = extractTransaction(txResponse.data);
    const txId        = transaction?.id;
    if (!txId) throw new Error('ID de transaction introuvable.');

    const tokenResponse = await fedapay.post(`/transactions/${txId}/token`);
    const paymentUrl =
      tokenResponse.data?.url ||
      tokenResponse.data?.token?.url ||
      tokenResponse.data?.v1?.token?.url;

    if (!paymentUrl) throw new Error('URL de paiement introuvable.');

    return res.json({ success: true, url: paymentUrl, transaction_id: txId });

  } catch (err) {
    const status  = err.response?.status || 500;
    let   message = 'Erreur lors de la création du paiement.';
    if (status === 401) message = 'Clé API FedaPay invalide.';
    else if (err.response?.data?.message) message = err.response.data.message;
    return res.status(status >= 400 && status < 600 ? status : 500).json({ success: false, error: message });
  }
}