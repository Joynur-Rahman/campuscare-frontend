import { isLostFound, ticketLabel } from './ticketUtils.js';

const isResolved = t => ['resolved', 'done', 'fixed'].includes((t?.status || '').toLowerCase().trim());

export const cleanText = (str = '') =>
  String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Extracts a normalized room number from a location string or description.
 * Examples:
 *   "Boys Hostel Room 214" -> "214"
 *   "Boys Hostel (Room 214), IIIT Guwahati Campus" -> "214"
 *   "Room no. 214" -> "214"
 *   "Room-214" -> "214"
 *   "Academic Building Room A-110" -> "A-110"
 *   "Lab 2" -> "2"
 *   "Flat 102" -> "102"
 * Returns null if no room number is detected.
 */
export function extractRoomNumber(text = '') {
  if (!text) return null;
  const str = String(text);

  // 1. Prefer extracting from Location line if present
  const locM = str.match(/Location:\s*([^\n]+)/i);
  const targetStr = locM ? locM[1] : str;

  // Pattern for room identifier: digits (e.g. 214) or letter+digits/dash (e.g. A-110, B204)
  const m1 = targetStr.match(/\b(?:room|lab|flat|cabin|office)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Za-z]?\s*[-#]?\s*[0-9]+[A-Za-z]?)\b/i);
  if (m1) return m1[1].replace(/[\s#]/g, '').toUpperCase().trim();

  const m2 = targetStr.match(/\b(?:r|rm)[\s.#-]*([0-9]{2,4}[a-z]?)\b/i);
  if (m2) return m2[1].toUpperCase().trim();

  const m3 = targetStr.match(/\b(?:hostel|bh|gh|academic|block|flat|quarters|residence)\b[^,\n()]*?\b([0-9]{2,4}[a-z]?)\b/i);
  if (m3) return m3[1].toUpperCase().trim();

  // Fallback to searching full text
  const m4 = str.match(/\b(?:room|lab|flat|cabin|office)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Za-z]?\s*[-#]?\s*[0-9]+[A-Za-z]?)\b/i);
  if (m4) return m4[1].replace(/[\s#]/g, '').toUpperCase().trim();

  return null;
}

/**
 * Extracts a normalized floor string from a location string or description.
 * Examples:
 *   "Boys Hostel · 2nd Floor · Room 214" -> "2nd Floor"
 *   "Ground Floor" -> "Ground Floor"
 *   "3rd floor" -> "3rd Floor"
 *   "Basement" -> "Basement"
 * Returns null if no floor is specified.
 */
export function extractFloor(text = '') {
  if (!text) return null;
  const str = String(text);
  const locM = str.match(/Location:\s*([^\n]+)/i);
  const targetStr = locM ? locM[1] : str;

  if (/\b(?:ground|gf)\b/i.test(targetStr)) return 'Ground Floor';
  const m = targetStr.match(/\b([0-9])(?:st|nd|rd|th)?\s*floor\b/i);
  if (m) {
    const n = m[1];
    const suffix = n === '1' ? 'st' : n === '2' ? 'nd' : n === '3' ? 'rd' : 'th';
    return `${n}${suffix} Floor`;
  }
  if (/\bbasement\b/i.test(targetStr)) return 'Basement';
  return null;
}

/**
 * Extracts building/hostel slug to ensure rooms with same number in different hostels aren't confused.
 */
export function extractBuilding(text = '') {
  if (!text) return null;
  const t = String(text).toLowerCase();
  if (t.includes('girl') || t.includes('gh')) return 'girls-hostel';
  if (t.includes('boy') || t.includes('bh')) return 'boys-hostel';
  if (t.includes('academic') || t.includes('classroom') || t.includes('lab')) return 'academic';
  if (t.includes('library')) return 'library';
  if (t.includes('canteen') || t.includes('mess')) return 'canteen';
  if (t.includes('quarter') || t.includes('faculty')) return 'quarters';
  if (t.includes('town hall') || t.includes('auditorium')) return 'town-hall';
  if (t.includes('badminton')) return 'badminton';
  if (t.includes('power')) return 'power';
  if (t.includes('gate')) return 'main-gate';
  return null;
}

/**
 * Parses category and subcategory from ticket object or title.
 */
export function getCategoryAndSub(ticket = {}) {
  let cat = ticket.category || ticket.category_name || ticket.categoryName || '';
  let sub = ticket.subCategory || ticket.sub_category || '';

  const full = String(ticket.title || ticket.categoryDisplay || '').trim();
  if (full.includes('—') || full.includes(' - ') || full.includes('–')) {
    const parts = full.split(/[—–]|\s-\s/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      if (!cat || cat === 'Other') cat = parts[0];
      if (!sub) sub = parts.slice(1).join(' — ');
    }
  }

  return {
    category: cat.trim(),
    subCategory: sub.trim()
  };
}

/**
 * Finds potential duplicate clusters among active complaints.
 * CRITICAL RULE: Duplicate tickets are detected ONLY when they are from:
 * 1. Same Room Number (and non-conflicting building)
 * 2. Same Category
 * 3. Same Subcategory
 *
 * @param {Array} tickets - Full list of tickets
 * @returns {Object} map of ticketId -> Array<{ ticket, reason, score, room }>
 */
export function findDuplicateClusters(tickets = []) {
  const active = (tickets || []).filter(t => !isResolved(t) && !isLostFound(t));
  const clusterMap = {};

  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    for (let j = i + 1; j < active.length; j++) {
      const b = active[j];

      const aLoc = `${a.location || ''} ${a.description || ''}`;
      const bLoc = `${b.location || ''} ${b.description || ''}`;

      const roomA = extractRoomNumber(aLoc);
      const roomB = extractRoomNumber(bLoc);

      // Condition 1: Must be from the same room number
      if (!roomA || !roomB || roomA !== roomB) {
        continue;
      }

      // Condition 1b: If floor is specified in both, floors must not conflict
      const floorA = extractFloor(aLoc);
      const floorB = extractFloor(bLoc);
      if (floorA && floorB && floorA !== floorB) {
        continue;
      }

      // If building is specified in both, buildings must not conflict (e.g. Boys Hostel vs Girls Hostel)
      const bldA = extractBuilding(aLoc);
      const bldB = extractBuilding(bLoc);
      if (bldA && bldB && bldA !== bldB) {
        continue;
      }

      // Condition 2: Same category
      const { category: catA, subCategory: subA } = getCategoryAndSub(a);
      const { category: catB, subCategory: subB } = getCategoryAndSub(b);

      const cleanCatA = cleanText(catA);
      const cleanCatB = cleanText(catB);
      const sameCat = Boolean(
        (cleanCatA && cleanCatB && (cleanCatA === cleanCatB || cleanCatA.includes(cleanCatB) || cleanCatB.includes(cleanCatA))) ||
        (a.category_id && b.category_id && String(a.category_id) === String(b.category_id))
      );

      if (!sameCat) {
        continue;
      }

      // Condition 3: Same subcategory
      const cleanSubA = cleanText(subA);
      const cleanSubB = cleanText(subB);
      const sameSub = Boolean(
        cleanSubA && cleanSubB && (cleanSubA === cleanSubB || cleanSubA.includes(cleanSubB) || cleanSubB.includes(cleanSubA))
      );

      if (!sameSub) {
        continue;
      }

      const floorInfo = (floorA && floorA === floorB) ? ` · ${floorA}` : '';
      const reason = `Same Room (${roomA}${floorInfo}) · ${catA || 'Category'} — ${subA || 'Subcategory'}`;
      const score = 95;

      const aId = String(a.id);
      const bId = String(b.id);
      if (!clusterMap[aId]) clusterMap[aId] = [];
      if (!clusterMap[bId]) clusterMap[bId] = [];
      clusterMap[aId].push({ ticket: b, reason, score, room: roomA });
      clusterMap[bId].push({ ticket: a, reason, score, room: roomA });
    }
  }

  return clusterMap;
}

/**
 * Checks if the current student already has an active ticket for the candidate problem/issue.
 * If candidate specifies a room number, it only matches if the active ticket has the SAME room number.
 *
 * @param {Array} userTickets - Tickets belonging to the current user
 * @param {Object} candidate - { category, problem, location, title }
 * @returns {Object|null} The active ticket if duplicate found, or null
 */
export function findUserActiveDuplicate(userTickets = [], candidate = {}) {
  const active = (userTickets || []).filter(t => !isResolved(t) && !isLostFound(t));
  if (!active.length) return null;

  const candLoc = candidate.location || '';
  const candRoom = candidate.room || extractRoomNumber(candLoc);
  const candFloor = candidate.floor || extractFloor(candLoc);
  const candBld = extractBuilding(candLoc);

  const candCat = cleanText(candidate.category || '');
  const candSub = cleanText(candidate.problem || '');

  for (const t of active) {
    const tLoc = `${t.location || ''} ${t.description || ''}`;
    const tRoom = extractRoomNumber(tLoc);
    const tFloor = extractFloor(tLoc);
    const tBld = extractBuilding(tLoc);

    // If candidate has a room number and ticket has a room number, they MUST match!
    if (candRoom && tRoom) {
      if (candRoom !== tRoom) {
        continue;
      }
      if (candFloor && tFloor && candFloor !== tFloor) {
        continue;
      }
      if (candBld && tBld && candBld !== tBld) {
        continue;
      }
    } else if (candRoom && !tRoom) {
      // Candidate specifies a room but active ticket didn't have one
      continue;
    }

    const { category: tCat, subCategory: tSub } = getCategoryAndSub(t);
    const cleanTCat = cleanText(tCat);
    const cleanTSub = cleanText(tSub);

    const sameCat = !candCat || !cleanTCat || candCat === cleanTCat || candCat.includes(cleanTCat) || cleanTCat.includes(candCat);
    const sameSub = candSub && cleanTSub && (candSub === cleanTSub || candSub.includes(cleanTSub) || cleanTSub.includes(candSub));

    if (sameCat && sameSub) {
      if (candRoom && tRoom && candRoom === tRoom) {
        return t;
      }
    }
  }

  return null;
}
