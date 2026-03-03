/* ═══════════════════════════════════════════════════════════════════════
   js/main.js — YourPass v4 ✅ CORRIGÉ
   Corrections :
   ✅ Bouton paiement = #momo-pay-btn (pas #momo-submit)
   ✅ ScrollReveal dynamique — window.revealElements() appelable après injection HTML
   ✅ Menu mobile : gère .open ET .responsive + animation burger
   ✅ goToPayment() centralisé ici (plus besoin dans chaque page)
   ✅ subscribeNewsletter() centralisé avec appel API réel
   ✅ Slider géré dans main.js avec initSlider()
   ✅ Sound toggle : gère #toggleSound ET #sound-btn
   ✅ Countdown WeLoveYa festival
═══════════════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   UTILITAIRES PAIEMENT
══════════════════════════════════════════════════════════════ */

function togglePaymentSection(name) {
  const section = document.getElementById(`${name}-section`);
  if (!section) return;
  const isActive = section.classList.contains('active');
  document.querySelectorAll('.payment-content').forEach(el => el.classList.remove('active'));
  if (!isActive) section.classList.add('active');
}
window.togglePaymentSection = togglePaymentSection;

function selectPaymentOption(btn, provider) {
  const parent = btn.closest('.payment-options');
  if (!parent) return;
  parent.querySelectorAll('.payment-option').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._selectedProvider = provider;
}
window.selectPaymentOption = selectPaymentOption;

/* ══════════════════════════════════════════════════════════════
   VALIDATION TÉLÉPHONE BÉNINOIS
══════════════════════════════════════════════════════════════ */
function validatePhone(phone) {
  const cleaned = phone.replace(/[\s\-\.]/g, '');
  return /^(\+?229)?[0-9]{8}$/.test(cleaned);
}

function normalizePhone(phone) {
  const cleaned = phone.replace(/[\s\-\.\+]/g, '');
  if (cleaned.startsWith('229') && cleaned.length === 11) return cleaned;
  if (cleaned.length === 8) return `229${cleaned}`;
  return cleaned;
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION TOAST
══════════════════════════════════════════════════════════════ */
function showNotification(message, type = 'success') {
  document.querySelectorAll('.yp-toast').forEach(el => el.remove());

  const colors = {
    success: { border: '#10b981', bg: '#ecfdf5', text: '#065f46', icon: '✅' },
    error:   { border: '#ef4444', bg: '#fef2f2', text: '#7f1d1d', icon: '❌' },
    info:    { border: '#3b82f6', bg: '#eff6ff', text: '#1e3a5f', icon: 'ℹ️' },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.className = 'yp-toast';
  toast.innerHTML = `<span style="font-size:18px;flex-shrink:0;">${c.icon}</span><span>${message}</span>`;

  Object.assign(toast.style, {
    position:     'fixed',
    bottom:       '24px',
    right:        '24px',
    background:   c.bg,
    border:       `1px solid ${c.border}`,
    borderLeft:   `4px solid ${c.border}`,
    borderRadius: '14px',
    padding:      '14px 22px',
    boxShadow:    '0 10px 40px rgba(0,0,0,0.12)',
    display:      'flex',
    alignItems:   'center',
    gap:          '12px',
    zIndex:       '99999',
    maxWidth:     '380px',
    fontSize:     '14px',
    fontWeight:   '500',
    color:        c.text,
    fontFamily:   "'Inter', 'Poppins', sans-serif",
    transform:    'translateX(120%)',
    transition:   'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  }));

  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
window.showNotification = showNotification;

/* ══════════════════════════════════════════════════════════════
   NAVIGATION VERS PAIEMENT (centralisé)
══════════════════════════════════════════════════════════════ */
function goToPayment(eventId, eventName, price, ticketType, quantity) {
  const eventData = {
    id:         eventId,
    name:       eventName,
    price:      price,
    ticketType: ticketType || 'standard',
    quantity:   quantity   || 1,
    date:       null,
    venue:      null,
    location:   null,
  };

  // Enrichir depuis YOURPASS_EVENTS si disponible
  if (window.YOURPASS_EVENTS) {
    const ev = window.YOURPASS_EVENTS.find(e => e.id === parseInt(eventId));
    if (ev) {
      eventData.date     = ev.date;
      eventData.venue    = ev.venue;
      eventData.location = ev.location;
      if (ticketType === 'vip') eventData.price = ev.vipPrice;
    }
  }

  localStorage.setItem('selectedEvent', JSON.stringify(eventData));
  window.location.href = 'paiement.html';
}
window.goToPayment = goToPayment;

/* ══════════════════════════════════════════════════════════════
   NEWSLETTER
══════════════════════════════════════════════════════════════ */
async function subscribeNewsletter(event) {
  if (event) event.preventDefault();
  const input = document.querySelector('.newsletter-form input[type="email"]');
  if (!input) return;
  const email = input.value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showNotification('Veuillez entrer une adresse email valide.', 'error');
    return;
  }

  const btn = document.querySelector('.newsletter-form button');
  const originalText = btn?.textContent || "S'inscrire";
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }

  try {
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.success) {
      showNotification('🎉 Inscription réussie ! Vous recevrez nos actualités.', 'success');
      input.value = '';
    } else {
      showNotification(data.error || "Erreur lors de l'inscription.", 'error');
    }
  } catch {
    showNotification('Erreur réseau. Veuillez réessayer.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}
window.subscribeNewsletter = subscribeNewsletter;

/* ══════════════════════════════════════════════════════════════
   PAIEMENT MOBILE MONEY — FedaPay
══════════════════════════════════════════════════════════════ */
async function processMomoPayment() {
  const phoneEl = document.getElementById('phone');
  const nameEl  = document.getElementById('momo-name');
  const emailEl = document.getElementById('momo-email');
  const btn     = document.getElementById('momo-pay-btn'); // ✅ ID correct

  const phone = phoneEl?.value?.trim() || '';
  const name  = nameEl?.value?.trim()  || '';
  const email = emailEl?.value?.trim() || '';

  let eventData = {};
  try { eventData = JSON.parse(localStorage.getItem('selectedEvent') || '{}'); } catch {}

  const price    = parseInt(eventData.price)    || 5000;
  const quantity = parseInt(eventData.quantity) || 1;
  const fees     = Math.round(price * quantity * 0.05);
  const total    = price * quantity + fees;
  const eventName = eventData.name || 'Billet YourPass';

  // ── Validation ─────────────────────────────────────────────
  if (!phone || !validatePhone(phone)) {
    showNotification('Numéro invalide. Format : 8 chiffres (ex : 97123456)', 'error');
    phoneEl?.focus();
    return;
  }
  if (!name || name.length < 2) {
    showNotification('Veuillez entrer votre prénom et nom complet.', 'error');
    nameEl?.focus();
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showNotification('Adresse email invalide.', 'error');
    emailEl?.focus();
    return;
  }

  const nameParts = name.trim().split(/\s+/);
  const firstname = nameParts[0] || 'Client';
  const lastname  = nameParts.slice(1).join(' ') || 'YourPass';
  const customerEmail = email || `${normalizePhone(phone)}@yourpass.bj`;

  // ── Feedback UI (spinner) ───────────────────────────────────
  const originalHTML = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    if (!document.getElementById('_yp_spin_style')) {
      const s = document.createElement('style');
      s.id = '_yp_spin_style';
      s.textContent = '@keyframes _yp_spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }
    btn.innerHTML = `
      <span style="
        display:inline-block;width:18px;height:18px;
        border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;
        border-radius:50%;animation:_yp_spin .7s linear infinite;
        vertical-align:middle;margin-right:8px;
      "></span>Initialisation…`;
  }

  // Sauvegarder pour success.html
  localStorage.setItem('yourpass_pending_order', JSON.stringify({
    email: customerEmail, name, eventName,
    amount: total, eventId: eventData.id || '1', timestamp: Date.now(),
  }));

  try {
    const response = await fetch('/api/pay-fedapay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:   total,
        event_id: String(eventData.id || '1'),
        customer: { firstname, lastname, email: customerEmail, phone_number: normalizePhone(phone) },
      }),
    });

    const data = await response.json();

    if (data.success && data.payment_url) {
      showNotification('✅ Redirection vers FedaPay…', 'info');
      setTimeout(() => { window.location.href = data.payment_url; }, 700);
    } else {
      throw new Error(data.error || 'Erreur lors de la création du paiement');
    }

  } catch (error) {
    console.error('[MomoPay]', error.message);
    showNotification('Erreur : ' + error.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML ||
        '<span class="pay-btn-icon">📱</span><span class="pay-btn-text">Payer maintenant</span>';
    }
  }
}
window.processMomoPayment = processMomoPayment;

/* ══════════════════════════════════════════════════════════════
   PAIEMENT FEDAPAY (formulaire alternatif)
══════════════════════════════════════════════════════════════ */
async function processFedaPayPayment() {
  const btn       = document.getElementById('fedapay-submit');
  const email     = document.getElementById('feda-email')?.value?.trim();
  const firstname = document.getElementById('feda-firstname')?.value?.trim();
  const lastname  = document.getElementById('feda-lastname')?.value?.trim();

  let eventData = {};
  try { eventData = JSON.parse(localStorage.getItem('selectedEvent') || '{}'); } catch {}
  const price = parseInt(eventData.price) || 5000;
  const total = price + Math.round(price * 0.05);

  if (!email || !firstname || !lastname) {
    showNotification('Veuillez remplir tous les champs (Prénom, Nom, Email).', 'error');
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Initialisation…'; }

  localStorage.setItem('yourpass_pending_order', JSON.stringify({
    email, name: `${firstname} ${lastname}`,
    eventName: eventData.name || 'Billet YourPass',
    amount: total, eventId: eventData.id || '1', timestamp: Date.now(),
  }));

  try {
    const response = await fetch('/api/pay-fedapay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total, event_id: String(eventData.id || '1'),
        customer: { firstname, lastname, email },
      }),
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

/* ══════════════════════════════════════════════════════════════
   SLIDER (hero sections)
══════════════════════════════════════════════════════════════ */
let _slideIndex    = 0;
let _slideInterval = null;

function changeSlide(direction) {
  const slides = document.querySelectorAll('.slide');
  const dots   = document.querySelectorAll('.dot');
  if (!slides.length) return;
  slides[_slideIndex].classList.remove('active');
  if (dots[_slideIndex]) dots[_slideIndex].classList.remove('active');
  _slideIndex = (_slideIndex + direction + slides.length) % slides.length;
  slides[_slideIndex].classList.add('active');
  if (dots[_slideIndex]) dots[_slideIndex].classList.add('active');
}

function currentSlide(n) {
  const slides = document.querySelectorAll('.slide');
  const dots   = document.querySelectorAll('.dot');
  if (!slides.length) return;
  slides[_slideIndex].classList.remove('active');
  if (dots[_slideIndex]) dots[_slideIndex].classList.remove('active');
  _slideIndex = Math.max(0, Math.min(n - 1, slides.length - 1));
  slides[_slideIndex].classList.add('active');
  if (dots[_slideIndex]) dots[_slideIndex].classList.add('active');
}

function initSlider() {
  const slides = document.querySelectorAll('.slide');
  if (!slides.length) return;
  slides.forEach((s, i) => s.classList.toggle('active', i === 0));
  _slideIndex = 0;
  if (_slideInterval) clearInterval(_slideInterval);
  _slideInterval = setInterval(() => changeSlide(1), 5000);
}

window.changeSlide  = changeSlide;
window.currentSlide = currentSlide;

/* ══════════════════════════════════════════════════════════════
   SCROLL REVEAL — dynamique
   Appeler window.revealElements() après injection de contenu async
══════════════════════════════════════════════════════════════ */
function revealElements() {
  if (typeof ScrollReveal === 'undefined') return;
  ScrollReveal().reveal('.event-card', {
    distance: '30px', origin: 'bottom', interval: 80,
    duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', reset: false,
  });
  ScrollReveal().reveal('.stat-card, .benefit-card, .partner-card', {
    distance: '20px', origin: 'bottom', interval: 100, duration: 500, reset: false,
  });
  ScrollReveal().reveal('.contact-method', {
    distance: '20px', origin: 'left', interval: 80, duration: 500, reset: false,
  });
  ScrollReveal().reveal('.faq-item', {
    distance: '15px', origin: 'bottom', interval: 60, duration: 400, reset: false,
  });
  ScrollReveal().reveal('.ticket-selection, .order-summary', {
    distance: '20px', origin: 'right', duration: 500, reset: false,
  });
}
window.revealElements = revealElements;

/* ══════════════════════════════════════════════════════════════
   COUNTDOWN (index.html)
══════════════════════════════════════════════════════════════ */
function initCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;
  const target = new Date('2026-03-15T18:00:00');
  function update() {
    const diff = target - new Date();
    if (diff <= 0) {
      el.innerHTML = `<p style="font-size:1.4rem;font-weight:700;">🎉 L'événement est en cours !</p>`;
      return;
    }
    const d  = Math.floor(diff / 86400000);
    const h  = Math.floor((diff % 86400000) / 3600000);
    const m  = Math.floor((diff % 3600000) / 60000);
    const s  = Math.floor((diff % 60000) / 1000);
    const p2 = n => String(n).padStart(2, '0');
    el.innerHTML = `
      <p style="font-size:.82rem;letter-spacing:.22em;text-transform:uppercase;opacity:.8;margin-bottom:20px;">
        ⏳ WeLoveYa Festival — 15 Mars 2026
      </p>
      <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
        ${[['Jours', d], ['Heures', p2(h)], ['Minutes', p2(m)], ['Secondes', p2(s)]]
          .map(([lbl, val]) => `
            <div style="text-align:center;min-width:72px;">
              <div style="font-size:2.8rem;font-weight:800;line-height:1;text-shadow:0 4px 20px rgba(0,0,0,.35);">${val}</div>
              <div style="font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;opacity:.75;margin-top:6px;">${lbl}</div>
            </div>
          `).join('')}
      </div>`;
  }
  update();
  setInterval(update, 1000);
}

/* ══════════════════════════════════════════════════════════════
   INITIALISATION PRINCIPALE
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Thème Dark / Light ─────────────────────────────────── */
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = '🌙';
  }
  document.querySelector('.theme-toggle')?.addEventListener('click', function () {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = this.querySelector('.theme-icon');
    if (icon) icon.textContent = isDark ? '🌙' : '☀️';
  });

  /* ── Navbar scroll shadow ───────────────────────────────── */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  /* ── Lien actif ─────────────────────────────────────────── */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .link').forEach(link => {
    const href = (link.getAttribute('href') || '').split('/').pop().split('?')[0];
    link.classList.toggle('active', href === currentPage);
  });

  /* ── Menu mobile (compatible .open ET .responsive) ──────── */
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu    = document.getElementById('navMenu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu.classList.contains('open') || navMenu.classList.contains('responsive');
      navMenu.classList.toggle('open',       !isOpen);
      navMenu.classList.toggle('responsive', !isOpen);
      menuToggle.classList.toggle('active',  !isOpen);

      // Animation burger → croix
      const spans = menuToggle.querySelectorAll('span');
      if (!isOpen) {
        spans[0]?.setAttribute('style', 'transform:rotate(45deg) translate(4px,4px);transition:.25s ease');
        spans[1]?.setAttribute('style', 'opacity:0;transform:scaleX(0);transition:.25s ease');
        spans[2]?.setAttribute('style', 'transform:rotate(-45deg) translate(4px,-4px);transition:.25s ease');
      } else {
        spans.forEach(s => s.removeAttribute('style'));
      }
    });

    navMenu.querySelectorAll('.nav-link, .link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open', 'responsive');
        menuToggle.classList.remove('active');
        menuToggle.querySelectorAll('span').forEach(s => s.removeAttribute('style'));
      });
    });

    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        navMenu.classList.remove('open', 'responsive');
        menuToggle.classList.remove('active');
        menuToggle.querySelectorAll('span').forEach(s => s.removeAttribute('style'));
      }
    });
  }

  /* ── Son vidéo (#toggleSound ou #sound-btn) ─────────────── */
  const soundBtn = document.getElementById('toggleSound') || document.getElementById('sound-btn');
  const bgVideo  = document.getElementById('bg-video');
  if (soundBtn && bgVideo) {
    soundBtn.addEventListener('click', () => {
      bgVideo.muted = !bgVideo.muted;
      soundBtn.textContent = bgVideo.muted ? '🔇' : '🔊';
    });
  }

  /* ── Countdown ──────────────────────────────────────────── */
  initCountdown();

  /* ── Slider ─────────────────────────────────────────────── */
  initSlider();

  /* ── ScrollReveal initial ───────────────────────────────── */
  setTimeout(revealElements, 300);

  /* ── Newsletter ─────────────────────────────────────────── */
  document.querySelector('.newsletter-form')?.addEventListener('submit', subscribeNewsletter);

  /* ── Bouton paiement FedaPay ─────────────────────────────── */
  document.getElementById('fedapay-submit')?.addEventListener('click', processFedaPayPayment);
  // ✅ CORRIGÉ : momo-pay-btn (pas momo-submit qui n'existe pas)
  document.getElementById('momo-pay-btn')?.addEventListener('click', processMomoPayment);

  /* ── FAQ accordéon ───────────────────────────────────────── */
  window.toggleFAQ = function (element) {
    const answer = element.nextElementSibling;
    const icon   = element.querySelector('.faq-icon');
    const isOpen = answer.style.display === 'block';
    document.querySelectorAll('.faq-answer').forEach(a => { a.style.display = 'none'; });
    document.querySelectorAll('.faq-question').forEach(q => q.classList.remove('active'));
    document.querySelectorAll('.faq-icon').forEach(i => { if (i) i.textContent = '+'; });
    if (!isOpen) {
      answer.style.display = 'block';
      if (icon) icon.textContent = '−';
      element.classList.add('active');
    }
  };

}); // fin DOMContentLoaded