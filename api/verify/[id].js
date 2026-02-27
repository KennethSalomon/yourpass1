import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

/* ══════════════════════════════════════════════════════════════════
   YourPass — api/verify/[id].js
   
   Endpoint de vérification du statut d'une transaction FedaPay.
   Appelé par success.html en polling.
   
   Route : GET /api/verify/:id
   
   Stratégie :
   1. Vérifier dans Supabase (mis à jour par webhook)
   2. Si absent/pending → interroger directement l'API FedaPay
   3. Retourner { status, amount, currency }
══════════════════════════════════════════════════════════════════ */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;

/* ── Interroger FedaPay directement ───────────────────────────── */
async function fetchFromFedaPay(txId) {
  if (!FEDAPAY_SECRET_KEY) return null;
  try {
    const res = await axios.get(`https://api.fedapay.com/v1/transactions/${txId}`, {
      headers: { Authorization: `Bearer ${FEDAPAY_SECRET_KEY}` },
      timeout: 10000
    });

    const tx = res.data?.['v1/transaction'] || res.data?.transaction || res.data;

    const statusMap = {
      'approved':    'completed',
      'transferred': 'completed',
      'declined':    'failed',
      'cancelled':   'cancelled',
      'pending':     'pending',
      'error':       'failed'
    };

    return {
      status:   statusMap[tx?.status] || tx?.status || 'pending',
      amount:   Number(tx?.amount || 0),
      currency: tx?.currency?.iso || 'XOF',
      raw:      tx?.status
    };
  } catch (err) {
    console.warn('[Verify] Erreur FedaPay direct:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Méthode non autorisée' });

  // Récupérer l'ID depuis la route dynamique ou le query param
  const txId = req.query?.id
            || req.url?.split('/').pop()?.split('?')[0];

  if (!txId || txId === 'verify') {
    return res.status(400).json({ error: 'ID de transaction manquant' });
  }

  console.log('[Verify] Vérification TX:', txId);

  /* ── 1. Chercher dans Supabase ────────────────────────────── */
  try {
    const { data: rows, error } = await supabase
      .from('payments')
      .select('status, amount, currency, updated_at')
      .eq('fedapay_id', String(txId))
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!error && rows && rows.length > 0) {
      const row = rows[0];
      console.log('[Verify] Trouvé en DB:', row.status);

      // Si le statut est terminal, retourner directement
      if (['completed', 'failed', 'cancelled', 'refunded'].includes(row.status)) {
        return res.status(200).json({
          status:   row.status,
          amount:   row.amount,
          currency: row.currency || 'XOF'
        });
      }
    }
  } catch (err) {
    console.warn('[Verify] Erreur Supabase:', err.message);
  }

  /* ── 2. Fallback : interroger FedaPay directement ─────────── */
  const fedaData = await fetchFromFedaPay(txId);

  if (fedaData) {
    console.log('[Verify] Statut FedaPay direct:', fedaData.status);

    // Mettre à jour Supabase si le statut est terminal
    if (['completed', 'failed', 'cancelled'].includes(fedaData.status)) {
      supabase.from('payments').upsert(
        { fedapay_id: String(txId), ...fedaData, updated_at: new Date().toISOString() },
        { onConflict: 'fedapay_id', ignoreDuplicates: false }
      ).then(({ error }) => {
        if (error) console.warn('[Verify] Erreur màj Supabase:', error.message);
      });
    }

    return res.status(200).json({
      status:   fedaData.status,
      amount:   fedaData.amount,
      currency: fedaData.currency
    });
  }

  /* ── 3. Rien trouvé → pending ─────────────────────────────── */
  return res.status(200).json({
    status:   'pending',
    amount:   0,
    currency: 'XOF'
  });
}