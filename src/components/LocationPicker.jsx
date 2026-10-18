import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MapPin, 
  Navigation, 
  Loader2, 
  Check,
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Crosshair,
  Compass,
  ExternalLink
} from 'lucide-react';
import { 
  reverseGeocode, 
  DEFAULT_CAMPUS_LOCATION, 
  CAMPUS_PRESETS,
  findMatchingLandmark,
  getLandmarkSuggestions,
  getMapplsKey,
  buildingLabelHtml, 
  BUILDING_NAME_MIN_ZOOM, 
  loadMapplsSdk, 
  createMapplsMap, 
  addCampusOverlay, 
  centeredHtml, 
  useSatelliteStyle
} from '../lib/mappls.js';
import { distanceToCampusM, CAMPUS_TOLERANCE_M, MAX_GPS_ACCURACY_M, fmtDistance, IIITG_CAMPUS_POLYGON, CAMPUS_LANDMARKS } from '../lib/campus.js';
import { loadLeaflet } from '../lib/leafletFallback.js';

export default function LocationPicker({ 
  value = '', 
  onChange, 
  coords, 
  onCoordsChange,
  placeholder = 'e.g. Hostel Room 214, Academic Block...',
  label = 'Issue Location *',
  geofence = false, // true → only spots inside the IIIT Guwahati boundary are accepted
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fenceMsg, setFenceMsg] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState(null); // 'gps' | 'manual' | 'preset' | null
  const [currentCoords, setCurrentCoords] = useState(coords || DEFAULT_CAMPUS_LOCATION);
  const [mapEngine, setMapEngine] = useState('loading'); // 'mappls' | 'loading' | 'error'
  const [errorMsg, setErrorMsg] = useState(null);
  const [viewMode, setViewMode] = useState('satellite');

  const mapContainerRef = useRef(null);
  const mapplsMapRef = useRef(null);
  const markerRef = useRef(null);
  const fallbackMapRef = useRef(null);
  const tileLayersRef = useRef(null);
  const dropdownRef = useRef(null);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Match official campus landmark from current input
  const matchedLandmark = useMemo(() => findMatchingLandmark(value), [value]);

  // Compute live suggestions from the 13 locations based on user input
  const suggestions = useMemo(() => getLandmarkSuggestions(value), [value]);

  const stopLiveRef = useRef(null);
  const userPickedRef = useRef(false);
  // Strict geofence: until the reporter's own live location is confirmed inside the campus,
  // no spot can be pinned (stops people outside campus pinning a place inside it).
  const lockRef = useRef(geofence ? 'Checking your live location…' : null);
  const [lockMsg, setLockMsg] = useState(lockRef.current);
  const setLock = (m) => { lockRef.current = m; setLockMsg(m); };

  // Read the reporter's live GPS once and lock / unlock pinning
  function applyPresence(fix) {
    if (!geofence) return;
    const d = distanceToCampusM(fix.lat, fix.lng);
    if (fix.accuracy > MAX_GPS_ACCURACY_M) {
      setLock(`Your GPS is too weak (±${Math.round(fix.accuracy)} m) to confirm you are on campus. Move to an open area and tap Auto Detect.`);
    } else if (d > CAMPUS_TOLERANCE_M) {
      setLock(`You are ${fmtDistance(d)} outside the IIIT Guwahati campus — on-campus problems can only be pinned from inside the campus.`);
    } else {
      setLock(null);
    }
  }
  useEffect(() => {
    if (!geofence) { setLock(null); return; }
    if (!navigator.geolocation) { setLock('This device cannot share its location, so a spot cannot be pinned.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => applyPresence({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => setLock(err.code === 1
        ? 'Location permission is off. Allow location access to pin where the problem is.'
        : 'Could not get your live location. Move to an open area and tap Auto Detect.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, [geofence]);

  const mapplsKey = getMapplsKey();

  // Close suggestions popup on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Synchronize internal coordinates if parent changes
  useEffect(() => {
    if (coords && (coords.lat !== currentCoords.lat || coords.lng !== currentCoords.lng)) {
      setCurrentCoords(coords);
    }
  }, [coords]);

  // Auto-sync coordinates when current value matches a verified campus landmark
  useEffect(() => {
    if (matchedLandmark) {
      if (!coords || (coords.lat !== matchedLandmark.lat || coords.lng !== matchedLandmark.lng)) {
        const pos = { lat: matchedLandmark.lat, lng: matchedLandmark.lng };
        setCurrentCoords(pos);
        onCoordsChange?.(pos);
        updateMapPosition(pos);
        setDetectionStatus('preset');
      }
    }
  }, [matchedLandmark]);
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    let watchId = null;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapplsMapRef.current) {
        try { mapplsMapRef.current.remove(); } catch {}
        mapplsMapRef.current = null;
      }
      setMapEngine('loading');
      try {
        const mappls = await loadMapplsSdk();
        if (!isMounted || !mapContainerRef.current) return;
        const el = mapContainerRef.current;
        const map = createMapplsMap(mappls, el, { center: [currentCoords.lat, currentCoords.lng], zoom: 17, zoomControl: true, location: false });
        useSatelliteStyle(mappls, map);
        addCampusOverlay(mappls, map, { showLabels: false });

        const onReady = () => {
          if (!isMounted) return;
          // Building dots (names appear once zoomed in)
          CAMPUS_LANDMARKS.forEach((lm) => {
            try { new mappls.Marker({ map, position: { lat: lm.lat, lng: lm.lng }, html: centeredHtml(buildingLabelHtml(lm)), width: 2, height: 2, fitbounds: false }); } catch { /* skip */ }
          });
          const syncNames = () => { try { el.classList.toggle('cc-names-on', map.getZoom() >= BUILDING_NAME_MIN_ZOOM); } catch { /* ignore */ } };
          syncNames();
          try { map.on('zoomend', syncNames); } catch { /* ignore */ }

          // Draggable pin for the issue spot
          const pin = new mappls.Marker({ map, position: { lat: currentCoords.lat, lng: currentCoords.lng }, html: centeredHtml('<div style="width:30px;height:30px;transform:translate(-15px,-30px)"><svg viewBox="0 0 24 24" width="30" height="30"><path fill="#e11d48" stroke="#fff" stroke-width="1.6" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></div>'), width: 2, height: 2, draggable: true, fitbounds: false });
          pin.addListener?.('dragend', () => {
            const p = pin.getPosition?.();
            if (!p) return;
            userPickedRef.current = true;
            handleLocationSelect({ lat: p.lat, lng: p.lng }, 'manual');
          });
          map.addListener?.('click', (e) => {
            const lat = e?.lngLat?.lat ?? e?.latlng?.lat;
            const lng = e?.lngLat?.lng ?? e?.latlng?.lng;
            if (lat == null || lng == null) return;
            try { pin.setPosition({ lat, lng }); } catch { /* ignore */ }
            userPickedRef.current = true;
            handleLocationSelect({ lat, lng }, 'manual');
          });

          mapplsMapRef.current = {
            setCenter: ([lat, lng]) => { try { map.setCenter({ lat, lng }); if ((map.getZoom?.() ?? 17) < 17) map.setZoom(17); } catch { /* ignore */ } },
            remove: () => { try { map.remove(); } catch { /* ignore */ } },
          };
          markerRef.current = { setPosition: (pos) => { try { pin.setPosition(pos); } catch { /* ignore */ } } };
          setMapEngine('mappls');
          setErrorMsg(null);

          // Live location (blue dot); first fix auto-picks the spot if on campus
          userPickedRef.current = false;
          if (navigator.geolocation) {
            let dot = null;
            let first = true;
            watchId = navigator.geolocation.watchPosition((pos) => {
              if (!isMounted) return;
              const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              applyPresence({ ...here, accuracy: pos.coords.accuracy });
              try {
                if (!dot) dot = new mappls.Marker({ map, position: here, html: centeredHtml('<div style="width:16px;height:16px;transform:translate(-8px,-8px);border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,.3)"></div>'), width: 2, height: 2, fitbounds: false });
                else dot.setPosition(here);
              } catch { /* ignore */ }
              if (!first) return;
              first = false;
              if (userPickedRef.current) return;
              if (distanceToCampusM(here.lat, here.lng) <= CAMPUS_TOLERANCE_M) {
                try { map.setCenter({ lat: here.lat, lng: here.lng }); map.setZoom(18); pin.setPosition(here); } catch { /* ignore */ }
                handleLocationSelect(here, 'gps');
              } else if (geofence) {
                setFenceMsg(`You appear to be ${fmtDistance(distanceToCampusM(here.lat, here.lng))} outside campus — the blue dot is you.`);
              }
            }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
          }
        };
        let ready = false;
        const once = () => { if (!ready) { ready = true; onReady(); } };
        if (map.isStyleLoaded?.()) once(); else { map.addListener?.('load', once); setTimeout(() => { if (map.isStyleLoaded?.()) once(); }, 2500); }
        mapplsMapRef.current = { setCenter: () => {}, remove: () => { try { map.remove(); } catch { /* ignore */ } } };
      } catch (err) {
        console.warn('MapmyIndia map failed to load, trying Leaflet fallback:', err?.message);
        try {
          const L = await loadLeaflet();
          if (!isMounted || !mapContainerRef.current) return;
          if (fallbackMapRef.current) {
            try { fallbackMapRef.current.remove(); } catch {}
            fallbackMapRef.current = null;
          }
          const map = L.map(mapContainerRef.current, { attributionControl: false }).setView([currentCoords.lat, currentCoords.lng], 17);
          fallbackMapRef.current = map;
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
          L.polygon(IIITG_CAMPUS_POLYGON, { color: '#facc15', weight: 2.5, opacity: 0.9, fillOpacity: 0.04 }).addTo(map);
          const marker = L.marker([currentCoords.lat, currentCoords.lng], { draggable: true }).addTo(map);
          markerRef.current = { setPosition: (p) => { try { marker.setLatLng([p.lat, p.lng]); } catch {} } };
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            handleLocationSelect({ lat: pos.lat, lng: pos.lng }, 'manual');
          });
          map.on('click', (e) => {
            marker.setLatLng(e.latlng);
            handleLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng }, 'manual');
          });
          setMapEngine('mappls');
          setErrorMsg(null);
        } catch (fErr) {
          console.warn('Fallback map failed:', fErr);
          if (!isMounted) return;
          setErrorMsg('Map could not be loaded — check your internet connection.');
          setMapEngine('error');
        }
      }
    }

    const timer = setTimeout(initMap, 80);
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (mapplsMapRef.current) {
        try { mapplsMapRef.current.remove(); } catch {}
        mapplsMapRef.current = null;
      }
    };
  }, [isOpen]);

  // Update map pin when currentCoords change
  function updateMapPosition(pos) {
    if (mapEngine === 'mappls' && mapplsMapRef.current) {
      try {
        mapplsMapRef.current.setCenter([pos.lat, pos.lng]);
        if (markerRef.current) {
          markerRef.current.setPosition({ lat: pos.lat, lng: pos.lng });
        }
      } catch {}
    }
  }

  function switchLayer(mode) {
    setViewMode(mode);
    if (mapEngine === 'fallback' && fallbackMapRef.current && window.L) {
      applyLeafletTileLayer(window.L, fallbackMapRef.current, tileLayersRef, mode);
    }
  }

  // Select an official campus landmark
  function selectLandmark(spot) {
    setShowSuggestions(false);
    setActiveIndex(-1);
    setDetectionStatus('preset');
    const pos = { lat: spot.lat, lng: spot.lng };
    setCurrentCoords(pos);
    onCoordsChange?.(pos);
    updateMapPosition(pos);

    // Preserve any user-typed room / floor detail (e.g. "Room 204")
    const roomMatch = value.match(/(Room\s+[A-Za-z0-9-]+|Floor\s+\d+|Lab\s+[A-Za-z0-9-]+|Flat\s+\d+)/i);
    const detail = roomMatch ? ` (${roomMatch[0]})` : '';
    onChange(`${spot.name}${detail}, IIIT Guwahati Campus`);
  }

  // Handle user typing with live suggestions and landmark resolution
  function handleInputChange(text) {
    onChange(text);
    setShowSuggestions(true);
    setActiveIndex(-1);

    const matched = findMatchingLandmark(text);
    if (matched) {
      const pos = { lat: matched.lat, lng: matched.lng };
      setCurrentCoords(pos);
      onCoordsChange?.(pos);
      updateMapPosition(pos);
      setDetectionStatus('preset');
    }
  }

  // Keyboard navigation for autocomplete list
  function handleKeyDown(e) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setShowSuggestions(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        selectLandmark(suggestions[activeIndex]);
      } else if (suggestions.length === 1) {
        e.preventDefault();
        selectLandmark(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setShowSuggestions(false);
      // Auto-correct if user typed a valid alias (like "lib" or "canteen")
      const auto = findMatchingLandmark(value);
      if (auto && !value.toLowerCase().includes(auto.name.toLowerCase())) {
        selectLandmark(auto);
      }
    }, 250);
  }

  // Handle selected location & reverse geocode
  async function handleLocationSelect(pos, source = 'manual', customLabel = null) {
    if (geofence && source !== 'gps' && lockRef.current) {
      setFenceMsg(lockRef.current);
      try { markerRef.current?.setPosition?.({ lat: currentCoords.lat, lng: currentCoords.lng }); } catch {}
      return;
    }
    if (geofence) {
      const d = distanceToCampusM(pos.lat, pos.lng);
      if (d > CAMPUS_TOLERANCE_M) {
        setFenceMsg(source === 'gps'
          ? `You are ${fmtDistance(d)} outside the IIIT Guwahati campus. This problem can only be reported from inside the campus.`
          : 'That spot is outside the campus boundary. Pick a place inside the yellow outline.');
        try { markerRef.current?.setPosition?.({ lat: currentCoords.lat, lng: currentCoords.lng }); } catch {}
        return;
      }
      setFenceMsg(null);
      if (source === 'gps') setLock(null);
    }
    setCurrentCoords(pos);
    onCoordsChange?.(pos);
    setDetectionStatus(source);
    updateMapPosition(pos);

    if (customLabel) {
      onChange(customLabel);
      return;
    }

    setGeocoding(true);
    try {
      const res = await reverseGeocode(pos.lat, pos.lng, mapplsKey);
      if (res?.address) {
        // If current input already has user-typed details (like Room number), we preserve them
        const roomMatch = value.match(/(Room\s+\d+|Flat\s+\d+|Floor\s+\d+|B-\d+|A-\d+)/i);
        const prefix = roomMatch ? `${roomMatch[0]}, ` : '';
        onChange(prefix + res.address);
      }
    } catch (e) {
      console.warn('Geocoding error', e);
    } finally {
      setGeocoding(false);
    }
  }

  // Automatic Location Detection via Browser GPS
  function detectCurrentLocation() {
    if (!navigator.geolocation) {
      setFenceMsg('This device cannot share its location.');
      return;
    }

    setDetecting(true);
    setDetectionStatus(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetecting(false);
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setIsOpen(true);
        handleLocationSelect(newCoords, 'gps');
      },
      (err) => {
        setDetecting(false);
        let msg = 'Could not retrieve your location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access in your browser settings.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        setFenceMsg(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  return (
    <div className="space-y-2">
      {/* Input Header & Controls */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700">
            {label}
          </label>
          <div className="flex items-center gap-2">
            {/* Auto Detect Button */}
            <button
              type="button"
              onClick={detectCurrentLocation}
              disabled={detecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-sm shadow-emerald-600/30 active:scale-95 disabled:opacity-60"
              title="Automatically detect current GPS position"
            >
              {detecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Detecting GPS…</span>
                </>
              ) : (
                <>
                  <Crosshair className="w-3.5 h-3.5 text-white" />
                  <span>Auto Detect (GPS)</span>
                </>
              )}
            </button>

            {/* Toggle Map View */}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors active:scale-95 ${isOpen ? 'bg-[#2f4e56] text-white border-[#2f4e56]' : 'bg-white text-[#2f4e56] border-[#9fbcbf] hover:bg-[#eef3f1] dark:bg-[#15171a] dark:text-[#b9bec9] dark:border-[#2a2e35]'}`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{isOpen ? 'Hide Map' : 'Pick on Map'}</span>
              {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Text Input with Live Autocomplete Suggestions */}
        <div ref={dropdownRef} className="relative flex flex-col gap-1.5">
          <div className="relative flex items-center">
            <div className="absolute left-3 text-slate-400 pointer-events-none">
              {geocoding ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              ) : (
                <MapPin className={`w-4 h-4 ${matchedLandmark ? 'text-emerald-600' : 'text-rose-500'}`} />
              )}
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={placeholder}
              className={`w-full pl-9 pr-28 py-2.5 text-sm border rounded-lg input-enhanced focus:outline-none focus:ring-2 ${
                matchedLandmark 
                  ? 'border-emerald-400 bg-emerald-50/20 focus:ring-emerald-500/20 focus:border-emerald-500' 
                  : value.trim() 
                    ? 'border-amber-300 bg-amber-50/20 focus:ring-amber-500/20 focus:border-amber-500'
                    : 'border-slate-300 focus:ring-indigo-500/20 focus:border-indigo-500'
              }`}
            />
            {detectionStatus && (
              <span className={`absolute right-2.5 px-2 py-0.5 text-[10px] font-semibold rounded-full border truncate max-w-[100px] ${
                matchedLandmark 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {matchedLandmark ? `🏛️ ${matchedLandmark.name}` : detectionStatus === 'gps' ? '📍 GPS Auto' : '📌 Map Picked'}
              </span>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown Popup */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-slideUp">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur z-10">
                <span>Official Campus Locations ({suggestions.length})</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Strict Selection</span>
              </div>
              {suggestions.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">
                  <p className="font-semibold text-rose-600 mb-0.5">No matching campus location</p>
                  <p className="text-[11px] text-slate-400">Must be one of the 13 official IIITG campus locations.</p>
                </div>
              ) : (
                suggestions.map((spot, idx) => {
                  const isHighlight = idx === activeIndex;
                  const isSelected = matchedLandmark?.name === spot.name;
                  return (
                    <button
                      key={spot.name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectLandmark(spot);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                        isHighlight 
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200' 
                          : isSelected
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{spot.icon}</span>
                        <div className="min-w-0">
                          <div className="font-bold flex items-center gap-1.5 truncate">
                            <span>{spot.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-normal bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {spot.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {spot.subtitle || spot.name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {spot.plusCode && (
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-200/50">
                            {spot.plusCode}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Verification Status Indicator */}
          {matchedLandmark ? (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold">{matchedLandmark.icon} {matchedLandmark.name}</span>
                <span className="text-[11px] text-emerald-600/80">({matchedLandmark.type})</span>
              </div>
              <span className="font-mono text-[10px] text-emerald-600">
                {matchedLandmark.lat.toFixed(5)}, {matchedLandmark.lng.toFixed(5)}
              </span>
            </div>
          ) : value.trim().length > 0 && !showSuggestions ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span>Please pick one of the 13 official campus locations (e.g. Library, Canteen, Boys Hostel...).</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Preset Campus Landmarks */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px] text-slate-600">
        <span className="text-slate-400 shrink-0 font-medium text-[10px] uppercase tracking-wider">Quick:</span>
        {CAMPUS_PRESETS.map((spot) => (
          <button
            key={spot.name}
            type="button"
            onClick={() => {
              setIsOpen(true);
              handleLocationSelect(
                { lat: spot.lat, lng: spot.lng },
                'preset',
                `${spot.name}, IIIT Guwahati Campus`
              );
            }}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-md transition-colors font-medium cursor-pointer active:scale-95"
          >
            <span>{spot.icon}</span>
            <span>{spot.name}</span>
          </button>
        ))}
      </div>

      {geofence && lockMsg && !fenceMsg && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertCircle className="w-4 h-4 mt-px shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{lockMsg}</span>
        </div>
      )}
      {fenceMsg && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-100">
          {fenceMsg}
        </div>
      )}

      {/* Interactive Map Accordion */}
      {isOpen && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-inner transition-all animate-fadeIn">
          {/* Map Status Bar */}
          <div className="px-3 py-2 bg-slate-100/90 dark:bg-[#15171a] border-b border-slate-200 dark:border-[#2a2e35] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {mapEngine === 'mappls' ? (
                  <span className="text-emerald-700 font-semibold">Satellite · tap to set the spot</span>
                ) : (
                  <span>{mapEngine === 'error' ? 'Map unavailable — type the place or use a quick spot' : 'Loading MapmyIndia…'}</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span>{currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}</span>
              <a
                href={`https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-indigo-600"
                title="Open in external maps"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Interactive Map Canvas */}
          <div 
            className="w-full h-56 bg-slate-200 relative z-0" 
            style={{ minHeight: '220px' }}
          >
            <div ref={mapContainerRef} className="w-full h-full" />
            {mapEngine === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 z-10 gap-1 text-center p-4">
                <MapPin className="w-6 h-6 text-rose-500" />
                <span className="text-xs font-bold text-slate-700">Map unavailable</span>
                <span className="text-[11px] text-slate-600">{errorMsg || 'The map could not be loaded.'} You can still use GPS or type the place.</span>
              </div>
            )}
            {mapEngine === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/80 backdrop-blur-xs z-10 gap-2 pointer-events-none">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs text-slate-600 font-medium">Loading MapmyIndia…</span>
              </div>
            )}
          </div>

          {/* Bottom helper tip */}
          <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              Click anywhere on the map or drag the pin to set the exact spot.
            </span>
            {errorMsg && (
              <span className="text-amber-600 font-medium truncate max-w-[200px]" title={errorMsg}>
                {errorMsg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
