/* ═══════════════════════════════════════════════════════════════════════
   js/main.js — YourPass (Version Complète avec Sauvegarde Locale)
═══════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Toggle sections paiement ─────────────────────────────────────────────
function togglePaymentSection(name) {
  const section = document.getElementById(`${name}-section`);
  if (!section) return;
  const isActive = section.classList.contains('active');
  document.querySelectorAll('.payment-content').forEach(el => el.classList.remove('active'));
  if (!isActive) section.classList.add('active');
}

// ─── Sélection option paiement ────────────────────────────────────────────
function selectPaymentOption(btn, provider) {
  const parent = btn.closest('.payment-options');
  if (!parent) return;
  parent.querySelectorAll('.payment-option').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._selectedProvider = provider;
}

// ─── Validation numéro de téléphone béninois ──────────────────────────────
function validatePhone(phone) {
  const cleaned = phone.replace(/[\s\-\.]/g, '');
  return /^(\+?229)?[0-9]{8}$/.test(cleaned);
}

// ─── Normaliser le numéro ─────────────────────────────────────────────────
function normalizePhone(phone) {
  const cleaned = phone.replace(/[\s\-\.\+]/g, '');
  if (cleaned.startsWith('229')) return cleaned;
  return `229${cleaned}`;
}

// ─── GESTION DU PAIEMENT FEDAPAY ──────────────────────────────────────────
async function processFedaPayPayment() {
  const btn = document.getElementById('fedapay-submit');
  const email = document.getElementById('feda-email')?.value;
  const firstname = document.getElementById('feda-firstname')?.value;
  const lastname = document.getElementById('feda-lastname')?.value;

  // Récupération des infos de l'événement depuis l'URL ou le state
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('event') || '1';
  const amount = params.get('price') || '5000';
  const eventName = document.querySelector('.item-info h3')?.textContent || 'Billet YourPass';

  if (!email || !firstname || !lastname) {
    alert('Veuillez remplir tous les champs (Nom, Prénom, Email).');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Initialisation...';

    // 💡 CRITIQUE : Sauvegarder les infos pour la page success.html
    const pendingOrder = {
      email: email,
      name: `${firstname} ${lastname}`,
      eventName: eventName,
      amount: amount,
      eventId: eventId,
      timestamp: Date.now()
    };
    localStorage.setItem('yourpass_pending_order', JSON.stringify(pendingOrder));

    const response = await fetch('/api/pay-fedapay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        event_id: eventId,
        customer: {
          firstname: firstname,
          lastname: lastname,
          email: email
        }
      })
    });

    const data = await response.json();

    if (data.success && data.payment_url) {
      window.location.href = data.payment_url;
    } else {
      throw new Error(data.error || 'Erreur lors de la création du paiement');
    }
  } catch (error) {
    console.error('Erreur FedaPay:', error);
    alert('Erreur : ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Payer maintenant';
  }
}

// ─── GESTION DU PAIEMENT MOMO (DIRECT) ────────────────────────────────────
async function processMomoPayment() {
  const btn = document.getElementById('momo-submit');
  const phone = document.getElementById('momo-phone')?.value;
  const provider = window._selectedProvider;

  if (!phone || !validatePhone(phone)) {
    alert('Veuillez entrer un numéro MTN ou Moov valide (8 chiffres).');
    return;
  }
  if (!provider) {
    alert('Veuillez sélectionner votre opérateur (MTN ou Moov).');
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="loader-small"></span> Traitement...';

    // Simulation ou appel API direct pour Momo
    console.log(`Paiement via ${provider} pour le numéro ${normalizePhone(phone)}`);
    
    // Ici, tu pourrais rediriger vers ton API pay-fedapay en spécifiant le mode direct
    alert('Redirection vers l\'interface de paiement sécurisée...');
    
  } catch (error) {
    alert('Erreur: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Confirmer le paiement';
  }
}

// ─── Initialisation navbar / thème ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Thème Dark/Light
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = '🌙';
  }

  const themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      const icon = themeBtn.querySelector('.theme-icon');
      if (icon) icon.textContent = isDark ? '🌙' : '☀️';
    });
  }

  // Menu Mobile
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu    = document.getElementById('navMenu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      menuToggle.classList.toggle('active');
    });
  }

  // Fermeture menu au clic sur un lien
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (navMenu) navMenu.classList.remove('open');
      if (menuToggle) menuToggle.classList.remove('active');
    });
  });

  // Liaison du bouton FedaPay
  const fedaBtn = document.getElementById('fedapay-submit');
  if (fedaBtn) {
    fedaBtn.addEventListener('click', processFedaPayPayment);
  }

  // Liaison du bouton Momo
  const momoBtn = document.getElementById('momo-submit');
  if (momoBtn) {
    momoBtn.addEventListener('click', processMomoPayment);
  }
});

// ─── Utilitaire de notification ───────────────────────────────────────────
function showNotice(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `notice notice-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('show'); }, 100);
  setTimeout(() => { 
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  }, 4000);
}