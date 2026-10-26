import { landmarkForText } from './campus.js';
import { categoryLabel } from '../data/catalog.js';

const isResolved = t => ['resolved', 'done'].includes((t?.status || '').toLowerCase().trim());

const matchesTech = (t, tech) => {
  const tid = tech.firebaseId || tech.clerk_id || tech.id;
  const assigned = t.assignedTo || t.assigned_to;
  return (assigned && assigned === tid) ||
    (t.assignedToEmail && tech.email && t.assignedToEmail.toLowerCase() === tech.email.toLowerCase());
};

// Per-technician performance (the "audit").
export function techStats(tickets, techs) {
  return techs.map(tech => {
    const mine = tickets.filter(t => matchesTech(t, tech));
    const fixed = mine.filter(isResolved);
    const ratings = fixed.map(t => t.rating).filter(r => typeof r === 'number');
    return {
      ...tech,
      given: mine.length,
      fixed: fixed.length,
      active: mine.filter(t => !isResolved(t)).length,
      reopened: mine.reduce((s, t) => s + (t.reopenCount || 0) + (t.status === 'reopened' ? 1 : 0), 0),
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    };
  }).sort((a, b) => b.fixed - a.fixed);
}

export function byCategory(tickets) {
  const map = {};
  tickets.forEach(t => {
    let cat = t.category || t.categoryName || t.category_name;
    // If missing or raw UUID, extract readable name from categoryDisplay or title
    if (!cat || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(cat)) {
      const full = t.categoryDisplay || t.title || '';
      if (full.includes('—')) {
        cat = full.split('—')[0].trim();
      } else if (full.includes(' - ')) {
        cat = full.split(' - ')[0].trim();
      } else {
        cat = 'Other';
      }
    }
    const label = categoryLabel(cat) || cat;
    map[label] = map[label] || { reported: 0, fixed: 0, urgent: 0, label };
    map[label].reported++;
    if (isResolved(t)) map[label].fixed++;
    if (t.priority === 'High' || t.status === 'escalated') map[label].urgent++;
  });
  return Object.entries(map).map(([k, v]) => ({ key: k, label: v.label || k, ...v })).sort((a, b) => b.reported - a.reported);
}

export function byPlace(tickets) {
  const map = {};
  tickets.forEach(t => {
    // Group spellings of the same building ("Academic Block", "Academic Building — Lab 2"…) under its official name
    const hit = landmarkForText(t.location);
    const p = hit?.name || (t.location || 'Campus').split(' — ')[0].trim() || 'Campus';
    map[p] = (map[p] || 0) + 1;
  });
  return Object.entries(map).map(([k, v]) => ({ place: k, count: v })).sort((a, b) => b.count - a.count);
}

export function summary(tickets) {
  const fixed = tickets.filter(isResolved);
  const ratings = fixed.map(t => t.rating).filter(r => typeof r === 'number');
  const open = tickets.filter(t => !isResolved(t));
  return {
    reported: tickets.length,
    fixed: fixed.length,
    open: open.length,
    unassigned: open.filter(t => !t.assignedTo && !t.assigned_to).length,
    urgent: tickets.filter(t => (t.priority === 'High' || t.status === 'escalated') && !isResolved(t)).length,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
  };
}

