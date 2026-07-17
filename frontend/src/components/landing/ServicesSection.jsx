import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServiceTypes } from '../../api/stats';
import { getIconComponent, WrenchIcon } from '../../constants/serviceIcons';
import styles from './ServicesSection.module.css';

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

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
  // Compute semi-transparent colors based on the hex theme color if not explicitly provided
  // Assuming theme_color is a hex code like "#3B82F6"
  const hex = svc.theme_color || '#3B82F6';
  
  // Very simple hex to rgba for the CSS variables
  let r = 59, g = 130, b = 246; // fallback blue
  if (hex.match(/^#[0-9a-f]{6}$/i)) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  const colorDim = `rgba(${r},${g},${b},0.12)`;
  const colorBorder = `rgba(${r},${g},${b},0.25)`;
  const colorGlow = `rgba(${r},${g},${b},0.18)`;

  const cardStyle = {
    '--svc-color': hex,
    '--svc-dim': colorDim,
    '--svc-border': colorBorder,
    '--svc-glow': colorGlow,
  };

  const IconComponent = getIconComponent(svc.key);

  return (
    <div className={styles.card} style={cardStyle} onClick={() => navigate('/chat')}>
      {/* Top accent strip */}
      <div className={styles.accentStrip} />

      {/* Card Body */}
      <div className={styles.cardBody}>
        <div className={styles.iconBox}>
          <IconComponent size={28} color={hex} />
        </div>

        <h3 className={styles.cardTitle}>{svc.label}</h3>
        <p className={styles.cardUrdu} style={{ color: hex }}>{svc.label_urdu}</p>

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
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getServiceTypes()
      .then((data) => {
        if (mounted && data?.service_types) {
          setServices(data.service_types);
        }
      })
      .catch((err) => console.error('Failed to fetch service types:', err))
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

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
            {isLoading ? (
              <p style={{ padding: '2rem' }}>Loading services...</p>
            ) : (
              services.map((svc) => (
                <ServiceCard key={svc.key} svc={svc} navigate={navigate} />
              ))
            )}
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
        {!isLoading && services.length > 0 && (
          <div className={styles.dotsWrap}>
            {services.map((_, idx) => (
              <button
                key={idx}
                className={`${styles.dot} ${idx === activeIndex ? styles.dotActive : ''}`}
                onClick={() => scrollToDot(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
