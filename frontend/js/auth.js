/**
 * Auth state manager — handles JWT state client-side.
 * The actual tokens live in httpOnly cookies managed by the backend.
 * We only cache the user profile in memory/sessionStorage.
 */

const Auth = (() => {
  let _user = null;

  const SESSION_KEY = 'opseazy_user';

  function getUser() {
    if (_user) return _user;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) _user = JSON.parse(raw);
    } catch {}
    return _user;
  }

  function setUser(user) {
    _user = user;
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
    updateNavUI();
  }

  function isLoggedIn() { return !!getUser(); }
  function isAdmin() { return getUser()?.role === 'admin'; }

  async function tryRestoreSession() {
    try {
      const data = await window.api.me();
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }

  async function logout() {
    try { await window.api.logout(); } catch {}
    setUser(null);
    window.location.href = '/';
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = `/pages/login.html?redirect=${encodeURIComponent(window.location.href)}`;
      return false;
    }
    return true;
  }

  function updateNavUI() {
    const user = getUser();
    const authSection = document.getElementById('nav-auth');
    const userSection = document.getElementById('nav-user');
    const userNameEl  = document.getElementById('nav-username');

    if (!authSection && !userSection) return;

    if (user) {
      if (authSection) authSection.classList.add('hidden');
      if (userSection) userSection.classList.remove('hidden');
      if (userNameEl)  userNameEl.textContent = user.name.split(' ')[0];
      const avatarEls = document.querySelectorAll('.navbar-avatar');
      avatarEls.forEach(el => { el.textContent = user.name[0].toUpperCase(); });
    } else {
      if (authSection) authSection.classList.remove('hidden');
      if (userSection) userSection.classList.add('hidden');
    }
  }

  return { getUser, setUser, isLoggedIn, isAdmin, tryRestoreSession, logout, requireAuth, updateNavUI };
})();

window.Auth = Auth;
