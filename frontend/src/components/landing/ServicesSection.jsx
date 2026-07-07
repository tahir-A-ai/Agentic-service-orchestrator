import { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveServices } from '../../api/client';
import styles from './ServicesSection.module.css';

// ── Per-service data ─────────────────────────────────────────────────────────

const SERVICES = [
  {
    key: 'electrician',
    label: 'Electrician',
    urdu: 'BIJLI WALA',
    emoji: '⚡',
    color: '#3B82F6',
    colorDim: 'rgba(59,130,246,0.12)',
    colorBorder: 'rgba(59,130,246,0.25)',
    colorGlow: 'rgba(59,130,246,0.18)',
    description: 'Ghar ki wiring, MCB, fans, switches — har bijli ki masla hal karein.',
  },
  {
    key: 'plumber',
    label: 'Plumber',
    urdu: 'NALQE WALA',
    emoji: '🔧',
    color: '#22C55E',
    colorDim: 'rgba(34,197,94,0.10)',
    colorBorder: 'rgba(34,197,94,0.25)',
    colorGlow: 'rgba(34,197,94,0.18)',
    description: 'Leakage, blockage, geyser, ya naye pipe — sab kuch thik kar dein.',
  },
  {
    key: 'ac technician',
    label: 'AC Technician',
    urdu: 'AC WALA',
    emoji: '❄️',
    color: '#06B6D4',
    colorDim: 'rgba(6,182,212,0.10)',
    colorBorder: 'rgba(6,182,212,0.25)',
    colorGlow: 'rgba(6,182,212,0.18)',
    description: 'AC service, gas filling, installation ya repair — expert se karwao.',
  },
  {
    key: 'painter',
    label: 'Painter',
    urdu: 'PAINTER',
    emoji: '🖌️',
    color: '#A855F7', // Purple
    colorDim: 'rgba(168,85,247,0.10)',
    colorBorder: 'rgba(168,85,247,0.25)',
    colorGlow: 'rgba(168,85,247,0.18)',
    description: 'Ghar ke andar ya bahar — painting, touch-up, waterproofing sab.',
  },
];

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

function WrenchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ChevronIcon({ direction = 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {direction === 'left'
        ? <polyline points="15 18 9 12 15 6" />
        : <polyline points="9 18 15 12 9 6" />
      }
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
    <div className={styles.card} style={cardStyle} onClick={() => navigate('/chat')}>
      {/* Top accent strip */}
      <div className={styles.accentStrip} />

      {/* Card Body */}
      <div className={styles.cardBody}>
        <div className={styles.iconBox}>
          <span className={styles.emoji}>{svc.emoji}</span>
        </div>

        <h3 className={styles.cardTitle}>{svc.label}</h3>
        <p className={styles.cardUrdu} style={{ color: svc.color }}>{svc.urdu}</p>

        <p className={styles.cardDesc}>{svc.description}</p>

        <div className={styles.cardFooter}>
          <button
            className={styles.roundBtn}
            onClick={(e) => {
              e.stopPropagation();
              navigate('/chat');
            }}
            aria-label={`Book ${svc.label}`}
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Export with Carousel ────────────────────────────────────────────────

export default function ServicesSection() {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // State for dynamic active services from DB
  const [activeServiceKeys, setActiveServiceKeys] = useState(null);

  useEffect(() => {
    let mounted = true;
    getActiveServices()
      .then((data) => {
        if (mounted && data?.active_services) {
          // Normalize to lowercase for robust matching
          setActiveServiceKeys(data.active_services.map(k => k.toLowerCase()));
        }
      })
      .catch((err) => console.error('Failed to fetch active services:', err));

    return () => { mounted = false; };
  }, []);

  // Filter the hardcoded list based on DB availability.
  // If activeServiceKeys is null (loading) or empty (error or no active providers), 
  // we could optionally fallback to all, but let's filter if it's an array.
  const displayedServices = useMemo(() => {
    if (activeServiceKeys === null) return SERVICES; // show all while loading
    // Filter to only those whose key is in the active list
    const filtered = SERVICES.filter(svc => activeServiceKeys.includes(svc.key.toLowerCase()));
    // Fallback to all if somehow the DB returned none or no matches, to avoid empty section
    return filtered.length > 0 ? filtered : SERVICES;
  }, [activeServiceKeys]);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);

    // Calculate active dot
    const cardWidth = el.querySelector(`.${styles.card}`)?.offsetWidth || 320;
    const gap = 20;
    const newIndex = Math.round(el.scrollLeft / (cardWidth + gap));
    setActiveIndex(newIndex);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener('scroll', checkScroll);
  }, []);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(`.${styles.card}`)?.offsetWidth || 320;
    el.scrollBy({ left: dir === 'left' ? -cardWidth - 20 : cardWidth + 20, behavior: 'smooth' });
  };

  const scrollToDot = (index) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(`.${styles.card}`)?.offsetWidth || 320;
    const gap = 20;
    el.scrollTo({ left: index * (cardWidth + gap), behavior: 'smooth' });
  };

  return (
    <section className={styles.section} id="services">
      {/* Glow orbs */}
      <div className={styles.glowOrb1} aria-hidden="true" />
      <div className={styles.glowOrb2} aria-hidden="true" />

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

        {/* Carousel wrapper */}
        <div className={styles.carouselWrap}>
          {/* Left arrow */}
          {canScrollLeft && (
            <button className={`${styles.arrowBtn} ${styles.arrowLeft}`} onClick={() => scroll('left')} aria-label="Scroll left">
              <ChevronIcon direction="left" />
            </button>
          )}

          {/* Scroll track */}
          <div className={styles.scrollTrack} ref={scrollRef}>
            {displayedServices.map((svc) => (
              <ServiceCard key={svc.key} svc={svc} navigate={navigate} />
            ))}
          </div>

          {/* Right arrow */}
          {canScrollRight && (
            <button className={`${styles.arrowBtn} ${styles.arrowRight}`} onClick={() => scroll('right')} aria-label="Scroll right">
              <ChevronIcon direction="right" />
            </button>
          )}

          {/* Fade edges */}
          <div className={styles.fadeLeft} aria-hidden="true" />
          <div className={styles.fadeRight} aria-hidden="true" />
        </div>

        {/* Carousel Dots */}
        <div className={styles.dotsWrap}>
          {displayedServices.map((_, idx) => (
            <button
              key={idx}
              className={`${styles.dot} ${idx === activeIndex ? styles.dotActive : ''}`}
              onClick={() => scrollToDot(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
