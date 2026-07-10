import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { getProviderStats } from '../../../api/client';
import StatusToggle from './StatusToggle';
import Badge from '../../ui/Badge';
import styles from './DashboardLayout.module.css';

export default function DashboardLayout() {
  const { providerProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [liveServiceType, setLiveServiceType] = useState(providerProfile?.service || 'Service');

  useEffect(() => {
    if (providerProfile?.id) {
      getProviderStats(providerProfile.id)
        .then(stats => {
          setActiveJobsCount(stats.active_jobs);
          if (stats.service_type) setLiveServiceType(stats.service_type);
        })
        .catch(console.error);
      
      // Simple poll every 15s to keep the badge somewhat live
      const interval = setInterval(() => {
        getProviderStats(providerProfile.id)
          .then(stats => {
            setActiveJobsCount(stats.active_jobs);
            if (stats.service_type) setLiveServiceType(stats.service_type);
          })
          .catch(console.error);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [providerProfile?.id]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { 
      path: '/provider/dashboard', 
      label: 'Dashboard', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="18" y="3" width="4" height="18"></rect>
          <rect x="10" y="8" width="4" height="13"></rect>
          <rect x="2" y="13" width="4" height="8"></rect>
        </svg>
      ),
      end: true 
    },
    { 
      path: '/provider/dashboard/active', 
      label: 'Active Jobs', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      ),
      badge: activeJobsCount > 0 ? activeJobsCount : undefined
    },
    { 
      path: '/provider/dashboard/completed', 
      label: 'Completed', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      )
    },
    { 
      path: '/provider/dashboard/profile', 
      label: 'Profile', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )
    },
    { 
      path: '/provider/dashboard/help', 
      label: 'Help', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      )
    },
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
          sidebarCollapsed ? styles.collapsed : ''
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.profileSection}>
          <div className={styles.profileInfo}>
            <div className={styles.avatar}>
              {providerProfile?.name?.substring(0, 2).toUpperCase() || 'TM'}
            </div>
            {!sidebarCollapsed && (
              <div className={styles.profileDetails}>
                <h2 className={styles.name}>{providerProfile?.name || 'Tariq Mehmood'}</h2>
                <Badge variant="blue" className={styles.serviceBadge}>
                  <span className={styles.badgeIcon}>⚡</span> {liveServiceType}
                </Badge>
              </div>
            )}
          </div>
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
              {!sidebarCollapsed && <span className={styles.navLabel}>{item.label}</span>}
              {!sidebarCollapsed && item.badge && (
                <span className={styles.navBadge}>{item.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          {!sidebarCollapsed && (
            <button className={styles.collapseBtn} onClick={() => setSidebarCollapsed(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Collapse
            </button>
          )}
          {sidebarCollapsed && (
            <button className={styles.collapseBtn} onClick={() => setSidebarCollapsed(false)} title="Expand">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          )}
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            {!sidebarCollapsed && 'Logout'}
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
