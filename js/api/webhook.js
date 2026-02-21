export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).end();

  const event = req.body;
  if (!event?.name) return res.status(400).json({ received: false });

  const tx = event.data?.object || {};
  console.log(`Webhook FedaPay — ${event.name} | TX: ${tx.id}`);

  return res.status(200).json({ received: true });
}