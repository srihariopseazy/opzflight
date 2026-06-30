/**
 * Navbar component — shared across all pages.
 * Renders the nav HTML and wires up mobile menu + user dropdown.
 */

function renderNavbar(activePage) {
  const navHtml = `
<nav class="navbar" role="navigation" aria-label="Main navigation">
  <div class="container navbar-inner">
    <a href="/" class="navbar-logo" aria-label="OPSEAZY Home">
      <div class="navbar-logo-icon">✈</div>
      <div>
        <div class="navbar-logo-text">OPSEAZY</div>
        <div class="navbar-logo-sub">Flight Booking</div>
      </div>
    </a>

    <div class="navbar-links">
      <a href="/" class="nav-link ${activePage === 'home' ? 'active' : ''}">Home</a>
      <a href="/pages/my-bookings.html" class="nav-link ${activePage === 'bookings' ? 'active' : ''}">My Bookings</a>
    </div>

    <div style="display:flex;align-items:center;gap:12px;">
      <div class="navbar-auth" id="nav-auth">
        <a href="/pages/login.html" class="btn-nav-login">Log In</a>
        <a href="/pages/register.html" class="btn-nav-signup">Sign Up</a>
      </div>

      <div class="navbar-user hidden" id="nav-user">
        <div style="position:relative;" id="navbar-user-wrapper">
          <button class="navbar-user-btn" id="navbar-user-btn" aria-haspopup="true" aria-expanded="false">
            <div class="navbar-avatar" id="nav-avatar">U</div>
            <span id="nav-username">User</span>
            <span>▾</span>
          </button>
          <div class="navbar-dropdown" id="navbar-dropdown" role="menu">
            <a href="/pages/my-bookings.html" class="dropdown-item" role="menuitem">🎫 My Bookings</a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" id="btn-logout" role="menuitem">⎋ Log Out</button>
          </div>
        </div>
      </div>

      <button class="navbar-hamburger" id="hamburger" aria-label="Toggle menu" aria-expanded="false">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </button>
    </div>
  </div>

  <div class="navbar-mobile" id="mobile-menu" role="menu">
    <a href="/" class="mobile-nav-link">Home</a>
    <a href="/pages/my-bookings.html" class="mobile-nav-link">My Bookings</a>
    <div class="mobile-nav-divider"></div>
    <a href="/pages/login.html" class="mobile-nav-link">Log In</a>
    <a href="/pages/register.html" class="mobile-nav-link">Sign Up</a>
  </div>
</nav>`;

  const target = document.getElementById('navbar-mount');
  if (target) target.innerHTML = navHtml;

  // Mobile hamburger
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  hamburger?.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
  });

  // User dropdown
  const userBtn = document.getElementById('navbar-user-btn');
  const dropdown = document.getElementById('navbar-dropdown');
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('open');
    userBtn.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', () => {
    dropdown?.classList.remove('open');
    userBtn?.setAttribute('aria-expanded', 'false');
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => Auth.logout());
}

window.renderNavbar = renderNavbar;
