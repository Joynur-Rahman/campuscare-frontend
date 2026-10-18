import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Navigation, Compass } from 'lucide-react';
import { buildingLabelHtml, BUILDING_NAME_MIN_ZOOM, loadMapplsSdk, createMapplsMap, addCampusOverlay, centeredHtml, useSatelliteStyle, getMapplsKey } from '../lib/mappls.js';
import { CAMPUS_LANDMARKS, IIITG_CAMPUS_POLYGON } from '../lib/campus.js';
import { loadLeaflet } from '../lib/leafletFallback.js';
import { getTicketCoords, shortTicketId } from '../lib/ticketUtils.js';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';

export default function LocationModal({ ticket, onClose }) {
  useBodyScrollLock();
  const mapContainerRef = useRef(null);
  const mapplsMapRef = useRef(null);
  const [mapError, setMapError] = useState('');

  const coords = getTicketCoords(ticket);
  const lat = coords?.lat ?? (ticket?.latitude ? Number(ticket.latitude) : null);
  const lng = coords?.lng ?? (ticket?.longitude ? Number(ticket.longitude) : null);
  const address = ticket?.location || 'Campus Location';

  useEffect(() => {
    if (!lat || !lng || !mapContainerRef.current) return;
    let isMounted = true;
    let stopLive = null;
    let watchId = null;

    async function loadFallbackLeaflet() {
      try {
        const L = await loadLeaflet();
        if (!isMounted || !mapContainerRef.current) return;
        const map = L.map(mapContainerRef.current, { attributionControl: false }).setView([lat, lng], 18);
        mapplsMapRef.current = map;
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
        L.polygon(IIITG_CAMPUS_POLYGON, { color: '#facc15', weight: 2.5, opacity: 0.9, fillOpacity: 0.04 }).addTo(map);
        L.marker([lat, lng]).addTo(map);
        CAMPUS_LANDMARKS.forEach((lm) => {
          try {
            L.circleMarker([lm.lat, lm.lng], { radius: 4, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8 }).addTo(map);
          } catch {}
        });
        setMapError('');
      } catch (fErr) {
        if (isMounted) setMapError('Campus map could not be loaded — check your internet connection.');
      }
    }

    async function init() {
      const key = getMapplsKey();
      if (!key) {
        await loadFallbackLeaflet();
        return;
      }

      try {
        const mappls = await loadMapplsSdk(key);
        if (!isMounted || !mapContainerRef.current) return;
        const el = mapContainerRef.current;
        const map = createMapplsMap(mappls, el, { center: [lat, lng], zoom: 18, zoomControl: true, location: false });
        mapplsMapRef.current = map;
        useSatelliteStyle(mappls, map);
        addCampusOverlay(mappls, map, { showLabels: false });
        const onReady = () => {
          if (!isMounted) return;
          CAMPUS_LANDMARKS.forEach((lm) => {
            try { new mappls.Marker({ map, position: { lat: lm.lat, lng: lm.lng }, html: centeredHtml(buildingLabelHtml(lm)), width: 2, height: 2, fitbounds: false }); } catch { /* skip */ }
          });
          const syncNames = () => { try { el.classList.toggle('cc-names-on', map.getZoom() >= BUILDING_NAME_MIN_ZOOM); } catch { /* ignore */ } };
          syncNames();
          try { map.on('zoomend', syncNames); } catch { /* ignore */ }
          try { new mappls.Marker({ map, position: { lat, lng }, html: centeredHtml('<div style="width:30px;height:30px;transform:translate(-15px,-30px)"><svg viewBox="0 0 24 24" width="30" height="30"><path fill="#e11d48" stroke="#fff" stroke-width="1.6" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></div>'), width: 2, height: 2, fitbounds: false }); } catch { /* ignore */ }
          if (navigator.geolocation) {
            let dot = null;
            watchId = navigator.geolocation.watchPosition((p) => {
              if (!isMounted) return;
              const here = { lat: p.coords.latitude, lng: p.coords.longitude };
              try {
                if (!dot) dot = new mappls.Marker({ map, position: here, html: centeredHtml('<div style="width:16px;height:16px;transform:translate(-8px,-8px);border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,.3)"></div>'), width: 2, height: 2, fitbounds: false });
                else dot.setPosition(here);
              } catch { /* ignore */ }
            }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
          }
          stopLive = () => { if (watchId != null) navigator.geolocation.clearWatch(watchId); };
        };
        let ready = false;
        const once = () => { if (!ready) { ready = true; onReady(); } };
        if (map.isStyleLoaded?.()) once(); else { map.addListener?.('load', once); setTimeout(() => { if (map.isStyleLoaded?.()) once(); }, 2500); }
      } catch {
        await loadFallbackLeaflet();
      }
    }

    const timer = setTimeout(init, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopLive?.();
      if (mapplsMapRef.current) {
        try { mapplsMapRef.current.remove(); } catch {}
        mapplsMapRef.current = null;
      }
    };
  }, [lat, lng]);

  if (!ticket) return null;

  const modalNode = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-fadeIn" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="min-w-0 pr-3">
            <span
              title={`Full ID: ${ticket.id}`}
              className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400"
            >
              {shortTicketId(ticket)}
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
            <>
              <div ref={mapContainerRef} className="w-full h-full" />
              {mapError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center p-6 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <MapPin className="w-7 h-7 text-rose-500" />
                  <span className="font-bold">Map unavailable</span>
                  <span>{mapError}</span>
                </div>
              )}
            </>
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

  return typeof document !== 'undefined'
    ? createPortal(modalNode, document.body)
    : modalNode;
}
