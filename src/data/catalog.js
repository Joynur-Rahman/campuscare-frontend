// Problem catalogue for the report form.
//
// BACKEND NOTE: the backend only knows the 10 original category keys below
// (IT, Electrical, Water, Hostel, Civil, Housekeeping, Mess, Security, Medical,
// Other) and their `team` names (= department names). Every extra category is
// a frontend-only grouping: it has `team: null` and a `submitAs` key, so the
// ticket is still filed under a backend-known category/department. The full
// "Category — Problem" text always travels in the ticket title, so staff and
// admins still see exactly what was reported.
//
// Fields
//   key        stable id used in the UI
//   label      shown to students
//   group      dropdown section
//   team       backend department name (only on backend-known categories)
//   submitAs   backend category key used when the ticket is created
//   handledBy  who usually deals with it (shown as a hint only)
//   onSite     true  → a campus location is needed to fix it
//   confidential true → private complaint: never public, location optional
//   issues     sub-categories

export const GROUPS = [
  'Maintenance & Facilities',
  'Hostel, Mess & Campus Life',
  'Academics & Administration',
  'Safety, Conduct & Wellbeing',
  'Other',
];

export const CATEGORIES = [
  // ───────────── Maintenance & Facilities ─────────────
  {
    key: 'IT', label: 'IT & Network', group: 'Maintenance & Facilities', team: 'IT & Network Cell', onSite: true,
    issues: [
      'Wi-Fi not working', 'Internet very slow', 'Wi-Fi login / captive portal issue', 'LAN port not working',
      'Network cable damaged', 'Campus email / account access issue', 'ERP / student portal not working',
      'Software licence or installation request', 'Printer / scanner not working', 'CCTV camera not working',
    ],
  },
  {
    key: 'Electrical', label: 'Electrical', group: 'Maintenance & Facilities', team: 'Electrical Cell', onSite: true,
    issues: [
      'Fan not working', 'Tube light / bulb not working', 'Power socket not working', 'No power in room',
      'Switchboard damaged / sparking', 'MCB keeps tripping', 'Exposed or loose wiring', 'Inverter / power backup issue',
      'Frequent power cuts', 'Street light not working',
    ],
  },
  {
    key: 'Appliances', label: 'AC, Geyser & Appliances', group: 'Maintenance & Facilities', team: null, submitAs: 'Electrical',
    handledBy: 'Electrical Cell', onSite: true,
    issues: [
      'AC not cooling', 'AC leaking water', 'AC remote missing / not working', 'Geyser not working',
      'Water cooler not working', 'Water purifier (RO) not working', 'Washing machine not working',
      'Refrigerator not working', 'Lift / elevator not working', 'Lift stuck (people inside)',
    ],
  },
  {
    key: 'Water', label: 'Water & Plumbing', group: 'Maintenance & Facilities', team: 'Plumbing & Estate', onSite: true,
    issues: [
      'No water supply', 'Low water pressure', 'Tap leaking', 'Flush not working', 'Toilet / commode blocked',
      'Drain overflowing', 'Pipe burst / leakage', 'Shower not working', 'Dirty / smelly water',
      'Water tank overflowing', 'Wash basin broken',
    ],
  },
  {
    key: 'Civil', label: 'Building & Civil', group: 'Maintenance & Facilities', team: 'Civil & Building Maintenance', onSite: true,
    issues: [
      'Wall crack', 'Water seepage / damp wall', 'Roof leaking', 'Floor tiles broken', 'Plaster falling',
      'Staircase / railing damaged', 'Window glass broken', 'Painting needed', 'Waterlogging in campus',
      'Ramp / accessibility issue',
    ],
  },
  {
    key: 'Furniture', label: 'Furniture, Doors & Locks', group: 'Maintenance & Facilities', team: null, submitAs: 'Civil',
    handledBy: 'Civil & Building Maintenance', onSite: true,
    issues: [
      'Bed / cot broken', 'Chair / table broken', 'Cupboard / almirah broken', 'Door not closing / damaged',
      'Lock / latch broken', 'Lost room key', 'Window latch / mesh broken', 'Curtain rod broken',
      'Mattress damaged', 'Classroom bench damaged',
    ],
  },
  {
    key: 'Housekeeping', label: 'Cleaning & Pests', group: 'Maintenance & Facilities', team: 'Housekeeping & Sanitation', onSite: true,
    issues: [
      'Room not cleaned', 'Washroom not cleaned', 'Corridor / common area dirty', 'Garbage not collected',
      'Dustbin missing / overflowing', 'Cockroaches / rats', 'Mosquito problem', 'Bed bugs',
      'Stray animals / snakes', 'Bad smell / sewage odour',
    ],
  },
  {
    key: 'Grounds', label: 'Roads, Gardens & Outdoors', group: 'Maintenance & Facilities', team: null, submitAs: 'Civil',
    handledBy: 'Estate & Civil Maintenance', onSite: true,
    issues: [
      'Road / pathway damaged', 'Overgrown grass / bushes', 'Fallen tree / branch', 'Garden not maintained',
      'Open drain / manhole', 'Parking issue', 'Signboard missing / damaged', 'Construction debris lying around',
    ],
  },
  {
    key: 'Classroom', label: 'Classrooms & Labs', group: 'Maintenance & Facilities', team: null, submitAs: 'IT',
    handledBy: 'IT Cell / Lab staff', onSite: true,
    issues: [
      'Projector not working', 'Smart board / display not working', 'Mic / speaker not working',
      'Lab computer not working', 'Lab equipment faulty', 'Software missing on lab PCs', 'Lab not opened on time',
      'Classroom AC / fan not working', 'Not enough seats / benches',
    ],
  },

  // ───────────── Hostel, Mess & Campus Life ─────────────
  {
    key: 'Hostel', label: 'Hostel Office', group: 'Hostel, Mess & Campus Life', team: 'Hostel Office', onSite: true,
    issues: [
      'Room allotment / change request', 'Roommate issue', 'Noise complaint', 'Laundry service issue',
      'Hostel gate timing issue', 'Guest / visitor permission', 'Common room / TV room issue',
      'Hostel warden not available', 'Hostel ID / entry card issue',
    ],
  },
  {
    key: 'Mess', label: 'Mess & Canteen', group: 'Hostel, Mess & Campus Life', team: 'Mess & Food Services', onSite: true,
    issues: [
      'Food quality poor', 'Food undercooked / stale', 'Insect / foreign object in food', 'Hygiene issue',
      'Menu not followed', 'Quantity not enough', 'Drinking water not available', 'Overcharging at canteen',
      'Mess timing issue', 'Mess rebate / bill issue',
    ],
  },
  {
    key: 'Library', label: 'Library', group: 'Hostel, Mess & Campus Life', team: null, submitAs: 'Other',
    handledBy: 'Central Library', onSite: true,
    issues: [
      'Book not available', 'Book issue / return problem', 'Library fine dispute', 'E-resources / journal access',
      'Reading room seating', 'Library timing issue', 'Library AC / lights / Wi-Fi',
    ],
  },
  {
    key: 'Sports', label: 'Sports & Gym', group: 'Hostel, Mess & Campus Life', team: null, submitAs: 'Other',
    handledBy: 'Sports Office', onSite: true,
    issues: [
      'Gym equipment broken', 'Sports equipment not available', 'Ground / court not maintained',
      'Court lights not working', 'Facility booking issue', 'Sports room / gym timing issue',
    ],
  },
  {
    key: 'Transport', label: 'Transport & Bus', group: 'Hostel, Mess & Campus Life', team: null, submitAs: 'Other',
    handledBy: 'Transport / Admin Office', onSite: false,
    issues: [
      'Bus late / missed', 'Bus timing change request', 'Overcrowded bus', 'Rash driving', 'Bus breakdown',
      'Bus pass issue', 'Vehicle / parking permit',
    ],
  },
  {
    key: 'Clubs', label: 'Clubs, Fests & Events', group: 'Hostel, Mess & Campus Life', team: null, submitAs: 'Other',
    handledBy: 'Student Activity Centre', onSite: false,
    issues: [
      'Venue booking issue', 'Event permission delay', 'Club funds / reimbursement', 'Equipment for event',
      'Noise from event after hours',
    ],
  },

  // ───────────── Academics & Administration ─────────────
  {
    key: 'Faculty', label: 'Faculty & Teaching', group: 'Academics & Administration', team: null, submitAs: 'Other',
    handledBy: 'Head of Department / Dean (Academic)', onSite: false, confidential: true,
    issues: [
      'Faculty frequently absent / late', 'Classes not taken as per schedule', 'Syllabus not completed',
      'Unfair grading / evaluation', 'Biased or rude behaviour by faculty', 'Faculty not available for doubts',
      'Attendance marked incorrectly', 'Harassment by faculty / staff',
    ],
  },
  {
    key: 'Academic', label: 'Courses, Attendance & Timetable', group: 'Academics & Administration', team: null, submitAs: 'Other',
    handledBy: 'Academic Section', onSite: false,
    issues: [
      'Course registration issue', 'Timetable clash', 'Elective not allotted', 'Attendance shortage / correction',
      'Credit transfer / backlog', 'Internship / project approval', 'Academic calendar issue', 'TA / lab assistant issue',
    ],
  },
  {
    key: 'Exams', label: 'Examinations & Results', group: 'Academics & Administration', team: null, submitAs: 'Other',
    handledBy: 'Examination Cell', onSite: false,
    issues: [
      'Result not declared', 'Wrong marks / grade', 'Re-evaluation request', 'Answer sheet not shown',
      'Exam schedule clash', 'Admit card issue', 'Grade card / transcript delay', 'Malpractice report',
    ],
  },
  {
    key: 'Fees', label: 'Fees, Scholarships & Accounts', group: 'Academics & Administration', team: null, submitAs: 'Other',
    handledBy: 'Accounts Section', onSite: false,
    issues: [
      'Fee payment failed / not updated', 'Refund pending', 'Scholarship not received', 'Scholarship document issue',
      'Fine / penalty dispute', 'Fee receipt not generated', 'Hostel / mess dues issue',
    ],
  },
  {
    key: 'Admin', label: 'Documents & Admin Office', group: 'Academics & Administration', team: null, submitAs: 'Other',
    handledBy: 'Administration / Registrar Office', onSite: false,
    issues: [
      'ID card not issued / lost', 'Bonafide certificate', 'No-dues certificate', 'Name / DOB correction in records',
      'Leave / outpass approval', 'Document verification delay', 'Character / migration certificate',
    ],
  },
  {
    key: 'Placement', label: 'Training & Placement', group: 'Academics & Administration', team: null, submitAs: 'Other',
    handledBy: 'Training & Placement Cell', onSite: false,
    issues: [
      'Not informed about a drive', 'Eligibility / shortlisting issue', 'Internship NOC / approval',
      'Placement portal issue', 'Offer letter / company issue',
    ],
  },

  // ───────────── Safety, Conduct & Wellbeing ─────────────
  {
    key: 'Ragging', label: 'Ragging & Bullying', group: 'Safety, Conduct & Wellbeing', team: null, submitAs: 'Security',
    handledBy: 'Anti-Ragging Committee', onSite: false, confidential: true,
    issues: [
      'Ragging by seniors', 'Verbal abuse / humiliation', 'Physical abuse', 'Forced activities / tasks',
      'Online / social-media bullying', 'Threats or intimidation', 'Witnessed ragging of someone else',
    ],
  },
  {
    key: 'Harassment', label: 'Harassment & Discrimination', group: 'Safety, Conduct & Wellbeing', team: null, submitAs: 'Security',
    handledBy: 'Internal Complaints Committee (ICC)', onSite: false, confidential: true,
    issues: [
      'Sexual harassment', 'Stalking', 'Gender discrimination', 'Caste / regional discrimination',
      'Discrimination against disability', 'Hostile behaviour by staff', 'Cyber harassment',
    ],
  },
  {
    key: 'Security', label: 'Security & Safety', group: 'Safety, Conduct & Wellbeing', team: 'Security Office', onSite: true,
    issues: [
      'Theft / item stolen', 'Lost & found', 'Suspicious person on campus', 'Gate / entry problem',
      'Fight / violence', 'Fire hazard / extinguisher missing', 'Unsafe area at night', 'Alcohol / drugs on campus',
      'Guard not at post',
    ],
  },
  {
    key: 'Medical', label: 'Medical', group: 'Safety, Conduct & Wellbeing', team: 'Medical Centre', onSite: true,
    issues: [
      'Need doctor / first aid', 'Ambulance needed', 'Medicine not available', 'Medical centre closed / doctor absent',
      'Medical certificate / leave', 'Health insurance claim',
    ],
  },
  {
    key: 'Wellbeing', label: 'Counselling & Mental Health', group: 'Safety, Conduct & Wellbeing', team: null, submitAs: 'Medical',
    handledBy: 'Student Counsellor', onSite: false, confidential: true,
    issues: [
      'Want to talk to a counsellor', 'Stress / anxiety', 'Academic pressure', 'Homesickness / loneliness',
      'Concern about a friend', 'Substance use concern',
    ],
  },

  // ───────────── Other ─────────────
  {
    key: 'Other', label: 'Something else', group: 'Other', team: null, onSite: false,
    issues: ['Suggestion / feedback', 'General complaint', 'Something else (describe it in the details)'],
  },
];

const BY_KEY = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

export const getCategory = (k) => BY_KEY[k] || null;
export const categoryLabel = (k) => BY_KEY[k]?.label || k;
/** Backend category key a catalog entry is filed under. */
export const submitKey = (k) => BY_KEY[k]?.submitAs || k;
export const isConfidentialCategory = (k) => Boolean(BY_KEY[k]?.confidential);
export const needsLocation = (k) => BY_KEY[k] ? BY_KEY[k].onSite !== false : true;
