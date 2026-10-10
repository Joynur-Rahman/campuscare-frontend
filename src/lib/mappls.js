/**
 * MapmyIndia (Mappls) Web Maps Integration Helper
 * Handles dynamic SDK script loading, reverse geocoding, and fallbacks.
 */

const MAPPLS_SDK_URL = 'https://apis.mappls.com/advancedmaps/api';

// Default campus location (IIIT Guwahati)
export const DEFAULT_CAMPUS_LOCATION = {
  lat: 26.0827,
  lng: 91.5606,
  label: 'IIIT Guwahati Campus',
};

// Preset campus spots for quick selection
export const CAMPUS_PRESETS = [
  { name: 'Academic Block', lat: 26.0833, lng: 91.5612 },
  { name: 'Central Library', lat: 26.0828, lng: 91.5602 },
  { name: 'Boys Hostel', lat: 26.0815, lng: 91.5595 },
  { name: 'Girls Hostel', lat: 26.0840, lng: 91.5588 },
  { name: 'Canteen & Mess', lat: 26.0822, lng: 91.5600 },
  { name: 'Admin Building', lat: 26.0837, lng: 91.5620 },
  { name: 'Sports Complex', lat: 26.0808, lng: 91.5615 },
  { name: 'Main Campus Gate', lat: 26.0850, lng: 91.5628 },
];

let scriptLoadPromise = null;

/**
 * Loads the Mappls Web Map JS SDK with the provided static key.
 */
export function loadMapplsSdk(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));

  if (window.mappls && window.mappls.Map) {
    return Promise.resolve(window.mappls);
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    if (!apiKey) {
      return reject(new Error('MapmyIndia Static Key is missing. Add VITE_MAPPLS_KEY to .env'));
    }

    // Check if script already exists in document
    const existing = document.querySelector('script[data-mappls-sdk]');
    if (existing) {
      const checkInterval = setInterval(() => {
        if (window.mappls && window.mappls.Map) {
          clearInterval(checkInterval);
          resolve(window.mappls);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-mappls-sdk', 'true');
    script.src = `${MAPPLS_SDK_URL}/${encodeURIComponent(apiKey)}/map_sdk?layer=vector&v=3.0`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Small timeout for mappls object initialization
      const timer = setInterval(() => {
        if (window.mappls && window.mappls.Map) {
          clearInterval(timer);
          resolve(window.mappls);
        }
      }, 50);

      // Timeout after 5s if mappls doesn't appear
      setTimeout(() => {
        clearInterval(timer);
        if (window.mappls && window.mappls.Map) {
          resolve(window.mappls);
        } else {
          reject(new Error('Mappls SDK loaded but window.mappls is unavailable. Check domain whitelisting in Mappls console.'));
        }
      }, 5000);
    };

    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load MapmyIndia SDK. Please check your internet connection or Static Key.'));
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Reverse Geocode coordinates to a readable address.
 * Tries MapmyIndia first, falls back to OpenStreetMap Nominatim.
 */
export async function reverseGeocode(lat, lng, apiKey) {
  // 1. Try MapmyIndia reverse geocoding API if key is present
  if (apiKey) {
    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${encodeURIComponent(apiKey)}/rev_geocode?lat=${lat}&lng=${lng}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.results && data.results.length > 0) {
          const item = data.results[0];
          const address = item.formatted_address || [
            item.poi,
            item.houseName,
            item.street,
            item.subSubLocality,
            item.subLocality,
            item.locality,
            item.city,
            item.pincode,
          ].filter(Boolean).join(', ');

          if (address) {
            return {
              address,
              poi: item.poi || null,
              locality: item.locality || item.subLocality || null,
              raw: item,
              source: 'mapmyindia',
            };
          }
        }
      }
    } catch (e) {
      console.warn('MapmyIndia reverse geocode network error, falling back...', e);
    }
  }

  // 2. High-reliability fallback using OpenStreetMap Nominatim
  try {
    const fallbackUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(fallbackUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const parts = [
        addr.building || addr.amenity || addr.office || addr.university || addr.college,
        addr.road,
        addr.suburb || addr.neighbourhood || addr.residential,
        addr.city || addr.town || addr.village || addr.county,
        addr.postcode,
      ].filter(Boolean);

      return {
        address: parts.length > 0 ? parts.join(', ') : data.display_name || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
        raw: data,
        source: 'nominatim',
      };
    }
  } catch (err) {
    console.warn('Fallback reverse geocoding failed', err);
  }

  return {
    address: `Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    source: 'coordinates',
  };
}

/**
 * Returns the configured MapmyIndia key from localStorage or .env
 */
export function getMapplsKey() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cc_mappls_static_key') || import.meta.env.VITE_MAPPLS_KEY || '';
}

/**
 * Saves or clears the MapmyIndia key in localStorage
 */
export function setMapplsKey(key) {
  if (typeof window === 'undefined') return;
  if (key && key.trim()) {
    localStorage.setItem('cc_mappls_static_key', key.trim());
  } else {
    localStorage.removeItem('cc_mappls_static_key');
  }
}

