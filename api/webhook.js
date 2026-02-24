import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Initialisation (Vercel récupérera ces variables d'env)
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY // Utilise bien la Service Role Key ici
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const event = req.body;
  if (!event?.name) return res.status(400).json({ received: false });

  const tx = event.data?.object || {};
  console.log(`Webhook FedaPay – ${event.name} | TX: ${tx.id}`);

  // --- LOGIQUE D'EVOLUTION ---

  // On ne traite que si la transaction est approuvée
  if (event.name === 'transaction.approved') {
    try {
      const customerEmail = tx.customer?.email;

      // 1. Enregistrement dans Supabase
      const { error: dbError } = await supabase
        .from('paiements') // remplace par le nom de ta table
        .insert([{ 
          transaction_id: tx.id, 
          email: customerEmail, 
          amount: tx.amount,
          status: 'success' 
        }]);

      if (dbError) throw dbError;

      // 2. Envoi de l'email avec Resend
      if (customerEmail) {
        await resend.emails.send({
          from: 'Acme <onboarding@resend.dev>', // Ou ton domaine vérifié
          to: customerEmail,
          subject: 'Paiement confirmé !',
          html: `<strong>Merci pour votre achat !</strong><br>ID Transaction: ${tx.id}`
        });
      }

    } catch (error) {
      console.error('Erreur traitement webhook:', error);
      // On répond quand même 200 à FedaPay pour éviter qu'il ne renvoie le webhook en boucle
      return res.status(200).json({ error: 'Internal logic failed' });
    }
  }

  return res.status(200).json({ received: true });
}