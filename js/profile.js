/* ================================================================
   YourPass — js/profile.js
   v4 — Déconnexion corrigée + client Supabase partagé
================================================================ */
'use strict';

(function YourPassProfile() {

  const SB_URL = 'https://towojafvhdywdowrpkrn.supabase.co';
  const SB_KEY = 'sb_publishable_u2DHBeNqtcd7QVdTTwU_xA_ujiqdFit';

  /* ── Client Supabase partagé globalement ────────────────────
     On stocke sur window._ypSb pour que connexion.html et
     profile.js utilisent la MÊME instance → signOut() fonctionne.
  ─────────────────────────────────────────────────────────── */
  if (!window._ypSb) {
    window._ypSb = window.supabase.createClient(SB_URL, SB_KEY);
  }
  const sb = window._ypSb;

  /* ── Helpers ────────────────────────────────────────────── */
  function getLocalUser() {
    try { return JSON.parse(localStorage.getItem('yourpass_user') || 'null'); }
    catch { return null; }
  }

  function getInitials(name) {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0] || '?').slice(0, 2).toUpperCase();
  }

  function getAvatarColor(seed) {
    const palette = ['#4988C4','#e85d04','#7209b7','#2b9348','#d62828','#b5179e','#3a86ff','#f77f00'];
    let hash = 0;
    for (let i = 0; i < (seed || '').length; i++)
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  function hideConnexionLink() {
    document.querySelectorAll('a.nav-link, a.link').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.includes('connexion') || href.includes('dashboard')) {
        const li = link.closest('li');
        if (li) li.style.display = 'none';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     DÉCONNEXION ROBUSTE
     1. signOut() sur le client partagé (scope:'local')
     2. Nettoyage de TOUTES les clés Supabase dans localStorage
     3. Nettoyage sessionStorage
     4. Redirection vers connexion.html
  ══════════════════════════════════════════════════════════ */
  async function performLogout() {
    try {
      await sb.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('[YourPass] signOut error (ignored):', err?.message);
    }

    /* Supprimer toutes les clés YourPass + Supabase */
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith('yourpass_') ||
        k.startsWith('sb-') ||
        k.includes('supabase') ||
        k === 'supabase.auth.token'
      )) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));

    try { sessionStorage.clear(); } catch {}

    window.location.href = 'connexion.html';
  }

  /* ══════════════════════════════════════════════════════════
     RENDU DU WIDGET PROFIL
  ══════════════════════════════════════════════════════════ */
  function renderProfileWidget(user) {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    hideConnexionLink();
    document.getElementById('yp-profile-widget')?.remove();

    const initials = getInitials(user.name || user.email);
    const color    = getAvatarColor(user.id || user.email || '');
    const fullName = user.name || user.email || 'Utilisateur';
    const email    = user.email || '';

    const widget = document.createElement('div');
    widget.id = 'yp-profile-widget';

    widget.innerHTML = `
      <style>
        #yp-profile-widget{position:relative;display:inline-block;}
        .yp-avatar-btn{background:none;border:none;cursor:pointer;padding:0;position:relative;display:flex;align-items:center;}
        .yp-avatar-circle{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Poppins',sans-serif;font-weight:700;color:#fff;font-size:14px;border:2.5px solid rgba(255,255,255,0.3);transition:transform 0.2s;}
        .yp-avatar-btn:hover .yp-avatar-circle{transform:scale(1.08);}
        .yp-online-dot{width:9px;height:9px;background:#2ecc71;border-radius:50%;border:1.5px solid #fff;position:absolute;bottom:1px;right:1px;}
        .yp-drop{position:absolute;top:calc(100% + 10px);right:0;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.18);width:230px;padding:8px 0;opacity:0;pointer-events:none;transform:translateY(-8px);transition:opacity 0.2s,transform 0.2s;z-index:9999;}
        .yp-drop.yp-open{opacity:1;pointer-events:auto;transform:translateY(0);}
        .yp-drop-head{padding:14px 16px;display:flex;align-items:center;gap:11px;}
        .yp-drop-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;font-family:'Poppins',sans-serif;flex-shrink:0;}
        .yp-drop-info{min-width:0;}
        .yp-drop-name{display:block;font-weight:700;font-size:13.5px;color:#1e293b;font-family:'Poppins',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .yp-drop-email{display:block;font-size:11px;color:#94a3b8;font-family:'Poppins',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .yp-sep{height:1px;background:#f1f5f9;margin:4px 0;}
        .yp-item{display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:13.5px;color:#334155;font-family:'Poppins',sans-serif;text-decoration:none;cursor:pointer;background:none;border:none;width:100%;text-align:left;transition:background 0.15s;}
        .yp-item:hover{background:#f8fafc;color:#2d6cff;}
        .yp-logout{color:#e74c3c!important;}
        .yp-logout:hover{background:#fff5f5!important;color:#c0392b!important;}
      </style>

      <button class="yp-avatar-btn" id="yp-avatar-btn" aria-label="Mon profil" aria-expanded="false">
        <div class="yp-avatar-circle" style="background:${color};">
          <span>${initials}</span>
        </div>
        <span class="yp-online-dot"></span>
      </button>

      <div class="yp-drop" id="yp-drop" role="menu" aria-hidden="true">
        <div class="yp-drop-head">
          <div class="yp-drop-avatar" style="background:${color};">${initials}</div>
          <div class="yp-drop-info">
            <strong class="yp-drop-name">${fullName}</strong>
            <span class="yp-drop-email">${email}</span>
          </div>
        </div>

        <div class="yp-sep"></div>

        <a href="success.html" class="yp-item" role="menuitem">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></svg>
          Mes billets
        </a>
        <a href="events.html" class="yp-item" role="menuitem">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Événements
        </a>
        <a href="dashboard.html" class="yp-item" role="menuitem">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Mon espace
        </a>

        <div class="yp-sep"></div>

        <button class="yp-item yp-logout" id="yp-logout-btn" role="menuitem">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span id="yp-logout-label">Déconnexion</span>
        </button>
      </div>
    `;

    const themeBtn = navActions.querySelector('.theme-toggle');
    navActions.insertBefore(widget, themeBtn || null);

    /* Dropdown toggle */
    const btn  = document.getElementById('yp-avatar-btn');
    const drop = document.getElementById('yp-drop');

    const close = () => { drop.classList.remove('yp-open'); btn.setAttribute('aria-expanded','false'); drop.setAttribute('aria-hidden','true'); };
    const open  = () => { drop.classList.add('yp-open');    btn.setAttribute('aria-expanded','true');  drop.setAttribute('aria-hidden','false'); };

    btn.addEventListener('click', e => { e.stopPropagation(); drop.classList.contains('yp-open') ? close() : open(); });
    document.addEventListener('click', close);
    drop.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    /* Bouton déconnexion */
    document.getElementById('yp-logout-btn').addEventListener('click', async () => {
      const label = document.getElementById('yp-logout-label');
      if (label) label.textContent = '⏳ Déconnexion…';
      document.getElementById('yp-logout-btn').disabled = true;
      await performLogout();
    });
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  async function init() {
    /* Affichage rapide depuis localStorage */
    const local = getLocalUser();
    if (local) renderProfileWidget(local);

    /* Vérification Supabase (source de vérité) */
    try {
      const { data } = await sb.auth.getUser();
      if (data?.user) {
        const u    = data.user;
        const meta = u.user_metadata || {};
        const name = meta.firstname
          ? `${meta.firstname} ${meta.lastname || ''}`.trim()
          : u.email.split('@')[0];
        const user = { id: u.id, email: u.email, name };
        localStorage.setItem('yourpass_user', JSON.stringify(user));
        if (!local || local.name !== user.name || local.email !== user.email) {
          renderProfileWidget(user);
        }
      } else {
        /* Pas de session valide → nettoyer */
        if (local) {
          localStorage.removeItem('yourpass_user');
          document.getElementById('yp-profile-widget')?.remove();
        }
      }
    } catch (err) {
      console.warn('[YourPass] profile init error:', err?.message);
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();