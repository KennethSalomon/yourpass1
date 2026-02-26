import axios from 'axios';

/**
 * Route de DEBUG — À SUPPRIMER APRÈS TEST
 * Teste FedaPay avec des données minimales et loggue tout
 * 
 * Usage : POST https://yourpass1.vercel.app/api/debug-payment
 * Body : {} (vide, utilise des données de test fixes)
 */

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') { resolve(req.body); return; }
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key      = process.env.FEDAPAY_SECRET_KEY || '';
  const callback = process.env.CALLBACK_URL || 'https://yourpass1.vercel.app/success.html';
  const mode     = key.startsWith('sk_live_') ? 'PRODUCTION' : key.startsWith('sk_sandbox_') ? 'LIVE' : 'INVALIDE';

  const body = await parseBody(req);

  const report = {
    env: {
      key_present:   !!key,
      key_preview:   key ? key.slice(0, 15) + '...' : 'MANQUANTE',
      mode,
      callback_url:  callback
    },
    body_received: body,
    body_parsing:  Object.keys(body).length > 0 ? 'OK' : 'VIDE (problème de parsing)',
    steps: []
  };

  if (!key) {
    report.steps.push({ step: 'ENV CHECK', status: 'FAIL', error: 'FEDAPAY_SECRET_KEY manquante' });
    return res.status(500).json(report);
  }
  report.steps.push({ step: 'ENV CHECK', status: 'OK' });

  // Test avec données minimales
  const testData = {
    amount:       1000,
    phoneNumber:  body.phoneNumber || '22997000000',
    firstname:    body.firstname   || 'Test',
    lastname:     body.lastname    || 'YourPass',
    email:        body.email       || undefined,
    eventName:    'Test Debug'
  };

  try {
    const fedapay = axios.create({
      baseURL: 'https://api.fedapay.com/v1',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 20000
    });

    // Étape 1 : Créer transaction
    report.steps.push({ step: 'CRÉER TRANSACTION', status: 'EN COURS', data: testData });

    const txRes = await fedapay.post('/transactions', {
      amount:       testData.amount,
      currency:     { iso: 'XOF' },
      description:  `Debug — ${testData.eventName}`,
      callback_url: callback,
      customer: {
        firstname:    testData.firstname,
        lastname:     testData.lastname,
        email:        testData.email || undefined,
        phone_number: { number: testData.phoneNumber.replace(/\D/g, ''), country: 'BJ' }
      }
    });

    const tx   = txRes.data?.v1?.transaction || txRes.data?.transaction || txRes.data;
    const txId = tx?.id;

    report.steps[report.steps.length - 1].status = 'OK';
    report.steps[report.steps.length - 1].tx_id  = txId;
    report.steps[report.steps.length - 1].tx_status = tx?.status;

    if (!txId) throw new Error('TX ID introuvable dans la réponse: ' + JSON.stringify(txRes.data).slice(0, 300));

    // Étape 2 : Générer token
    report.steps.push({ step: 'GÉNÉRER TOKEN', status: 'EN COURS', tx_id: txId });

    const tokenRes  = await fedapay.post(`/transactions/${txId}/token`);
    const paymentUrl = tokenRes.data?.url
                    || tokenRes.data?.token?.url
                    || tokenRes.data?.v1?.token?.url
                    || tokenRes.data?.v1?.url;

    report.steps[report.steps.length - 1].status      = 'OK';
    report.steps[report.steps.length - 1].url_found   = !!paymentUrl;
    report.steps[report.steps.length - 1].url_preview = paymentUrl ? paymentUrl.slice(0, 60) + '...' : null;
    report.steps[report.steps.length - 1].raw_keys    = Object.keys(tokenRes.data || {});

    report.result = {
      success:        true,
      transaction_id: txId,
      payment_url:    paymentUrl,
      message:        paymentUrl ? '✅ TOUT FONCTIONNE !' : '⚠️ Transaction créée mais URL manquante'
    };

    return res.status(200).json(report);

  } catch (err) {
    const last = report.steps[report.steps.length - 1];
    if (last) {
      last.status = 'FAIL';
      last.error  = err.message;
      last.http_status = err.response?.status;
      last.fedapay_response = err.response?.data;
    }
    report.result = { success: false, error: err.message };
    return res.status(500).json(report);
  }
}