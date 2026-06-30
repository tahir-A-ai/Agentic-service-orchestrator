import { useNavigate } from 'react-router-dom';
import styles from './ServicesSection.module.css';

// ── Per-service data ─────────────────────────────────────────────────────────

const SERVICES = [
  {
    key: 'electrician',
    label: 'Electrician',
    urdu: 'Bijli Wala',
    emoji: '⚡',
    color: '#3B82F6',
    colorDim: 'rgba(59,130,246,0.12)',
    colorBorder: 'rgba(59,130,246,0.25)',
    colorGlow: 'rgba(59,130,246,0.18)',
    rating: '4.8',
    description:
      'Ghar ki wiring, MCB, fans, switches — har bijli ki masla hal karein.',
    tasks: [
      'Wiring & Rewiring',
      'MCB / Fuse Repair',
      'Fan Installation',
      'Light Fitting',
      'Inverter Setup',
      'Earthing & Safety Check',
    ],
    avgTime: '45–90 min',
    price: 'Rs. 800–2,500',
    bookings: '820+',
  },
  {
    key: 'plumber',
    label: 'Plumber',
    urdu: 'Nalqe Wala',
    emoji: '🔧',
    color: '#22C55E',
    colorDim: 'rgba(34,197,94,0.10)',
    colorBorder: 'rgba(34,197,94,0.25)',
    colorGlow: 'rgba(34,197,94,0.18)',
    rating: '4.7',
    description:
      'Leakage, blockage, geyser, ya naye pipe — sab kuch thik kar dein.',
    tasks: [
      'Pipe Leakage Fix',
      'Drain Blockage',
      'Geyser Repair',
      'Tap Replacement',
      'Water Pump',
      'Bathroom Fitting',
    ],
    avgTime: '30–120 min',
    price: 'Rs. 600–3,000',
    bookings: '650+',
  },
  {
    key: 'ac',
    label: 'AC Technician',
    urdu: 'AC Wala',
    emoji: '❄️',
    color: '#06B6D4',
    colorDim: 'rgba(6,182,212,0.10)',
    colorBorder: 'rgba(6,182,212,0.25)',
    colorGlow: 'rgba(6,182,212,0.18)',
    rating: '4.9',
    description:
      'AC service, gas filling, installation ya repair — expert se karwao.',
    tasks: [
      'AC Service / Cleaning',
      'Gas Refilling',
      'New Installation',
      'Compressor Repair',
      'Remote / PCB Fix',
      'Split AC Install',
    ],
    avgTime: '60–180 min',
    price: 'Rs. 1,200–5,000',
    bookings: '530+',
  },
];

// ── Icons (inline SVG to avoid external deps) ────────────────────────────────

function WrenchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#EAB308" stroke="#EAB308" strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ svc, navigate }) {
  const cardStyle = {
    '--svc-color': svc.color,
    '--svc-dim': svc.colorDim,
    '--svc-border': svc.colorBorder,
    '--svc-glow': svc.colorGlow,
  };

  return (
    <div className={styles.card} style={cardStyle}>
      {/* Top accent strip */}
      <div className={styles.accentStrip} />

      {/* Card Body */}
      <div className={styles.cardBody}>
        {/* Row 1: icon + title + rating */}
        <div className={styles.cardTop}>
          <div className={styles.cardTopLeft}>
            <div className={styles.iconBox}>
              <span className={styles.emoji}>{svc.emoji}</span>
            </div>
            <div>
              <div className={styles.cardTitle}>{svc.label}</div>
              <div className={styles.cardUrdu} style={{ color: svc.color }}>{svc.urdu}</div>
            </div>
          </div>
          <div className={styles.ratingPill}>
            <StarIcon />
            <span className={styles.ratingValue}>{svc.rating}</span>
          </div>
        </div>

        {/* Description */}
        <p className={styles.cardDesc}>{svc.description}</p>

        {/* Task chips */}
        <div className={styles.chipsRow}>
          {svc.tasks.map((t) => (
            <span key={t} className={styles.chip}>{t}</span>
          ))}
        </div>

        {/* Meta strip */}
        <div className={styles.metaStrip}>
          <div className={styles.metaCol}>
            <span className={styles.metaEmoji}>⏱</span>
            <span className={styles.metaLabel}>Avg Time</span>
            <span className={styles.metaValue}>{svc.avgTime}</span>
          </div>
          <div className={`${styles.metaCol} ${styles.metaColBorder}`}>
            <span className={styles.metaEmoji}>💰</span>
            <span className={styles.metaLabel}>Price Range</span>
            <span className={styles.metaValue}>{svc.price}</span>
          </div>
          <div className={styles.metaCol}>
            <span className={styles.metaEmoji}>📋</span>
            <span className={styles.metaLabel}>Bookings</span>
            <span className={styles.metaValue}>{svc.bookings}</span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className={styles.cardFooter}>
        <button
          className={styles.ctaBtn}
          onClick={() => navigate('/chat')}
          aria-label={`Book ${svc.label}`}
        >
          {svc.label} Book Karein
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────

export default function ServicesSection() {
  const navigate = useNavigate();

  return (
    <section className={styles.section} id="services">
      {/* Radial glow overlay */}
      <div className={styles.glowOverlay} aria-hidden="true" />

      <div className={styles.inner}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.eyebrow}>
            <WrenchIcon />
            <span>OUR SERVICES</span>
          </div>
          <h2 className={styles.heading}>Teen Zaroorat, Ek Platform</h2>
          <p className={styles.subtext}>
            Islamabad ke ghar mein har mushkil ka hal — plumber se lekar AC
            technician tak, sab kuch AI se book karein.
          </p>
        </div>

        {/* Cards */}
        <div className={styles.grid}>
          {SERVICES.map((svc) => (
            <ServiceCard key={svc.key} svc={svc} navigate={navigate} />
          ))}
        </div>
      </div>
    </section>
  );
}
