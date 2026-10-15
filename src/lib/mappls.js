/**
 * Mappls (MapmyIndia) Web Map JS SDK v3 loader + helpers.
 * Supports both direct Mappls vector/satellite maps and clean Leaflet satellite fallback.
 */

import { IIITG_CAMPUS_POLYGON, CAMPUS_LANDMARKS, IIITG_CENTER as CAMPUS_CENTER } from './campus.js';

export const IIITG_CENTER = CAMPUS_CENTER || { lat: 26.08135, lng: 91.56025 };
export const DEFAULT_CAMPUS_LOCATION = IIITG_CENTER;
export const IIITG_ZOOM = 16.5;

export const CAMPUS_PRESETS = CAMPUS_LANDMARKS.map((lm) => ({
  id: lm.id,
  name: lm.name,
  lat: lm.lat,
  lng: lm.lng,
  color: lm.color,
}));

export function getMapplsKey() {
  return (
    import.meta.env.VITE_MAPPLS_SDK_KEY ||
    import.meta.env.VITE_MAPPLS_KEY ||
    ''
  ).trim();
}

export function mapErrorMessage(err, hasKey = Boolean(getMapplsKey())) {
  if (!hasKey) {
    return 'MapmyIndia key not configured (VITE_MAPPLS_KEY).';
  }
  return err?.message || 'MapmyIndia map could not be loaded — please try again.';
}

let loadPromise = null;

export function loadMapplsSdk(explicitKey) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  if (window.mappls && window.mappls.Map) {
    return Promise.resolve(window.mappls);
  }
  if (loadPromise) return loadPromise;

  const key = (explicitKey || getMapplsKey() || '').trim();
  if (!key) {
    return Promise.reject(new Error('Missing VITE_MAPPLS_SDK_KEY in .env'));
  }

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__mapplsReady_' + Math.random().toString(36).slice(2, 8);
    let settled = false;

    const finish = (ok, val) => {
      if (settled) return;
      settled = true;
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
      if (ok) resolve(val);
      else {
        loadPromise = null;
        reject(val);
      }
    };

    const timer = setTimeout(() => {
      if (window.mappls && window.mappls.Map) {
        finish(true, window.mappls);
      } else {
        finish(false, new Error('MapmyIndia took too long to load — please try again.'));
      }
    }, 12000);

    window[callbackName] = () => {
      clearTimeout(timer);
      if (window.mappls && window.mappls.Map) {
        finish(true, window.mappls);
      } else {
        finish(false, new Error('Mappls SDK loaded but window.mappls.Map missing'));
      }
    };

    const script = document.createElement('script');
    // Web SDK v3 (access_token). The old /advancedmaps/api/<key>/map_sdk URL is rejected for this key.
    script.src =
      `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(key)}` +
      `&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      clearTimeout(timer);
      finish(false, new Error('Could not reach MapmyIndia — check your internet connection.'));
    };
    // Some SDK builds ignore the callback: poll for window.mappls as well
    const poll = setInterval(() => {
      if (window.mappls && window.mappls.Map) { clearInterval(poll); clearTimeout(timer); finish(true, window.mappls); }
    }, 100);
    setTimeout(() => clearInterval(poll), 12000);
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Alias for callers using loadMappls()
export const loadMappls = loadMapplsSdk;

/**
 * Supports both calling conventions:
 * 1) createMapplsMap(mappls, targetEl, opts) -> returns `map` directly (used by LocationPicker / LocationModal)
 * 2) await createMapplsMap(targetEl, opts) -> returns `{ mappls, map, id, createdId }`
 */
export function createMapplsMap(arg1, arg2, arg3) {
  // Convention 1: createMapplsMap(mapplsInstance, targetElement, opts)
  if (arg1 && typeof arg1.Map === 'function') {
    const mappls = arg1;
    const target = arg2;
    const opts = arg3 || {};
    let id;
    if (typeof target === 'string') {
      id = target;
    } else if (target && target instanceof HTMLElement) {
      if (!target.id) {
        target.id = 'mappls-map-' + Math.random().toString(36).slice(2, 9);
      }
      id = target.id;
    } else {
      throw new Error('createMapplsMap: invalid target');
    }

    const rawCenter = opts.center || IIITG_CENTER;
    const centerArr = Array.isArray(rawCenter)
      ? rawCenter
      : [rawCenter.lat ?? IIITG_CENTER.lat, rawCenter.lng ?? IIITG_CENTER.lng];

    const m1 = new mappls.Map(id, {
      center: centerArr,
      zoom: opts.zoom ?? IIITG_ZOOM,
      zoomControl: opts.zoomControl ?? true,
      location: opts.location ?? false,
      clickableIcons: false,
      search: false,
    });
    makeScrollFriendly(m1);
    return m1;
  }

  // Convention 2: async createMapplsMap(targetElement, opts)
  const target = arg1;
  const opts = arg2 || {};
  return loadMapplsSdk().then((mappls) => {
    let id;
    let createdId = false;
    if (typeof target === 'string') {
      id = target;
    } else if (target && target instanceof HTMLElement) {
      if (!target.id) {
        target.id = 'mappls-map-' + Math.random().toString(36).slice(2, 9);
        createdId = true;
      }
      id = target.id;
    } else {
      throw new Error('createMapplsMap: invalid target');
    }

    const rawCenter = opts.center || IIITG_CENTER;
    const centerArr = Array.isArray(rawCenter)
      ? rawCenter
      : [rawCenter.lat ?? IIITG_CENTER.lat, rawCenter.lng ?? IIITG_CENTER.lng];

    const map = new mappls.Map(id, {
      center: centerArr,
      zoom: opts.zoom ?? IIITG_ZOOM,
      zoomControl: opts.zoomControl ?? true,
      location: opts.location ?? false,
      clickableIcons: false,
      search: false,
    });
    makeScrollFriendly(map);

    return { mappls, map, id, createdId };
  });
}


/** Page-scroll friendly maps: wheel scrolls the page until the map is clicked (Ctrl/⌘+wheel always zooms);
 *  on touch screens one finger scrolls the page and two fingers move / zoom the map. */
export function makeScrollFriendly(map) {
  const apply = () => {
    try {
      const box = map.getContainer?.();
      map.scrollZoom?.disable?.();
      map.on?.('click', () => map.scrollZoom?.enable?.());
      box?.addEventListener('mouseleave', () => map.scrollZoom?.disable?.());
      // Trackpad pinch (ctrl+wheel) and Ctrl/⌘+wheel zoom smoothly and proportionally,
      // instead of jumping a whole zoom level for every tiny wheel event.
      box?.addEventListener('wheel', (e) => {
        if ((e.ctrlKey || e.metaKey) && !map.scrollZoom?.isEnabled?.()) {
          e.preventDefault();
          const step = Math.max(-0.5, Math.min(0.5, -e.deltaY * 0.01));
          const z = Math.max(14, Math.min(20, map.getZoom() + step));
          map.setZoom(z);
        }
      }, { passive: false });
      // When wheel zoom is enabled, keep trackpad scrolling gentle
      try { map.scrollZoom?.setWheelZoomRate?.(1 / 600); map.scrollZoom?.setZoomRate?.(1 / 200); } catch { /* ignore */ }
      try { map.setMinZoom?.(14); map.setMaxZoom?.(20); } catch { /* ignore */ }
      if (window.matchMedia?.('(pointer: coarse)').matches) map.dragPan?.disable?.();
    } catch { /* ignore */ }
  };
  apply();
  try { map.on?.('load', apply); } catch { /* ignore */ }
}

// Satellite view on the MapmyIndia map. This key only has the "standard-day" style, so satellite
// imagery is laid under MapmyIndia's own roads & labels and the flat land fills are hidden.
const SAT_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export function useSatelliteStyle(mappls, map) {
  if (!map) return;
  const apply = () => {
    try {
      if (!map.getStyle || !map.addSource || map.getSource?.('cc-satellite')) return;
      const layers = map.getStyle()?.layers || [];
      const firstSymbol = layers.find((l) => l.type === 'symbol')?.id;
      map.addSource('cc-satellite', { type: 'raster', tiles: [SAT_TILES], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri' });
      map.addLayer({ id: 'cc-satellite', type: 'raster', source: 'cc-satellite' }, firstSymbol);
      layers.forEach((l) => {
        if (['fill', 'fill-extrusion', 'background'].includes(l.type) && !String(l.id).startsWith('cc-')) {
          try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch { /* ignore */ }
        }
      });
      // keep the campus boundary above the imagery
      ['cc-campus-fill', 'cc-campus-line'].forEach((id) => { try { if (map.getLayer(id)) map.moveLayer(id); } catch { /* ignore */ } });
    } catch { /* ignore */ }
  };
  let done = false;
  const once = () => { if (!done) { done = true; apply(); } };
  try {
    if (map.isStyleLoaded?.()) once();
    else { map.on?.('load', once); setTimeout(() => { try { if (map.isStyleLoaded?.()) once(); } catch { /* ignore */ } }, 2500); }
  } catch { /* ignore */ }
}

/**
 * Clean building dot + permanent name label (`• Academic Building`)
 * used by both Mappls and Leaflet satellite fallback so building names
 * are always clearly marked on the campus map.
 */
export function buildingLabelHtml(landmark) {
  const dotColor = landmark.color || '#38bdf8';
  const safeName = String(landmark.name || '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Zero-size anchor: the dot's centre is exactly the building's coordinate.
  // The name sits beside it and only shows once zoomed in (see .cc-names-on in index.css).
  return `<div style="position:relative;width:0;height:0;pointer-events:none;user-select:none">
    <span style="
      position:absolute;left:-4.5px;top:-4.5px;
      width:9px;height:9px;border-radius:999px;
      background:${dotColor};
      box-shadow:0 0 0 1.5px #0f172a, 0 0 0 3px rgba(255,255,255,0.9), 0 1px 5px rgba(0,0,0,0.6);
    "></span>
    <span class="cc-bname" style="
      position:absolute;${landmark.labelLeft ? 'right:8px' : 'left:8px'};top:-9px;
      align-items:center;
      padding:1.5px 6px;
      border-radius:999px;
      background:rgba(15, 23, 42, 0.84);
      border:1px solid rgba(255, 255, 255, 0.28);
      box-shadow:0 2px 5px rgba(0, 0, 0, 0.5);
      white-space:nowrap;
      color:#f8fafc;
      font-size:10px;
      font-weight:700;
      line-height:1.25;
      font-family:Inter,system-ui,-apple-system,sans-serif;
    ">${safeName}</span>
  </div>`;
}

/** Building names appear from this zoom level onwards (dots are always shown). */
export const BUILDING_NAME_MIN_ZOOM = 16;

/**
 * Clean dot marker HTML for active tickets/issues (no bulky emoji pin).
 * Renders a crisp colored dot with white ring, subtle pulse halo, and optional count badge.
 */
export function ticketDotHtml(opts = {}) {
  const color = opts.color || '#ef4444';
  const size = opts.size || 15;
  const selected = Boolean(opts.selected);
  const badge = opts.badge || '';
  const dotSize = selected ? size + 4 : size;
  const ring = selected
    ? `0 0 0 5px ${color}66, 0 3px 10px rgba(0,0,0,0.6)`
    : `0 0 0 3px ${color}3d, 0 2px 6px rgba(0,0,0,0.45)`;

  return `<div style="
    position:relative;
    width:${dotSize}px;height:${dotSize}px;border-radius:999px;
    background:${color};
    border:2.25px solid #ffffff;
    box-shadow:${ring};
    cursor:pointer;
    transform:translate(-50%, -50%);
    transition:transform 0.15s ease, box-shadow 0.15s ease;
  ">${
    badge
      ? `<span style="
          position:absolute;top:-7px;right:-9px;
          min-width:15px;height:15px;padding:0 3.5px;
          border-radius:999px;background:#0f172a;color:#fff;
          font-size:9px;font-weight:800;
          display:inline-flex;align-items:center;justify-content:center;
          border:1.5px solid #fff;line-height:1;
        ">${badge}</span>`
      : ''
  }</div>`;
}

/**
 * Draw the IIIT Guwahati yellow campus boundary + building dot labels on a Mappls map.
 */
export function addCampusOverlay(mappls, map, opts = {}) {
  const showLabels = opts.showLabels !== false;
  const cleanupFns = [];

  const draw = () => {
    try {
      if (map.addSource && !map.getSource?.('cc-campus')) {
        const ring = IIITG_CAMPUS_POLYGON.map(([lat, lng]) => [lng, lat]);
        ring.push(ring[0]);
        map.addSource('cc-campus', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } } });
        map.addLayer({ id: 'cc-campus-fill', type: 'fill', source: 'cc-campus', paint: { 'fill-color': '#facc15', 'fill-opacity': 0.06 } });
        map.addLayer({ id: 'cc-campus-line', type: 'line', source: 'cc-campus', paint: { 'line-color': '#eab308', 'line-width': 2.5 } });
        cleanupFns.push(() => { try { map.removeLayer('cc-campus-line'); map.removeLayer('cc-campus-fill'); map.removeSource('cc-campus'); } catch { /* map gone */ } });
      }
    } catch {
      // ignore polygon errors
    }

    if (showLabels) {
      for (const lm of CAMPUS_LANDMARKS) {
        try {
          const m = new mappls.Marker({
            map,
            position: { lat: lm.lat, lng: lm.lng },
            html: centeredHtml(buildingLabelHtml(lm)),
            width: 2,
            height: 2,
            fitbounds: false,
          });
          cleanupFns.push(() => removeMarker(m));
        } catch {
          // ignore individual label error
        }
      }
    }
  };

  let drawn = false;
  const once = () => { if (drawn) return; drawn = true; draw(); };
  try {
    if (map?.isStyleLoaded?.() || map?.loaded?.()) once();
    else if (map && typeof map.on === 'function') map.on('load', once);
    else if (map && typeof map.addListener === 'function') map.addListener('load', once);
  } catch { /* ignore */ }
  setTimeout(() => { try { if (map?.isStyleLoaded?.()) once(); } catch { /* ignore */ } }, 1500);

  return () => {
    cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  };
}

/**
 * Supports both calling conventions:
 * 1) addMapplsPin(mappls, map, { lat, lng }, opts)
 * 2) addMapplsPin(mappls, map, { lat, lng, color, size, ... })
 */
/** Mappls centres its marker box on the point; put our zero-size anchor in the box centre. */
export function centeredHtml(inner, nudge = [0, 0]) {
  const [dx, dy] = nudge;
  return `<div style="position:relative;width:100%;height:100%;pointer-events:none"><div style="position:absolute;left:calc(50% + ${dx}px);top:calc(50% + ${dy}px);width:0;height:0;pointer-events:auto">${inner}</div></div>`;
}

export function addMapplsPin(mappls, map, posOrOpts = {}, maybeOpts = {}) {
  const merged =
    posOrOpts && typeof posOrOpts === 'object' && maybeOpts && typeof maybeOpts === 'object'
      ? { ...posOrOpts, ...maybeOpts }
      : posOrOpts || {};

  const {
    lat,
    lng,
    color = '#ef4444',
    title = '',
    popupHtml = '',
    draggable = false,
    onClick,
    onDragEnd,
    size = 16,
    badge = '',
    selected = false,
    nudge = [0, 0],
  } = merged;

  const html = centeredHtml(ticketDotHtml({ color, size, badge, selected }), nudge);

  const markerOpts = {
    map,
    position: { lat: Number(lat), lng: Number(lng) },
    html,
    width: size + 16,
    height: size + 16,
    draggable,
    fitbounds: false,
  };
  if (popupHtml) markerOpts.popupHtml = popupHtml;
  if (title) markerOpts.title = title;

  const marker = new mappls.Marker(markerOpts);

  if (onClick && marker.addListener) {
    marker.addListener('click', (e) => onClick(e, marker));
  }
  if (draggable && onDragEnd && marker.addListener) {
    marker.addListener('dragend', (e) => {
      const pos = extractLatLng(e, marker);
      if (pos) onDragEnd(pos);
    });
  }

  return marker;
}

export function showLiveLocation(mappls, map, opts = {}) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {};
  let watchId = null;
  let marker = null;
  let first = true;

  try {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        try {
          if (marker) removeMarker(marker);
          if (mappls && map) {
            marker = addMapplsPin(mappls, map, fix, {
              color: '#3b82f6',
              size: 14,
              title: 'Your GPS Location',
            });
          }
        } catch {
          // ignore
        }
        if (opts.onFix) opts.onFix(fix, first);
        first = false;
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  } catch {
    // ignore
  }

  return () => {
    if (watchId != null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* ignore */
      }
    }
    if (marker) removeMarker(marker);
  };
}

export async function reverseGeocode(lat, lng) {
  // Match closest IIIT Guwahati building landmark within ~95m first
  let closest = null;
  let bestDist = Infinity;
  for (const lm of CAMPUS_LANDMARKS) {
    const dLat = (lat - lm.lat) * 110574;
    const dLng = (lng - lm.lng) * 99800;
    const d = Math.hypot(dLat, dLng);
    if (d < bestDist) {
      bestDist = d;
      closest = lm;
    }
  }
  if (closest && bestDist <= 95) {
    return {
      address: `${closest.name}, IIIT Guwahati`,
      landmark: closest.name,
    };
  }
  return {
    address: `IIIT Guwahati Campus (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`,
  };
}

export function removeMarker(marker) {
  if (!marker) return;
  try {
    if (typeof marker.remove === 'function') marker.remove();
    else if (typeof marker.setMap === 'function') marker.setMap(null);
  } catch {
    // ignore
  }
}

export function extractLatLng(evt, fallbackMarker) {
  if (!evt) return null;
  if (evt.lngLat && typeof evt.lngLat.lat === 'number') {
    return { lat: evt.lngLat.lat, lng: evt.lngLat.lng };
  }
  if (evt.latlng && typeof evt.latlng.lat === 'number') {
    return { lat: evt.latlng.lat, lng: evt.latlng.lng };
  }
  if (evt.detail && typeof evt.detail.lat === 'number') {
    return { lat: evt.detail.lat, lng: evt.detail.lng };
  }
  if (typeof evt.lat === 'number' && typeof evt.lng === 'number') {
    return { lat: evt.lat, lng: evt.lng };
  }
  if (fallbackMarker && typeof fallbackMarker.getPosition === 'function') {
    const p = fallbackMarker.getPosition();
    if (p && typeof p.lat === 'number') return { lat: p.lat, lng: p.lng };
  }
  return null;
}

export function openDirections(lat, lng, label = 'Ticket Location') {
  if (lat == null || lng == null) return;
  const q = encodeURIComponent(`${lat},${lng} (${label})`);
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&query=${q}`,
    '_blank',
    'noopener'
  );
}
