// Compact problem catalogue for the report form. Mirrors the categories/teams
// from the original app. (The full catalogue can be loaded from the backend.)
export const CATEGORIES = [
  { key: 'IT', label: 'IT & Network', team: 'IT & Network Cell', issues: ['Wi-Fi not working', 'Internet very slow', 'LAN port not working', 'Projector not working'] },
  { key: 'Electrical', label: 'Electrical', team: 'Electrical Cell', issues: ['Fan not working', 'Tube light / bulb not working', 'Power socket not working', 'No power in room'] },
  { key: 'Water', label: 'Water & Plumbing', team: 'Plumbing & Estate', issues: ['No water supply', 'Tap leaking', 'Flush not working', 'Drain overflowing'] },
  { key: 'Hostel', label: 'Hostel Office', team: 'Hostel Office', issues: ['Room change request', 'Laundry service issue', 'Noise complaint'] },
  { key: 'Civil', label: 'Building & Civil', team: 'Civil & Building Maintenance', issues: ['Wall crack', 'Water seepage / damp wall', 'Roof leaking', 'Floor tiles broken'] },
  { key: 'Housekeeping', label: 'Cleaning & Pests', team: 'Housekeeping & Sanitation', issues: ['Room not cleaned', 'Garbage not collected', 'Cockroaches / rats', 'Mosquito problem'] },
  { key: 'Mess', label: 'Mess & Canteen', team: 'Mess & Food Services', issues: ['Food quality poor', 'Hygiene issue', 'Menu not followed'] },
  { key: 'Security', label: 'Security & Safety', team: 'Security Office', issues: ['Theft / item stolen', 'Lost & found', 'Suspicious person on campus', 'Gate / entry problem'] },
  { key: 'Medical', label: 'Medical', team: 'Medical Centre', issues: ['Need doctor / first aid', 'Ambulance needed', 'Medicine not available'] },
  { key: 'Other', label: 'Something else', team: null, issues: ['Something else (describe it in the details)'] },
];
export const categoryLabel = (k) => (CATEGORIES.find(c => c.key === k)?.label) || k;
