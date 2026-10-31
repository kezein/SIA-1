/**
 * Meet Focus Tracker - Data Layer (Role 4: Dashboard)
 * 
 * Centralized data access layer.
 * Integrates directly with Supabase (schema.sql / Role 3 - Aaron Celindro)
 * Supports Google / Gmail Teacher Authentication & Supabase Realtime.
 * Seamlessly falls back to mockEvents.json for offline testing.
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
let supabaseClient = null;
let currentRealtimeChannel = null;

/**
 * Retrieves configured Supabase credentials from localStorage or CONFIG object.
 */
function getSupabaseConfig() {
  const storedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_url') : null;
  const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_anon_key') : null;

  const configUrl = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) ? CONFIG.SUPABASE_URL : '';
  const configKey = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_ANON_KEY) ? CONFIG.SUPABASE_ANON_KEY : '';

  const url = (storedUrl || configUrl || '').trim();
  const key = (storedKey || configKey || '').trim();

  const isConfigured = Boolean(url && key && !url.includes('your-project-id') && !key.includes('your-anon-public-key'));
  return { url, key, isConfigured };
}

/**
 * Initializes the Supabase client instance using supabase-js.
 */
function initSupabase() {
  if (supabaseClient) return supabaseClient;

  const { url, key, isConfigured } = getSupabaseConfig();

  if (isConfigured && typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    try {
      supabaseClient = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      console.log('[Dashboard] Supabase client initialized:', url);
    } catch (err) {
      console.warn('[Dashboard] Could not initialize Supabase client:', err);
    }
  }

  return supabaseClient;
}

/**
 * Saves project credentials to localStorage and reinitializes client.
 */
function saveSupabaseSettings(url, key) {
  if (typeof localStorage !== 'undefined') {
    if (url) localStorage.setItem('supabase_url', url.trim());
    if (key) localStorage.setItem('supabase_anon_key', key.trim());
  }
  supabaseClient = null;
  return initSupabase();
}

/**
 * Initiates Google OAuth (Gmail) sign in via Supabase Auth.
 */
async function signInWithGoogle() {
  const client = initSupabase();
  if (!client) {
    throw new Error("Supabase is not configured yet. Please enter your Project URL and Anon Key in settings.");
  }

  const redirectUrl = window.location.href.split('#')[0];
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Initiates email/password sign in via Supabase Auth.
 */
async function signInWithEmail(email, password) {
  const client = initSupabase();
  if (!client) {
    throw new Error("Supabase is not configured yet. Please enter your Project URL and Anon Key in settings.");
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password: password
  });

  if (error) throw error;
  return data;
}

/**
 * Creates a teacher account with Supabase email/password authentication.
 */
async function signUpWithEmail(email, password, fullName) {
  const client = initSupabase();
  if (!client) {
    throw new Error("Supabase is not configured. Add your project URL and anon key in Connection settings to create an account.");
  }

  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() }
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Signs out the teacher from Supabase session.
 */
async function signOut() {
  const client = initSupabase();
  if (client) {
    await client.auth.signOut();
  }
}

/**
 * Gets the current active Supabase user session.
 */
async function getCurrentUser() {
  const client = initSupabase();
  if (!client) return null;

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return null;
    return session.user;
  } catch (err) {
    return null;
  }
}

/**
 * Listens for auth state changes (login, logout, token refresh).
 */
function onAuthStateChange(callback) {
  const client = initSupabase();
  if (!client) return null;

  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (typeof callback === 'function') {
      callback(event, session);
    }
  });

  return subscription;
}

/**
 * Loads mock events fallback.
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
    console.warn("Could not fetch mockEvents.json (likely local file:// origin). Using built-in fallback data.", err);
    cachedAllEvents = FALLBACK_MOCK_EVENTS;
    return cachedAllEvents;
  }
}

/**
 * Returns { startMs, endMs } epoch timestamps for a named date range preset.
 * Used to filter events to a specific class session or time window.
 *
 * @param {'today'|'yesterday'|'last7'|'all'} range
 * @returns {{ startMs: number, endMs: number }}
 */
function getDateRangeTimestamps(range) {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  switch (range) {
    case 'today':
      return { startMs: todayStartMs, endMs: now };

    case 'yesterday': {
      const yesterdayStart = todayStartMs - 86400000; // -24h
      return { startMs: yesterdayStart, endMs: todayStartMs - 1 };
    }

    case 'last7': {
      const sevenDaysAgo = todayStartMs - 6 * 86400000; // inclusive of today
      return { startMs: sevenDaysAgo, endMs: now };
    }

    case 'all':
    default:
      return { startMs: 0, endMs: now };
  }
}

/**
 * Main data access function required by Role 4.
 * Fetches events matching the specified meetingCode.
 * Queries Supabase table `focus_events` live if available, with mock fallback.
 *
 * @param {string} meetingCode - The Google Meet code (e.g. 'abc-defg-hij')
 * @param {{ dateRange?: 'today'|'yesterday'|'last7'|'all' }} [options]
 * @returns {Promise<Array>} Array of event objects matching the meeting code
 */
async function getEvents(meetingCode, options = {}) {
  if (!meetingCode) return [];
  const normalizedCode = meetingCode.trim();
  const { dateRange = 'all' } = options;
  const { startMs, endMs } = getDateRangeTimestamps(dateRange);

  const client = initSupabase();

  if (client) {
    try {
      // Build query — apply date range filter server-side when not 'all'
      let query = client
        .from('focus_events')
        .select('*')
        .ilike('meetingCode', normalizedCode)
        .order('timestamp', { ascending: true });

      if (dateRange !== 'all') {
        query = query.gte('timestamp', startMs).lte('timestamp', endMs);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[Dashboard] Supabase query notice:', error.message);
      } else if (Array.isArray(data) && data.length > 0) {
        console.log(
          `[Dashboard] Fetched ${data.length} live event(s) from Supabase for "${normalizedCode}" [${dateRange}]`
        );
        return data;
      } else if (Array.isArray(data)) {
        // Query succeeded but returned 0 events.
        // For demo codes fall through to mock data so the UI stays demonstrable.
        if (normalizedCode.toLowerCase() === 'abc-defg-hij' || normalizedCode.toLowerCase() === 'xyz-uvwx-rst') {
          console.log('[Dashboard] No live events in Supabase for demo code; displaying mock demonstration.');
        } else {
          return [];
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Supabase live fetch failed, utilizing mock fallback:', err);
    }
  }

  // Fallback to mock dataset — apply date range filter client-side
  const allEvents = await loadAllEvents();
  return allEvents.filter(event => {
    if (!event.meetingCode) return false;
    if (event.meetingCode.trim().toLowerCase() !== normalizedCode.toLowerCase()) return false;
    if (dateRange !== 'all') {
      const ts = Number(event.timestamp) || 0;
      if (ts < startMs || ts > endMs) return false;
    }
    return true;
  });
}

/**
 * Returns a list of distinct meeting codes from Supabase or mock data.
 */
async function getAvailableMeetingCodes() {
  const client = initSupabase();

  if (client) {
    try {
      const { data, error } = await client
        .from('focus_events')
        .select('meetingCode');

      if (!error && Array.isArray(data) && data.length > 0) {
        const codes = Array.from(new Set(data.map(r => r.meetingCode).filter(Boolean)));
        if (codes.length > 0) return codes;
      }
    } catch (err) {
      console.warn('[Dashboard] Error querying meeting codes from Supabase:', err);
    }
  }

  const allEvents = await loadAllEvents();
  const codesSet = new Set();
  allEvents.forEach(e => {
    if (e.meetingCode) codesSet.add(e.meetingCode.trim());
  });
  return Array.from(codesSet);
}

/**
 * Subscribes to real-time events inserted into Supabase `focus_events`.
 * Live updates the teacher's dashboard without refreshing!
 */
function subscribeToRealtime(meetingCode, onEventCallback) {
  const client = initSupabase();
  if (!client || !meetingCode) return null;

  if (currentRealtimeChannel) {
    try {
      client.removeChannel(currentRealtimeChannel);
    } catch (e) {}
    currentRealtimeChannel = null;
  }

  try {
    currentRealtimeChannel = client
      .channel(`live-meet-${meetingCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'focus_events' },
        (payload) => {
          const newEv = payload.new;
          if (newEv && newEv.meetingCode && newEv.meetingCode.trim().toLowerCase() === meetingCode.trim().toLowerCase()) {
            console.log('[Dashboard] Live tab switch event received via Supabase Realtime:', newEv);
            if (typeof onEventCallback === 'function') {
              onEventCallback(newEv);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Dashboard] Supabase Realtime channel status: ${status}`);
      });

    return currentRealtimeChannel;
  } catch (err) {
    console.warn('[Dashboard] Realtime subscription error:', err);
    return null;
  }
}

/**
 * Computes analytics per participant for a list of events:
 * - switches: count of "left" events
 * - totalAway: sum of duration on "returned" events
 * - longestAway: maximum single duration on "returned" events
 * - status: 'In Meet' vs 'Currently Away' based on last event
 */
function computeParticipantStats(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  const map = new Map();
  const sorted = [...events].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

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
      const dur = typeof ev.duration === "number" ? ev.duration : (Number(ev.duration) || 0);
      item.totalAway += dur;
      if (dur > item.longestAway) {
        item.longestAway = dur;
      }
      item.returnedCount += 1;
    }
  });

  const DISCONNECT_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
  const now = Date.now();

  return Array.from(map.values()).map(item => {
    const isCurrentlyAway = item.lastEvent && item.lastEvent.type === "left";
    const currentAwayDuration = isCurrentlyAway && item.lastEvent
      ? Math.max(0, now - (Number(item.lastEvent.timestamp) || 0))
      : 0;
    const isDisconnected = isCurrentlyAway && currentAwayDuration >= DISCONNECT_THRESHOLD_MS;

    let statusCode = "active";
    let statusLabel = "In Meet";

    if (isDisconnected) {
      statusCode = "idle";
      statusLabel = "Disconnected / Idle";
    } else if (isCurrentlyAway) {
      statusCode = "away";
      statusLabel = "Away";
    }
    
    return {
      participant: item.participant,
      switches: item.switches,
      totalAway: item.totalAway,
      longestAway: item.longestAway,
      returnedCount: item.returnedCount,
      isCurrentlyAway: isCurrentlyAway,
      isDisconnected: isDisconnected,
      currentAwayDuration: currentAwayDuration,
      statusCode: statusCode,
      status: statusLabel,
      formattedTotalAway: formatDuration(item.totalAway),
      formattedLongestAway: formatDuration(item.longestAway),
      events: item.events
    };
  });
}

/**
 * Formats milliseconds into "mm:ss" format (or "hh:mm:ss" if >= 1 hour).
 */
function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms < 0) return "00:00";
  
  const totalSeconds = Math.round(Number(ms) / 1000);
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
    loadAllEvents,
    initSupabase,
    getSupabaseConfig,
    saveSupabaseSettings,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    getCurrentUser,
    onAuthStateChange,
    subscribeToRealtime,
    getDateRangeTimestamps
  };
}
