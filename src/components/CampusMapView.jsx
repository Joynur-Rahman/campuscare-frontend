import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Crosshair,
  Flame,
  Filter,
  MapPin,
  Search,
  ChevronRight,
  Navigation,
  X,
  Move,
  Copy,
  RotateCcw,
} from 'lucide-react';
import {
  createMapplsMap,
  addMapplsPin,
  addCampusOverlay,
  buildingLabelHtml,
  ticketDotHtml,
  centeredHtml,
  useSatelliteStyle,
  removeMarker,
  openDirections,
  IIITG_CENTER,
  IIITG_ZOOM,
  BUILDING_NAME_MIN_ZOOM,
} from '../lib/mappls.js';
import {
  IIITG_CAMPUS_POLYGON,
  CAMPUS_LANDMARKS,
  readDeviceGps,
} from '../lib/campus.js';
import { loadLeaflet, enableWheelOnFocus } from '../lib/leafletFallback.js';
import {
  getTicketCoords,
  statusLabel,
  statusStyle,
  ticketLabel,
  shortTicketId,
} from '../lib/ticketUtils.js';
import AssignMenu from './admin/AssignMenu.jsx';

const LANDMARK_STORAGE_KEY = 'cc_iiitg_landmarks_v2';

function loadSavedLandmarks() {
  try {
    const raw = localStorage.getItem(LANDMARK_STORAGE_KEY);
    if (!raw) return CAMPUS_LANDMARKS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return CAMPUS_LANDMARKS;
    return CAMPUS_LANDMARKS.map((def) => {
      const hit = parsed.find((p) => p.id === def.id);
      return hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)
        ? { ...def, lat: Number(hit.lat), lng: Number(hit.lng) }
        : def;
    });
  } catch {
    return CAMPUS_LANDMARKS;
  }
}

/**
 * Determine category color, key & label for a ticket dot marker.
 * Uses strict word-boundary matching for 'IT' so words like "Security" or "Found item"
 * never falsely match "it".
 */
export function getTicketCategoryMeta(t) {
  const str = `${t?.category || ''} ${t?.subCategory || ''} ${t?.categoryDisplay || ''} ${t?.category_name || ''} ${t?.department_name || ''} ${t?.title || ''}`.toLowerCase();
  if (str.includes('lost') || str.includes('found')) {
    return { key: 'lostfound', label: 'Lost & Found', short: 'Lost & Found', icon: '🔍', color: '#a855f7' };
  }
  if (str.includes('secur') || str.includes('guard') || str.includes('safety')) {
    return { key: 'security', label: 'Security', short: 'Security', icon: '🛡️', color: '#ef4444' };
  }
  if (str.includes('water') || str.includes('plumb') || str.includes('leak') || str.includes('pipe') || str.includes('washroom') || str.includes('dispenser')) {
    return { key: 'water', label: 'Water & Plumbing', short: 'Water', icon: '💧', color: '#06b6d4' };
  }
  if (str.includes('electr') || str.includes('power') || str.includes('light') || str.includes('fan') || str.includes('ac') || str.includes('socket')) {
    return { key: 'electrical', label: 'Electrical', short: 'Electrical', icon: '⚡', color: '#f59e0b' };
  }
  if (/\bit\b/.test(str) || str.includes('wifi') || str.includes('wi-fi') || str.includes('network') || str.includes('internet') || str.includes('lan') || str.includes('projector')) {
    return { key: 'it', label: 'IT & Network', short: 'IT', icon: '💻', color: '#3b82f6' };
  }
  if (str.includes('clean') || str.includes('housekeep') || str.includes('garbage') || str.includes('sanit') || str.includes('mess')) {
    return { key: 'housekeeping', label: 'Housekeeping', short: 'Cleaning', icon: '🧹', color: '#10b981' };
  }
  if (str.includes('carpentr') || str.includes('civil') || str.includes('door') || str.includes('window') || str.includes('furniture')) {
    return { key: 'civil', label: 'Civil & Carpentry', short: 'Civil', icon: '🪚', color: '#f97316' };
  }
  return { key: 'general', label: 'General Maintenance', short: 'Other', icon: '🔧', color: '#ec4899' };
}

const isResolved = (t) =>
  ['resolved', 'done', 'fixed', 'closed'].includes(String(t?.status || '').toLowerCase().trim());
const isUnassigned = (t) => !t?.assignedTo && !t?.assigned_to && !isResolved(t);
const isUrgent = (t) =>
  !isResolved(t) &&
  (String(t?.priority || t?.urgency || '').toLowerCase() === 'high' ||
    String(t?.priority || t?.urgency || '').toLowerCase() === 'critical' ||
    Boolean(t?.urgent) ||
    String(t?.status || '').toLowerCase() === 'escalated');

const CATEGORY_TABS = [
  { key: 'all', label: 'All', dot: null },
  { key: 'it', label: 'IT', dot: '#3b82f6' },
  { key: 'electrical', label: 'Electrical', dot: '#f59e0b' },
  { key: 'water', label: 'Water', dot: '#06b6d4' },
  { key: 'security', label: 'Security', dot: '#ef4444' },
  { key: 'lostfound', label: 'Lost & Found', dot: '#a855f7' },
];

/**
 * Interactive IIIT Guwahati Campus Map + Split-View Triage Command Center.
 * - Uses modern Esri World Imagery Satellite by default (where all IIITG buildings are completed).
 * - Marks all 12 IIIT Guwahati campus buildings with permanent dot+name labels (`• Building Name`) on roofs.
 * - Includes an interactive "Calibrate Dots" drag mode for Admins to fine-tune any building dot directly on the roof.
 * - Strictly isolates map z-index (`isolate relative z-0`) so map buttons (`My GPS`, zoom, badges)
 *   NEVER collide with top navbar Notifications / Messages popovers or modals.
 */
export default function CampusMapView({
  tickets = [],
  techs = [],
  onSelectTicket,
  fill = false,
  height = 480,
}) {
  const isAdminView = Boolean(techs && techs.length > 0);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapplsRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const buildingMarkersRef = useRef([]);
  const gpsMarkerRef = useRef(null);

  // MapmyIndia only
  const engine = 'mappls';
  const [mapError, setMapError] = useState('');
  const [landmarks, setLandmarks] = useState(loadSavedLandmarks);
  const [calibrateMode, setCalibrateMode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all'); // 'all' | 'unassigned' | 'active' | 'urgent'
  const [searchQuery, setSearchQuery] = useState('');
  const [showBuildingNames, setShowBuildingNames] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsToast, setGpsToast] = useState('');

  // Enrich tickets with category metadata & snapped building roof coordinates
  const enrichedTickets = useMemo(() => {
    const raw = (tickets || []).map((t) => {
      const baseCoords = getTicketCoords(t);
      // If ticket matched a landmark ID/name, use the latest calibrated landmark position
      let coords = baseCoords;
      if (baseCoords?.buildingName) {
        const cal = landmarks.find((lm) => lm.name === baseCoords.buildingName);
        if (cal) coords = { lat: cal.lat, lng: cal.lng, buildingName: cal.name };
      }
      const cat = getTicketCategoryMeta(t);
      return {
        ...t,
        _coords: coords,
        _cat: cat,
      };
    });

    const bySpot = new Map();
    raw.forEach((t) => {
      if (!t._coords) return;
      const key = `${t._coords.lat.toFixed(4)},${t._coords.lng.toFixed(4)}`;
      if (!bySpot.has(key)) bySpot.set(key, []);
      bySpot.get(key).push(t);
    });

    return raw.map((t) => {
      if (!t._coords) return t;
      const key = `${t._coords.lat.toFixed(4)},${t._coords.lng.toFixed(4)}`;
      const group = bySpot.get(key) || [t];
      const idx = group.indexOf(t);
      // First issue at a spot sits as a small badge just above-left of the building dot
      // (its name stays readable); further issues there fan out in a tight ring.
      if (group.length === 1 || idx === 0) {
        return { ...t, _displayCoords: { lat: t._coords.lat, lng: t._coords.lng }, _badge: Boolean(t._coords.buildingName) };
      }
      const others = group.length - 1;
      const angle = (2 * Math.PI * (idx - 1)) / others - Math.PI / 2;
      const radius = 0.0001 + Math.floor((idx - 1) / 6) * 0.00005;
      return {
        ...t,
        _displayCoords: {
          lat: t._coords.lat + Math.sin(angle) * radius,
          lng: t._coords.lng + Math.cos(angle) * radius,
        },
      };
    });
  }, [tickets, landmarks]);

  // Filter by top Category bar
  const catFiltered = useMemo(() => {
    if (catFilter === 'all') return enrichedTickets;
    return enrichedTickets.filter((t) => t._cat.key === catFilter);
  }, [enrichedTickets, catFilter]);

  // Filter for right-hand queue + map pins
  const visibleTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catFiltered.filter((t) => {
      if (queueFilter === 'unassigned' && !isUnassigned(t)) return false;
      if (queueFilter === 'active' && isResolved(t)) return false;
      if (queueFilter === 'urgent' && !isUrgent(t)) return false;
      if (!q) return true;
      const hay = `${t.id || ''} ${t.title || ''} ${t.category || ''} ${t.subCategory || ''} ${t.location || ''} ${t.assignedToName || ''} ${t.description || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [catFiltered, queueFilter, searchQuery]);

  const pinnedTickets = useMemo(
    () => visibleTickets.filter((t) => Boolean(t._displayCoords)),
    [visibleTickets]
  );

  const unassignedCount = useMemo(
    () => catFiltered.filter(isUnassigned).length,
    [catFiltered]
  );
  const activeCount = useMemo(
    () => catFiltered.filter((t) => !isResolved(t)).length,
    [catFiltered]
  );
  const urgentCount = useMemo(
    () => catFiltered.filter(isUrgent).length,
    [catFiltered]
  );

  const selectedTicket = useMemo(
    () => visibleTickets.find((t) => t.id === selectedId) || null,
    [visibleTickets, selectedId]
  );

  // Initialize Esri Satellite, Google Hybrid, or Mappls map
  useEffect(() => {
    let cancelled = false;
    let cleanupOverlay = null;
    setMapReady(false);

    const el = containerRef.current;
    if (!el) return;

    markersRef.current.forEach(removeMarker);
    markersRef.current = [];
    buildingMarkersRef.current.forEach(removeMarker);
    buildingMarkersRef.current = [];
    if (gpsMarkerRef.current) {
      removeMarker(gpsMarkerRef.current);
      gpsMarkerRef.current = null;
    }

    if (mapRef.current) {
      try {
        if (typeof mapRef.current.remove === 'function') mapRef.current.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    }
    mapplsRef.current = null;
    leafletRef.current = null;
    el.innerHTML = '';

    const initLeafletSatellite = async (mode) => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !containerRef.current) return;

        const map = L.map(containerRef.current, {
          scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: !L.Browser.mobile,
          center: [IIITG_CENTER.lat, IIITG_CENTER.lng],
          zoom: 17,
          zoomControl: false,
          attributionControl: false,
        });
        enableWheelOnFocus(L, map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

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

        L.polygon(IIITG_CAMPUS_POLYGON, {
          color: '#facc15',
          weight: 2.5,
          opacity: 0.92,
          fillColor: '#facc15',
          fillOpacity: 0.04,
          interactive: false,
        }).addTo(map);

        leafletRef.current = L;
        mapRef.current = map;
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
          center: IIITG_CENTER,
          zoom: IIITG_ZOOM,
        });
        if (cancelled) return;
        mapplsRef.current = mappls;
        mapRef.current = map;
        useSatelliteStyle(mappls, map);
        cleanupOverlay = addCampusOverlay(mappls, map, { showLabels: false });
        const markReady = () => {
          if (!cancelled) setMapReady(true);
        };
        if (map && typeof map.on === 'function') {
          map.on('load', markReady);
          setTimeout(markReady, 700);
        } else {
          markReady();
        }
      } catch {
        if (!cancelled) setMapError('MapmyIndia map could not be loaded — check your internet connection and refresh.');
      }
    };

    setMapError('');
    initMappls();

    return () => {
      cancelled = true;
      if (cleanupOverlay) cleanupOverlay();
      markersRef.current.forEach(removeMarker);
      markersRef.current = [];
      buildingMarkersRef.current.forEach(removeMarker);
      buildingMarkersRef.current = [];
      if (gpsMarkerRef.current) {
        removeMarker(gpsMarkerRef.current);
        gpsMarkerRef.current = null;
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
  }, [engine]);

  // Render IIIT Guwahati building dot + name labels (`• Academic Building`, `• Boys' Hostel`, etc.)
  // When `calibrateMode` is ON, building dots become draggable so Admin can fine-tune any roof label!
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    buildingMarkersRef.current.forEach(removeMarker);
    buildingMarkersRef.current = [];

    if (!showBuildingNames) return;

    const map = mapRef.current;
    const L = leafletRef.current;
    const mappls = mapplsRef.current;

    for (const lm of landmarks) {
      try {
        if (engine !== 'mappls' && L) {
          const pillHtml = calibrateMode
            ? buildingLabelHtml(lm).replace(
                'pointer-events:none;',
                'pointer-events:auto;cursor:grab;outline:1.5px dashed #facc15;'
              )
            : buildingLabelHtml(lm);

          const icon = L.divIcon({
            className: 'iiitg-building-dot-label',
            html: pillHtml,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          const m = L.marker([lm.lat, lm.lng], {
            icon,
            interactive: calibrateMode,
            draggable: calibrateMode,
            keyboard: false,
            zIndexOffset: calibrateMode ? 1200 : 100,
          }).addTo(map);

          if (calibrateMode) {
            m.on('dragend', () => {
              const pos = m.getLatLng();
              if (!pos) return;
              setLandmarks((prev) => {
                const next = prev.map((item) =>
                  item.id === lm.id
                    ? {
                        ...item,
                        lat: Number(pos.lat.toFixed(5)),
                        lng: Number(pos.lng.toFixed(5)),
                      }
                    : item
                );
                try {
                  localStorage.setItem(LANDMARK_STORAGE_KEY, JSON.stringify(next));
                } catch {}
                return next;
              });
            });
          }

          buildingMarkersRef.current.push(m);
        } else if (engine === 'mappls' && mappls) {
          const m = new mappls.Marker({
            map,
            position: { lat: lm.lat, lng: lm.lng },
            html: centeredHtml(buildingLabelHtml(lm)),
            width: 2,
            height: 2,
            draggable: calibrateMode,
            fitbounds: false,
          });
          if (calibrateMode) {
            m.addListener?.('dragend', () => {
              const pos = m.getPosition?.();
              if (!pos) return;
              setLandmarks((prev) => {
                const next = prev.map((item) =>
                  item.id === lm.id ? { ...item, lat: Number(Number(pos.lat).toFixed(6)), lng: Number(Number(pos.lng).toFixed(6)) } : item
                );
                try { localStorage.setItem(LANDMARK_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
                return next;
              });
            });
          }
          buildingMarkersRef.current.push(m);
        }
      } catch {
        // ignore
      }
    }

    // Building names appear once zoomed in (dots are always shown); always on while adjusting
    const box = containerRef.current;
    const syncNames = () => {
      try {
        box?.classList.toggle('cc-names-on', calibrateMode || (map.getZoom?.() ?? 0) >= BUILDING_NAME_MIN_ZOOM);
      } catch { /* ignore */ }
    };
    syncNames();
    try { map.on?.('zoomend', syncNames); map.on?.('zoom', syncNames); } catch { /* ignore */ }
    return () => {
      try { map.off?.('zoomend', syncNames); map.off?.('zoom', syncNames); } catch { /* ignore */ }
    };
  }, [mapReady, engine, showBuildingNames, landmarks, calibrateMode]);

  // Render clean colored issue dots (`•`) on the map
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    markersRef.current.forEach(removeMarker);
    markersRef.current = [];

    const map = mapRef.current;
    const L = leafletRef.current;
    const mappls = mapplsRef.current;

    pinnedTickets.forEach((t) => {
      const { lat, lng } = t._displayCoords;
      const isSelected = t.id === selectedId;
      const dotColor = t._cat.color;

      try {
        if (engine !== 'mappls' && L) {
          const html = ticketDotHtml({
            color: dotColor,
            size: isUrgent(t) ? 17 : 15,
            selected: isSelected,
          });

          const icon = L.divIcon({
            className: 'iiitg-ticket-dot-pin',
            html,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          const marker = L.marker([lat, lng], {
            icon,
            title: `${ticketLabel(t)} (${t.location || 'Campus'})`,
            zIndexOffset: isSelected ? 900 : 400,
          }).addTo(map);

          marker.bindTooltip(
            `<div style="font-family:Inter,system-ui,sans-serif;font-size:11.5px;line-height:1.35;padding:2px 4px;">
              <div style="font-weight:700;color:#0f172a;">${String(ticketLabel(t)).replace(/</g, '&lt;')}</div>
              <div style="color:#475569;font-size:10.5px;">📍 ${String(t.location || t._coords?.buildingName || 'Campus').replace(/</g, '&lt;')} · <span style="color:${dotColor};font-weight:700;">${t._cat.short}</span></div>
            </div>`,
            { direction: 'top', offset: [0, -8], opacity: 0.96 }
          );

          marker.on('click', () => setSelectedId(t.id));
          markersRef.current.push(marker);
        } else if (engine === 'mappls' && mappls) {
          const marker = addMapplsPin(mappls, map, {
            lat,
            lng,
            color: dotColor,
            size: isUrgent(t) ? 17 : 15,
            selected: isSelected,
            // On a named building: sit just above-left of the building dot so its name stays readable
            nudge: t._badge ? [-11, -13] : [0, 0],
            title: `${ticketLabel(t)} (${t.location || 'Campus'})`,
            onClick: () => setSelectedId(t.id),
          });
          markersRef.current.push(marker);
        }
      } catch {
        // ignore single marker failure
      }
    });
  }, [pinnedTickets, mapReady, engine, selectedId]);

  const focusTicketOnMap = (t) => {
    setSelectedId(t.id);
    const c = t._displayCoords || t._coords;
    if (!c || !mapRef.current) return;
    try {
      if (engine !== 'mappls' && typeof mapRef.current.flyTo === 'function') {
        mapRef.current.flyTo([c.lat, c.lng], 18, { duration: 0.5 });
      } else if (typeof mapRef.current.setCenter === 'function') {
        mapRef.current.setCenter({ lat: c.lat, lng: c.lng }); mapRef.current.setZoom?.(18);
      }
    } catch {
      // ignore
    }
  };

  const handleMyGps = async () => {
    if (gpsBusy) return;
    setGpsBusy(true);
    setGpsToast('');
    try {
      const fix = await readDeviceGps(8000);
      const map = mapRef.current;
      const L = leafletRef.current;
      if (gpsMarkerRef.current) {
        removeMarker(gpsMarkerRef.current);
        gpsMarkerRef.current = null;
      }
      if (engine !== 'mappls' && L && map) {
        const icon = L.divIcon({
          className: 'iiitg-user-gps-dot',
          html: ticketDotHtml({ color: '#2563eb', size: 16, selected: true }),
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        gpsMarkerRef.current = L.marker([fix.lat, fix.lng], {
          icon,
          title: 'Your GPS Location',
          zIndexOffset: 950,
        }).addTo(map);
        map.flyTo([fix.lat, fix.lng], 17, { duration: 0.6 });
      } else if (map?.setCenter) {
        map.setCenter({ lat: fix.lat, lng: fix.lng });
      }
      setGpsToast('Centered on your GPS');
      setTimeout(() => setGpsToast(''), 2500);
    } catch {
      const map = mapRef.current;
      if (engine !== 'mappls' && map?.setView) {
        map.setView([IIITG_CENTER.lat, IIITG_CENTER.lng], 17, { animate: true });
      } else if (map?.setCenter) {
        map.setCenter({ lat: IIITG_CENTER.lat, lng: IIITG_CENTER.lng });
      }
      setGpsToast('Centered on IIITG Campus');
      setTimeout(() => setGpsToast(''), 2500);
    } finally {
      setGpsBusy(false);
    }
  };

  const copyLandmarksCode = () => {
    const code =
      'export const CAMPUS_LANDMARKS = [\n' +
      landmarks
        .map(
          (l) =>
            `  { id: '${l.id}', name: ${JSON.stringify(l.name)}, lat: ${l.lat}, lng: ${l.lng}, color: '${l.color}' },`
        )
        .join('\n') +
      '\n];';
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const resetLandmarks = () => {
    try {
      localStorage.removeItem(LANDMARK_STORAGE_KEY);
    } catch {}
    setLandmarks(CAMPUS_LANDMARKS);
  };

  const queueTabs = isAdminView
    ? [
        { key: 'all', label: `All (${catFiltered.length})` },
        { key: 'unassigned', label: `Unassigned (${unassignedCount})` },
        { key: 'urgent', label: `Urgent (${urgentCount})` },
      ]
    : [
        { key: 'all', label: `All (${catFiltered.length})` },
        { key: 'active', label: `Open (${activeCount})` },
        { key: 'urgent', label: `Urgent (${urgentCount})` },
      ];

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-[#121417] border border-[#d6ded7] dark:border-[#2a2e35] shadow-xs overflow-hidden flex flex-col ${
        fill ? 'lg:h-full lg:min-h-0' : ''
      }`}
    >
      {/* ── Top Category Filter Strip ── */}
      <div className="shrink-0 px-3.5 py-2 border-b border-slate-100 dark:border-[#212429] flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 dark:bg-[#101113]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
            <Filter className="w-3 h-3" /> Category:
          </span>
          {CATEGORY_TABS.map((tab) => {
            const active = catFilter === tab.key;
            const count =
              tab.key === 'all'
                ? enrichedTickets.length
                : enrichedTickets.filter((t) => t._cat.key === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCatFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#2f4e56] text-white border-[#2f4e56] dark:bg-white dark:text-black dark:border-white shadow-2xs'
                    : 'bg-white dark:bg-[#161618] text-slate-700 dark:text-white border-slate-200 dark:border-[#212124] hover:bg-slate-100'
                }`}
              >
                {tab.dot && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/80"
                    style={{ backgroundColor: tab.dot }}
                  />
                )}
                <span>
                  {tab.label}
                  {tab.key === 'all' ? ` (${count})` : count > 0 ? ` (${count})` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Map Controls: Layer Switcher + Building Dots Toggle + Admin Drag-to-Calibrate */}
        <div className="flex items-center gap-1.5 flex-wrap max-w-full min-w-0">


          <button
            type="button"
            onClick={() => setShowBuildingNames((v) => !v)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
              showBuildingNames
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-700 dark:border-emerald-500'
                : 'bg-white dark:bg-[#17191d] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#2b2f36]'
            }`}
            title="Show or hide building markers"
          >
            {showBuildingNames ? 'Hide buildings' : 'Show buildings'}
          </button>

          {isAdminView && (
            <button
              type="button"
              onClick={() => {
                setShowBuildingNames(true);
                setCalibrateMode((v) => !v);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                calibrateMode
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-[#17191d] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#2b2f36] hover:bg-slate-100'
              }`}
              title="Drag buildings to correct their position"
            >
              <Move className="w-3 h-3" />
              <span>{calibrateMode ? 'Done' : 'Adjust buildings'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Calibration Helper Banner (shown only when Calibrate Roof Dots is active) */}
      {calibrateMode && (
        <div className="shrink-0 px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
          <span className="font-semibold">
            <strong>Adjust buildings:</strong> drag a building onto its roof. Changes save automatically.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyLandmarksCode}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedCode ? 'Copied campus.js!' : 'Copy campus.js coords'}</span>
            </button>
            <button
              type="button"
              onClick={resetLandmarks}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 text-amber-900 dark:text-amber-200 text-[11px] font-bold hover:bg-amber-100/60 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset defaults
            </button>
          </div>
        </div>
      )}

      {/* ── Main Split Body: Map (Left) + Actionable Triage Queue (Right) ── */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 ${
          fill ? 'lg:flex-1 lg:min-h-0' : ''
        }`}
      >
        {/* LEFT: Strictly isolated map stacking context (`isolate relative z-0`) so map controls NEVER overlap navbar dropdowns */}
        <div
          className="lg:col-span-7 relative isolate z-0 bg-slate-900 overflow-hidden h-[360px] sm:h-[440px] lg:h-auto min-h-[340px] lg:min-h-0"
          style={fill ? { isolation: 'isolate' } : { height, isolation: 'isolate' }}
        >
          <div ref={containerRef} className="w-full h-full relative z-0" />
          {mapError && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 p-6 text-center bg-slate-100 dark:bg-[#101113]">
              <MapPin className="w-7 h-7 text-rose-500" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Map unavailable</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs">{mapError}</p>
            </div>
          )}

          {/* Top overlay bar inside isolated map (z-20 inside z-0 container -> never collides with header popovers!) */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-md border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100">
              <Compass className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
Satellite
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                {pinnedTickets.length} {pinnedTickets.length === 1 ? 'issue' : 'issues'}
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              {gpsToast && (
                <span className="px-2.5 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-semibold shadow">
                  {gpsToast}
                </span>
              )}
              <button
                type="button"
                onClick={handleMyGps}
                disabled={gpsBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-bold shadow-md border border-slate-200/80 dark:border-slate-700 transition cursor-pointer active:scale-95"
                title="Locate my GPS or recenter on IIIT Guwahati"
              >
                <Crosshair className={`w-3.5 h-3.5 text-emerald-600 ${gpsBusy ? 'animate-spin' : ''}`} />
                <span>{gpsBusy ? 'Locating…' : 'My GPS'}</span>
              </button>
            </div>
          </div>

          {!mapReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs text-xs text-white font-semibold">
              Loading IIIT Guwahati campus satellite map…
            </div>
          )}

          {/* Selected ticket floating card at bottom of map */}
          {selectedTicket && (
            <div className="absolute bottom-3 left-3 right-12 sm:right-auto sm:w-96 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedTicket._cat.color }}
                    />
                    <span
                      title={`Full ID: ${selectedTicket.id}`}
                      className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400"
                    >
                      {shortTicketId(selectedTicket)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle(
                        selectedTicket
                      )}`}
                    >
                      {statusLabel(selectedTicket)}
                    </span>
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white mt-1 truncate">
                    {ticketLabel(selectedTicket)}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                    📍 {selectedTicket.location || selectedTicket._coords?.buildingName || 'IIITG Campus'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                {selectedTicket._coords && (
                  <button
                    type="button"
                    onClick={() =>
                      openDirections(
                        selectedTicket._coords.lat,
                        selectedTicket._coords.lng,
                        ticketLabel(selectedTicket)
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Navigation className="w-3 h-3" /> Directions
                  </button>
                )}
                {onSelectTicket && (
                  <button
                    type="button"
                    onClick={() => onSelectTicket(selectedTicket)}
                    className="ml-auto px-2.5 py-1 rounded-lg bg-[#2f4e56] hover:bg-[#253f46] text-white text-[11px] font-bold cursor-pointer"
                  >
                    Open Ticket →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Live Triage Queue */}
        <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-[#212429] flex flex-col bg-slate-50/40 dark:bg-[#101114] min-h-[320px] lg:min-h-0">
          {/* Queue filter tabs + search */}
          <div className="p-3 border-b border-slate-200/70 dark:border-[#212429] space-y-2 shrink-0 bg-white dark:bg-[#121417]">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0f1012] p-1 rounded-xl">
              {queueTabs.map((tab) => {
                const active = queueFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setQueueFilter(tab.key)}
                    className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      active
                        ? 'bg-[#2f4e56] text-white shadow-2xs dark:bg-white dark:text-black'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, building, room, issue..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-[#2b2f36] bg-slate-50/70 dark:bg-[#0f1012] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2f4e56]/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Scrollable ticket cards */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-[420px] lg:max-h-none">
            {visibleTickets.map((t) => {
              const active = t.id === selectedId;
              const urgent = isUrgent(t);
              const assignedName = t.assignedToName || t.acknowledged_name || '';

              return (
                <div
                  key={t.id}
                  onClick={() => focusTicketOnMap(t)}
                  className={`p-3 rounded-xl border transition cursor-pointer bg-white dark:bg-[#15171a] ${
                    active
                      ? 'border-[#2f4e56] ring-2 ring-[#2f4e56]/15 dark:border-indigo-400'
                      : 'border-slate-200/90 dark:border-[#272b31] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white shadow-2xs"
                        style={{ backgroundColor: t._cat.color }}
                        title={t._cat.label}
                      />
                      <span
                        title={`Full ID: ${t.id}`}
                        className="font-mono text-xs font-extrabold text-slate-700 dark:text-slate-200"
                      >
                        {shortTicketId(t)}
                      </span>
                      {urgent && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                          <Flame className="w-3 h-3" /> URGENT
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusStyle(
                        t
                      )}`}
                    >
                      {statusLabel(t)}
                    </span>
                  </div>

                  <p className="text-xs font-extrabold text-slate-900 dark:text-white mt-1.5 truncate">
                    {ticketLabel(t)}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#212429] flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-300 truncate min-w-0">
                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                      <span className="truncate">
                        {t.location || t._coords?.buildingName || 'IIITG Campus'}
                      </span>
                    </span>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {assignedName && (!isAdminView || isResolved(t)) && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          {assignedName}
                        </span>
                      )}
                      {isAdminView && !isResolved(t) && (
                        <AssignMenu ticket={t} techs={techs} />
                      )}
                      {onSelectTicket && (
                        <button
                          type="button"
                          onClick={() => onSelectTicket(t)}
                          className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#2f4e56] dark:hover:text-indigo-300 px-1.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <span>Open</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleTickets.length === 0 && (
              <div className="py-12 px-4 text-center text-xs text-slate-400">
                No tickets match the current filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
