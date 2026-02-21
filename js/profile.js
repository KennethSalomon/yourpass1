/* ================================================================
   YourPass — profile.js  (version Simple & Efficace)
   
   INTÉGRATION sur toutes les pages sauf connexion.html :
   
   Dans <head> :
     <link rel="stylesheet" href="css/profile.css">
   
   Avant </body> :
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="js/profile.js"></script>
================================================================ */

'use strict';

(function YourPassProfile() {

  const SB_URL = 'https://towojafvhdywdowrpkrn.supabase.co';
  const SB_KEY = 'sb_publishable_u2DHBeNqtcd7QVdTTwU_xA_ujiqdFit';

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
    for (let i = 0; i < (seed||'').length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  function renderProfileWidget(user) {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    // Cacher le lien Connexion dans la nav
    document.querySelectorAll('a.nav-link, a.link').forEach(link => {
      if ((link.getAttribute('href') || '').includes('connexion')) {
        const li = link.closest('li');
        if (li) li.style.display = 'none';
      }
    });

    document.getElementById('yp-profile-widget')?.remove();

    const initials = getInitials(user.name || user.email);
    const color    = getAvatarColor(user.id || user.email || '');
    const fullName = user.name || user.email || 'Utilisateur';
    const email    = user.email || '';

    const widget = document.createElement('div');
    widget.id = 'yp-profile-widget';

    widget.innerHTML = `
      <button class="yp-avatar-btn" id="yp-avatar-btn" aria-label="Mon profil" aria-expanded="false">
        <div class="yp-avatar-circle" style="background:${color};">
          <span class="yp-avatar-initials">${initials}</span>
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

        <div class="yp-sep"></div>

        <button class="yp-item yp-logout" id="yp-logout" role="menuitem">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Déconnexion
        </button>

      </div>
    `;

    const themeBtn = navActions.querySelector('.theme-toggle');
    navActions.insertBefore(widget, themeBtn || null);

    const btn  = widget.querySelector('#yp-avatar-btn');
    const drop = widget.querySelector('#yp-drop');

    const close = () => {
      drop.classList.remove('yp-open');
      btn.setAttribute('aria-expanded', 'false');
      drop.setAttribute('aria-hidden', 'true');
    };
    const open = () => {
      drop.classList.add('yp-open');
      btn.setAttribute('aria-expanded', 'true');
      drop.setAttribute('aria-hidden', 'false');
    };

    btn.addEventListener('click', e => {
      e.stopPropagation();
      drop.classList.contains('yp-open') ? close() : open();
    });
    document.addEventListener('click', close);
    drop.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    widget.querySelector('#yp-logout').addEventListener('click', async () => {
      try {
        if (window.supabase) {
          const sb = window.supabase.createClient(SB_URL, SB_KEY);
          await sb.auth.signOut();
        }
      } catch {}
      localStorage.removeItem('yourpass_user');
      localStorage.removeItem('yourpass_ticket');
      window.location.href = 'connexion.html';
    });
  }

  async function init() {
    const local = getLocalUser();
    if (local) renderProfileWidget(local);

    if (!window.supabase) return;
    try {
      const sb = window.supabase.createClient(SB_URL, SB_KEY);
      const { data } = await sb.auth.getUser();
      if (data?.user) {
        const u = data.user;
        const meta = u.user_metadata || {};
        const name = meta.firstname
          ? `${meta.firstname} ${meta.lastname || ''}`.trim()
          : u.email.split('@')[0];
        const user = { id: u.id, email: u.email, name };
        localStorage.setItem('yourpass_user', JSON.stringify(user));
        if (!local || local.name !== user.name) renderProfileWidget(user);
      }
    } catch {}
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();