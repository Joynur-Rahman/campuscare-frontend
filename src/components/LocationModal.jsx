import { useEffect, useRef } from 'react';
import { X, MapPin, ExternalLink, Navigation, Compass } from 'lucide-react';
import { loadMapplsSdk, getMapplsKey } from '../lib/mappls.js';
import { getTicketCoords } from '../lib/ticketUtils.js';

export default function LocationModal({ ticket, onClose }) {
  const mapContainerRef = useRef(null);
  const mapplsMapRef = useRef(null);
  const leafletMapRef = useRef(null);

  const coords = getTicketCoords(ticket);
  const lat = coords?.lat ?? (ticket?.latitude ? Number(ticket.latitude) : null);
  const lng = coords?.lng ?? (ticket?.longitude ? Number(ticket.longitude) : null);
  const address = ticket?.location || 'Campus Location';
  const apiKey = getMapplsKey();

  useEffect(() => {
    if (!lat || !lng || !mapContainerRef.current) return;
    let isMounted = true;

    async function init() {
      // 1. Try MapmyIndia (Mappls)
      if (apiKey) {
        try {
          const mappls = await loadMapplsSdk(apiKey);
          if (!isMounted || !mapContainerRef.current) return;

          const map = new mappls.Map(mapContainerRef.current, {
            center: [lat, lng],
            zoom: 17,
            zoomControl: true,
            location: true,
          });
          mapplsMapRef.current = map;

          new mappls.Marker({
            map,
            position: { lat, lng },
          });
          return;
        } catch (err) {
          console.warn('Mappls SDK failed in LocationModal, using fallback', err);
        }
      }

      // 2. High-reliability fallback (Leaflet / OSM)
      try {
        if (!window.L) {
          await loadLeafletLibrary();
        }
        if (!isMounted || !mapContainerRef.current) return;

        const L = window.L;
        if (L.Icon?.Default) {
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });
        }

        const map = L.map(mapContainerRef.current).setView([lat, lng], 17);
        leafletMapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors | MapmyIndia Compatible',
        }).addTo(map);

        const customPinIcon = L.divIcon({
          className: 'modal-ticket-pin',
          html: `
            <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
              <div style="background-color: #ef4444; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff;">
                <span style="transform: rotate(45deg); font-size: 14px;">📍</span>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        L.marker([lat, lng], { icon: customPinIcon }).addTo(map);
      } catch (fErr) {
        console.error('Leaflet fallback error in LocationModal', fErr);
      }
    }

    const timer = setTimeout(init, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch {}
        leafletMapRef.current = null;
      }
      if (mapplsMapRef.current) {
        try { mapplsMapRef.current.remove(); } catch {}
        mapplsMapRef.current = null;
      }
    };
  }, [lat, lng, apiKey]);

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-fadeIn" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="min-w-0 pr-3">
            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {ticket.id}
            </span>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate mt-0.5">
              {ticket.title || ticket.categoryDisplay || 'Issue Location'}
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="modal-x shrink-0">
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Map View */}
        <div className="relative w-full h-64 bg-slate-100 dark:bg-slate-800">
          {lat && lng ? (
            <div ref={mapContainerRef} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center">
              <Compass className="w-8 h-8 text-slate-300 mb-2" />
              <span>Exact GPS coordinates were not pinned for this ticket.</span>
            </div>
          )}
        </div>

        {/* Location Details Footer */}
        <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {address}
              </p>
              {lat && lng && (
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {lat && lng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Get Directions</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function loadLeafletLibrary() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);

    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.setAttribute('data-leaflet-css', 'true');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.setAttribute('data-leaflet-js', 'true');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
