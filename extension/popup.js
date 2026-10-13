/**
 * Meet Focus Tracker - Popup Script (Role 2)
 * 
 * Responsibilities:
 * - Load and display participant name, meeting code, switch count, and total time away
 * - Auto-save participant name and meeting code to chrome.storage.local
 * - Listen for live updates via chrome.storage.onChanged
 * - Provide a Reset button to clear switches and time away
 * - Show a warning message if consent has not been granted (consentGiven !== true)
 */

// DOM Element References
const consentBanner = document.getElementById('consent-banner');
const participantInput = document.getElementById('participant-name');
const meetingCodeInput = document.getElementById('meeting-code');
const switchesDisplay = document.getElementById('switches-count');
const totalAwayDisplay = document.getElementById('total-away');
const resetBtn = document.getElementById('reset-btn');

/**
 * Formats a duration in milliseconds into "mm:ss" string format.
 * Example: 65000 ms -> "01:05"
 * @param {number} ms - Milliseconds away
 * @returns {string} Formatted mm:ss string
 */
function formatDuration(ms) {
  if (!ms || ms < 0 || isNaN(ms)) {
    return '00:00';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Toggles the visibility of the consent warning banner.
 * @param {boolean} consentGiven - Whether consent has been granted
 */
function updateConsentDisplay(consentGiven) {
  if (consentGiven === true) {
    consentBanner.classList.add('hidden');
  } else {
    consentBanner.classList.remove('hidden');
  }
}

/**
 * Updates the switch count displayed in the popup.
 * @param {number} switches - Number of tab switches recorded
 */
function updateSwitchesDisplay(switches) {
  switchesDisplay.textContent = typeof switches === 'number' ? switches : 0;
}

/**
 * Updates the total time away displayed in the popup (formatted mm:ss).
 * @param {number} totalAway - Total away duration in milliseconds
 */
function updateTotalAwayDisplay(totalAway) {
  totalAwayDisplay.textContent = formatDuration(totalAway);
}

/**
 * Initializes popup values from chrome.storage.local on open.
 */
async function initializePopup() {
  const data = await chrome.storage.local.get([
    'consentGiven',
    'participant',
    'meetingCode',
    'switches',
    'totalAway'
  ]);

  // Update consent warning visibility
  updateConsentDisplay(data.consentGiven);

  // Fill in stored input values
  participantInput.value = data.participant || '';
  meetingCodeInput.value = data.meetingCode || '';

  // Update stats counters
  updateSwitchesDisplay(data.switches);
  updateTotalAwayDisplay(data.totalAway);
}

// Save participant name to chrome.storage.local as the user types
participantInput.addEventListener('input', () => {
  chrome.storage.local.set({ participant: participantInput.value.trim() });
});

// Save meeting code to chrome.storage.local as the user types
meetingCodeInput.addEventListener('input', () => {
  chrome.storage.local.set({ meetingCode: meetingCodeInput.value.trim() });
});

// Reset button: resets switch counter, total away time, and active leave timestamp
resetBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    switches: 0,
    totalAway: 0,
    lastLeaveTime: null
  });
});

/**
 * Listen for changes in chrome.storage.local and update the popup live.
 * This ensures counts and values update instantly even if events occur while the popup is open.
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  // React to consent changes
  if (changes.consentGiven !== undefined) {
    updateConsentDisplay(changes.consentGiven.newValue);
  }

  // React to switches count changes
  if (changes.switches !== undefined) {
    updateSwitchesDisplay(changes.switches.newValue);
  }

  // React to total away duration changes
  if (changes.totalAway !== undefined) {
    updateTotalAwayDisplay(changes.totalAway.newValue);
  }

  // Sync participant name if updated from another context (only if not actively typing)
  if (changes.participant !== undefined && document.activeElement !== participantInput) {
    participantInput.value = changes.participant.newValue || '';
  }

  // Sync meeting code if updated by background/content script (only if not actively typing)
  if (changes.meetingCode !== undefined && document.activeElement !== meetingCodeInput) {
    meetingCodeInput.value = changes.meetingCode.newValue || '';
  }
});

// Initialize the popup UI when DOM is ready
document.addEventListener('DOMContentLoaded', initializePopup);
