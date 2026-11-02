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
const MAX_CLOSED_MEET_TABS = 100;

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
let backgroundEventQueue = Promise.resolve();

function serializeBackgroundEvent(operation) {
    const result = backgroundEventQueue.then(operation);
    backgroundEventQueue = result.catch((error) => {
        console.error('[Meet Focus Tracker] Background event failed:', error);
    });
    return result;
}

async function registerMeetTab(tabId, meetingCode) {
    if (!Number.isInteger(tabId) || !meetingCode) {
        return;
    }

    const data = await chrome.storage.local.get(['trackedMeetTabs', 'closedMeetTabs', 'meetingCode']);
    const trackedMeetTabs = data.trackedMeetTabs && typeof data.trackedMeetTabs === 'object'
        ? data.trackedMeetTabs
        : {};
    const closedMeetTabs = data.closedMeetTabs && typeof data.closedMeetTabs === 'object'
        ? data.closedMeetTabs
        : {};
    const tabKey = String(tabId);
    trackedMeetTabs[tabKey] = meetingCode;
    delete closedMeetTabs[tabKey];
    const updates = { trackedMeetTabs: trackedMeetTabs };
    updates.closedMeetTabs = closedMeetTabs;
    if (!data.meetingCode) {
        updates.meetingCode = meetingCode;
    }
    await chrome.storage.local.set(updates);
}

async function closeTrackedMeetTab(tabId) {
    if (!Number.isInteger(tabId)) {
        return;
    }

    const data = await chrome.storage.local.get([
        'trackedMeetTabs',
        'closedMeetTabs',
        'consentGiven',
        'participant',
        'meetingCode',
        'switches',
        'lastLeaveTime'
    ]);
    const trackedMeetTabs = data.trackedMeetTabs && typeof data.trackedMeetTabs === 'object'
        ? data.trackedMeetTabs
        : {};
    const closedMeetTabs = data.closedMeetTabs && typeof data.closedMeetTabs === 'object'
        ? data.closedMeetTabs
        : {};
    const tabKey = String(tabId);
    const meetingCode = trackedMeetTabs[tabKey];

    if (!meetingCode) {
        return;
    }

    delete trackedMeetTabs[tabKey];
    closedMeetTabs[tabKey] = Date.now();
    const closedTabIds = Object.keys(closedMeetTabs).sort(
        (a, b) => closedMeetTabs[a] - closedMeetTabs[b]
    );
    while (closedTabIds.length > MAX_CLOSED_MEET_TABS) {
        delete closedMeetTabs[closedTabIds.shift()];
    }
    await chrome.storage.local.set({
        trackedMeetTabs: trackedMeetTabs,
        closedMeetTabs: closedMeetTabs
    });

    if (data.consentGiven !== true) {
        return;
    }

    const updates = { lastLeaveTime: null };
    let closeEvent = null;

    // A prior visibility/blur event already counted this departure. Otherwise
    // count the close itself as one switch.
    if (typeof data.lastLeaveTime !== 'number') {
        const timestamp = Date.now();
        const switches = (typeof data.switches === 'number' ? data.switches : 0) + 1;
        updates.switches = switches;
        if (!data.meetingCode) {
            updates.meetingCode = meetingCode;
        }
        closeEvent = {
            participant: data.participant || '',
            meetingCode: meetingCode,
            type: 'left',
            timestamp: timestamp
        };
    }

    await chrome.storage.local.set(updates);
    if (closeEvent) {
        console.log('[Meet Focus Tracker] Meet tab closed; counting departure:', closeEvent);
        try {
            await sendToBackend(closeEvent);
        } catch (error) {
            console.error('[Meet Focus Tracker] Failed to send tab-close event:', error);
        }
    }
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        isPopupOpen = true;
        port.onDisconnect.addListener(() => {
            isPopupOpen = false;
            lastPopupCloseTime = Date.now();
        });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    serializeBackgroundEvent(() => closeTrackedMeetTab(tabId))
        .catch((error) => {
            console.error('[Meet Focus Tracker] Failed to process closed tab:', error);
        });
});

/**
 * Handles incoming focus events ("left" or "returned") from content.js.
 * All state is read from and written to chrome.storage.local.
 * @param {Object} message - Event message { type, timestamp, meetingCode }
 */
async function handleFocusEvent(message, tabId) {
    // 1. Read current state and settings from chrome.storage.local
    const data = await chrome.storage.local.get([
        'consentGiven',
        'participant',
        'meetingCode',
        'switches',
        'totalAway',
        'lastLeaveTime',
        'closedMeetTabs'
    ]);

    // 2. Gatekeeper: Do not count any events unless consent has been granted
    if (data.consentGiven !== true) {
        console.log('[Meet Focus Tracker] Event ignored: Consent has not been granted yet.');
        return;
    }

    const closedMeetTabs = data.closedMeetTabs && typeof data.closedMeetTabs === 'object'
        ? data.closedMeetTabs
        : {};
    if (Number.isInteger(tabId) && closedMeetTabs[String(tabId)]) {
        console.log('[Meet Focus Tracker] Event ignored from a closed Meet tab.');
        return;
    }

    // Ignore focus blur caused by opening the extension popup, but do not
    // discard real tab switches or Picture-in-Picture events while it is open.
    if (
        message.type === 'left' &&
        message.reason === 'blur' &&
        (isPopupOpen || (Date.now() - lastPopupCloseTime < 1500))
    ) {
        console.log('[Meet Focus Tracker] Event ignored: User is viewing extension popup.');
        return;
    }

    // A definitive visibility event may upgrade a blur event that was ignored
    // while the extension popup was open. Do not count duplicate leave signals.
    if (message.type === 'left' && typeof data.lastLeaveTime === 'number') {
        console.log('[Meet Focus Tracker] Duplicate "left" event ignored.');
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
        serializeBackgroundEvent(() => handleFocusEvent(message, sender.tab && sender.tab.id))
            .then(() => sendResponse({ status: 'ok' }))
            .catch((err) => {
                console.error('[Meet Focus Tracker] Error handling event:', err);
                sendResponse({ status: 'error', error: err.message });
            });

        // Return true to keep message channel open for async response
        return true;
    }

    // SPA navigation: content.js detected a new meeting code in the URL.
    // Persist it for the popup and associate the tab so closure can be counted.
    if (message && message.type === 'meeting_detected' && message.meetingCode) {
        serializeBackgroundEvent(() => registerMeetTab(sender.tab && sender.tab.id, message.meetingCode))
            .then(() => sendResponse({ status: 'ok' }))
            .catch((error) => {
                console.error('[Meet Focus Tracker] Failed to register Meet tab:', error);
                sendResponse({ status: 'error', error: error.message });
            });
        return true;
    }

    // pagehide is the fast path; chrome.tabs.onRemoved is the fallback. Both
    // consume the same tracked-tab entry, preventing a duplicate switch count.
    if (message && message.type === 'session_ended') {
        serializeBackgroundEvent(() => closeTrackedMeetTab(sender.tab && sender.tab.id))
            .then(() => sendResponse({ status: 'ok' }))
            .catch((error) => {
                console.error('[Meet Focus Tracker] Failed to process session end:', error);
                sendResponse({ status: 'error', error: error.message });
            });
        return true;
    }
});

// 9. Open consent screen automatically when the extension is installed
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL("consent.html") });
    }
});
