/**
 * Meet Focus Tracker - Content Script (Role 1)
 * Runs on Google Meet (https://meet.google.com/*)
 * Detects when a participant leaves or returns to the meeting tab.
 */

// Track whether the participant is currently marked as away
let away = false;

// Timer ID for the 500ms delay before confirming a "left" event
let leaveTimer = null;

/**
 * Extracts the meeting code from the URL path.
 * Example: https://meet.google.com/abc-defg-hij -> "abc-defg-hij"
 */
function getMeetingCode() {
  // Remove leading slashes and take the first path segment
  const path = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  const systemPaths = ['landing', 'home', 'meet', 'new', 'lookup', ''];
  if (systemPaths.includes((path || '').toLowerCase())) {
    return '';
  }
  return path || '';
}

/**
 * Sends focus events ("left" or "returned") to the background script.
 * @param {string} type - "left" | "returned"
 */
function report(type) {
  const payload = {
    type: type,
    timestamp: Date.now(),
    meetingCode: getMeetingCode()
  };

  // Console log for testing purposes (this can be removed later)
  console.log('[Meet Focus Tracker] Event reported:', payload);

  // Send message to the background service worker
  try {
    const messagePromise = chrome.runtime.sendMessage(payload);
    // Catch cases where the background script is not yet active or listening
    if (messagePromise && typeof messagePromise.catch === 'function') {
      messagePromise.catch(() => {});
    }
  } catch (error) {
    // Catches errors if the extension was reloaded or disabled
    console.warn('[Meet Focus Tracker] Failed to send message:', error);
  }
}

/**
 * Triggered when a participant shows signs of leaving Meet
 * (tab switch, new tab opened, or window blurred).
 */
function handleLeave() {
  // If already reported away or countdown is already in progress, do nothing
  if (away || leaveTimer !== null) {
    return;
  }

  // Wait 500 ms before reporting "left" (ignores quick blips like notifications)
  leaveTimer = setTimeout(() => {
    away = true;
    leaveTimer = null;
    report('left');
  }, 500);
}

/**
 * Triggered when a participant returns to Meet
 * (tab becomes visible or window regains focus).
 */
function handleReturn() {
  // If participant returned within 500 ms, cancel the pending "left" event
  if (leaveTimer !== null) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }

  // If participant had previously been reported as away, report "returned"
  if (away) {
    away = false;
    report('returned');
  }
}

// 1. Detect tab switching or opening a new tab
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    handleLeave();
  } else {
    handleReturn();
  }
});

// 2. Detect alt-tabbing or clicking outside the browser window
window.addEventListener('blur', () => {
  handleLeave();
});

// 3. Detect returning focus back to the Google Meet window
window.addEventListener('focus', () => {
  handleReturn();
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SPA Navigation Detection
//    Google Meet is a Single Page Application: navigating from the lobby to a
//    live call (e.g. /abc-defg-hij) never triggers a page reload, so the URL
//    changes silently. We watch for these changes and notify the background
//    script whenever a valid meeting code appears in the path.
//
//    Strategy A: Navigation API (Chrome 102+, covers all MV3-capable Chrome).
//    Strategy B: MutationObserver on <title> — lightweight fallback for any
//                edge case where the Navigation API is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a `meeting_detected` message to the background script so it can
 * persist the meeting code and keep the popup in sync.
 * @param {string} code - A valid Google Meet meeting code
 */
function notifyMeetingDetected(code) {
  if (!code) return;
  console.log('[Meet Focus Tracker] SPA navigation — meeting detected:', code);
  try {
    const msg = chrome.runtime.sendMessage({ type: 'meeting_detected', meetingCode: code });
    if (msg && typeof msg.catch === 'function') msg.catch(() => {});
  } catch (e) {
    console.warn('[Meet Focus Tracker] Failed to notify meeting_detected:', e);
  }
}

// Keep track of the last code we notified so we don't fire duplicate messages
// for the same meeting (Meet occasionally re-navigates within the same call).
let _lastNotifiedCode = getMeetingCode();

// Notify on initial load if the page already has a meeting code
if (_lastNotifiedCode) {
  notifyMeetingDetected(_lastNotifiedCode);
}

/**
 * Called on every URL or title change; extracts and de-dupes meeting codes.
 */
function onUrlChange() {
  const code = getMeetingCode();
  if (code && code !== _lastNotifiedCode) {
    _lastNotifiedCode = code;
    notifyMeetingDetected(code);
  }
}

// Strategy A — Navigation API (fires on every pushState / replaceState / popstate)
if (typeof window.navigation !== 'undefined') {
  window.navigation.addEventListener('navigate', onUrlChange);
} else {
  // Strategy B — MutationObserver on <title> (Google Meet always updates the
  // page title when the route changes, making it a reliable SPA change signal)
  const titleEl = document.querySelector('title');
  if (titleEl) {
    new MutationObserver(onUrlChange).observe(titleEl, { childList: true });
  }
  // Also listen to popstate for back/forward navigation
  window.addEventListener('popstate', onUrlChange);
}
