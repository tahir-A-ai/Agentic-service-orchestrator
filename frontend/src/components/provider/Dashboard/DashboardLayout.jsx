import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import StatusToggle from './StatusToggle';
import Badge from '../../ui/Badge';
import styles from './DashboardLayout.module.css';

export default function DashboardLayout() {
  const { providerProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/provider/dashboard', label: 'Dashboard', icon: '📊', end: true },
    { path: '/provider/dashboard/active', label: 'Active Jobs', icon: '🔨' },
    { path: '/provider/dashboard/completed', label: 'Completed', icon: '✅' },
    { path: '/provider/dashboard/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <button
          className={styles.hamburger}
          onClick={() => setMobileMenuOpen((v) => !v)}
        >
          ☰
        </button>
        <span className={styles.mobileTitle}>Provider Dashboard</span>
      </div>

      {/* Sidebar */}
      <aside
        className={[
          styles.sidebar,
          mobileMenuOpen ? styles.sidebarOpen : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.profileSection}>
          <div className={styles.avatar}>
            {providerProfile?.name?.charAt(0) || 'P'}
          </div>
          <h2 className={styles.name}>{providerProfile?.name || 'Provider'}</h2>
          <Badge variant="blue" className={styles.badge}>
            {providerProfile?.service || 'Service'}
          </Badge>
          <div className={styles.toggleWrap}>
            <StatusToggle />
          </div>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.active : ''].join(' ')
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles.main}>
        <div className={styles.contentInner}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
