/**
 * MapmyIndia (Mappls) Web Maps Integration Helper
 * Handles dynamic SDK script loading, reverse geocoding, and fallbacks.
 */

const MAPPLS_SDK_URL = 'https://apis.mappls.com/advancedmaps/api';

// Default campus location (IIIT Guwahati Center)
export const DEFAULT_CAMPUS_LOCATION = {
  lat: 26.0815,
  lng: 91.5608,
  label: 'IIIT Guwahati Campus',
};

// Official campus spots with exact coordinates and search aliases
export const CAMPUS_PRESETS = [
  { 
    name: 'Academic Building', 
    lat: 26.081306, 
    lng: 91.561917, 
    icon: '🏛️', 
    type: 'Academic', 
    plusCode: null,
    subtitle: 'Classrooms, Labs & Faculty Offices',
    aliases: ['academic', 'class', 'classroom', 'lab', 'lecture', 'a-110', 'admin', 'office', 'acad', 'department', 'academic block'] 
  },
  { 
    name: 'Library', 
    lat: 26.081127, 
    lng: 91.562130, 
    icon: '📚', 
    type: 'Academic', 
    plusCode: '3HJ6+FV9',
    subtitle: 'Central Library & Reading Halls',
    aliases: ['library', 'lib', 'reading room', 'study hall', 'central library', 'books', 'libr'] 
  },
  { 
    name: 'Canteen', 
    lat: 26.082251, 
    lng: 91.562126, 
    icon: '☕', 
    type: 'Amenity', 
    plusCode: '3HJ6+WV2',
    subtitle: 'Dining Hall & Cafeteria',
    aliases: ['canteen', 'mess', 'cafe', 'cafeteria', 'dining', 'food', 'snacks', 'cant', 'eating'] 
  },
  { 
    name: 'Boys Hostel', 
    lat: 26.080111, 
    lng: 91.558444, 
    icon: '🏢', 
    type: 'Hostel', 
    plusCode: null,
    subtitle: 'Men Residential Blocks',
    aliases: ['boys hostel', 'boy hostel', 'bh', 'men hostel', 'boys', 'bh1', 'bh2', 'b-block'] 
  },
  { 
    name: 'Girls Hostel', 
    lat: 26.082111, 
    lng: 91.559444, 
    icon: '🏡', 
    type: 'Hostel', 
    plusCode: null,
    subtitle: 'Women Residential Block',
    aliases: ['girls hostel', 'girl hostel', 'gh', 'women hostel', 'girls', 'gh1', 'gh2', 'g-block'] 
  },
  { 
    name: 'Town Hall', 
    lat: 26.081444, 
    lng: 91.559778, 
    icon: '🎭', 
    type: 'Hall', 
    plusCode: null,
    subtitle: 'Auditorium & Events Arena',
    aliases: ['town hall', 'hall', 'auditorium', 'audi', 'seminar hall', 'stage', 'th'] 
  },
  { 
    name: 'Indoor Badminton Court', 
    lat: 26.081500, 
    lng: 91.559389, 
    icon: '🏸', 
    type: 'Sports', 
    plusCode: null,
    subtitle: 'Indoor Sports Complex',
    aliases: ['indoor badminton court', 'badminton', 'indoor court', 'court', 'shuttle', 'badminton court', 'bad', 'indoor'] 
  },
  { 
    name: 'Playground', 
    lat: 26.080722, 
    lng: 91.559139, 
    icon: '⚽', 
    type: 'Sports', 
    plusCode: null,
    subtitle: 'Outdoor Field & Running Track',
    aliases: ['playground', 'ground', 'cricket', 'football', 'play ground', 'sports field', 'field', 'sports'] 
  },
  { 
    name: 'IIITG Lake', 
    lat: 26.081667, 
    lng: 91.561000, 
    icon: '🌊', 
    type: 'Nature', 
    plusCode: null,
    subtitle: 'Campus Waterbody & Promenade',
    aliases: ['iiitg lake', 'lake', 'pond', 'water', 'water body'] 
  },
  { 
    name: 'Power House', 
    lat: 26.082278, 
    lng: 91.561444, 
    icon: '⚡', 
    type: 'Facility', 
    plusCode: null,
    subtitle: 'Electrical Substation & Generator Room',
    aliases: ['power house', 'power', 'substation', 'transformer', 'generator', 'electric room', 'ph'] 
  },
  { 
    name: 'Faculty Residence', 
    lat: 26.082889, 
    lng: 91.559639, 
    icon: '🏘️', 
    type: 'Residence', 
    plusCode: null,
    subtitle: 'Staff & Professor Housing',
    aliases: ['faculty residence', 'faculty', 'quarters', 'residence', 'staff', 'prof quarters', 'housing'] 
  },
  { 
    name: 'Iron Bridge', 
    lat: 26.080003, 
    lng: 91.560003, 
    icon: '🌉', 
    type: 'Transit', 
    plusCode: '3HJ6+22',
    subtitle: 'South Campus Access Bridge',
    aliases: ['iron bridge', 'bridge', 'culvert', 'iron'] 
  },
  { 
    name: 'Main Gate', 
    lat: 26.081753, 
    lng: 91.563255, 
    icon: '🚪', 
    type: 'Transit', 
    plusCode: '3HJ7+P8H',
    subtitle: 'Main Security Entrance & Checkpost',
    aliases: ['main gate', 'gate', 'entrance', 'security gate', 'guard room', 'entry'] 
  },
];

/**
 * Matches a query string to one of the 13 official campus landmarks.
 * Returns the matching landmark object or null if invalid.
 */
export function findMatchingLandmark(query) {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim().toLowerCase();
  if (!q) return null;

  // 1. Direct exact name match
  for (const spot of CAMPUS_PRESETS) {
    if (spot.name.toLowerCase() === q) return spot;
  }

  // 2. Direct exact alias match (e.g. "gh" -> Girls Hostel, "bh" -> Boys Hostel)
  for (const spot of CAMPUS_PRESETS) {
    if (spot.aliases && spot.aliases.some(a => a.toLowerCase() === q)) return spot;
  }

  // 3. Query contains the full official name of the spot (e.g. "Girls Hostel, IIIT Guwahati Campus")
  // Check longer names first so specific landmarks take precedence
  const spotsByLength = [...CAMPUS_PRESETS].sort((a, b) => b.name.length - a.name.length);
  for (const spot of spotsByLength) {
    if (q.includes(spot.name.toLowerCase())) return spot;
  }

  // 4. Query starts with the spot name
  for (const spot of CAMPUS_PRESETS) {
    if (spot.name.toLowerCase().startsWith(q)) return spot;
  }

  // 5. Query contains alias with exact word boundaries
  for (const spot of CAMPUS_PRESETS) {
    if (spot.aliases) {
      for (const a of spot.aliases) {
        const al = a.toLowerCase();
        const regex = new RegExp(`(^|[^a-z0-9])${al}([^a-z0-9]|$)`, 'i');
        if (regex.test(q)) {
          return spot;
        }
      }
    }
  }

  // 6. Plus code match
  for (const spot of CAMPUS_PRESETS) {
    if (spot.plusCode && (spot.plusCode.toLowerCase() === q || q.includes(spot.plusCode.toLowerCase()))) {
      return spot;
    }
  }

  return null;
}

/**
 * Returns suggestions from CAMPUS_PRESETS matching the query.
 * If query is empty, returns all 13 locations.
 */
export function getLandmarkSuggestions(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return CAMPUS_PRESETS;
  }
  const q = query.trim().toLowerCase();

  return CAMPUS_PRESETS.filter(spot => {
    const sName = spot.name.toLowerCase();
    const nameMatch = sName.includes(q) || q.includes(sName);
    const aliasMatch = spot.aliases && spot.aliases.some(a => {
      const al = a.toLowerCase();
      return al === q || al.startsWith(q) || (q.length >= 3 && al.includes(q));
    });
    const plusMatch = spot.plusCode && spot.plusCode.toLowerCase().includes(q);
    const typeMatch = spot.type && spot.type.toLowerCase().startsWith(q);
    return nameMatch || aliasMatch || plusMatch || typeMatch;
  });
}

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

