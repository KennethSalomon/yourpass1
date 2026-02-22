/* ================================================================
   YourPass — supabase-auth.js  (version corrigée — sans boucle 404)
   
   CORRECTION PRINCIPALE :
   - checkSession() ne redirige plus automatiquement sur toutes les pages
   - Seule connexion.html effectue la vérification de session active
================================================================ */

'use strict';

const SUPABASE_URL = 'https://towojafvhdywdowrpkrn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_u2DHBeNqtcd7QVdTTwU_xA_ujiqdFit';

/* ── Init client ─────────────────────────────────────────────── */
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ════════════════════════════════════════════════════════════════
   UTILITAIRES
════════════════════════════════════════════════════════════════ */

function showFormMessage(containerId, message, type = 'error') {
  let el = document.getElementById(containerId + '-msg');
  if (!el) {
    el = document.createElement('p');
    el.id = containerId + '-msg';
    el.style.cssText = `
      text-align:center; font-size:13px; margin-top:10px;
      padding:8px 14px; border-radius:20px; font-weight:500;
      transition:all 0.3s ease;
    `;
    document.getElementById(containerId)?.appendChild(el);
  }
  el.textContent  = message;
  el.style.background = type === 'error' ? 'rgba(231,76,60,0.25)' : 'rgba(46,204,113,0.25)';
  el.style.color      = type === 'error' ? '#ff6b6b' : '#2ecc71';
  el.style.border     = `1px solid ${type === 'error' ? 'rgba(231,76,60,0.4)' : 'rgba(46,204,113,0.4)'}`;
  el.style.display    = 'block';
  setTimeout(() => { if (el) el.style.display = 'none'; }, 5500);
}

function setSubmitLoading(btn, loading, defaultText) {
  if (!btn) return;
  btn.disabled      = loading;
  btn.value         = loading ? '⏳ Chargement…' : defaultText;
  btn.style.opacity = loading ? '0.7' : '1';
}

function translateError(error) {
  const msg = error?.message || '';
  const map = {
    'Invalid login credentials':        'Email ou mot de passe incorrect.',
    'Email not confirmed':              'Confirme ton email avant de te connecter.',
    'User already registered':          'Un compte existe déjà avec cet email.',
    'Password should be at least':      'Le mot de passe doit contenir au moins 6 caractères.',
    'Unable to validate email address': 'Adresse email invalide.',
    'signup is disabled':               'Les inscriptions sont temporairement désactivées.',
    'Email rate limit exceeded':        'Trop de tentatives. Réessaie dans quelques minutes.',
    'rate limit':                       'Trop de tentatives. Réessaie dans 1 minute.',
  };
  for (const [key, val] of Object.entries(map)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return msg || 'Une erreur est survenue. Réessaie.';
}

/* ════════════════════════════════════════════════════════════════
   CONNEXION
════════════════════════════════════════════════════════════════ */
async function handleLogin(e) {
  if (e) e.preventDefault();

  const allInputs = document.querySelectorAll('#login .input-field');
  let email = '', password = '';
  allInputs.forEach(input => {
    if (input.type === 'password') password = input.value.trim();
    else email = input.value.trim();
  });

  if (!email || !password) {
    showFormMessage('login', 'Remplis ton email et ton mot de passe.', 'error');
    return;
  }

  const submitBtn = document.querySelector('#login .submit');
  setSubmitLoading(submitBtn, true, 'Sign In');

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  setSubmitLoading(submitBtn, false, 'Sign In');

  if (error) {
    showFormMessage('login', translateError(error), 'error');
    return;
  }

  if (data.user) {
    const u = data.user;
    localStorage.setItem('yourpass_user', JSON.stringify({
      id:    u.id,
      email: u.email,
      name:  u.user_metadata?.firstname
             ? `${u.user_metadata.firstname} ${u.user_metadata.lastname || ''}`.trim()
             : u.email.split('@')[0]
    }));
  }

  showFormMessage('login', '✅ Connexion réussie ! Redirection…', 'success');
  setTimeout(() => { window.location.href = 'index.html'; }, 800);
}

/* ════════════════════════════════════════════════════════════════
   INSCRIPTION
════════════════════════════════════════════════════════════════ */
async function handleRegister(e) {
  if (e) e.preventDefault();

  const inputs    = document.querySelectorAll('#register .input-field');
  const submitBtn = document.querySelector('#register .submit');
  let firstname = '', lastname = '', email = '', password = '';

  inputs.forEach(input => {
    const ph = input.placeholder.toLowerCase();
    if (input.type === 'password')                          password  = input.value.trim();
    else if (ph.includes('firstname') || ph.includes('prénom')) firstname = input.value.trim();
    else if (ph.includes('lastname')  || ph.includes('nom'))    lastname  = input.value.trim();
    else if (ph.includes('email'))                          email     = input.value.trim();
  });

  if (!firstname || !email || !password) {
    showFormMessage('register', 'Remplis tous les champs obligatoires.', 'error');
    return;
  }
  if (password.length < 6) {
    showFormMessage('register', 'Le mot de passe doit contenir au moins 6 caractères.', 'error');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormMessage('register', 'Adresse email invalide.', 'error');
    return;
  }
  const termsCheck = document.getElementById('register-check');
  if (termsCheck && !termsCheck.checked) {
    showFormMessage('register', "Accepte les conditions d'utilisation pour continuer.", 'error');
    return;
  }

  setSubmitLoading(submitBtn, true, 'Register');

  const { data, error } = await sb.auth.signUp({
    email, password,
    options: {
      data: { firstname, lastname },
      emailRedirectTo: window.location.origin + '/connexion.html'
    }
  });

  if (error) {
    setSubmitLoading(submitBtn, false, 'Register');
    showFormMessage('register', translateError(error), 'error');
    return;
  }

  if (data.user) {
    await sb.from('profiles').insert({
      id: data.user.id, firstname, lastname, email,
      created_at: new Date().toISOString()
    });
  }

  setSubmitLoading(submitBtn, false, 'Register');

  if (!data.session) {
    showFormMessage('register', '✅ Compte créé ! Vérifie ta boîte email pour confirmer.', 'success');
  } else {
    localStorage.setItem('yourpass_user', JSON.stringify({
      id: data.user.id, email, name: `${firstname} ${lastname}`.trim()
    }));
    showFormMessage('register', '✅ Compte créé ! Redirection…', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  }
}

/* ════════════════════════════════════════════════════════════════
   MOT DE PASSE OUBLIÉ
════════════════════════════════════════════════════════════════ */
async function handleForgotPassword() {
  const emailInput = document.querySelector('#login .input-field:not([type="password"])');
  const email      = emailInput?.value.trim();

  if (!email) {
    showFormMessage('login', 'Entre d\'abord ton email, puis clique ici.', 'error');
    emailInput?.focus();
    return;
  }

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/connexion.html'
  });

  if (error) showFormMessage('login', translateError(error), 'error');
  else        showFormMessage('login', `📧 Email envoyé à ${email}`, 'success');
}

/* ════════════════════════════════════════════════════════════════
   DÉCONNEXION
════════════════════════════════════════════════════════════════ */
async function logout() {
  try { await sb.auth.signOut(); } catch {}
  localStorage.removeItem('yourpass_user');
  localStorage.removeItem('yourpass_ticket');
  window.location.href = 'connexion.html';
}
window.logout = logout;

/* ════════════════════════════════════════════════════════════════
   VÉRIFICATION SESSION — UNIQUEMENT SUR connexion.html
   
   CORRECTION : on ne redirige QUE si on est sur connexion.html
   et qu'une session existe déjà. Sur les autres pages, rien.
════════════════════════════════════════════════════════════════ */
async function checkSessionOnLoginPage() {
  // N'agit QUE sur connexion.html
  const isLoginPage = window.location.pathname.includes('connexion');
  if (!isLoginPage) return;

  try {
    const { data } = await sb.auth.getSession();
    if (data?.session?.user) {
      // Déjà connecté → retour accueil
      window.location.replace('index.html');
    } else {
      // Pas de session → cacher le loader si présent
      const loader = document.getElementById('auth-loader');
      if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 500);
      }
    }
  } catch {
    // En cas d'erreur réseau, on affiche quand même le formulaire
    const loader = document.getElementById('auth-loader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 500);
    }
  }
}

/* ════════════════════════════════════════════════════════════════
   UTILITAIRE PUBLIC — récupère l'utilisateur connecté
════════════════════════════════════════════════════════════════ */
async function getUser() {
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}
window.getUser = getUser;

/* ════════════════════════════════════════════════════════════════
   BRANCHEMENT SUR LES FORMULAIRES (connexion.html uniquement)
════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Vérification session (redirection si déjà connecté, sur connexion.html seulement)
  checkSessionOnLoginPage();

  /* ── Login ─────────────────────────────────────────────────── */
  const loginSubmit = document.querySelector('#login .submit');
  if (loginSubmit) {
    loginSubmit.addEventListener('click', handleLogin);
    document.querySelectorAll('#login .input-field').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(e); });
    });
  }

  /* ── Register ──────────────────────────────────────────────── */
  const registerSubmit = document.querySelector('#register .submit');
  if (registerSubmit) {
    registerSubmit.addEventListener('click', handleRegister);
    document.querySelectorAll('#register .input-field').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(e); });
    });
  }

  /* ── Forgot password ───────────────────────────────────────── */
  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', e => {
      e.preventDefault();
      handleForgotPassword();
    });
  }
});