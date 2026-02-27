/* ================================================================
   YourPass — main.js  v2.4 (CORRIGÉ — PAIEMENT COMPLET)

   CORRECTIONS v2.4 :
   ✅ processMomoPayment() sauvegarde transaction_id AVANT redirection
   ✅ Gestion robuste du nom (prénom/nom séparés)
   ✅ Validation numéro de téléphone améliorée
   ✅ Messages d'erreur utilisateur améliorés
================================================================ */

'use strict';

/* ────────────────────────────────────────────────────────────────
   CONFIGURATION — URL de base de l'API
──────────────────────────────────────────────────────────────── */
const API_BASE = 'https://yourpass1.vercel.app/api';

/* ────────────────────────────────────────────────────────────────
   1. TOAST NOTIFICATIONS
──────────────────────────────────────────────────────────────── */
function showNotification(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    Object.assign(container.style, {
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      zIndex: '9999', pointerEvents: 'none'
    });
    document.body.appendChild(container);
  }

  const icons  = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const colors = {
    info:    { bg: '#1e3a5f', border: '#2d6cff' },
    success: { bg: '#0d3320', border: '#2ecc71' },
    error:   { bg: '#3d0f0f', border: '#e74c3c' },
    warning: { bg: '#3d2b00', border: '#f5c77a' }
  };
  const cfg = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.innerHTML = `<span>${icons[type] || icons.info}</span> ${message}`;
  Object.assign(toast.style, {
    background: cfg.bg, border: `1px solid ${cfg.border}`,
    color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '12px',
    fontSize: '0.9rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    opacity: '0', transform: 'translateX(30px)',
    transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '320px'
  });

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity   = '1';
    toast.style.transform = 'translateX(0)';
  });
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(30px)';
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

// Alias pour compatibilité
window.YourPass = window.YourPass || {};
window.YourPass.showToast = showNotification;

/* ────────────────────────────────────────────────────────────────
   2. THÈME DARK / LIGHT
──────────────────────────────────────────────────────────────── */
function initTheme() {
  const themeIcon = document.querySelector('.theme-icon');
  if (!themeIcon) return;

  const applyTheme = (isDark) => {
    document.body.classList.toggle('dark-mode', isDark);
    themeIcon.textContent = isDark ? '🌙' : '☀️';
  };

  const saved       = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved ? saved === 'dark' : prefersDark);

  themeIcon.closest('button')?.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('dark-mode');
    applyTheme(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

/* ────────────────────────────────────────────────────────────────
   3. NAVIGATION
──────────────────────────────────────────────────────────────── */
function initNavigation() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu    = document.querySelector('.nav-menu');
  const navLinks   = document.querySelectorAll('.nav-link');
  const indicator  = document.querySelector('.nav-indicator');

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    link.classList.toggle('active',
      href === currentPage || (currentPage === '' && href === 'index.html')
    );
  });

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('active');
      menuToggle.classList.toggle('open', isOpen);
    });
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        navMenu.classList.remove('active');
        menuToggle.classList.remove('open');
      }
    });
    navLinks.forEach(link => link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      menuToggle.classList.remove('open');
    }));
  }

  if (indicator && navMenu && navLinks.length > 0) {
    const moveIndicator = (link) => {
      const lr = link.getBoundingClientRect();
      const mr = navMenu.getBoundingClientRect();
      indicator.style.width     = lr.width + 'px';
      indicator.style.transform = `translateX(${lr.left - mr.left}px)`;
    };
    requestAnimationFrame(() => {
      const active = document.querySelector('.nav-link.active') || navLinks[0];
      if (active) moveIndicator(active);
    });
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        moveIndicator(link);
      });
      link.addEventListener('mouseenter', () => moveIndicator(link));
    });
    navMenu.addEventListener('mouseleave', () => {
      const active = document.querySelector('.nav-link.active');
      if (active) moveIndicator(active);
    });
    window.addEventListener('resize', () => {
      const current = document.querySelector('.nav-link.active');
      if (current) moveIndicator(current);
    }, { passive: true });
  }
}

/* ────────────────────────────────────────────────────────────────
   4. SCROLL EFFECTS
──────────────────────────────────────────────────────────────── */
function initScrollEffects() {
  const navbar   = document.querySelector('.navbar');
  const scrollUp = document.querySelector('.scrollup');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (navbar)   navbar.classList.toggle('scrolled', y > 50);
    if (scrollUp) scrollUp.classList.toggle('show-scroll', y >= 350);
  }, { passive: true });
}

/* ────────────────────────────────────────────────────────────────
   5. REVEAL ON SCROLL
──────────────────────────────────────────────────────────────── */
function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  elements.forEach(el => observer.observe(el));
}

/* ────────────────────────────────────────────────────────────────
   6. VIDÉO HERO + COUNTDOWN
──────────────────────────────────────────────────────────────── */
function initHeroVideo() {
  const video     = document.getElementById('bg-video');
  const toggleBtn = document.getElementById('toggleSound') || document.getElementById('sound-btn');
  const countdown = document.getElementById('countdown');

  if (video && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      toggleBtn.textContent = video.muted ? '🔇' : '🔊';
    });
  }

  if (countdown) {
    const eventDate = new Date('2026-04-28T20:00:00').getTime();
    const units = [
      { label: 'j', ms: 86400000 },
      { label: 'h', ms: 3600000  },
      { label: 'm', ms: 60000    },
      { label: 's', ms: 1000     }
    ];
    const update = () => {
      const diff = eventDate - Date.now();
      if (diff <= 0) { countdown.innerHTML = "<span>C'est l'heure ! 🎉</span>"; return; }
      let remaining = diff;
      countdown.innerHTML = units.map(({ label, ms }) => {
        const val  = Math.floor(remaining / ms);
        remaining %= ms;
        return `<span>${String(val).padStart(2,'0')}<small>${label}</small></span>`;
      }).join('');
    };
    update();
    setInterval(update, 1000);
  }
}

/* ────────────────────────────────────────────────────────────────
   7. SLIDER
──────────────────────────────────────────────────────────────── */
function initSlider() {
  const slider = document.querySelector('.slider-track');
  if (!slider) return;
  let current  = 0;
  let timer;
  const slides = slider.querySelectorAll('.slide');
  const dots   = document.querySelectorAll('.slider-dot');
  if (!slides.length) return;

  const goTo = (n) => {
    current = ((n % slides.length) + slides.length) % slides.length;
    slider.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  };
  const reset = () => { clearInterval(timer); timer = setInterval(() => goTo(current + 1), 5000); };
  reset();

  dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); reset(); }));
  document.getElementById('prevBtn')?.addEventListener('click', () => { goTo(current - 1); reset(); });
  document.getElementById('nextBtn')?.addEventListener('click', () => { goTo(current + 1); reset(); });

  if (slider) {
    let startX = 0;
    slider.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) { goTo(current + (dx < 0 ? 1 : -1)); reset(); }
    });
  }
}

/* ────────────────────────────────────────────────────────────────
   8. NEWSLETTER
──────────────────────────────────────────────────────────────── */
function initNewsletter() {
  window.subscribeNewsletter = async (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input[type="email"]');
    const email = input?.value.trim();
    if (!email) return;

    try {
      const res = await fetch(`${API_BASE}/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        showNotification(`Inscription confirmée pour ${email} 🎉`, 'success');
        e.target.reset();
      } else {
        showNotification('Erreur lors de l\'inscription. Réessayez.', 'error');
      }
    } catch {
      showNotification(`Inscription confirmée pour ${email} 🎉`, 'success');
      e.target.reset();
    }
  };
}

/* ────────────────────────────────────────────────────────────────
   9. PAIEMENT
──────────────────────────────────────────────────────────────── */

window.goToPayment = (id, name, price, ticketType, quantity = 1) => {
  try {
    const event = window.getEventById ? window.getEventById(id) : null;
    localStorage.setItem('selectedEvent', JSON.stringify({
      id, name,
      price:      price || (event ? event.price : 0),
      vipPrice:   event ? event.vipPrice : 0,
      ticketType: ticketType || 'standard',
      quantity,
      date:       event ? event.date : new Date().toISOString(),
      venue:      event ? event.venue : '',
      location:   event ? event.location : '',
      time:       event ? event.time : '',
      selectedAt: new Date().toISOString()
    }));
    window.location.href = 'paiement.html';
  } catch {
    showNotification('Impossible de sauvegarder la sélection.', 'error');
  }
};

/* ─── processMomoPayment ─────────────────────────────────────── */
window.processMomoPayment = async () => {
  const phoneInput = document.getElementById('phone');
  const nameInput  = document.getElementById('momo-name');
  const emailInput = document.getElementById('momo-email');
  const payBtn     = document.getElementById('momo-pay-btn') ||
                     document.querySelector('#momo-form .btn-primary');

  // ── Validation numéro ──────────────────────────────────────
  const phone = (phoneInput?.value || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 8) {
    showNotification('Numéro de téléphone invalide (minimum 8 chiffres).', 'error');
    phoneInput?.focus();
    return;
  }

  // ── Validation nom ─────────────────────────────────────────
  const fullName = (nameInput?.value || '').trim();
  if (fullName.length < 2) {
    showNotification('Veuillez entrer votre nom complet.', 'error');
    nameInput?.focus();
    return;
  }

  const parts     = fullName.split(/\s+/);
  const firstname = parts[0] || 'Client';
  const lastname  = parts.slice(1).join(' ') || firstname;

  // ── Récupérer les données de l'événement ───────────────────
  const eventData = (() => {
    try { return JSON.parse(localStorage.getItem('selectedEvent') || '{}'); }
    catch { return {}; }
  })();

  const amount = (typeof window.calculateTotal === 'function')
    ? window.calculateTotal()
    : ((eventData.price || 5000) + Math.round((eventData.price || 5000) * 0.05));

  const eventName = document.getElementById('event-name')?.textContent?.trim()
                 || eventData.name
                 || 'Événement YourPass';

  const emailVal = (emailInput?.value || '').trim();

  // ── UI : état chargement ────────────────────────────────────
  if (payBtn) {
    payBtn.disabled  = true;
    payBtn.innerHTML = '⏳ Traitement en cours…';
  }
  showNotification('Initialisation du paiement…', 'info', 8000);

  try {
    const res = await fetch(`${API_BASE}/pay-fedapay`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        phoneNumber: phone,
        firstname,
        lastname,
        email:     emailVal || undefined,
        eventName
      })
    });

    let result;
    try {
      result = await res.json();
    } catch {
      throw new Error(`Réponse serveur invalide (HTTP ${res.status})`);
    }

    if (!res.ok || !result.success) {
      const msg = result.error
               || (Array.isArray(result.errors) ? result.errors.join(', ') : null)
               || `Erreur serveur HTTP ${res.status}`;
      throw new Error(msg);
    }

    if (!result.url) {
      throw new Error('URL de paiement manquante dans la réponse serveur.');
    }

    // ✅ CORRECTION CRITIQUE : Sauvegarder l'ID de transaction AVANT la redirection
    // success.html en a besoin pour le polling
    const txId = String(result.transaction_id || '');
    if (txId) {
      localStorage.setItem('yourpass_pending_tx', txId);
    }
    localStorage.setItem('yourpass_pending', JSON.stringify({
      transaction_id: txId,
      eventName,
      ticketType:  eventData.ticketType === 'vip' ? 'VIP' : 'Standard',
      totalAmount: amount,
      phone,
      createdAt:   new Date().toISOString()
    }));

    showNotification('Redirection vers FedaPay…', 'success', 2000);
    // ✅ Courte pause pour que le localStorage soit bien écrit
    setTimeout(() => { window.location.href = result.url; }, 700);

  } catch (err) {
    console.error('[YourPass] Erreur paiement:', err);
    let msg = err.message || 'Erreur inconnue.';

    // Messages d'erreur améliorés
    if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('NetworkError') || msg.includes('CORS')) {
      msg = '🔴 Impossible de contacter le serveur de paiement. Vérifiez votre connexion internet.';
    } else if (msg.includes('422') || msg.includes('invalide')) {
      msg = '⚠️ ' + msg;
    }

    showNotification(msg, 'error', 7000);

    if (payBtn) {
      payBtn.disabled  = false;
      payBtn.innerHTML = '<span class="pay-btn-icon">📱</span><span class="pay-btn-text">Payer avec Mobile Money</span>';
    }
  }
};

window.processCardPayment   = () => showNotification('Paiement par carte bientôt disponible.', 'info');
window.processCryptoPayment = () => showNotification('Paiement crypto bientôt disponible.', 'info');

window.togglePaymentSection = (sectionId) => {
  const target   = document.getElementById(sectionId + '-section');
  const isActive = target?.classList.contains('active');
  document.querySelectorAll('.payment-content').forEach(c => c.classList.remove('active'));
  if (target && !isActive) target.classList.add('active');
};

window.selectPaymentOption = (element, option) => {
  element.parentElement
    ?.querySelectorAll('.payment-option')
    .forEach(opt => opt.classList.remove('active'));
  element.classList.add('active');
  const pi = document.getElementById('phone');
  if (pi) pi.placeholder = `Numéro ${option.toUpperCase()} (ex: 229 ${option === 'moov' ? '96' : '97'} XX XX XX)`;
};

/* ────────────────────────────────────────────────────────────────
   10. CONNEXION
──────────────────────────────────────────────────────────────── */
function initConnexion() {
  const loginBtn     = document.getElementById('loginBtn');
  const registerBtn  = document.getElementById('registerBtn');
  const loginForm    = document.getElementById('login');
  const registerForm = document.getElementById('register');
  if (!loginBtn || !loginForm) return;

  const showLogin = () => {
    loginForm.style.cssText    = 'left:4px; opacity:1;';
    registerForm.style.cssText = 'right:-520px; opacity:0;';
    loginBtn.classList.add('white-btn');
    registerBtn?.classList.remove('white-btn');
  };
  const showRegister = () => {
    loginForm.style.cssText    = 'left:-510px; opacity:0;';
    registerForm.style.cssText = 'right:5px; opacity:1;';
    loginBtn.classList.remove('white-btn');
    registerBtn?.classList.add('white-btn');
  };

  loginBtn.addEventListener('click', showLogin);
  registerBtn?.addEventListener('click', showRegister);
  window.login    = showLogin;
  window.register = showRegister;
}

/* ────────────────────────────────────────────────────────────────
   INIT GÉNÉRAL
──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initScrollEffects();
  initReveal();
  initHeroVideo();
  initSlider();
  initNewsletter();
  initConnexion();

  if (typeof ScrollReveal !== 'undefined') {
    const sr = ScrollReveal({ origin: 'bottom', distance: '40px', duration: 700, delay: 80, reset: false });
    sr.reveal('.event-card',     { interval: 100, scale: 0.96 });
    sr.reveal('.partner-card',   { interval: 80,  scale: 0.90 });
    sr.reveal('.benefit-card',   { interval: 100 });
    sr.reveal('.contact-method', { interval: 120, origin: 'left' });
    sr.reveal('.page-header h1, .page-header p', { interval: 80, origin: 'top' });
    sr.reveal('.footer-section', { interval: 100 });
    sr.reveal('.ticket-card',    { interval: 100 });
  }
});

window.myMenuFunction = () => {
  document.getElementById('navMenu')?.classList.toggle('responsive');
};