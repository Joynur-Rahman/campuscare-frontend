import { isLostFound } from './ticketUtils.js';

const isResolved = t => ['resolved', 'done', 'fixed'].includes((t?.status || '').toLowerCase().trim());

/**
 * Finds potential duplicate clusters among active complaints.
 * @param {Array} tickets - Full list of tickets
 * @returns {Object} map of ticketId -> Array<{ ticket, reason, score }>
 */
export function findDuplicateClusters(tickets = []) {
  const active = (tickets || []).filter(t => !isResolved(t) && !isLostFound(t));
  const clusterMap = {};

  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    for (let j = i + 1; j < active.length; j++) {
      const b = active[j];
      let match = false;
      let reason = '';
      let score = 0;

      const aLoc = (a.location || '').toLowerCase();
      const bLoc = (b.location || '').toLowerCase();
      const aCat = (a.category || a.categoryDisplay || '').toLowerCase();
      const bCat = (b.category || b.categoryDisplay || '').toLowerCase();
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();

      const aLandmark = aLoc.split(',')[0].trim();
      const bLandmark = bLoc.split(',')[0].trim();

      // Check 1: Same official campus landmark + same category
      if (aLandmark && bLandmark && aLandmark === bLandmark && aCat && bCat && aCat === bCat) {
        match = true;
        score = 85;
        reason = `Same location & category: ${a.location?.split(',')[0]} · ${a.category}`;
      } else if (aLandmark && bLandmark && aLandmark === bLandmark) {
        // Check 2: Same landmark + keyword overlap in title
        const aWords = aTitle.split(/\W+/).filter(w => w.length >= 4 && !['issue', 'problem', 'need', 'please'].includes(w));
        const bWords = bTitle.split(/\W+/).filter(w => w.length >= 4 && !['issue', 'problem', 'need', 'please'].includes(w));
        const overlap = aWords.filter(w => bWords.includes(w));
        if (overlap.length >= 1) {
          match = true;
          score = 75;
          reason = `Same location (${aLandmark}) & problem keywords (${overlap.join(', ')})`;
        }
      } else {
        // Check 3: Significant title and problem description overlap
        const aWords = aTitle.split(/\W+/).filter(w => w.length >= 4);
        const bWords = bTitle.split(/\W+/).filter(w => w.length >= 4);
        const overlap = aWords.filter(w => bWords.includes(w));
        if (overlap.length >= 2 && aCat === bCat) {
          match = true;
          score = 65;
          reason = `Matching category (${a.category}) & issue title`;
        }
      }

      if (match) {
        if (!clusterMap[a.id]) clusterMap[a.id] = [];
        if (!clusterMap[b.id]) clusterMap[b.id] = [];
        clusterMap[a.id].push({ ticket: b, reason, score });
        clusterMap[b.id].push({ ticket: a, reason, score });
      }
    }
  }

  return clusterMap;
}
