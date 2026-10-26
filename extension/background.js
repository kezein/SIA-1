/**
 * Meet Focus Tracker - Background Service Worker (Role 2)
 * 
 * Responsibilities:
 * - Listen for "left" and "returned" events from content.js
 * - Read participant name from chrome.storage.local
 * - Track focus switch count and total time away
 * - Build the complete event in the shared format
 * - Persist all state in chrome.storage.local (never in variables, as SW can be suspended)
 * - Only count events when consentGiven === true
 * - Call sendToBackend(event) inside try/catch so tracking never breaks
 */
importScripts('config.js', 'supabaseClient.js');

/**
 * Maximum plausible away duration for a single absence event.
 * If a student closes their laptop or Chrome while marked away and reopens
 * it hours later, the stale lastLeaveTime would produce absurd durations
 * (e.g. 18 h). Cap at 3 hours so analytics averages remain meaningful.
 * A capped event is still recorded — it is NOT silently dropped.
 */
const MAX_AWAY_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours in ms

/**
 * Sends the formatted event to the backend database.
 * TODO: Role 3 and I will connect this on Wednesday.
 * @param {Object} event - The shared event object
 */
async function sendToBackend(event) {
    if (typeof SupabaseClient !== 'undefined' && SupabaseClient.sendFocusEvent) {
        return await SupabaseClient.sendFocusEvent(event);
    }
}

// Track whether extension popup is currently open to avoid false "left" events
let isPopupOpen = false;
let lastPopupCloseTime = 0;

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        isPopupOpen = true;
        port.onDisconnect.addListener(() => {
            isPopupOpen = false;
            lastPopupCloseTime = Date.now();
        });
    }
});

/**
 * Handles incoming focus events ("left" or "returned") from content.js.
 * All state is read from and written to chrome.storage.local.
 * @param {Object} message - Event message { type, timestamp, meetingCode }
 */
async function handleFocusEvent(message) {
    // 1. Read current state and settings from chrome.storage.local
    const data = await chrome.storage.local.get([
        'consentGiven',
        'participant',
        'meetingCode',
        'switches',
        'totalAway',
        'lastLeaveTime'
    ]);

    // 2. Gatekeeper: Do not count any events unless consent has been granted
    if (data.consentGiven !== true) {
        console.log('[Meet Focus Tracker] Event ignored: Consent has not been granted yet.');
        return;
    }

    // 3. Ignore "left" event if user is just viewing the extension popup (or closed it < 1.5s ago)
    if (message.type === 'left' && (isPopupOpen || (Date.now() - lastPopupCloseTime < 1500))) {
        console.log('[Meet Focus Tracker] Event ignored: User is viewing extension popup.');
        return;
    }

    // 4. Ignore "returned" event if participant was never marked away
    if (message.type === 'returned' && !data.lastLeaveTime) {
        console.log('[Meet Focus Tracker] Returned event ignored: Participant was not away.');
        return;
    }

    // 3. Extract participant and meeting code
    const participant = data.participant || '';
    const meetingCode = message.meetingCode || data.meetingCode || '';

    // 4. Retrieve numeric counters (default to 0 if not set)
    let switches = typeof data.switches === 'number' ? data.switches : 0;
    let totalAway = typeof data.totalAway === 'number' ? data.totalAway : 0;
    let lastLeaveTime = typeof data.lastLeaveTime === 'number' ? data.lastLeaveTime : null;

    let fullEvent = null;

    // 5. Handle "left" event
    if (message.type === 'left') {
        // Increment switch count
        switches += 1;
        // Record the time the participant left
        lastLeaveTime = message.timestamp || Date.now();

        // Construct full event in shared format (duration is only on "returned")
        fullEvent = {
            participant: participant,
            meetingCode: meetingCode,
            type: 'left',
            timestamp: lastLeaveTime
        };

        // Save updated state to storage
        const updates = {
            switches: switches,
            lastLeaveTime: lastLeaveTime
        };
        if (message.meetingCode && !data.meetingCode) {
            updates.meetingCode = message.meetingCode;
        }
        await chrome.storage.local.set(updates);

        console.log('[Meet Focus Tracker] Processed "left" event:', fullEvent);
    }
    // 6. Handle "returned" event
    else if (message.type === 'returned') {
        const returnTimestamp = message.timestamp || Date.now();

        // Compute duration = returned timestamp - saved leave timestamp.
        // Clamp to MAX_AWAY_DURATION_MS to prevent stale sessions (e.g. laptop
        // closed overnight) from recording absurd durations and skewing averages.
        let duration = 0;
        if (lastLeaveTime) {
            const rawDuration = Math.max(0, returnTimestamp - lastLeaveTime);
            if (rawDuration > MAX_AWAY_DURATION_MS) {
                console.warn(
                    `[Meet Focus Tracker] Away duration capped: raw=${Math.round(rawDuration / 60000)}min ` +
                    `exceeds limit (${MAX_AWAY_DURATION_MS / 3600000}h). ` +
                    'Likely a stale session from a previous browser/laptop shutdown.'
                );
            }
            duration = Math.min(rawDuration, MAX_AWAY_DURATION_MS);
            totalAway += duration;
        }

        // Clear the leave timestamp
        lastLeaveTime = null;

        // Construct full event in shared format (includes duration)
        fullEvent = {
            participant: participant,
            meetingCode: meetingCode,
            type: 'returned',
            timestamp: returnTimestamp,
            duration: duration
        };

        // Save updated state to storage
        const updates = {
            totalAway: totalAway,
            lastLeaveTime: null
        };
        if (message.meetingCode && !data.meetingCode) {
            updates.meetingCode = message.meetingCode;
        }
        await chrome.storage.local.set(updates);

        console.log('[Meet Focus Tracker] Processed "returned" event:', fullEvent);
    }

    // 7. Send to backend wrapped in try/catch so a failure never breaks counting
    if (fullEvent) {
        try {
            await sendToBackend(fullEvent);
        } catch (error) {
            console.error('[Meet Focus Tracker] sendToBackend failed:', error);
        }
    }
}

// 8. Listen for runtime messages from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && (message.type === 'left' || message.type === 'returned')) {
        handleFocusEvent(message)
            .then(() => sendResponse({ status: 'ok' }))
            .catch((err) => {
                console.error('[Meet Focus Tracker] Error handling event:', err);
                sendResponse({ status: 'error', error: err.message });
            });

        // Return true to keep message channel open for async response
        return true;
    }

    // SPA navigation: content.js detected a new meeting code in the URL.
    // Persist it so popup.js can read it without a page reload.
    if (message && message.type === 'meeting_detected' && message.meetingCode) {
        chrome.storage.local.get(['meetingCode'], (data) => {
            // Only update if no meeting code is already saved (don't overwrite
            // an active session's code if the user navigated within the same call)
            if (!data.meetingCode) {
                chrome.storage.local.set({ meetingCode: message.meetingCode }, () => {
                    console.log(
                        '[Meet Focus Tracker] Meeting code saved from SPA navigation:',
                        message.meetingCode
                    );
                });
            }
            sendResponse({ status: 'ok' });
        });
        return true; // Keep channel open for async chrome.storage callback
    }

    // Tab close / unload: content.js fired a session_ended event via sendMessage.
    // Clear lastLeaveTime so the student does not appear permanently "Away"
    // on the teacher's dashboard after closing the Meet tab.
    if (message && message.type === 'session_ended') {
        chrome.storage.local.set({ lastLeaveTime: null }, () => {
            console.log('[Meet Focus Tracker] Session ended — lastLeaveTime cleared for clean state.');
        });
        sendResponse({ status: 'ok' });
        return true;
    }
});

// 9. Open consent screen automatically when the extension is installed
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL("consent.html") });
    }
});
