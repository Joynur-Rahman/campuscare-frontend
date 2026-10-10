import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MapPin, 
  Crosshair, 
  Loader2, 
  Plus, 
  ExternalLink, 
  Compass, 
  KeyRound, 
  Check, 
  Info,
  X,
  Search,
  ChevronRight,
  Navigation,
  ListFilter
} from 'lucide-react';
import { 
  loadMapplsSdk, 
  reverseGeocode, 
  DEFAULT_CAMPUS_LOCATION, 
  CAMPUS_PRESETS,
  getMapplsKey, 
  setMapplsKey 
} from '../lib/mappls.js';
import { ticketLabel, statusStyle, statusLabel, getTicketCoords, cleanDescription } from '../lib/ticketUtils.js';

// Category color and icon configuration
const CATEGORY_META = {
  it: { label: 'IT & Network', color: '#2563eb', bg: 'bg-blue-50 text-blue-700 border-blue-200', emoji: '💻' },
  electrical: { label: 'Electrical', color: '#d97706', bg: 'bg-amber-50 text-amber-700 border-amber-200', emoji: '⚡' },
  water: { label: 'Water & Plumbing', color: '#0284c7', bg: 'bg-sky-50 text-sky-700 border-sky-200', emoji: '💧' },
  security: { label: 'Security', color: '#dc2626', bg: 'bg-rose-50 text-rose-700 border-rose-200', emoji: '🛡️' },
  lost: { label: 'Lost & Found', color: '#7c3aed', bg: 'bg-purple-50 text-purple-700 border-purple-200', emoji: '🔍' },
  default: { label: 'General Issue', color: '#e11d48', bg: 'bg-rose-50 text-rose-700 border-rose-200', emoji: '📍' },
};

function getTicketCategoryMeta(t) {
  const str = `${t?.category || ''} ${t?.categoryDisplay || ''} ${t?.title || ''}`.toLowerCase();
  if (str.includes('it') || str.includes('wi-fi') || str.includes('wifi') || str.includes('network') || str.includes('internet')) return CATEGORY_META.it;
  if (str.includes('elec') || str.includes('fan') || str.includes('light') || str.includes('power')) return CATEGORY_META.electrical;
  if (str.includes('water') || str.includes('plumb') || str.includes('leak') || str.includes('tap') || str.includes('washroom')) return CATEGORY_META.water;
  if (str.includes('lost') || str.includes('found')) return CATEGORY_META.lost;
  if (str.includes('secur') || str.includes('gate') || str.includes('guard')) return CATEGORY_META.security;
  return CATEGORY_META.default;
}

// Resolve ticket location to coordinates if not explicitly set
function resolveTicketCoords(ticket) {
  const extracted = getTicketCoords(ticket);
  if (extracted) return extracted;
  const loc = (ticket?.location || '').toLowerCase();
  if (loc.includes('hostel') || loc.includes('room')) {
    return { lat: 26.0815, lng: 91.5595 };
  }
  if (loc.includes('library')) {
    return { lat: 26.0828, lng: 91.5602 };
  }
  if (loc.includes('academic') || loc.includes('class') || loc.includes('lab') || loc.includes('a-110')) {
    return { lat: 26.0833, lng: 91.5612 };
  }
  if (loc.includes('canteen') || loc.includes('mess') || loc.includes('cafe')) {
    return { lat: 26.0822, lng: 91.5600 };
  }
  if (loc.includes('admin') || loc.includes('office')) {
    return { lat: 26.0837, lng: 91.5620 };
  }
  if (loc.includes('sports') || loc.includes('ground') || loc.includes('gym')) {
    return { lat: 26.0808, lng: 91.5615 };
  }
  // Slight jitter around default campus center so markers don't overlap completely
  const hash = (ticket?.id || 't').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const offsetLat = ((hash % 10) - 5) * 0.0003;
  const offsetLng = (((hash >> 2) % 10) - 5) * 0.0003;
  return { 
    lat: DEFAULT_CAMPUS_LOCATION.lat + offsetLat, 
    lng: DEFAULT_CAMPUS_LOCATION.lng + offsetLng 
  };
}

export default function CampusMapView({ 
  tickets = [], 
  onSelectTicket, 
  onRequestReport 
}) {
  const [mapEngine, setMapEngine] = useState('loading'); // 'mappls' | 'fallback'
  const [activeKey, setActiveKey] = useState(getMapplsKey());
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState(activeKey);
  const [keySaved, setKeySaved] = useState(false);

  const [selectedPin, setSelectedPin] = useState(null); // ticket or custom pinned spot
  const [detectingGps, setDetectingGps] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTicketId, setActiveTicketId] = useState(null);

  const mapContainerRef = useRef(null);
  const mapplsMapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);

  // Filter tickets matching category and optional search text
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (categoryFilter !== 'all') {
        const str = `${t.category || ''} ${t.categoryDisplay || ''} ${t.title || ''} ${t.subCategory || ''}`.toLowerCase();
        if (!str.includes(categoryFilter.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${t.id || ''} ${t.title || ''} ${t.categoryDisplay || ''} ${t.location || ''} ${t.description || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, categoryFilter, searchQuery]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Initialize Map ONCE (only when activeKey changes or on first mount)
  //    This prevents the map from refreshing every 8-10 seconds on ticket polls.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;

      // Clean up previous map instances if any
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch {}
        leafletMapRef.current = null;
      }
      if (mapplsMapRef.current) {
        try { mapplsMapRef.current.remove(); } catch {}
        mapplsMapRef.current = null;
      }
      markersRef.current = [];

      // Try MapmyIndia (Mappls) if key is configured
      if (activeKey) {
        try {
          const mappls = await loadMapplsSdk(activeKey);
          if (!isMounted || !mapContainerRef.current) return;

          const map = new mappls.Map(mapContainerRef.current, {
            center: [DEFAULT_CAMPUS_LOCATION.lat, DEFAULT_CAMPUS_LOCATION.lng],
            zoom: 16,
            zoomControl: true,
            location: true,
          });
          mapplsMapRef.current = map;

          map.addListener('click', async (e) => {
            const lat = e.lngLat ? e.lngLat.lat : e.latlng?.lat;
            const lng = e.lngLat ? e.lngLat.lng : e.latlng?.lng;
            if (lat && lng) {
              const geo = await reverseGeocode(lat, lng, activeKey);
              setSelectedPin({
                type: 'custom',
                lat,
                lng,
                address: geo?.address || `Campus Spot (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
              });
            }
          });

          if (isMounted) setMapEngine('mappls');
          return;
        } catch (err) {
          console.warn('Mappls SDK failed, using OpenStreetMap fallback', err);
        }
      }

      // Fallback: Leaflet + OpenStreetMap with custom SVG markers
      try {
        if (!window.L) {
          await loadLeafletLibrary();
        }
        if (!isMounted || !mapContainerRef.current) return;

        const L = window.L;

        // Configure standard Leaflet icon paths
        if (L.Icon?.Default) {
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });
        }

        const map = L.map(mapContainerRef.current, {
          center: [DEFAULT_CAMPUS_LOCATION.lat, DEFAULT_CAMPUS_LOCATION.lng],
          zoom: 16,
          zoomControl: true,
        });
        leafletMapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        map.on('click', async (e) => {
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;
          const geo = await reverseGeocode(lat, lng, activeKey);
          setSelectedPin({
            type: 'custom',
            lat,
            lng,
            address: geo?.address || `Campus Spot (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
          });
        });

        if (isMounted) setMapEngine('fallback');
      } catch (fErr) {
        console.error('Leaflet map loading error', fErr);
      }
    }

    const timer = setTimeout(initMap, 50);

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
      markersRef.current = [];
    };
  }, [activeKey]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Sync Markers when filteredTickets or mapEngine change.
  //    This updates markers WITHOUT resetting or reloading the map instance!
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Clear previous markers
    markersRef.current.forEach(m => {
      try {
        if (m.remove) m.remove();
        else if (m.removeFrom && leafletMapRef.current) m.removeFrom(leafletMapRef.current);
      } catch {}
    });
    markersRef.current = [];

    // ── Leaflet Engine Markers ──
    if (mapEngine === 'fallback' && leafletMapRef.current && window.L) {
      const L = window.L;
      const map = leafletMapRef.current;

      filteredTickets.forEach((t) => {
        const coords = resolveTicketCoords(t);
        const meta = getTicketCategoryMeta(t);
        const isSelected = activeTicketId === t.id;

        // Custom rich SVG DivIcon with category styling
        const iconHtml = `
          <div class="custom-ticket-pin relative cursor-pointer transform -translate-x-1/2 -translate-y-full transition-transform hover:scale-125" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
            <div style="background-color: ${meta.color}; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff; ${isSelected ? 'box-shadow: 0 0 0 4px #6366f1;' : ''}">
              <span style="transform: rotate(45deg); font-size: 15px; line-height: 1;">${meta.emoji}</span>
            </div>
            ${t.priority === 'High' ? '<span style="position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background-color: #ef4444; border-radius: 50%; border: 2px solid #ffffff;"></span>' : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'ticket-marker-icon',
          html: iconHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        });

        const marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(map);

        marker.bindTooltip(
          `<div style="font-family: inherit; font-size: 11px; padding: 2px 4px;">
            <div style="font-weight: 700; color: #0f172a;">${ticketLabel(t)}</div>
            <div style="color: #64748b; margin-top: 2px;">📍 ${t.location || 'Campus'}</div>
          </div>`,
          { direction: 'top', offset: [0, -32], opacity: 0.95 }
        );

        marker.on('click', () => {
          setActiveTicketId(t.id);
          setSelectedPin({ type: 'ticket', ticket: t, ...coords });
          map.panTo([coords.lat, coords.lng], { animate: true, duration: 0.5 });
        });

        markersRef.current.push(marker);
      });
    }

    // ── MapmyIndia (Mappls) Engine Markers ──
    if (mapEngine === 'mappls' && mapplsMapRef.current && window.mappls) {
      const mappls = window.mappls;
      const map = mapplsMapRef.current;

      filteredTickets.forEach((t) => {
        const coords = resolveTicketCoords(t);
        try {
          const m = new mappls.Marker({
            map,
            position: coords,
          });
          m.addListener('click', () => {
            setActiveTicketId(t.id);
            setSelectedPin({ type: 'ticket', ticket: t, ...coords });
            if (map.setCenter) map.setCenter([coords.lat, coords.lng]);
          });
          markersRef.current.push(m);
        } catch (e) {
          console.warn('Failed to place Mappls marker', e);
        }
      });
    }
  }, [filteredTickets, mapEngine, activeTicketId]);

  // Jump to and highlight a ticket on the map
  function focusTicket(t) {
    const coords = resolveTicketCoords(t);
    setActiveTicketId(t.id);
    setSelectedPin({ type: 'ticket', ticket: t, ...coords });

    if (mapEngine === 'fallback' && leafletMapRef.current) {
      leafletMapRef.current.flyTo([coords.lat, coords.lng], 17, { duration: 0.8 });
    } else if (mapEngine === 'mappls' && mapplsMapRef.current) {
      mapplsMapRef.current.setCenter([coords.lat, coords.lng]);
      mapplsMapRef.current.setZoom(17);
    }
  }

  // GPS Locate User
  function locateUser() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setDetectingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (mapEngine === 'mappls' && mapplsMapRef.current) {
          mapplsMapRef.current.setCenter([lat, lng]);
          mapplsMapRef.current.setZoom(17);
        } else if (leafletMapRef.current && window.L) {
          leafletMapRef.current.flyTo([lat, lng], 17, { duration: 0.8 });
          const L = window.L;
          L.circleMarker([lat, lng], { radius: 8, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.8 }).addTo(leafletMapRef.current);
        }

        const geo = await reverseGeocode(lat, lng, activeKey);
        setSelectedPin({
          type: 'custom',
          lat,
          lng,
          address: geo?.address || `Your Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
          isUserGps: true,
        });
      },
      (err) => {
        setDetectingGps(false);
        alert(err.message || 'Unable to access location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Save MapmyIndia Key
  function saveKey(e) {
    e.preventDefault();
    setMapplsKey(keyInput);
    setActiveKey(keyInput.trim());
    setKeySaved(true);
    setTimeout(() => {
      setKeySaved(false);
      setShowKeyDialog(false);
    }, 1200);
  }

  return (
    <div className="space-y-4">
      {/* ── Top Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          <span className="text-slate-400 dark:text-slate-500 font-bold px-1 text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1">
            <ListFilter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'all', label: `All (${tickets.length})` },
            { id: 'it', label: '💻 IT' },
            { id: 'electrical', label: '⚡ Electrical' },
            { id: 'water', label: '💧 Water' },
            { id: 'security', label: '🛡️ Security' },
            { id: 'lost', label: '🔍 Lost & Found' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs cursor-pointer ${
                categoryFilter === c.id 
                  ? 'bg-iiitg-800 dark:bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Quick Search & Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative min-w-[160px] sm:min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search place or issue…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* GPS Auto-Detect */}
          <button
            type="button"
            onClick={locateUser}
            disabled={detectingGps}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Automatically detect your location"
          >
            {detectingGps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span className="hidden sm:inline">{detectingGps ? 'Locating…' : 'My GPS'}</span>
          </button>

          {/* MapmyIndia Key Config */}
          <button
            type="button"
            onClick={() => setShowKeyDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Configure MapmyIndia Static Key"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">{activeKey ? 'Mappls Active' : 'Set Mappls Key'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Layout: Split View with Interactive Map + Issues Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Container (takes 8 cols on desktop) */}
        <div className="lg:col-span-8 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-950 min-h-[500px]">
          <div 
            ref={mapContainerRef} 
            className="w-full h-[520px] lg:h-[580px] relative z-0"
          />

          {/* Engine Status Badge */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold shadow-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              {mapEngine === 'mappls' ? (
                <span className="text-emerald-600 font-extrabold">MapmyIndia Vector Map</span>
              ) : (
                <span className="text-slate-700 dark:text-slate-300">Campus Interactive Map</span>
              )}
            </span>
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-xs hidden sm:inline">
              {filteredTickets.length} pinned issues
            </span>
          </div>

          {/* Tip Badge */}
          <div className="absolute top-3 right-3 z-10 hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium shadow-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Click any pin to inspect details</span>
          </div>

          {/* Selected Pin Bottom Action Card */}
          {selectedPin && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 animate-slideUp">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] text-slate-400 block">
                      {selectedPin.type === 'ticket' ? selectedPin.ticket.id : 'CAMPUS PIN'}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                      {selectedPin.type === 'ticket' ? ticketLabel(selectedPin.ticket) : 'Selected Location'}
                    </h4>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedPin(null); setActiveTicketId(null); }} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedPin.type === 'ticket' ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {cleanDescription(selectedPin.ticket.description) || 'No additional description provided.'}
                  </p>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                    <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                    <span className="truncate">{selectedPin.ticket.location || 'Campus'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${statusStyle(selectedPin.ticket)}`}>
                      {statusLabel(selectedPin.ticket)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPin.lat},${selectedPin.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1"
                      >
                        <Navigation className="w-3 h-3 text-indigo-500" />
                        <span>Navigate</span>
                      </a>
                      <button
                        onClick={() => onSelectTicket?.(selectedPin.ticket)}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-iiitg-800 hover:bg-iiitg-900 rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        View Ticket
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {selectedPin.address}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-mono text-slate-400">
                      {selectedPin.lat.toFixed(5)}, {selectedPin.lng.toFixed(5)}
                    </span>
                    {onRequestReport && (
                      <button
                        onClick={() => {
                          onRequestReport?.({
                            location: selectedPin.address,
                            lat: selectedPin.lat,
                            lng: selectedPin.lng,
                          });
                          setSelectedPin(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Report Issue Here</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Issues Directory Sidebar (takes 4 cols on desktop) ── */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[520px] lg:h-[580px] overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">Mapped Issues</h3>
              <p className="text-[11px] text-slate-400">Click any issue to focus on map</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              {filteredTickets.length} Total
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                <Compass className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-bold text-slate-600 dark:text-slate-400">No issues found</p>
                <p className="mt-1">Try switching the category filter or search query.</p>
              </div>
            ) : (
              filteredTickets.map(t => {
                const isSelected = activeTicketId === t.id;
                const meta = getTicketCategoryMeta(t);
                const coords = resolveTicketCoords(t);

                return (
                  <div
                    key={t.id}
                    onClick={() => focusTicket(t)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left group ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs ring-1 ring-indigo-400/50'
                        : 'bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{meta.emoji}</span>
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {t.id}
                        </span>
                      </div>
                      <span className={`px-2 py-0.2 text-[10px] font-bold rounded-full border ${statusStyle(t)}`}>
                        {statusLabel(t)}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-snug line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {ticketLabel(t)}
                    </h4>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                      <span className="truncate flex items-center gap-1 max-w-[170px]" title={t.location || 'Campus'}>
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="truncate">{t.location || 'Campus'}</span>
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 text-[10px] group-hover:translate-x-0.5 transition-transform">
                        <span>Fly to</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── MapmyIndia Static Key In-App Setup Modal ── */}
      {showKeyDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={() => setShowKeyDialog(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">MapmyIndia (Mappls) Static Key</h3>
              </div>
              <button onClick={() => setShowKeyDialog(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Copy the <strong>Static Key</strong> from your Mappls Console dashboard (at <code>auth.mappls.com/console</code>) and paste it below. It will activate full MapmyIndia vector tiles and reverse geocoding.
            </p>

            <form onSubmit={saveKey} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mappls Static Key</label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder="Paste your Mappls Static Key here…"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyDialog(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-iiitg-800 hover:bg-iiitg-900 rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  {keySaved ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Key Saved!</span>
                    </>
                  ) : (
                    <span>Save &amp; Apply</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
