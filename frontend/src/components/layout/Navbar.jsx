import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../auth/AuthModal';
import styles from './Navbar.module.css';

/* ── Inline SVG Icons ──────────────── */
function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function LogOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, authModalOpen, authModalView, openAuth, closeAuth } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  return (
    <>
      <nav className={[styles.navbar, scrolled ? styles.scrolled : ''].filter(Boolean).join(' ')}>
        <div className={styles.inner}>
          {/* Logo */}
          <Link to="/" className={styles.logo} aria-label="Karigar.pk home">
            <span className={styles.logoMark} />
            <span className={styles.logoText}>
              Karigar<span className={styles.logoDot}>.pk</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className={[styles.navLinks, menuOpen ? styles.open : ''].filter(Boolean).join(' ')}>
            <Link to="/" className={styles.link}>Home</Link>
            <a
              href="#services"
              className={styles.link}
              onClick={(e) => {
                e.preventDefault();
                if (location.pathname !== '/') {
                  window.location.href = '/#services';
                  return;
                }
                document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Services
            </a>
            <a
              href="#how-it-works"
              className={styles.link}
              onClick={(e) => {
                e.preventDefault();
                if (location.pathname !== '/') {
                  window.location.href = '/#how-it-works';
                  return;
                }
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              How It Works
            </a>
            <Link to="/provider/register" className={styles.link}>For Providers</Link>

            {/* Auth Actions */}
            <div className={styles.navActions}>
              {isAuthenticated ? (
                <>
                  {user?.role === 'provider' && (
                    <Link to="/provider/dashboard" className={styles.iconBtn} title="Dashboard">
                      <DashboardIcon />
                    </Link>
                  )}
                  <span className={styles.userPill}>
                    <UserIcon />
                    <span>{user?.username}</span>
                  </span>
                  <button className={styles.logoutBtn} onClick={logout} title="Logout">
                    <LogOutIcon />
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.loginLink} onClick={() => openAuth('login')}>Login</button>
                  <button className={styles.ctaBtn} onClick={() => openAuth('role-select')}>
                    Signup <span className={styles.ctaArrow}>→</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Hamburger */}
          <button
            className={[styles.hamburger, menuOpen ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <AuthModal isOpen={authModalOpen} onClose={closeAuth} initialView={authModalView} />
    </>
  );
}
