// api/newsletter.js — YourPass
// Endpoint newsletter : sauvegarde l'email dans Supabase
// REMPLACEZ les variables d'environnement dans Vercel Dashboard

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // ← clé SERVICE ROLE (pas anon)
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert({ email: email.toLowerCase().trim(), subscribed_at: new Date().toISOString() }, {
        onConflict: 'email',
        ignoreDuplicates: true,
      });

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Inscription réussie' });

  } catch (err) {
    console.error('[newsletter] Error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}