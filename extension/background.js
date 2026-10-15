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

/**
 * Sends the formatted event to the backend database.
 * TODO: Role 3 and I will connect this on Wednesday.
 * @param {Object} event - The shared event object
 */
async function sendToBackend(event) {
    // TODO: Connect with Role 3 backend API / database on Wednesday.
}

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

        // Compute duration = returned timestamp - saved leave timestamp
        let duration = 0;
        if (lastLeaveTime) {
            duration = Math.max(0, returnTimestamp - lastLeaveTime);
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
});

// 9. Open consent screen automatically when the extension is installed
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL("consent.html") });
    }
});