# Meet Focus Tracker - QA Test Cases

This document defines the formal test cases for **Meet Focus Tracker**. It covers functional, edge case, and privacy testing across the Chrome Extension (content script, background script, popup, consent screen), backend sync, and the teacher dashboard.

---

## 1. Test Environment & Prerequisites

- **Browser:** Google Chrome (Version 120+ or latest stable)
- **Extension:** Meet Focus Tracker (Manifest V3, unpacked)
- **Target Platform:** `https://meet.google.com/`
- **Roles Involved:**
  - Role 1: Content Script (`content.js`) & Manifest (`manifest.json`)
  - Role 2: Background Script (`background.js`) & Popup (`popup.html` / `popup.js`)
  - Role 3: Database & Backend Integration
  - Role 4: Teacher Dashboard
  - Role 5: UI/UX, QA, Documentation

---

## 2. Test Execution Matrix

| Test ID | Test Scenario | Steps to Reproduce | Expected Result | Pass / Fail | Notes |
|:---|:---|:---|:---|:---:|:---|
| **TC-01** | **Switching tabs** | 1. Open Google Meet call.<br>2. Open a second tab (e.g., Google Docs).<br>3. Stay on second tab for 5 seconds.<br>4. Switch back to Google Meet tab. | `visibilitychange` triggers.<br>After 500 ms, `"left"` event sent.<br>On return, `"returned"` event sent with `duration ≈ 5000 ms`.<br>Popup switch count increments by 1. | *Pending* | Core tab-switching detection via `document.hidden`. |
| **TC-02** | **Opening a new tab** | 1. In active Google Meet call, press `Ctrl+T` (or click `+`).<br>2. Wait 5 seconds on new tab.<br>3. Close new tab or switch back to Meet. | Meet tab loses visibility.<br>`"left"` event recorded after 500 ms.<br>`"returned"` event logged upon return with ~5s duration away. | *Pending* | Verifies focus loss caused by creating a new browser tab. |
| **TC-03** | **Alt-tab to another app** | 1. In active Google Meet call, press `Alt+Tab` to another desktop application (e.g., Notepad, Discord).<br>2. Stay in other app for 8 seconds.<br>3. Switch back to Google Meet. | `window.blur` triggers.<br>`"left"` event logged after 500 ms.<br>On return, `window.focus` triggers `"returned"` event with `duration ≈ 8000 ms`. | *Pending* | Verifies operating system window focus detection. |
| **TC-04** | **Quick blip under 500 ms** | 1. While in Meet, quickly click outside browser or tap `Alt+Tab` and immediately click back into Meet within `< 500 ms`. | Pending `leaveTimer` is cancelled by `handleReturn()`.<br>NO `"left"` or `"returned"` event sent.<br>Switch count remains unchanged. | *Pending* | Verifies anti-jitter / threshold logic in `content.js`. |
| **TC-05** | **Screen-share picker** | 1. In Google Meet, click "Present now" to trigger the browser screen-sharing dialog.<br>2. Spend 3 seconds selecting a screen or cancel. | If the browser screen picker causes window blur exceeding 500 ms, an event may fire.<br>Document behavior according to known limitations. | *Pending* | Known limitation: Native dialogs may briefly blur page focus. |
| **TC-06** | **System notification** | 1. While in Meet, receive an OS or browser notification banner.<br>2. Observe if banner steals focus for `< 500 ms` vs `> 500 ms`. | Toast notifications that do not steal active window focus should NOT trigger `"left"`.<br>If notification steals focus >500 ms, record known limitation. | *Pending* | Known limitation: Focus-stealing OS popups. |
| **TC-07** | **Two Meet windows open** | 1. Open two separate Google Meet tabs/windows simultaneously.<br>2. Switch between Window A and Window B.<br>3. Observe event counts for each. | Each content script isolates its events to its respective `meetingCode`.<br>Focusing Window A marks Window B away and vice versa without crash. | *Pending* | Verifies multi-window handling and state isolation. |
| **TC-08** | **Extension reloaded mid-meeting** | 1. Join Google Meet.<br>2. Open `chrome://extensions` in another window and click "Reload" on the extension.<br>3. Return to Meet and switch tabs. | `content.js` catches runtime error via `try/catch` and logs warning without breaking Meet page.<br>Refreshing Meet re-establishes tracking. | *Pending* | Verifies graceful error handling for orphaned scripts. |
| **TC-09** | **Browser closed unexpectedly** | 1. Participant is in active Meet call.<br>2. Participant closes entire Chrome browser window (or clicks close tab). | Background script handles disconnect.<br>Database retains all events up to the close event.<br>No corrupt JSON payload sent. | *Pending* | Verifies session teardown integrity. |
| **TC-10** | **No consent given** | 1. Participant installs extension.<br>2. Consent screen shows; participant clicks "Decline" (`consentGiven = false`).<br>3. Participant joins Meet and switches tabs. | Content script checks `consentGiven`.<br>Tracking does NOT start.<br>No `"left"` or `"returned"` events sent to background or database. | *Pending* | Ethical & Privacy gate: tracking must require affirmative consent. |
| **TC-11** | **Empty participant name** | 1. Open extension popup.<br>2. Leave participant name input blank (or whitespace).<br>3. Attempt to save / start tracking. | Popup displays validation message ("Please enter your name").<br>Cannot start tracking without a valid participant name. | *Pending* | Prevents anonymous or malformed event records. |
| **TC-12** | **Wrong meeting code** | 1. Open extension popup.<br>2. Enter meeting code `xyz-123` while actual URL is `meet.google.com/abc-defg-hij`. | Popup/content script warns user of mismatch or automatically pulls meeting code from current Meet URL path. | *Pending* | Prevents orphaned data in teacher dashboard. |
| **TC-13** | **Multiple students in same meeting** | 1. Student A ("Alice") and Student B ("Bob") join the same Meet code `abc-defg-hij`.<br>2. Alice switches tabs twice (total 15s away).<br>3. Bob switches tabs once (total 5s away).<br>4. Teacher opens dashboard for `abc-defg-hij`. | Dashboard lists both Alice and Bob under meeting `abc-defg-hij`.<br>Alice shows 2 switches / 15s away.<br>Bob shows 1 switch / 5s away.<br>Data is not merged. | *Pending* | Verifies multi-user concurrency and dashboard aggregation. |

---

## 3. Test Execution Instructions

1. **Setup:**
   - Clone or load the repository as an unpacked extension at `chrome://extensions`.
   - Ensure permissions include `storage` in `manifest.json`.
2. **Pre-test State:**
   - Clear extension local storage: `chrome.storage.local.clear()`.
   - Open `extension/consent.html` to confirm initial state.
3. **Execution:**
   - Run each test case in order.
   - Record actual results in the `Pass / Fail` column (`Pass`, `Fail`, or `Blocked`).
   - If a test fails, file an issue citing the `Test ID` and console logs.
4. **Post-test Verification:**
   - Verify that all database records strictly match `docs/EVENT_FORMAT.md`.
   - Verify that no private data (URLs, window titles, keystrokes) was transmitted.
