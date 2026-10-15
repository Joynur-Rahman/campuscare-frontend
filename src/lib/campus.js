// IIIT Guwahati campus geometry and landmarks.
// Building points: checked on Esri World Imagery against the OpenStreetMap building outlines
// (ways 8817857xx / 8820276xx) and the Google Maps place pins — each point sits on its roof.

export const IIITG_CENTER = { lat: 26.08135, lng: 91.56055 };

export const IIITG_CAMPUS_POLYGON = [
  [26.0830014, 91.5591367], [26.0829780, 91.5592767], [26.0841299, 91.5595501],
  [26.0837381, 91.5612427], [26.0825394, 91.5611613], [26.0822559, 91.5624373],
  [26.0821185, 91.5624145], [26.0819313, 91.5633813], [26.0809286, 91.5631860],
  [26.0808496, 91.5632706], [26.0797153, 91.5630981], [26.0767243, 91.5625154],
  [26.0788909, 91.5571675], [26.0801868, 91.5577413], [26.0806307, 91.5579455],
  [26.0809725, 91.5580725], [26.0818549, 91.5582213], [26.0817915, 91.5587667],
];

export const CAMPUS_TOLERANCE_M = 30;
export const MAX_GPS_ACCURACY_M = 150;

/**
 * Roof-aligned IIIT Guwahati campus landmarks:
 * - Academic Building: Main eastern Academic & Administrative complex roof (26.08138, 91.56195)
 * - Library Block: Southern wing of the Academic & Library complex (26.08095, 91.56205)
 * - Main Gate: Eastern main entrance gate on IT Park Street (26.08172, 91.56322)
 * - IIITG Canteen: Green-roofed IIITG Canteen building near northern boundary jog (26.08224, 91.56206)
 * - Faculty Quarters: Completed northern Faculty Residential building (26.08352, 91.55965)
 * - Girls' Hostel: White multi-winged Girls' Hostel roof north of Town Hall & south of IT Park St (26.08215, 91.55940)
 * - Town Hall: Large square green-roofed auditorium north of Sports Ground (26.08152, 91.55940)
 * - Badminton Court: Adjacent green-roofed Indoor Badminton Court immediately east of Town Hall (26.08152, 91.55974)
 * - Sports Ground: Central-west playground field between Town Hall and Boys' Hostel (26.08085, 91.55925)
 * - Boys' Hostel: Large multi-winged Boys' Hostel roof in southwest sector (26.08018, 91.55848)
 * - Hostel Mess: H-shaped green-roofed dining complex immediately east of Boys' Hostel (26.07995, 91.55916)
 * - Campus Lake: Central campus water reservoir (26.08135, 91.56065)
 */
// One colour for every building pin — lime green isn't used by any issue category,
// the campus boundary (yellow) or the GPS dot (blue), and stands out on satellite imagery.
export const BUILDING_DOT_COLOR = '#a3e635';

export const CAMPUS_LANDMARKS = [
  { id: 'academic', name: 'Academic Building', lat: 26.08125, lng: 91.56188, color: BUILDING_DOT_COLOR },
  { id: 'library', name: 'Library Block', lat: 26.081012, lng: 91.562104, color: BUILDING_DOT_COLOR },
  { id: 'main-gate', name: 'Main Gate', lat: 26.081849, lng: 91.563301, color: BUILDING_DOT_COLOR },
  { id: 'canteen', name: 'IIITG Canteen', lat: 26.082278, lng: 91.562042, color: BUILDING_DOT_COLOR },
  { id: 'quarters', name: 'Faculty Quarters', lat: 26.082834, lng: 91.559676, color: BUILDING_DOT_COLOR },
  { id: 'girls-hostel', name: "Girls' Hostel", lat: 26.082057, lng: 91.559382, color: BUILDING_DOT_COLOR },
  { id: 'town-hall', name: 'Town Hall', lat: 26.081555, lng: 91.559647, color: BUILDING_DOT_COLOR },
  { id: 'badminton', name: 'Badminton Court', lat: 26.081555, lng: 91.559308, color: BUILDING_DOT_COLOR, labelLeft: true },
  { id: 'ground', name: 'Sports Ground', lat: 26.0809, lng: 91.558829, color: BUILDING_DOT_COLOR },
  { id: 'boys-hostel', name: "Boys' Hostel", lat: 26.080156, lng: 91.558314, color: BUILDING_DOT_COLOR },
  { id: 'power', name: 'Power Station', lat: 26.082347, lng: 91.561354, color: BUILDING_DOT_COLOR },
  { id: 'lake', name: 'Campus Lake', lat: 26.08132, lng: 91.56084, color: BUILDING_DOT_COLOR },
];

export function fetchOsmCampusLandmarks() {
  return Promise.resolve(CAMPUS_LANDMARKS);
}

/**
 * Match a typed place ("Boys Hostel — Room 214", "Library block") to a campus landmark.
 */
export function landmarkForText(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  const rules = [
    ['girls-hostel', /girl/],
    ['boys-hostel', /hostel|\broom\b|b-block/],
    ['library', /librar/],
    ['canteen', /canteen|cafe/],
    ['town-hall', /town hall|auditorium/],
    ['badminton', /badminton/],
    ['ground', /ground|playground|cricket|sports/],
    ['quarters', /quarter|faculty resid/],
    ['power', /power (house|station)|generator|substation|transformer/],
    ['lake', /\blake\b|pond/],
    ['main-gate', /\bgate\b|security|entrance/],
    ['academic', /academic|class|\blab\b|a-\d|admin|office|block|corridor|dispenser/],
  ];
  for (const [id, re] of rules) {
    if (re.test(t)) {
      const l = CAMPUS_LANDMARKS.find((x) => x.id === id);
      if (l) return { lat: l.lat, lng: l.lng, id, name: l.name };
    }
  }
  return null;
}

const M_LAT = 110574;
const M_LNG = 111320 * Math.cos((IIITG_CENTER.lat * Math.PI) / 180);
const toXY = (lat, lng) => [(lng - IIITG_CENTER.lng) * M_LNG, (lat - IIITG_CENTER.lat) * M_LAT];

function pointInPolygon(lat, lng) {
  const vs = IIITG_CAMPUS_POLYGON;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [xi, yi] = vs[i], [xj, yj] = vs[j];
    if (((yi > lng) !== (yj > lng)) && (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export function distanceToCampusM(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  if (pointInPolygon(lat, lng)) return 0;
  const [px, py] = toXY(lat, lng);
  const vs = IIITG_CAMPUS_POLYGON;
  let best = Infinity;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [ax, ay] = toXY(vs[j][0], vs[j][1]);
    const [bx, by] = toXY(vs[i][0], vs[i][1]);
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

export const isInsideCampus = (lat, lng, tol = CAMPUS_TOLERANCE_M) => distanceToCampusM(lat, lng) <= tol;
export const fmtDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export function readDeviceGps(timeout = 12000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This device cannot share its location.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? 'Location permission is off. Allow location access to report this problem.'
              : 'Could not get your location. Move to an open area and try again.'
          )
        ),
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}
