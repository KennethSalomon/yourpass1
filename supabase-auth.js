/* ══════════════════════════════════════════════════════════════════
   YourPass — supabase-auth.js  (version CORRIGÉE v2)

   CORRECTIONS :
   ✅ SUPABASE_URL contient l'URL du projet (pas une clé secrète)
   ✅ SUPABASE_ANON_KEY contient la clé publishable
   ✅ Initialisation Supabase une seule fois (singleton)
   ✅ Helpers d'authentification disponibles globalement
══════════════════════════════════════════════════════════════════ */

// ✅ CORRECTION CRITIQUE : Remplacer ces valeurs par vos vraies valeurs Supabase
// SUPABASE_URL  → Format : https://XXXXXXXXXXXXXXXX.supabase.co
// SUPABASE_ANON_KEY → Clé "anon" / "public" du projet Supabase
const SUPABASE_URL      = 'https://towojafvhdywdowrpkrn.supabase.co';  // ← Votre URL Supabase
const SUPABASE_ANON_KEY = 'sb_publishable_u2DHBeNqtcd7QVdTTwU_xA_ujiqdFit'; // ← Votre clé anon

// Singleton : ne pas initialiser deux fois
if (typeof window._supabaseClient === 'undefined') {
  window._supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[YourPass] Supabase initialisé');
}

window.supabaseClient = window._supabaseClient;

/* ── Helpers d'authentification ────────────────────────────── */

async function getSession() {
  const { data: { session }, error } = await window.supabaseClient.auth.getSession();
  if (error) console.error('[Auth] Erreur getSession:', error.message);
  return session;
}

async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

async function requireAuth(redirectTo = 'connexion.html') {
  const user = await getCurrentUser();
  if (!user) {
    console.warn('[Auth] Non connecté, redirection vers', redirectTo);
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

async function signOut() {
  const { error } = await window.supabaseClient.auth.signOut();
  if (error) console.error('[Auth] Erreur signOut:', error.message);
  localStorage.clear();
  window.location.href = 'connexion.html';
}

// Écouter les changements d'authentification
window.supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('[Auth] État:', event, session?.user?.email || 'non connecté');

  if (event === 'SIGNED_OUT') {
    localStorage.removeItem('yourpass_user');
    localStorage.removeItem('yourpass_pending_tx');
    localStorage.removeItem('yourpass_pending');
  }

  if (event === 'SIGNED_IN' && session?.user) {
    const u    = session.user;
    const meta = u.user_metadata || {};
    const name = meta.firstname
      ? `${meta.firstname} ${meta.lastname || ''}`.trim()
      : u.email.split('@')[0];
    localStorage.setItem('yourpass_user', JSON.stringify({
      id: u.id, email: u.email, name
    }));
  }
});

// Export global
window.YourPassAuth = { getSession, getCurrentUser, requireAuth, signOut };