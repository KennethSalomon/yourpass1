/* ═══════════════════════════════════════════════════════════════════════
   js/main.js — YourPass v3 (Corrigé)
   Corrections :
   ✅ showNotification() désormais définie (était manquante dans tout le projet)
   ✅ processMomoPayment() appelle réellement l'API FedaPay
   ✅ Navbar scroll + active link détection
   ✅ Countdown event header
═══════════════════════════════════════════════════════════════════════ */

'use strict';

/* ── Toggle sections paiement ─────────────────────────────────────────── */
function togglePaymentSection(name) {
  const section = document.getElementById(`${name}-section`);
  if (!section) return;
  const isActive = section.classList.contains('active');
  document.querySelectorAll('.payment-content').forEach(el => el.classList.remove('active'));
  if (!isActive) section.classList.add('active');
}

/* ── Sélection option paiement ────────────────────────────────────────── */
function selectPaymentOption(btn, provider) {
  const parent = btn.closest('.payment-options');
  if (!parent) return;
  parent.querySelectorAll('.payment-option').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._selectedProvider = provider;
}

/* ── Validation numéro de téléphone béninois ──────────────────────────── */
function validatePhone(phone) {
  const cleaned = phone.replace(/[\s\-\.]/g, '');
  return /^(\+?229)?[0-9]{8}$/.test(cleaned);
}

/* ── Normaliser le numéro ─────────────────────────────────────────────── */
function normalizePhone(phone) {
  const cleaned = phone.replace(/[\s\-\.\+]/g, '');
  if (cleaned.startsWith('229')) return cleaned;
  return `229${cleaned}`;
}

/* ═══════════════════════════════════════════════════════════════════════
   NOTIFICATION TOAST — définie ici, disponible dans toutes les pages
   Usage : showNotification('Message', 'success' | 'error' | 'info')
═══════════════════════════════════════════════════════════════════════ */
function showNotification(message, type = 'success') {
  // Supprimer toute notification existante
  document.querySelectorAll('.notification-toast').forEach(el => el.remove());

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `notification-toast ${type}`;
  toast.innerHTML = `<span style="font-size:18px;">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;

  // Style inline de secours si css/style.css non chargé
  toast.style.cssText = `
    position: fixed;
    bottom: 24px; right: 24px;
    background: #fff;
    border-radius: 14px;
    padding: 14px 22px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 99999;
    max-width: 380px;
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
    font-family: 'Inter', sans-serif;
    border-left: 4px solid ${type === 'error' ? '#ff6b6b' : type === 'info' ? '#1C4DB8' : '#10b981'};
    transform: translateX(120%);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });
  });

  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Exposer globalement
window.showNotification = showNotification;

/* ═══════════════════════════════════════════════════════════════════════
   PAIEMENT MOBILE MONEY via FedaPay
   Lit les champs du formulaire paiement.html et appelle /api/pay-fedapay
═══════════════════════════════════════════════════════════════════════ */
async function processMomoPayment() {
  const btn      = document.getElementById('momo-pay-btn');
  const phone    = document.getElementById('phone')?.value?.trim();
  const name     = document.getElementById('momo-name')?.value?.trim();
  const email    = document.getElementById('momo-email')?.value?.trim();
  const provider = window._selectedProvider || 'mtn';

  // Récupérer les données de l'événement sélectionné
  let eventData = {};
  try { eventData = JSON.parse(localStorage.getItem('selectedEvent') || '{}'); } catch {}

  const eventName = document.querySelector('.item-info h3')?.textContent
    || eventData.name
    || 'Billet YourPass';

  // Calcul du montant total (avec frais)
  const price    = parseInt(eventData.price) || 5000;
  const quantity = parseInt(eventData.quantity) || 1;
  const fees     = Math.round(price * quantity * 0.05);
  const total    = price * quantity + fees;

  // Validation
  if (!phone || !validatePhone(phone)) {
    showNotification('Veuillez entrer un numéro MTN ou Moov valide (8 chiffres).', 'error');
    return;
  }
  if (!name) {
    showNotification('Veuillez entrer votre prénom et nom.', 'error');
    return;
  }

  // Préparer les noms
  const nameParts = name.trim().split(/\s+/);
  const firstname = nameParts[0] || 'Client';
  const lastname  = nameParts.slice(1).join(' ') || 'YourPass';

  // Adresse email de secours
  const customerEmail = email || `${normalizePhone(phone)}@yourpass.bj`;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loader-small"></span> Initialisation…';
  }

  try {
    // Sauvegarder pour success.html
    localStorage.setItem('yourpass_pending_order', JSON.stringify({
      email: customerEmail,
      name: name,
      eventName: eventName,
      amount: total,
      eventId: eventData.id || '1',
      timestamp: Date.now()
    }));

    const response = await fetch('/api/pay-fedapay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total,
        event_id: eventData.id || '1',
        customer: {
          firstname,
          lastname,
          email: customerEmail,
          phone_number: normalizePhone(phone)
        }
      })
    });

    const data = await response.json();

    if (data.success && data.payment_url) {
      showNotification('Redirection vers la page de paiement sécurisée…', 'info');
      setTimeout(() => { window.location.href = data.payment_url; }, 800);
    } else {
      throw new Error(data.error || 'Erreur lors de la création du paiement');
    }

  } catch (error) {
    console.error('[MomoPay] Erreur:', error.message);
    showNotification('Erreur : ' + error.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="pay-btn-icon">📱</span><span class="pay-btn-text">Payer maintenant</span>';
    }
  }
}

window.processMomoPayment = processMomoPayment;

/* ── FedaPay direct (depuis checkout.html / autre) ───────────────────── */
async function processFedaPayPayment() {
  const btn       = document.getElementById('fedapay-submit');
  const email     = document.getElementById('feda-email')?.value?.trim();
  const firstname = document.getElementById('feda-firstname')?.value?.trim();
  const lastname  = document.getElementById('feda-lastname')?.value?.trim();

  const params    = new URLSearchParams(window.location.search);
  const eventId   = params.get('event') || '1';
  const eventName = document.querySelector('.item-info h3')?.textContent || 'Billet YourPass';

  let eventData = {};
  try { eventData = JSON.parse(localStorage.getItem('selectedEvent') || '{}'); } catch {}
  const price = parseInt(eventData.price) || parseInt(params.get('price')) || 5000;
  const fees  = Math.round(price * 0.05);
  const total = price + fees;

  if (!email || !firstname || !lastname) {
    showNotification('Veuillez remplir tous les champs (Nom, Prénom, Email).', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Initialisation…'; }

  try {
    localStorage.setItem('yourpass_pending_order', JSON.stringify({
      email, name: `${firstname} ${lastname}`, eventName, amount: total,
      eventId, timestamp: Date.now()
    }));

    const response = await fetch('/api/pay-fedapay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total,
        event_id: eventId,
        customer: { firstname, lastname, email }
      })
    });

    const data = await response.json();

    if (data.success && data.payment_url) {
      window.location.href = data.payment_url;
    } else {
      throw new Error(data.error || 'Erreur FedaPay');
    }
  } catch (error) {
    showNotification('Erreur : ' + error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Payer maintenant'; }
  }
}

window.processFedaPayPayment = processFedaPayPayment;

/* ═══════════════════════════════════════════════════════════════════════
   INITIALISATION — Navbar, Thème, Menu Mobile, Countdown
═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Thème Dark/Light ─────────────────────────────────────────── */
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

  /* ── Menu Mobile ──────────────────────────────────────────────── */
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu    = document.getElementById('navMenu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      menuToggle.classList.toggle('active');
    });
  }

  // Fermer au clic sur un lien
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu?.classList.remove('open');
      menuToggle?.classList.remove('active');
    });
  });

  // Fermer au clic hors menu
  document.addEventListener('click', (e) => {
    if (navMenu?.classList.contains('open') &&
        !navMenu.contains(e.target) &&
        !menuToggle?.contains(e.target)) {
      navMenu.classList.remove('open');
      menuToggle?.classList.remove('active');
    }
  });

  /* ── Navbar scroll shadow ─────────────────────────────────────── */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const onScroll = () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Active nav link ──────────────────────────────────────────── */
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = (link.getAttribute('href') || '').split('/').pop();
    if (href === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  /* ── Video son toggle (index.html) ───────────────────────────── */
  const toggleSoundBtn = document.getElementById('toggleSound');
  const bgVideo        = document.getElementById('bg-video');

  if (toggleSoundBtn && bgVideo) {
    toggleSoundBtn.addEventListener('click', () => {
      bgVideo.muted = !bgVideo.muted;
      toggleSoundBtn.textContent = bgVideo.muted ? '🔇' : '🔊';
    });
  }

  /* ── Countdown (index.html) ──────────────────────────────────── */
  const countdownEl = document.getElementById('countdown');
  if (countdownEl) {
    // Prochain grand événement : WeLoveYa Festival 15 mars 2026
    const target = new Date('2026-03-15T18:00:00');

    function updateCountdown() {
      const now  = new Date();
      const diff = target - now;

      if (diff <= 0) {
        countdownEl.innerHTML = '<p style="font-size:1.4rem;font-weight:700;">🎉 L\'événement est en cours !</p>';
        return;
      }

      const d  = Math.floor(diff / 86400000);
      const h  = Math.floor((diff % 86400000) / 3600000);
      const m  = Math.floor((diff % 3600000) / 60000);
      const s  = Math.floor((diff % 60000) / 1000);

      const fmt = n => n.toString().padStart(2, '0');

      countdownEl.innerHTML = `
        <p style="font-size:0.85rem;letter-spacing:0.2em;text-transform:uppercase;opacity:0.8;margin-bottom:20px;">
          ⏳ Prochain événement — WeLoveYa Festival
        </p>
        <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
          ${[['Jours', d], ['Heures', fmt(h)], ['Minutes', fmt(m)], ['Secondes', fmt(s)]].map(([label, val]) => `
            <div style="text-align:center;min-width:70px;">
              <div style="font-size:2.8rem;font-weight:800;line-height:1;text-shadow:0 4px 20px rgba(0,0,0,0.3);">${val}</div>
              <div style="font-size:0.7rem;letter-spacing:0.15em;text-transform:uppercase;opacity:0.75;margin-top:6px;">${label}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  /* ── Boutons FedaPay / Momo ──────────────────────────────────── */
  document.getElementById('fedapay-submit')?.addEventListener('click', processFedaPayPayment);
  document.getElementById('momo-submit')?.addEventListener('click', processMomoPayment);

  /* ── ScrollReveal ────────────────────────────────────────────── */
  if (typeof ScrollReveal !== 'undefined') {
    ScrollReveal().reveal('.event-card, .event-card-full', {
      distance: '30px',
      origin: 'bottom',
      interval: 80,
      duration: 600,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      reset: false
    });
    ScrollReveal().reveal('.stat-card, .benefit-card, .partner-card', {
      distance: '20px',
      origin: 'bottom',
      interval: 100,
      duration: 500,
      reset: false
    });
  }
});