import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './LiveTrackingMap.module.css';

// Default Islamabad reference coordinates
const DEFAULT_CENTER = [33.6844, 73.0479];

/**
 * Calculates straight-line distance in km between two GPS points (Haversine formula).
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes calibrated urban ETA in minutes from straight-line km (28 km/h + 8 min dispatch buffer).
 */
function calculateFallbackEta(distanceKm) {
  const travelMins = (distanceKm / 28) * 60;
  return Math.max(5, Math.round(travelMins + 8));
}

/**
 * Formats arrival clock time (e.g., "1:23 PM").
 */
function formatArrivalTime(etaMins) {
  const arrival = new Date(Date.now() + etaMins * 60000);
  return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function LiveTrackingMap({
  provider = {},
  customer = {},
  status = 'In_Progress',
  onClose,
  isProviderView = false,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(null);
  const providerMarkerRef = useRef(null);
  const routeCoordsRef = useRef([]);
  const totalDistanceRef = useRef(0);
  const totalDurationRef = useRef(0);
  const stepIndexRef = useRef(0);

  // Resolved Coordinates
  const providerLat = Number(provider?.latitude) || 33.6999;
  const providerLon = Number(provider?.longitude) || 73.1756;
  const customerLat = Number(customer?.latitude) || 33.6425;
  const customerLon = Number(customer?.longitude) || 72.9841;

  // Tracking metrics state
  const [distanceKm, setDistanceKm] = useState(null);
  const [etaMins, setEtaMins] = useState(null);
  const [arrivalTime, setArrivalTime] = useState('');
  const [isRouting, setIsRouting] = useState(true);
  const [routeSource, setRouteSource] = useState('osrm'); // 'osrm' | 'fallback'
  const [isArrived, setIsArrived] = useState(false);

  // Determine who to call based on who is viewing
  const contactName = isProviderView
    ? customer?.name || customer?.customer_name || 'Customer'
    : provider?.name || 'Provider';

  const contactRole = isProviderView
    ? customer?.address || customer?.exact_address || 'Customer Location'
    : provider?.service_type || 'Service Technician';

  const contactPhone = isProviderView
    ? customer?.phone || customer?.customer_phone
    : provider?.phone;

  // Status Badge Label
  const getStatusLabel = () => {
    if (isArrived || status === 'Pending_Completion') {
      return 'Arrived at Destination';
    }
    if (status === 'Completed') {
      return 'Job Completed';
    }
    if (status === 'Pending_Acceptance') {
      return 'Pending Acceptance';
    }
    if (status === 'In_Progress') {
      return isProviderView ? 'En Route to Customer' : 'Technician on the Way (Live Moving)';
    }
    return 'Live Tracking';
  };

  // Recenter map on bounds
  const handleRecenter = useCallback(() => {
    if (mapInstanceRef.current) {
      const bounds = L.latLngBounds(
        [providerLat, providerLon],
        [customerLat, customerLon]
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [providerLat, providerLon, customerLat, customerLon]);

  // 1. Initialize Map and load base OSRM route
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView(DEFAULT_CENTER, 13);

      // Position zoom controls cleanly on the right below the close button
      L.control.zoom({ position: 'topright' }).addTo(map);

      // CartoDB Voyager tiles matching modern sleek theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers and route layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // 1. Custom Provider Marker Icon (Green pulse)
    const providerIcon = L.divIcon({
      className: 'custom-pin',
      html: `
        <div class="provider-pin">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    // 2. Custom Customer Marker Icon (Blue pin)
    const customerIcon = L.divIcon({
      className: 'custom-pin',
      html: `
        <div class="customer-pin">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    // Add Markers
    const providerMarker = L.marker([providerLat, providerLon], { icon: providerIcon }).addTo(map);
    providerMarker.bindPopup(`<strong>${provider.name || 'Provider'}</strong><br/>${provider.service_type || 'Technician'}`);
    providerMarkerRef.current = providerMarker;

    const customerMarker = L.marker([customerLat, customerLon], { icon: customerIcon }).addTo(map);
    customerMarker.bindPopup(`<strong>Destination</strong><br/>${customer.address || customer.exact_address || 'Customer Location'}`);

    // 3. Fetch OSRM Driving Route
    const fetchRoute = async () => {
      setIsRouting(true);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${providerLon},${providerLat};${customerLon},${customerLat}?overview=full&geometries=geojson`;

      try {
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const dist = (route.distance / 1000).toFixed(1);
          const durationMins = Math.max(5, Math.round(route.duration / 60));

          setDistanceKm(dist);
          setEtaMins(durationMins);
          setArrivalTime(formatArrivalTime(durationMins));
          setRouteSource('osrm');

          // Store raw waypoints and totals for live movement
          const coordinates = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          routeCoordsRef.current = coordinates;
          totalDistanceRef.current = Number(dist);
          totalDurationRef.current = Number(durationMins);
          stepIndexRef.current = 0;
          setIsArrived(false);

          if (routeLayerRef.current) {
            map.removeLayer(routeLayerRef.current);
          }

          routeLayerRef.current = L.polyline(coordinates, {
            color: '#22C55E',
            weight: 5,
            opacity: 0.95,
            lineJoin: 'round',
            dashArray: null,
          }).addTo(map);
        } else {
          throw new Error('No OSRM route found');
        }
      } catch (err) {
        console.warn('OSRM routing fallback activated:', err);
        const haversineDist = calculateHaversineKm(providerLat, providerLon, customerLat, customerLon);
        const roundedDist = haversineDist.toFixed(1);
        const fallbackEta = calculateFallbackEta(haversineDist);

        setDistanceKm(roundedDist);
        setEtaMins(fallbackEta);
        setArrivalTime(formatArrivalTime(fallbackEta));
        setRouteSource('fallback');

        const fallbackLine = [
          [providerLat, providerLon],
          [customerLat, customerLon],
        ];
        routeCoordsRef.current = fallbackLine;
        totalDistanceRef.current = Number(roundedDist);
        totalDurationRef.current = Number(fallbackEta);
        stepIndexRef.current = 0;

        if (routeLayerRef.current) {
          map.removeLayer(routeLayerRef.current);
        }

        routeLayerRef.current = L.polyline(fallbackLine, {
          color: '#22C55E',
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 8',
        }).addTo(map);
      } finally {
        setIsRouting(false);
      }
    };

    fetchRoute();
    handleRecenter();
  }, [providerLat, providerLon, customerLat, customerLon, provider, customer, handleRecenter]);

  // 2. Real-Time Movement & Countdown Interval Engine
  useEffect(() => {
    if (status !== 'In_Progress' || isArrived) return;

    const interval = setInterval(() => {
      const waypoints = routeCoordsRef.current;
      if (!waypoints || waypoints.length < 2) return;

      const totalWaypoints = waypoints.length;
      // Step size: advance smoothly along the route every 2.5s
      const stepJump = Math.max(1, Math.floor(totalWaypoints / 40));
      const nextIndex = Math.min(totalWaypoints - 1, stepIndexRef.current + stepJump);
      stepIndexRef.current = nextIndex;

      const currentPosition = waypoints[nextIndex];

      // A. Smoothly move technician pin
      if (providerMarkerRef.current) {
        providerMarkerRef.current.setLatLng(currentPosition);
      }

      // B. Trim the route line so path behind car disappears
      if (routeLayerRef.current) {
        const remainingPath = waypoints.slice(nextIndex);
        routeLayerRef.current.setLatLngs(remainingPath);
      }

      // C. Count down distance and ETA
      const remainingFraction = Math.max(0, 1 - nextIndex / (totalWaypoints - 1));
      const curDist = (totalDistanceRef.current * remainingFraction).toFixed(1);
      const curEta = Math.max(1, Math.round(totalDurationRef.current * remainingFraction));

      if (nextIndex >= totalWaypoints - 1) {
        setIsArrived(true);
        setDistanceKm('0.0');
        setEtaMins(0);
        clearInterval(interval);
      } else {
        setDistanceKm(curDist);
        setEtaMins(curEta);
        setArrivalTime(formatArrivalTime(curEta));
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [status, isArrived]);

  return (
    <div className={styles.container}>
      {/* Map Canvas */}
      <div ref={mapContainerRef} className={styles.mapCanvas} />

      {/* Top Floating Bar */}
      <div className={styles.topOverlay}>
        <div className={styles.statusCard}>
          <span className={styles.pulseDot} />
          <span className={styles.statusText}>{getStatusLabel()}</span>
          <span className={`${styles.routeBadge} ${routeSource === 'osrm' ? styles.routeOsrm : styles.routeFallback}`}>
            {routeSource === 'osrm' ? 'Live Road Route' : 'Estimated'}
          </span>
        </div>

        {onClose && (
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close Map">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {/* Compact Bottom Tracking Panel */}
      <div className={styles.bottomPanel}>
        {/* Row 1: Person Info + Metrics */}
        <div className={styles.panelRow}>
          {/* Person Info */}
          <div className={styles.personInfo}>
            <div className={styles.avatar}>
              {contactName.substring(0, 2).toUpperCase()}
            </div>
            <div className={styles.personMeta}>
              <h4 className={styles.personName}>{contactName}</h4>
              <span className={styles.personRole}>{contactRole}</span>
            </div>
          </div>

          {/* Real-time ETA & Distance */}
          <div className={styles.etaContainer}>
            <div className={styles.etaBlock}>
              <span className={styles.etaLabel}>Est. ETA</span>
              <span className={styles.etaValue}>
                {isRouting ? '...' : isArrived ? 'Arrived' : `${etaMins || 20} min`}
              </span>
            </div>

            <div className={styles.etaBlock}>
              <span className={styles.etaLabel}>Distance</span>
              <span className={styles.distValue}>
                {isRouting ? '...' : `${distanceKm || 0} km`}
              </span>
            </div>

            {arrivalTime && !isArrived && (
              <div className={styles.etaBlock}>
                <span className={styles.etaLabel}>Arrival</span>
                <span className={styles.distValue}>{arrivalTime}</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Actions */}
        <div className={styles.actionsRow}>
          {contactPhone ? (
            <a href={`tel:${contactPhone}`} className={styles.callButton}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Call {contactName.split(' ')[0]} ({contactPhone})</span>
            </a>
          ) : (
            <button
              type="button"
              className={styles.callButton}
              onClick={() => alert('Phone number is currently unavailable for this user.')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Call {contactName.split(' ')[0]}</span>
            </button>
          )}

          <button type="button" className={styles.recenterBtn} onClick={handleRecenter}>
            Recenter Map
          </button>
        </div>
      </div>
    </div>
  );
}
