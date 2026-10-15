/**
 * Meet Focus Tracker - Supabase Client & Backend Integration (Role 3)
 * Author: Aaron Celindro
 * 
 * Communicates directly with Supabase via its PostgREST REST API.
 * Uses native fetch() - zero external dependencies, compatible with Chrome MV3 Service Worker.
 */

const SupabaseClient = (() => {
  /**
   * Retrieves configuration from global scope or chrome storage.
   */
  function getConfig() {
    const config = (typeof self !== 'undefined' && self.SUPABASE_CONFIG) ||
                   (typeof window !== 'undefined' && window.SUPABASE_CONFIG) ||
                   {};

    return {
      url: (config.url || '').trim().replace(/\/+$/, ''),
      anonKey: (config.anonKey || '').trim()
    };
  }

  /**
   * Validates whether credentials have been configured and aren't placeholders.
   */
  function isConfigured() {
    const { url, anonKey } = getConfig();
    return Boolean(
      url &&
      anonKey &&
      !url.includes('YOUR_PROJECT_ID') &&
      !anonKey.includes('YOUR_SUPABASE_ANON_KEY')
    );
  }

  /**
   * Flushes any queued events that previously failed to send due to network issues.
   */
  async function flushPendingEvents() {
    if (!isConfigured() || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }

    try {
      const data = await chrome.storage.local.get(['pendingFocusEvents']);
      const queue = data.pendingFocusEvents || [];
      if (!queue.length) return;

      console.log(`[SupabaseClient] Retrying ${queue.length} pending event(s)...`);
      const remaining = [];

      for (const event of queue) {
        const success = await sendSingleEvent(event, false);
        if (!success) {
          remaining.push(event);
        }
      }

      await chrome.storage.local.set({ pendingFocusEvents: remaining });
    } catch (err) {
      console.warn('[SupabaseClient] Error flushing pending events:', err);
    }
  }

  /**
   * Saves an event to chrome.storage.local queue for later retry.
   */
  async function queueEvent(event) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    try {
      const data = await chrome.storage.local.get(['pendingFocusEvents']);
      const queue = data.pendingFocusEvents || [];
      // Keep max 50 recent events to prevent unbounded storage growth
      queue.push(event);
      if (queue.length > 50) queue.shift();
      await chrome.storage.local.set({ pendingFocusEvents: queue });
      console.log('[SupabaseClient] Event queued for retry when online.');
    } catch (err) {
      console.warn('[SupabaseClient] Failed to queue event:', err);
    }
  }

  /**
   * Internal helper to send a single event to Supabase PostgREST.
   */
  async function sendSingleEvent(eventPayload, allowQueue = true) {
    const { url, anonKey } = getConfig();

    if (!isConfigured()) {
      console.warn('[SupabaseClient] Supabase is not configured. Please set credentials in config.js.');
      return false;
    }

    const endpoint = `${url}/rest/v1/focus_events`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(eventPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SupabaseClient] POST failed (${response.status}):`, errorText);
        if (allowQueue && (response.status >= 500 || response.status === 0)) {
          await queueEvent(eventPayload);
        }
        return false;
      }

      console.log('[SupabaseClient] Event successfully recorded in Supabase:', eventPayload.type);
      return true;
    } catch (networkError) {
      console.warn('[SupabaseClient] Network error sending event:', networkError.message);
      if (allowQueue) {
        await queueEvent(eventPayload);
      }
      return false;
    }
  }

  /**
   * Public API: Sends a focus event to Supabase.
   * Matches the shared event format defined in docs/EVENT_FORMAT.md:
   * {
   *   participant: string,
   *   meetingCode: string,
   *   type: 'left' | 'returned',
   *   timestamp: number,
   *   duration?: number
   * }
   */
  async function sendFocusEvent(event) {
    if (!event || typeof event !== 'object') {
      const err = 'Invalid event object provided';
      console.error('[SupabaseClient]', err);
      return { success: false, error: err };
    }

    const participantName = String(event.participant || '').trim();
    const meetingCode = String(event.meetingCode || '').trim();

    // Do not pollute database if participant or meetingCode is missing
    if (!participantName) {
      const err = 'Skipping event: participant name is empty';
      console.warn('[SupabaseClient]', err);
      return { success: false, error: err };
    }

    if (!meetingCode) {
      const err = 'Skipping event: meetingCode is empty';
      console.warn('[SupabaseClient]', err);
      return { success: false, error: err };
    }

    if (event.type !== 'left' && event.type !== 'returned') {
      const err = 'Skipping event: type must be "left" or "returned"';
      console.warn('[SupabaseClient]', err);
      return { success: false, error: err };
    }

    const payload = {
      participant: participantName,
      meetingCode: meetingCode,
      type: event.type,
      timestamp: Number(event.timestamp) || Date.now()
    };

    if (event.type === 'returned' && typeof event.duration === 'number') {
      payload.duration = Math.round(event.duration);
    }

    const success = await sendSingleEvent(payload, true);

    // Attempt to flush any previously failed events in background
    flushPendingEvents().catch(() => {});

    return { success, error: success ? null : 'Failed to deliver event to Supabase' };
  }

  /**
   * Diagnostic helper to test the Supabase connection.
   */
  async function testConnection() {
    const { url, anonKey } = getConfig();
    if (!isConfigured()) {
      return {
        ok: false,
        message: 'Credentials missing or using placeholder in config.js'
      };
    }

    try {
      const response = await fetch(`${url}/rest/v1/focus_events?select=id&limit=1`, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        }
      });

      if (response.ok) {
        return { ok: true, message: 'Connected successfully to Supabase!' };
      } else {
        return { ok: false, message: `Server returned status ${response.status}: ${response.statusText}` };
      }
    } catch (err) {
      return { ok: false, message: `Network error: ${err.message}` };
    }
  }

  return {
    sendFocusEvent,
    flushPendingEvents,
    testConnection,
    isConfigured
  };
})();

// Expose to ServiceWorkerGlobalScope and Window
if (typeof self !== 'undefined') {
  self.SupabaseClient = SupabaseClient;
}
if (typeof window !== 'undefined') {
  window.SupabaseClient = SupabaseClient;
}
