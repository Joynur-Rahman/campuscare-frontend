import { isLostFound, ticketLabel } from './ticketUtils.js';

const isResolved = t => ['resolved', 'done', 'fixed'].includes((t?.status || '').toLowerCase().trim());

const cleanText = (str = '') =>
  String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

      const aLoc = cleanText(a.location || '');
      const bLoc = cleanText(b.location || '');
      const aLandmark = aLoc.split(',')[0].trim();
      const bLandmark = bLoc.split(',')[0].trim();

      const aRawTitle = String(a.title || ticketLabel(a) || '');
      const bRawTitle = String(b.title || ticketLabel(b) || '');
      const aTitle = cleanText(aRawTitle);
      const bTitle = cleanText(bRawTitle);

      const aCat = cleanText(a.category || a.categoryDisplay || a.category_name || '');
      const bCat = cleanText(b.category || b.categoryDisplay || b.category_name || '');
      const sameCat = Boolean(
        (aCat && bCat && (aCat === bCat || aCat.includes(bCat) || bCat.includes(aCat))) ||
        (a.category_id && b.category_id && String(a.category_id) === String(b.category_id))
      );

      // Check 1: Exact or near-exact title match (>= 6 chars)
      if (aTitle && bTitle && (aTitle === bTitle || aTitle.includes(bTitle) || bTitle.includes(aTitle)) && Math.min(aTitle.length, bTitle.length) >= 6) {
        match = true;
        score = 95;
        reason = `Identical or matching issue: "${a.title || ticketLabel(a)}"`;
      }

      // Check 2: Same specific sub-problem after separator (e.g., "Elective not allotted" or "Tap leaking")
      if (!match) {
        const aParts = aRawTitle.split(/[—–\-\ufffd|:]/).map(cleanText).filter(Boolean);
        const bParts = bRawTitle.split(/[—–\-\ufffd|:]/).map(cleanText).filter(Boolean);
        const aSub = aParts[aParts.length - 1] || '';
        const bSub = bParts[bParts.length - 1] || '';
        if (aSub && bSub && aSub === bSub && aSub.length >= 5) {
          match = true;
          score = 90;
          reason = `Same specific problem: "${aSub}"`;
        }
      }

      // Check 3: Same official campus landmark + same category or 1+ keyword overlap
      if (!match && aLandmark && bLandmark && aLandmark === bLandmark) {
        if (sameCat) {
          match = true;
          score = 85;
          reason = `Same landmark (${a.location?.split(',')[0]}) & category`;
        } else {
          const aWords = aTitle.split(' ').filter(w => w.length >= 4 && !['issue', 'problem', 'need', 'please', 'help'].includes(w));
          const bWords = bTitle.split(' ').filter(w => w.length >= 4 && !['issue', 'problem', 'need', 'please', 'help'].includes(w));
          const overlap = aWords.filter(w => bWords.includes(w));
          if (overlap.length >= 1) {
            match = true;
            score = 80;
            reason = `Same landmark (${aLandmark}) & problem keyword (${overlap[0]})`;
          }
        }
      }

      // Check 4: Significant title keyword overlap (>= 2 distinctive words of length >= 4)
      if (!match) {
        const aWords = aTitle.split(' ').filter(w => w.length >= 4 && !['issue', 'problem', 'need', 'please', 'help', 'campus', 'room'].includes(w));
        const bWords = bTitle.split(' ').filter(w => w.length >= 4 && !['issue', 'problem', 'need', 'please', 'help', 'campus', 'room'].includes(w));
        const overlap = aWords.filter(w => bWords.includes(w));
        if (overlap.length >= 2) {
          match = true;
          score = sameCat ? 80 : 70;
          reason = `Matching issue keywords: ${overlap.join(', ')}`;
        }
      }

      if (match) {
        const aId = String(a.id);
        const bId = String(b.id);
        if (!clusterMap[aId]) clusterMap[aId] = [];
        if (!clusterMap[bId]) clusterMap[bId] = [];
        clusterMap[aId].push({ ticket: b, reason, score });
        clusterMap[bId].push({ ticket: a, reason, score });
      }
    }
  }

  return clusterMap;
}

/**
 * Checks if the current student already has an active ticket for the candidate problem/issue.
 * @param {Array} userTickets - Tickets belonging to the current user
 * @param {Object} candidate - { category, problem, title }
 * @returns {Object|null} The active ticket if duplicate found, or null
 */
export function findUserActiveDuplicate(userTickets = [], candidate = {}) {
  const active = (userTickets || []).filter(t => !isResolved(t) && !isLostFound(t));
  if (!active.length) return null;

  const rawTitle = String(candidate.title || `${candidate.category || ''} — ${candidate.problem || ''}`).trim();
  const candTitle = cleanText(rawTitle);
  const candProblem = cleanText(candidate.problem || '');

  const candParts = rawTitle.split(/[—–\-\ufffd|:]/).map(cleanText).filter(Boolean);
  const candSub = candParts[candParts.length - 1] || candProblem;

  for (const t of active) {
    const tRawTitle = String(t.title || ticketLabel(t) || '');
    const tTitle = cleanText(tRawTitle);
    const tSub = cleanText(t.subCategory || '');

    const tParts = tRawTitle.split(/[—–\-\ufffd|:]/).map(cleanText).filter(Boolean);
    const tLastSub = tParts[tParts.length - 1] || tSub;

    // Check 1: Exact or substring match in full title
    if (candTitle && tTitle && (candTitle === tTitle || candTitle.includes(tTitle) || tTitle.includes(candTitle)) && Math.min(candTitle.length, tTitle.length) >= 6) {
      return t;
    }

    // Check 2: Same specific sub-problem (e.g. "Elective not allotted")
    if (candSub && tLastSub && candSub === tLastSub && candSub.length >= 4) {
      return t;
    }

    // Check 3: Candidate problem contained in existing ticket title or subCategory
    if (candProblem && candProblem.length >= 4 && (tTitle.includes(candProblem) || tSub === candProblem)) {
      return t;
    }
  }

  return null;
}
