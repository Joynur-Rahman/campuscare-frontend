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
  loadMapplsSdk, 
  reverseGeocode, 
  DEFAULT_CAMPUS_LOCATION, 
  CAMPUS_PRESETS,
  findMatchingLandmark,
  getLandmarkSuggestions,
  getMapplsKey
} from '../lib/mappls.js';
import { applyLeafletTileLayer } from '../lib/mapLayers.js';

export default function LocationPicker({ 
  value = '', 
  onChange, 
  coords, 
  onCoordsChange,
  placeholder = 'e.g. Hostel Room 214, Academic Block...' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState(null); // 'gps' | 'manual' | 'preset' | null
  const [currentCoords, setCurrentCoords] = useState(coords || DEFAULT_CAMPUS_LOCATION);
  const [mapEngine, setMapEngine] = useState('loading'); // 'mappls' | 'fallback' | 'loading'
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

  // Initialize MapmyIndia or Fallback Map
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;

      // Clear previous map instances if any
      if (fallbackMapRef.current) {
        try { fallbackMapRef.current.remove(); } catch {}
        fallbackMapRef.current = null;
      }
      if (mapplsMapRef.current) {
        try { mapplsMapRef.current.remove(); } catch {}
        mapplsMapRef.current = null;
      }

      if (mapplsKey) {
        try {
          const mappls = await loadMapplsSdk(mapplsKey);
          if (!isMounted || !mapContainerRef.current) return;

          // Initialize Mappls Map
          const map = new mappls.Map(mapContainerRef.current, {
            center: [currentCoords.lat, currentCoords.lng],
            zoom: 16,
            zoomControl: true,
            location: true,
          });

          mapplsMapRef.current = map;

          // Add draggable marker
          const marker = new mappls.Marker({
            map: map,
            position: { lat: currentCoords.lat, lng: currentCoords.lng },
            draggable: true,
          });
          markerRef.current = marker;

          // Listen to marker dragend
          marker.addListener('dragend', async () => {
            const pos = marker.getPosition();
            if (pos) {
              const newPos = { lat: pos.lat, lng: pos.lng };
              handleLocationSelect(newPos, 'manual');
            }
          });

          // Listen to map click
          map.addListener('click', async (e) => {
            const lat = e.lngLat ? e.lngLat.lat : e.latlng?.lat;
            const lng = e.lngLat ? e.lngLat.lng : e.latlng?.lng;
            if (lat && lng) {
              const newPos = { lat, lng };
              if (markerRef.current) {
                markerRef.current.setPosition(newPos);
              }
              handleLocationSelect(newPos, 'manual');
            }
          });

          setMapEngine('mappls');
          setErrorMsg(null);
          return;
        } catch (err) {
          console.warn('Mappls SDK failed to initialize, falling back to OSM map:', err.message);
          if (!isMounted) return;
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg('MapmyIndia Static Key is not set in .env. Using interactive OpenStreetMap fallback.');
      }

      // Fallback: Dynamically load Leaflet for an interactive backup map
      try {
        if (!window.L) {
          await loadLeafletLibrary();
        }
        if (!isMounted || !mapContainerRef.current) return;

        if (fallbackMapRef.current) {
          try { fallbackMapRef.current.remove(); } catch {}
          fallbackMapRef.current = null;
        }
        const L = window.L;
        const map = L.map(mapContainerRef.current).setView([currentCoords.lat, currentCoords.lng], 16);
        fallbackMapRef.current = map;

        // Apply high-resolution Hybrid Satellite layer by default
        applyLeafletTileLayer(L, map, tileLayersRef, 'satellite');

        const marker = L.marker([currentCoords.lat, currentCoords.lng], { draggable: true }).addTo(map);
        markerRef.current = marker;

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          handleLocationSelect({ lat: pos.lat, lng: pos.lng }, 'manual');
        });

        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          handleLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng }, 'manual');
        });

        setMapEngine('fallback');
      } catch (fErr) {
        console.error('Fallback map could not be loaded', fErr);
        setMapEngine('error');
      }
    }

    const timer = setTimeout(initMap, 100);
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (fallbackMapRef.current) {
        try { fallbackMapRef.current.remove(); } catch {}
        fallbackMapRef.current = null;
      }
      if (mapplsMapRef.current) {
        try { mapplsMapRef.current.remove(); } catch {}
        mapplsMapRef.current = null;
      }
    };
  }, [isOpen, mapplsKey]);

  // Update map pin when currentCoords change
  function updateMapPosition(pos) {
    if (mapEngine === 'mappls' && mapplsMapRef.current) {
      try {
        mapplsMapRef.current.setCenter([pos.lat, pos.lng]);
        if (markerRef.current) {
          markerRef.current.setPosition({ lat: pos.lat, lng: pos.lng });
        }
      } catch {}
    } else if (mapEngine === 'fallback' && fallbackMapRef.current) {
      try {
        fallbackMapRef.current.setView([pos.lat, pos.lng], 16);
        if (markerRef.current && markerRef.current.setLatLng) {
          markerRef.current.setLatLng([pos.lat, pos.lng]);
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
      alert('Geolocation is not supported by your browser.');
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
        alert(msg);
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
            Issue Location *
          </label>
          <div className="flex items-center gap-2">
            {/* Auto Detect Button */}
            <button
              type="button"
              onClick={detectCurrentLocation}
              disabled={detecting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title="Automatically detect current GPS position"
            >
              {detecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Detecting GPS…</span>
                </>
              ) : (
                <>
                  <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Auto Detect (GPS)</span>
                </>
              )}
            </button>

            {/* Toggle Map View */}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Navigation className="w-3 h-3 text-indigo-600" />
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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] text-slate-600">
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

      {/* Interactive Map Accordion */}
      {isOpen && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-inner transition-all animate-fadeIn">
          {/* Map Status Bar */}
          <div className="px-3 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {mapEngine === 'mappls' ? (
                  <span className="text-emerald-700 font-semibold">MapmyIndia (Mappls) Active</span>
                ) : (
                  <span>Interactive Campus Map (Drag marker or click to place)</span>
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

            {/* Satellite / Street Switcher */}
            <div className="absolute top-2.5 right-2.5 z-[400] flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200 text-[11px] gap-1">
              <button
                type="button"
                onClick={() => switchLayer('satellite')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'satellite'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>🛰️</span>
                <span>Satellite</span>
              </button>
              <button
                type="button"
                onClick={() => switchLayer('street')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'street'
                    ? 'bg-iiitg-800 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>🗺️</span>
                <span>Street</span>
              </button>
            </div>

            {mapEngine === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/80 backdrop-blur-xs z-10 gap-2 pointer-events-none">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs text-slate-600 font-medium">Loading MapmyIndia tiles…</span>
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

/**
 * Dynamic Leaflet Loader for fallback maps
 */
function loadLeafletLibrary() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);

    // CSS
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.setAttribute('data-leaflet-css', 'true');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // JS
    const script = document.createElement('script');
    script.setAttribute('data-leaflet-js', 'true');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
