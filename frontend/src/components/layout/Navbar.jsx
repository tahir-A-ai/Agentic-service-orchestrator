import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  return (
    <nav className={[styles.navbar, scrolled ? styles.scrolled : ''].filter(Boolean).join(' ')}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link to="/" className={styles.logo} aria-label="Karigar.pk home">
          <span className={styles.logoMark} />
          <span className={styles.logoText}>
            Karigar<span className={styles.logoDot}>.pk</span>
          </span>
        </Link>

        {/* Desktop nav links */}
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

          <div className={styles.navActions}>
            <Link to="/provider/dashboard" className={styles.loginLink}>Login</Link>
            <Link to="/chat" className={styles.ctaBtn}>Get Started</Link>
          </div>
        </div>

        {/* Hamburger */}
        <button
          className={[styles.hamburger, menuOpen ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}
