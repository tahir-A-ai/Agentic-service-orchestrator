import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import styles from './AuthModal.module.css';

/* ── Inline SVG Icons ──────────────────────────── */
function ZapIcon({ size = 20, color = '#0D1117' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function UserIcon({ size = 20, color = '#22C55E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function HammerIcon({ size = 20, color = '#3B82F6' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9" />
      <path d="M17.64 15L22 10.64" /><path d="M20.91 11.7l-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" />
    </svg>
  );
}
function LockIcon({ size = 18, color = '#0D1117' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function EyeIcon({ size = 15, color = '#484F58' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon({ size = 15, color = '#484F58' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/* ── Floating Label Input ──────────────────────── */
function FloatingInput({ id, label, type = 'text', value, onChange, error, autoFocus }) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPw ? 'text' : 'password') : type;

  return (
    <div className={styles.fieldWrap}>
      <div className={[styles.inputContainer, error ? styles.inputError : '', focused ? styles.inputFocused : ''].filter(Boolean).join(' ')}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={[styles.input, lifted ? styles.inputLifted : ''].filter(Boolean).join(' ')}
          autoFocus={autoFocus}
          autoComplete={isPassword ? 'current-password' : 'off'}
        />
        <label htmlFor={id} className={[styles.floatLabel, lifted ? styles.floatLabelLifted : ''].filter(Boolean).join(' ')}>
          {label}
        </label>
        {isPassword && (
          <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(v => !v)} tabIndex={-1}>
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

/* ── Animated Checkmark SVG ────────────────────── */
function AnimatedCheckmark() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className={styles.checkSvg}>
      <circle cx="32" cy="32" r="28" stroke="rgba(34,197,94,0.15)" strokeWidth="3" fill="none" />
      <circle cx="32" cy="32" r="28" stroke="#22C55E" strokeWidth="3" fill="none"
        strokeDasharray="176" className={styles.checkCircle}
        style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }} />
      <polyline points="19,32 28,42 45,22" stroke="#22C55E" strokeWidth="4"
        strokeLinecap="round" fill="none" strokeDasharray="200" className={styles.checkMark} />
    </svg>
  );
}

/* ── Main AuthModal Component ──────────────────── */
export default function AuthModal({ isOpen, onClose, initialView = 'role-select' }) {
  const [view, setView] = useState(initialView);
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const { showToast } = useToast();

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginTab, setLoginTab] = useState('user'); // 'user' | 'provider'
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [signupEmail, setSignupEmail] = useState('');

  const backdropRef = useRef(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setName(''); setPhone(''); setEmail(''); setPassword(''); setConfirmPw('');
      setLoginEmail(''); setLoginPw('');
      setErrors({}); setLoading(false);
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onClose();
  };

  /* ── Customer Signup Handler ── */
  const handleCustomerSignup = async (e) => {
    e.preventDefault();
    if (loading) return; // Guard against double-submission

    const errs = {};
    if (!name.trim()) errs.name = 'Naam zaroor dein';
    if (!email.trim() || !email.includes('@')) errs.email = 'Valid email dein';
    if (password.length < 6) errs.password = 'Password kam az kam 6 characters ka ho';
    if (password !== confirmPw) errs.confirmPw = 'Passwords match nahi kar rahe';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await signup({ username: email, email, password, role: 'customer', full_name: name, phone });
      setSignupEmail(email);
      setView('signup-success');
    } catch (err) {
      const msg =
        err?.body?.detail?.message ||
        err?.body?.message ||
        err?.message ||
        'Signup fail ho gayi. Dobara try karein.';
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  /* ── Login Handler ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!loginEmail.trim()) errs.loginEmail = 'Email / username dein';
    if (!loginPw.trim()) errs.loginPw = 'Password dein';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 900));
      const user = await login(loginEmail, loginPw);
      if (user.role === 'provider') {
        onClose();
        navigate('/provider/dashboard');
      } else {
        onClose();
        navigate('/chat');
      }
    } catch (err) {
      setErrors({ form: err?.body?.detail?.message || 'Ghalat username ya password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop} ref={backdropRef} onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        {/* Close button */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* ─── VIEW A: Role Selection ─── */}
        {view === 'role-select' && (
          <div className={styles.viewFade} key="role-select">
            <div className={styles.headerCenter}>
              <div className={styles.iconBoxGreen}><ZapIcon size={20} color="#0D1117" /></div>
              <h2 className={styles.title}>Karigar.pk Join Karein</h2>
              <p className={styles.subtitle}>Aap platform kaise use karna chahte hain?</p>
            </div>
            <div className={styles.roleGrid}>
              <button className={styles.roleCardGreen} onClick={() => setView('customer-signup')}>
                <div className={styles.roleIconGreen}><UserIcon size={20} color="#22C55E" /></div>
                <div className={styles.roleTitle}>Service Lena Hai</div>
                <div className={styles.roleDesc}>Customer ban kar AI se services book karein</div>
              </button>
              <button className={styles.roleCardBlue} onClick={() => { onClose(); navigate('/provider/register'); }}>
                <div className={styles.roleIconBlue}><HammerIcon size={20} color="#3B82F6" /></div>
                <div className={styles.roleTitle}>Service Dena Hai</div>
                <div className={styles.roleDesc}>Provider ban kar orders haasil karein</div>
              </button>
            </div>
            <div className={styles.footer}>
              <span className={styles.footerMuted}>Pehle se account hai?</span>
              <button className={styles.footerLink} onClick={() => setView('login')}>Login Karein</button>
            </div>
          </div>
        )}

        {/* ─── VIEW B: Customer Signup ─── */}
        {view === 'customer-signup' && (
          <div className={styles.viewFade} key="customer-signup">
            <button className={styles.backLink} onClick={() => setView('role-select')}>
              <ChevronLeftIcon /> Wapas
            </button>
            <div className={styles.headerRow}>
              <div className={styles.roleIconGreen}><UserIcon size={18} color="#22C55E" /></div>
              <h2 className={styles.titleSm}>Customer Account Banayein</h2>
            </div>
            <p className={styles.subtitleSm}>Bilkul free hai — sirf seconds lagenge</p>

            {errors.form && <div className={styles.formError}>{errors.form}</div>}

            <form onSubmit={handleCustomerSignup} className={styles.form}>
              <FloatingInput id="signup-name" label="Full Name" value={name} onChange={e => setName(e.target.value)} error={errors.name} autoFocus />
              <FloatingInput id="signup-phone" label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} error={errors.phone} />
              <FloatingInput id="signup-email" label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
              <FloatingInput id="signup-pw" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} error={errors.password} />
              <FloatingInput id="signup-cpw" label="Confirm Password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} error={errors.confirmPw} />
              <button type="submit" className={styles.btnGreen} disabled={loading}>
                {loading ? 'Account ban raha hai...' : <><CheckCircleIcon /> Account Banayein</>}
              </button>
            </form>
            <div className={styles.footer}>
              <span className={styles.footerMuted}>Pehle se account hai?</span>
              <button className={styles.footerLink} onClick={() => setView('login')}>Login Karein</button>
            </div>
          </div>
        )}

        {/* ─── VIEW C: Signup Success ─── */}
        {view === 'signup-success' && (
          <div className={styles.viewFade} key="signup-success">
            <div className={styles.successCenter}>
              <AnimatedCheckmark />
              <h2 className={styles.title}>Account Ban Gaya!</h2>
              <p className={styles.subtitle}>
                <span style={{ color: '#F0F6FC', fontWeight: 600 }}>{signupEmail}</span> par confirmation bhej di gayi hai.
              </p>
              <button className={styles.btnGreen} onClick={() => setView('login')} style={{ marginTop: 20, width: '100%' }}>
                Login Karein <ArrowRightIcon />
              </button>
            </div>
          </div>
        )}

        {/* ─── VIEW D: Login ─── */}
        {view === 'login' && (
          <div className={styles.viewFade} key="login">
            <div className={styles.headerCenter}>
              <div className={styles.iconBoxGreen}><LockIcon size={18} color="#0D1117" /></div>
              <h2 className={styles.title}>Karigar.pk Login</h2>
              <p className={styles.subtitle}>Apna account select karein</p>
            </div>

            {/* Tab Switcher */}
            <div className={styles.tabWrap}>
              <button className={[styles.tab, loginTab === 'user' ? styles.tabActiveGreen : ''].filter(Boolean).join(' ')} onClick={() => setLoginTab('user')}>
                <UserIcon size={14} color={loginTab === 'user' ? '#0D1117' : '#8B949E'} /> User
              </button>
              <button className={[styles.tab, loginTab === 'provider' ? styles.tabActiveGreen : ''].filter(Boolean).join(' ')} onClick={() => setLoginTab('provider')}>
                <HammerIcon size={14} color={loginTab === 'provider' ? '#0D1117' : '#8B949E'} /> Provider
              </button>
            </div>

            {errors.form && <div className={styles.formError}>{errors.form}</div>}

            <form onSubmit={handleLogin} className={styles.form}>
              <FloatingInput id="login-email" label="Email Address" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} error={errors.loginEmail} autoFocus />
              <FloatingInput id="login-pw" label="Password" type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} error={errors.loginPw} />
              <div className={styles.forgotRow}>
                <button type="button" className={styles.forgotBtn}>Password bhool gaye?</button>
              </div>
              <button type="submit" className={styles.btnGreen} disabled={loading}>
                {loading ? 'Verify ho raha hai...' : (
                  loginTab === 'user'
                    ? <><span>Login</span> <ArrowRightIcon /></>
                    : <><span>Login</span> <ArrowRightIcon /></>
                )}
              </button>
            </form>
            <div className={styles.footer}>
              <span className={styles.footerMuted}>Account nahi hai?</span>
              <button className={styles.footerLink} onClick={() => setView('role-select')}>Signup Karein</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
