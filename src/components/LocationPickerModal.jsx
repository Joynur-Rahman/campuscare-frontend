import { useEffect, useRef, useState } from 'react';
import {
  createMapplsMap,
  addMapplsPin,
  addCampusOverlay,
  buildingLabelHtml,
  ticketDotHtml,
  removeMarker,
  extractLatLng,
  IIITG_CENTER,
  IIITG_ZOOM,
} from '../lib/mappls.js';
import {
  IIITG_CAMPUS_POLYGON,
  CAMPUS_LANDMARKS,
  fetchOsmCampusLandmarks,
} from '../lib/campus.js';
import { loadLeaflet } from '../lib/leafletFallback.js';

/**
 * Modal allowing a user to drop/drag a dot marker on the IIIT Guwahati campus map
 * or pick a known campus building preset (verified with Google Maps Plus Codes & OSM).
 */
export default function LocationPickerModal({
  open,
  onClose,
  onConfirm,
  initialCoords,
  initialLocation = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [engine, setEngine] = useState('esri');
  const [landmarks, setLandmarks] = useState(CAMPUS_LANDMARKS);
  const [coords, setCoords] = useState(
    initialCoords?.lat && initialCoords?.lng ? initialCoords : IIITG_CENTER
  );
  const [label, setLabel] = useState(initialLocation || '');
  const [mapReady, setMapReady] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCoords(
      initialCoords?.lat && initialCoords?.lng ? initialCoords : IIITG_CENTER
    );
    setLabel(initialLocation || '');
    fetchOsmCampusLandmarks().then((list) => {
      if (Array.isArray(list) && list.length > 0) setLandmarks(list);
    });
  }, [open, initialCoords, initialLocation]);

  // Initialize map when modal opens or engine switches
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let cleanupOverlay = null;
    setMapReady(false);

    const el = containerRef.current;
    if (!el) return;

    if (markerRef.current) {
      removeMarker(markerRef.current);
      markerRef.current = null;
    }
    if (mapRef.current) {
      try {
        if (typeof mapRef.current.remove === 'function') mapRef.current.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    }
    el.innerHTML = '';

    const startCenter =
      initialCoords?.lat && initialCoords?.lng ? initialCoords : IIITG_CENTER;

    const initLeafletSatellite = async (mode) => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !containerRef.current) return;

        const map = L.map(containerRef.current, {
          center: [startCenter.lat, startCenter.lng],
          zoom: 17,
          zoomControl: true,
          attributionControl: false,
        });

        if (mode === 'google-hybrid') {
          L.tileLayer('https://mt1.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}', {
            maxZoom: 20,
          }).addTo(map);
        } else {
          L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19 }
          ).addTo(map);
        }

        // Yellow IIITG campus boundary
        L.polygon(IIITG_CAMPUS_POLYGON, {
          color: '#facc15',
          weight: 2.5,
          opacity: 0.92,
          fillColor: '#facc15',
          fillOpacity: 0.04,
          interactive: false,
        }).addTo(map);

        // Permanent building dot + name labels on roofs
        for (const lm of landmarks) {
          const icon = L.divIcon({
            className: 'iiitg-building-dot-label',
            html: buildingLabelHtml(lm),
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          L.marker([lm.lat, lm.lng], {
            icon,
            interactive: false,
            keyboard: false,
          }).addTo(map);
        }

        // Draggable selected location dot
        const pinIcon = L.divIcon({
          className: 'iiitg-selected-dot',
          html: ticketDotHtml({ color: '#ef4444', size: 18, selected: true }),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([startCenter.lat, startCenter.lng], {
          icon: pinIcon,
          draggable: true,
          zIndexOffset: 1000,
        }).addTo(map);

        marker.on('dragend', () => {
          const p = marker.getLatLng();
          if (p) setCoords({ lat: p.lat, lng: p.lng });
        });

        map.on('click', (e) => {
          if (e?.latlng) {
            const next = { lat: e.latlng.lat, lng: e.latlng.lng };
            setCoords(next);
            marker.setLatLng([next.lat, next.lng]);
          }
        });

        mapRef.current = map;
        markerRef.current = marker;
        setMapReady(true);
        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            /* ignore */
          }
        }, 180);
      } catch {
        // ignore
      }
    };

    const initMappls = async () => {
      try {
        const { mappls, map } = await createMapplsMap(el, {
          center: startCenter,
          zoom: IIITG_ZOOM,
        });
        if (cancelled) return;
        mapRef.current = map;
        cleanupOverlay = addCampusOverlay(mappls, map, { showLabels: true });

        const placePin = (pos) => {
          if (markerRef.current) removeMarker(markerRef.current);
          markerRef.current = addMapplsPin(mappls, map, {
            lat: pos.lat,
            lng: pos.lng,
            color: '#ef4444',
            size: 18,
            selected: true,
            draggable: true,
            onDragEnd: (next) => setCoords(next),
          });
        };

        const onReady = () => {
          if (cancelled) return;
          setMapReady(true);
          placePin(startCenter);
          try {
            map.addListener?.('click', (e) => {
              const p = extractLatLng(e);
              if (p) {
                setCoords(p);
                placePin(p);
              }
            });
          } catch {
            // ignore
          }
        };

        if (map && typeof map.on === 'function') {
          map.on('load', onReady);
          setTimeout(onReady, 700);
        } else {
          onReady();
        }
      } catch {
        if (!cancelled) setEngine('google-hybrid');
      }
    };

    if (engine === 'mappls') {
      initMappls();
    } else {
      initLeafletSatellite(engine);
    }

    return () => {
      cancelled = true;
      if (cleanupOverlay) cleanupOverlay();
      if (markerRef.current) {
        removeMarker(markerRef.current);
        markerRef.current = null;
      }
      if (mapRef.current) {
        try {
          if (typeof mapRef.current.remove === 'function') mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, [open, engine, landmarks]);

  const moveMarkerTo = (next, nextLabel) => {
    setCoords(next);
    if (nextLabel) setLabel(nextLabel);
    try {
      if (engine !== 'mappls' && markerRef.current?.setLatLng) {
        markerRef.current.setLatLng([next.lat, next.lng]);
        mapRef.current?.panTo?.([next.lat, next.lng]);
      } else if (mapRef.current?.setCenter) {
        mapRef.current.setCenter([next.lat, next.lng]);
      }
    } catch {
      // ignore
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        moveMarkerTo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => setGeoBusy(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Pin Issue Location on IIIT Guwahati Campus
            </h3>
            <p className="text-xs text-slate-500">
              Click any building pill below or click directly on a building roof on the map
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs bg-slate-50">
              <button
                type="button"
                onClick={() => setEngine('google-hybrid')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  engine === 'google-hybrid'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Google Hybrid
              </button>
              <button
                type="button"
                onClick={() => setEngine('esri')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  engine === 'esri'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setEngine('mappls')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  engine === 'mappls'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mappls
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg px-1.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick building presets */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-500 shrink-0 mr-1">
            Buildings:
          </span>
          {landmarks.map((lm) => (
            <button
              key={lm.id}
              type="button"
              onClick={() => moveMarkerTo({ lat: lm.lat, lng: lm.lng }, lm.name)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition shrink-0 cursor-pointer ${
                label === lm.name
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: lm.color }}
              />
              {lm.name}
            </button>
          ))}
        </div>

        {/* Map container */}
        <div className="relative isolate z-0 bg-slate-900 h-64 sm:h-80 md:h-96 w-full overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-xs text-white font-medium">
              Loading IIIT Guwahati campus map…
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Building / Room label (e.g. Academic Block - Room 204)"
              className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={geoBusy}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 shrink-0 cursor-pointer"
            >
              {geoBusy ? 'Locating…' : '📍 Use My GPS'}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] text-slate-400 font-mono mr-1">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm?.({
                  lat: coords.lat,
                  lng: coords.lng,
                  location: label,
                });
                onClose?.();
              }}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
