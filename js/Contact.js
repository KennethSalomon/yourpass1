/* ================================================================
   YourPass — contact.js
   Gestion du formulaire contact avec soumission réelle + FAQ
================================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;

    // Collect data
    const data = {
      name:    form.querySelector('#contactName')?.value.trim(),
      email:   form.querySelector('#contactEmail')?.value.trim(),
      subject: form.querySelector('#contactSubject')?.value.trim(),
      message: form.querySelector('#contactMessage')?.value.trim(),
    };

    // Validate
    if (!data.name || !data.email || !data.message) {
      window.YourPass?.showToast('⚠️ Veuillez remplir tous les champs obligatoires.', 'warning');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      window.YourPass?.showToast('⚠️ Adresse email invalide.', 'warning');
      return;
    }

    // Submit
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Envoi en cours…';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        window.YourPass?.showToast('✅ Message envoyé ! Nous vous répondrons sous 24h.', 'success', 6000);
        form.reset();
      } else {
        const err = await res.json().catch(() => ({}));
        window.YourPass?.showToast(err.error || '❌ Erreur lors de l\'envoi.', 'error');
      }
    } catch {
      window.YourPass?.showToast('❌ Erreur réseau. Vérifiez votre connexion.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
});