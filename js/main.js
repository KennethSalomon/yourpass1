/* ═══════════════════════════════════════════════════════════════════════
   js/main.js — YourPass (version corrigée & complète)
   Contient : processMomoPayment, togglePaymentSection, selectPaymentOption
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
  const cleaned = phone.replace(/[\s\-\.+]/g, '');
  if (cleaned.startsWith('229')) return cleaned;
  if (cleaned.length === 8) return '229' + cleaned;
  return cleaned;
}

// ─── Paiement Mobile Money via FedaPay ───────────────────────────────────
async function processMomoPayment() {
  const phoneEl = document.getElementById('phone');
  const nameEl  = document.getElementById('momo-name');
  const emailEl = document.getElementById('momo-email');
  const payBtn  = document.getElementById('momo-pay-btn');

  if (!phoneEl || !nameEl) {
    console.error('[Main] Champs de formulaire introuvables');
    return;
  }

  const phone = phoneEl.value.trim();
  const name  = nameEl.value.trim();
  const email = emailEl ? emailEl.value.trim() : '';

  // ── Validations ──
  if (!name) {
    showFormError('Veuillez entrer le nom du titulaire.', nameEl);
    return;
  }
  if (!phone) {
    showFormError('Veuillez entrer votre numéro de téléphone.', phoneEl);
    return;
  }
  if (!validatePhone(phone)) {
    showFormError('Numéro de téléphone invalide (format béninois : 8 chiffres ou +229XXXXXXXX).', phoneEl);
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormError('Adresse email invalide.', emailEl);
    return;
  }

  // ── Récupérer les données événement ──
  let eventData = {};
  try { eventData = JSON.parse(localStorage.getItem('selectedEvent') || '{}'); } catch {}

  const price    = parseInt(eventData.price) || 5000;
  const qty      = parseInt(eventData.quantity) || 1;
  const fees     = Math.round(price * qty * 0.05);
  const total    = price * qty + fees;

  const finalTotal = typeof window.calculateTotal === 'function'
    ? window.calculateTotal()
    : total;

  // ── ✅ CORRECTION : Sauvegarder AVANT l'appel API (transaction_id ajouté après) ──
  const pendingData = {
    name,
    email,
    phone: normalizePhone(phone),
    amount: finalTotal,
    eventId: eventData.id,
    provider: window._selectedProvider || 'mtn',
    timestamp: Date.now(),
  };
  localStorage.setItem('pendingPayment', JSON.stringify(pendingData));

  // ── UI : loading ──
  if (payBtn) {
    payBtn.disabled = true;
    const btnText = payBtn.querySelector('.pay-btn-text');
    const btnIcon = payBtn.querySelector('.pay-btn-icon');
    if (btnText) btnText.textContent = 'Redirection vers FedaPay…';
    if (btnIcon) btnIcon.textContent = '⏳';
  }

  // ── Appel API backend ──
  try {
    const response = await fetch('/api/pay-fedapay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:      finalTotal,
        currency:    'XOF',
        description: eventData.name ? `Billet YourPass — ${eventData.name}` : 'Billet YourPass',
        customer: {
          firstname: name.split(' ')[0] || name,
          lastname:  name.split(' ').slice(1).join(' ') || '',
          email:     email || undefined,
          phone_number: {
            number:  normalizePhone(phone),
            country: 'BJ',
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    if (!data.payment_url && !data.url) {
      throw new Error('URL de paiement FedaPay non reçue');
    }

    // ── ✅ CORRECTION CRITIQUE : Sauvegarder transaction_id AVANT la redirection ──
    // success.html en a besoin pour vérifier le statut du paiement
    const txId = data.transaction_id || data.id || '';
    if (txId) {
      localStorage.setItem('yourpass_pending_tx', String(txId));
      // Mettre à jour pendingPayment avec le transaction_id
      pendingData.transaction_id = String(txId);
      localStorage.setItem('pendingPayment', JSON.stringify(pendingData));
      console.log('[Main] transaction_id sauvegardé :', txId);
    }

    // ── Redirection vers FedaPay ──
    window.location.href = data.payment_url || data.url;

  } catch (err) {
    console.error('[Main] Erreur paiement:', err.message);

    if (payBtn) {
      payBtn.disabled = false;
      const btnText = payBtn.querySelector('.pay-btn-text');
      const btnIcon = payBtn.querySelector('.pay-btn-icon');
      if (btnText) btnText.textContent = 'Payer maintenant';
      if (btnIcon) btnIcon.textContent = '📱';
    }

    showPaymentError(err.message);
  }
}

// ─── Helpers UI ───────────────────────────────────────────────────────────
function showFormError(message, inputEl) {
  if (inputEl) {
    inputEl.style.borderColor = '#ef4444';
    inputEl.focus();
    setTimeout(() => { inputEl.style.borderColor = ''; }, 3000);
  }
  showPaymentError(message);
}

function showPaymentError(message) {
  let el = document.getElementById('payment-error-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'payment-error-banner';
    el.style.cssText = `
      background: #fef2f2; border: 1px solid #fecaca;
      color: #dc2626; border-radius: 10px;
      padding: 12px 16px; font-size: 13px; font-weight: 500;
      margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
    `;
    const form = document.getElementById('momo-form');
    if (form) form.prepend(el);
  }
  el.innerHTML = `⚠️ ${message}`;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}

// ─── Initialisation navbar / thème ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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

  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu    = document.getElementById('navMenu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      menuToggle.classList.toggle('active');
    });
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (navMenu) navMenu.classList.remove('open');
    });
  });

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) link.classList.add('active');
  });
});