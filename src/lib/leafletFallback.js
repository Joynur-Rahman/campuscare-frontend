/**
 * Dynamic Leaflet (v1.9.4) loader from unpkg CDN for satellite fallback map.
 */

let leafletPromise = null

export function loadLeaflet() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'))
  }
  if (window.L && window.L.map) {
    return Promise.resolve(window.L)
  }
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise((resolve, reject) => {
    // Inject Leaflet CSS once
    if (!document.getElementById('leaflet-cdn-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-cdn-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => {
      if (window.L && window.L.map) {
        resolve(window.L)
      } else {
        leafletPromise = null
        reject(new Error('Leaflet script loaded but window.L is missing'))
      }
    }
    script.onerror = () => {
      leafletPromise = null
      reject(new Error('Failed to load Leaflet from CDN'))
    }
    document.head.appendChild(script)
  })

  return leafletPromise
}

/**
 * Scroll-friendly maps: the mouse wheel scrolls the PAGE until the map is clicked
 * (then it zooms the map), and Ctrl/⌘ + wheel always zooms. On phones one finger
 * scrolls the page and two fingers move / zoom the map.
 */
export function enableWheelOnFocus(L, map) {
  try {
    const box = map.getContainer();
    map.on('click focus', () => map.scrollWheelZoom.enable());
    box.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());
    box.addEventListener('wheel', (e) => {
      if ((e.ctrlKey || e.metaKey) && !map.scrollWheelZoom.enabled()) {
        e.preventDefault();
        map.setZoom(map.getZoom() + (e.deltaY < 0 ? 1 : -1));
      }
    }, { passive: false });
    if (L.Browser.mobile) map.touchZoom.enable();
  } catch { /* ignore */ }
}
