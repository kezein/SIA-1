/**
 * Meet Focus Tracker - Data Layer (Role 4)
 * 
 * All data access is centralized in this file.
 * Currently reads from mockEvents.json (with fallback for file:// protocol).
 * On Integration Day (Wednesday), Role 3 and Role 4 will update ONLY
 * getEvents(meetingCode) to query the real database (Firebase or Supabase).
 */

// Fallback dataset in case fetch is blocked by browser file:// CORS restrictions
const FALLBACK_MOCK_EVENTS = [
  { "participant": "Maria Santos", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340000000, "duration": null },
  { "participant": "Maria Santos", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340025000, "duration": 25000 },
  { "participant": "Maria Santos", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340300000, "duration": null },
  { "participant": "Maria Santos", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340345000, "duration": 45000 },
  { "participant": "Maria Santos", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340800000, "duration": null },
  { "participant": "Maria Santos", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340815000, "duration": 15000 },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340050000, "duration": null },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340062000, "duration": 12000 },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340200000, "duration": null },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340260000, "duration": 60000 },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340500000, "duration": null },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340530000, "duration": 30000 },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340700000, "duration": null },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340790000, "duration": 90000 },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760341100000, "duration": null },
  { "participant": "John Doe", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760341118000, "duration": 18000 },
  { "participant": "Alex Rivera", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340400000, "duration": null },
  { "participant": "Chloe Tan", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340150000, "duration": null },
  { "participant": "Chloe Tan", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340160000, "duration": 10000 },
  { "participant": "Chloe Tan", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340600000, "duration": null },
  { "participant": "Chloe Tan", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340620000, "duration": 20000 },
  { "participant": "David Kim", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340100000, "duration": null },
  { "participant": "David Kim", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340115000, "duration": 15000 },
  { "participant": "David Kim", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340350000, "duration": null },
  { "participant": "David Kim", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340375000, "duration": 25000 },
  { "participant": "David Kim", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340720000, "duration": null },
  { "participant": "David Kim", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340755000, "duration": 35000 },
  { "participant": "David Kim", "meetingCode": "abc-defg-hij", "type": "left", "timestamp": 1760340900000, "duration": null },
  { "participant": "David Kim", "meetingCode": "abc-defg-hij", "type": "returned", "timestamp": 1760340940000, "duration": 40000 },
  { "participant": "Maria Santos", "meetingCode": "xyz-uvwx-rst", "type": "left", "timestamp": 1760350000000, "duration": null },
  { "participant": "Maria Santos", "meetingCode": "xyz-uvwx-rst", "type": "returned", "timestamp": 1760350018000, "duration": 18000 },
  { "participant": "Alex Rivera", "meetingCode": "xyz-uvwx-rst", "type": "left", "timestamp": 1760350100000, "duration": null },
  { "participant": "Alex Rivera", "meetingCode": "xyz-uvwx-rst", "type": "returned", "timestamp": 1760350130000, "duration": 30000 },
  { "participant": "Alex Rivera", "meetingCode": "xyz-uvwx-rst", "type": "left", "timestamp": 1760350400000, "duration": null },
  { "participant": "Alex Rivera", "meetingCode": "xyz-uvwx-rst", "type": "returned", "timestamp": 1760350445000, "duration": 45000 },
  { "participant": "Chloe Tan", "meetingCode": "xyz-uvwx-rst", "type": "left", "timestamp": 1760350200000, "duration": null },
  { "participant": "David Kim", "meetingCode": "xyz-uvwx-rst", "type": "left", "timestamp": 1760350250000, "duration": null },
  { "participant": "David Kim", "meetingCode": "xyz-uvwx-rst", "type": "returned", "timestamp": 1760350272000, "duration": 22000 },
  { "participant": "David Kim", "meetingCode": "xyz-uvwx-rst", "type": "left", "timestamp": 1760350500000, "duration": null },
  { "participant": "David Kim", "meetingCode": "xyz-uvwx-rst", "type": "returned", "timestamp": 1760350531000, "duration": 31000 }
];

let cachedAllEvents = null;

/**
 * Loads all events either by fetching mockEvents.json or using the fallback data.
 */
async function loadAllEvents() {
  if (cachedAllEvents) return cachedAllEvents;

  try {
    const response = await fetch("mockEvents.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    cachedAllEvents = await response.json();
    return cachedAllEvents;
  } catch (err) {
    console.warn("Could not fetch mockEvents.json via HTTP (likely local file:// origin). Using built-in fallback data.", err);
    cachedAllEvents = FALLBACK_MOCK_EVENTS;
    return cachedAllEvents;
  }
}

/**
 * Main data access function required by Role 4.
 * Fetches events matching the specified meetingCode.
 * 
 * TODO (Role 3 & Role 4 on Wednesday):
 * Replace this implementation with Supabase / Firebase query:
 *   const { data, error } = await supabase
 *     .from('events')
 *     .select('*')
 *     .eq('meetingCode', meetingCode);
 * 
 * @param {string} meetingCode - The Google Meet code (e.g. 'abc-defg-hij')
 * @returns {Promise<Array>} Array of event objects matching the meeting code
 */
async function getEvents(meetingCode) {
  if (!meetingCode) return [];
  
  const normalizedCode = meetingCode.trim().toLowerCase();
  const allEvents = await loadAllEvents();

  return allEvents.filter(event => 
    event.meetingCode && event.meetingCode.trim().toLowerCase() === normalizedCode
  );
}

/**
 * Returns a list of all distinct meeting codes found in the events dataset.
 */
async function getAvailableMeetingCodes() {
  const allEvents = await loadAllEvents();
  const codesSet = new Set();
  allEvents.forEach(e => {
    if (e.meetingCode) codesSet.add(e.meetingCode.trim());
  });
  return Array.from(codesSet);
}

/**
 * Computes analytics per participant for a list of events:
 * - switches: count of "left" events
 * - totalAway: sum of duration on "returned" events
 * - longestAway: maximum single duration on "returned" events
 * - status: 'In Meet' vs 'Currently Away' based on last event
 * 
 * @param {Array} events - Event list for a specific meeting
 * @returns {Array} List of participant summaries
 */
function computeParticipantStats(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  const map = new Map();

  // Sort events chronologically
  const sorted = [...events].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  sorted.forEach(ev => {
    const name = ev.participant ? ev.participant.trim() : "Unknown Student";
    if (!map.has(name)) {
      map.set(name, {
        participant: name,
        switches: 0,
        totalAway: 0,
        longestAway: 0,
        returnedCount: 0,
        lastEvent: null,
        events: []
      });
    }

    const item = map.get(name);
    item.events.push(ev);
    item.lastEvent = ev;

    if (ev.type === "left") {
      item.switches += 1;
    } else if (ev.type === "returned") {
      const dur = typeof ev.duration === "number" ? ev.duration : 0;
      item.totalAway += dur;
      if (dur > item.longestAway) {
        item.longestAway = dur;
      }
      item.returnedCount += 1;
    }
  });

  return Array.from(map.values()).map(item => {
    // Edge case check: if student's last recorded action was "left", they haven't returned yet
    const isCurrentlyAway = item.lastEvent && item.lastEvent.type === "left";
    
    return {
      participant: item.participant,
      switches: item.switches,
      totalAway: item.totalAway,
      longestAway: item.longestAway,
      returnedCount: item.returnedCount,
      isCurrentlyAway: isCurrentlyAway,
      status: isCurrentlyAway ? "Away (Tab Switched)" : "In Meet (Active)",
      formattedTotalAway: formatDuration(item.totalAway),
      formattedLongestAway: formatDuration(item.longestAway),
      events: item.events
    };
  });
}

/**
 * Formats milliseconds into "mm:ss" format (or "hh:mm:ss" if >= 1 hour).
 * 
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms < 0) return "00:00";
  
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

// Expose on window object
if (typeof window !== "undefined") {
  window.DashboardData = {
    getEvents,
    getAvailableMeetingCodes,
    computeParticipantStats,
    formatDuration,
    loadAllEvents
  };
}
