/* ================================================================
   YourPass — supabase-auth.js
   Gestion complète de l'authentification via Supabase
   Méthode : Email + Mot de passe
================================================================ */

'use strict';

/* ── Config ─────────────────────────────────────────────────── */
const SUPABASE_URL = 'https://towojafvhdywdowrpkrn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_u2DHBeNqtcd7QVdTTwU_xA_ujiqdFit';

/* ── Initialisation du client Supabase ───────────────────────── */
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ════════════════════════════════════════════════════════════════
   UTILITAIRES
════════════════════════════════════════════════════════════════ */

/** Affiche un message d'erreur ou de succès sous un formulaire */
function showFormMessage(containerId, message, type = 'error') {
  let el = document.getElementById(containerId + '-msg');
  if (!el) {
    el = document.createElement('p');
    el.id = containerId + '-msg';
    el.style.cssText = `
      text-align: center;
      font-size: 13px;
      margin-top: 10px;
      padding: 8px 14px;
      border-radius: 20px;
      font-weight: 500;
      transition: all 0.3s ease;
    `;
    const container = document.getElementById(containerId);
    container?.appendChild(el);
  }

  el.textContent = message;
  el.style.background = type === 'error'
    ? 'rgba(231, 76, 60, 0.25)'
    : 'rgba(46, 204, 113, 0.25)';
  el.style.color  = type === 'error' ? '#ff6b6b' : '#2ecc71';
  el.style.border = `1px solid ${type === 'error' ? 'rgba(231,76,60,0.4)' : 'rgba(46,204,113,0.4)'}`;
  el.style.display = 'block';

  // Efface après 5 secondes
  setTimeout(() => { if (el) el.style.display = 'none'; }, 5000);
}

/** Active/désactive le bouton pendant le chargement */
function setSubmitLoading(btn, loading, defaultText) {
  if (!btn) return;
  btn.disabled   = loading;
  btn.value      = loading ? '⏳ Chargement...' : defaultText;
  btn.style.opacity = loading ? '0.7' : '1';
}

/** Traduit les erreurs Supabase en français */
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
  };
  for (const [key, val] of Object.entries(map)) {
    if (msg.includes(key)) return val;
  }
  return msg || 'Une erreur est survenue. Réessaie.';
}

/* ════════════════════════════════════════════════════════════════
   CONNEXION (SIGN IN)
════════════════════════════════════════════════════════════════ */
async function handleLogin(e) {
  if (e) e.preventDefault();

  const emailInput = document.querySelector('#login .input-field[type="email"], #login .email-input');
  const passInput  = document.querySelector('#login .input-field[type="password"]');
  const submitBtn  = document.querySelector('#login .submit');

  // Récupère l'email ou username (on cherche dans les deux champs texte)
  const allTextInputs = document.querySelectorAll('#login .input-field');
  let email = '', password = '';

  allTextInputs.forEach(input => {
    if (input.type === 'password') password = input.value.trim();
    else email = input.value.trim();
  });

  if (!email || !password) {
    showFormMessage('login', 'Remplis tous les champs.', 'error');
    return;
  }

  setSubmitLoading(submitBtn, true, 'Sign In');

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  setSubmitLoading(submitBtn, false, 'Sign In');

  if (error) {
    showFormMessage('login', translateError(error), 'error');
    return;
  }

  // Sauvegarde locale légère pour affichage rapide
  if (data.user) {
    const profile = {
      id:    data.user.id,
      email: data.user.email,
      name:  data.user.user_metadata?.firstname
           ? `${data.user.user_metadata.firstname} ${data.user.user_metadata.lastname || ''}`.trim()
           : data.user.email.split('@')[0]
    };
    localStorage.setItem('yourpass_user', JSON.stringify(profile));
  }

  showFormMessage('login', '✅ Connexion réussie ! Redirection...', 'success');
  setTimeout(() => { window.location.href = 'index.html'; }, 900);
}

/* ════════════════════════════════════════════════════════════════
   INSCRIPTION (SIGN UP)
════════════════════════════════════════════════════════════════ */
async function handleRegister(e) {
  if (e) e.preventDefault();

  // Récupère tous les champs du register
  const inputs    = document.querySelectorAll('#register .input-field');
  const submitBtn = document.querySelector('#register .submit');

  let firstname = '', lastname = '', email = '', password = '';

  inputs.forEach(input => {
    const ph = input.placeholder.toLowerCase();
    if (input.type === 'password') {
      password = input.value.trim();
    } else if (ph.includes('firstname') || ph.includes('prénom') || ph.includes('prenom')) {
      firstname = input.value.trim();
    } else if (ph.includes('lastname') || ph.includes('nom')) {
      lastname = input.value.trim();
    } else if (ph.includes('email')) {
      email = input.value.trim();
    }
  });

  // Validation basique
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

  // Vérifie l'acceptation des conditions si la checkbox existe
  const termsCheck = document.getElementById('register-check');
  if (termsCheck && !termsCheck.checked) {
    showFormMessage('register', 'Accepte les conditions d\'utilisation pour continuer.', 'error');
    return;
  }

  setSubmitLoading(submitBtn, true, 'Register');

  // Création du compte Supabase Auth
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { firstname, lastname }
    }
  });

  if (error) {
    setSubmitLoading(submitBtn, false, 'Register');
    showFormMessage('register', translateError(error), 'error');
    return;
  }

  // Insertion du profil dans la table `profiles`
  if (data.user) {
    await sb
      .from('profiles')
      .insert({
        id:        data.user.id,
        firstname,
        lastname,
        email,
        created_at: new Date().toISOString()
      })
      .then(({ error: profileError }) => {
        if (profileError) console.warn('[YourPass] Profil non inséré:', profileError.message);
      });
  }

  setSubmitLoading(submitBtn, false, 'Register');

  // Supabase envoie un email de confirmation (selon config)
  const needsConfirm = !data.session;
  if (needsConfirm) {
    showFormMessage(
      'register',
      '✅ Compte créé ! Vérifie ton email pour confirmer l\'inscription.',
      'success'
    );
  } else {
    // Connexion automatique si email confirm désactivé
    const profile = {
      id:    data.user.id,
      email: data.user.email,
      name:  `${firstname} ${lastname}`.trim()
    };
    localStorage.setItem('yourpass_user', JSON.stringify(profile));
    showFormMessage('register', '✅ Compte créé ! Redirection...', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 900);
  }
}

/* ════════════════════════════════════════════════════════════════
   MOT DE PASSE OUBLIÉ
════════════════════════════════════════════════════════════════ */
async function handleForgotPassword() {
  const emailInput = document.querySelector('#login .input-field:not([type="password"])');
  const email      = emailInput?.value.trim();

  if (!email) {
    showFormMessage('login', 'Entre ton email puis clique sur "Mot de passe oublié".', 'error');
    emailInput?.focus();
    return;
  }

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/connexion.html`
  });

  if (error) {
    showFormMessage('login', translateError(error), 'error');
  } else {
    showFormMessage('login', `📧 Email de réinitialisation envoyé à ${email}`, 'success');
  }
}

/* ════════════════════════════════════════════════════════════════
   DÉCONNEXION
════════════════════════════════════════════════════════════════ */
async function logout() {
  await sb.auth.signOut();
  localStorage.removeItem('yourpass_user');
  localStorage.removeItem('yourpass_ticket');
  window.location.href = 'connexion.html';
}
window.logout = logout;

/* ════════════════════════════════════════════════════════════════
   VÉRIFICATION SESSION ACTIVE
   Redirige vers index.html si déjà connecté
════════════════════════════════════════════════════════════════ */
async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (data?.session?.user) {
    // Déjà connecté → retour accueil
    window.location.href = 'index.html';
  }
}

/* ════════════════════════════════════════════════════════════════
   RÉCUPÈRE L'UTILISATEUR CONNECTÉ (pour les autres pages)
   Usage : const user = await getUser();
════════════════════════════════════════════════════════════════ */
async function getUser() {
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}
window.getUser = getUser;

/* ════════════════════════════════════════════════════════════════
   BRANCHEMENT SUR LES FORMULAIRES
════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si déjà connecté (évite d'afficher la page inutilement)
  checkSession();

  /* ── Login submit ─────────────────────────────────────────── */
  const loginSubmit = document.querySelector('#login .submit');
  if (loginSubmit) {
    loginSubmit.addEventListener('click', handleLogin);
    // Enter key dans les inputs du login
    document.querySelectorAll('#login .input-field').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(e); });
    });
  }

  /* ── Register submit ──────────────────────────────────────── */
  const registerSubmit = document.querySelector('#register .submit');
  if (registerSubmit) {
    registerSubmit.addEventListener('click', handleRegister);
    document.querySelectorAll('#register .input-field').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(e); });
    });
  }

  /* ── Forgot password link ─────────────────────────────────── */
  const forgotLink = document.querySelector('.two a[href="#"]');
  if (forgotLink) {
    forgotLink.addEventListener('click', e => {
      e.preventDefault();
      handleForgotPassword();
    });
  }
});
