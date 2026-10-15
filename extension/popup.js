/**
 * Meet Focus Tracker - Popup Script (Role 2)
 * 
 * Responsibilities:
 * - Load participant name and meeting code; require both before unlocking focus stats
 * - Smart parsing/cleaning of meeting code (handles pasted full URLs like meet.google.com/xxx-yyyy-zzz)
 * - Provide a clear "Save Changes" and "Cancel" toggle in edit mode (dims stats while editing)
 * - Auto-reset stats when a different meeting code is entered to avoid data contamination
 * - Provide an explicit "Cancel" and "Yes, Reset" confirmation dialog for resetting stats
 * - Keep live updates in sync with chrome.storage.local
 */

// DOM Element References
const consentBanner = document.getElementById('consent-banner');
const sessionBadge = document.getElementById('session-badge');

// Details section elements
const editDetailsBtn = document.getElementById('edit-details-btn');
const detailsInputs = document.getElementById('details-inputs');
const participantInput = document.getElementById('participant-name');
const meetingCodeInput = document.getElementById('meeting-code');
const saveDetailsBtn = document.getElementById('save-details-btn');
const cancelDetailsBtn = document.getElementById('cancel-details-btn');
const editTrackingNotice = document.getElementById('edit-tracking-notice');
const detailsSummary = document.getElementById('details-summary');
const summaryName = document.getElementById('summary-name');
const summaryCode = document.getElementById('summary-code');

// Stats section elements
const statsSection = document.getElementById('stats-section');
const statsLockedMessage = document.getElementById('stats-locked-message');
const statsContent = document.getElementById('stats-content');
const switchesDisplay = document.getElementById('switches-count');
const totalAwayDisplay = document.getElementById('total-away');

// Reset action elements
const resetInitialView = document.getElementById('reset-initial-view');
const resetConfirmView = document.getElementById('reset-confirm-view');
const resetBtn = document.getElementById('reset-btn');
const resetCancelBtn = document.getElementById('reset-cancel-btn');
const resetConfirmBtn = document.getElementById('reset-confirm-btn');

// State tracking
let currentSavedName = '';
let currentSavedCode = '';

/**
 * Extracts and cleans a Google Meet code from raw input or pasted URLs.
 * Examples:
 *   "https://meet.google.com/abc-defg-hij?authuser=0" -> "abc-defg-hij"
 *   "ABC-DEFG-HIJ" -> "abc-defg-hij"
 * @param {string} raw - Raw input string
 * @returns {string} Cleaned meeting code
 */
function cleanMeetingCode(raw) {
  if (!raw) return '';
  let val = raw.trim();

  // If full Meet URL was pasted, extract the code segment
  const urlMatch = val.match(/meet\.google\.com\/([a-zA-Z0-9-]+)/i);
  if (urlMatch && urlMatch[1]) {
    val = urlMatch[1];
  }

  // Strip query parameters, hashes, and leading/trailing slashes
  val = val.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');

  // Keep only alphanumeric characters and hyphens, converted to lowercase
  return val.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
}

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
 * Validates whether both participant name and meeting code are filled.
 * Enables or disables the Save Details button accordingly.
 * @returns {boolean} Whether both fields have non-empty values
 */
function validateInputs() {
  const name = participantInput.value.trim();
  const code = cleanMeetingCode(meetingCodeInput.value);
  const isValid = name.length > 0 && code.length > 0;
  saveDetailsBtn.disabled = !isValid;
  return isValid;
}

/**
 * Updates the UI between Setup mode (locked stats) and Active mode (unlocked stats).
 * @param {boolean} isUnlocked - Whether both details are provided and saved
 * @param {string} [name=''] - Participant name
 * @param {string} [code=''] - Meeting code
 */
function setUnlockedState(isUnlocked, name = '', code = '') {
  if (isUnlocked) {
    // Show active stats and hide lock screen
    statsSection.classList.remove('locked');
    statsSection.classList.remove('dimmed');
    statsLockedMessage.classList.add('hidden');
    statsContent.classList.remove('hidden');

    // Switch details from inputs to summary
    detailsInputs.classList.add('hidden');
    detailsSummary.classList.remove('hidden');
    editDetailsBtn.classList.remove('hidden');
    cancelDetailsBtn.classList.add('hidden');

    // Populate summary values
    summaryName.textContent = name;
    summaryCode.textContent = code;

    // Update session status badge
    sessionBadge.textContent = 'Active';
    sessionBadge.className = 'badge rounded-pill bg-success-subtle text-success-emphasis';
  } else {
    // Show locked placeholder and hide stats
    statsSection.classList.add('locked');
    statsSection.classList.remove('dimmed');
    statsLockedMessage.classList.remove('hidden');
    statsContent.classList.add('hidden');

    // Switch details to input mode
    detailsInputs.classList.remove('hidden');
    detailsSummary.classList.add('hidden');
    editDetailsBtn.classList.add('hidden');
    cancelDetailsBtn.classList.add('hidden');

    // Update session status badge
    sessionBadge.textContent = 'Setup';
    sessionBadge.className = 'badge rounded-pill bg-warning-subtle text-warning-emphasis';
  }
}

/**
 * Saves participant name and meeting code to storage and unlocks stats.
 * If the meeting code changed, resets stats so counters start fresh for the new meeting.
 */
async function handleSaveDetails() {
  const name = participantInput.value.trim();
  const code = cleanMeetingCode(meetingCodeInput.value);

  if (!name || !code) {
    return;
  }

  // Update input with cleaned code
  meetingCodeInput.value = code;

  // Prepare updates for chrome.storage.local
  const updates = {
    participant: name,
    meetingCode: code
  };

  // If meeting code changed to a different session, reset stats to avoid mixing data
  if (currentSavedCode && currentSavedCode.toLowerCase() !== code.toLowerCase()) {
    updates.switches = 0;
    updates.totalAway = 0;
    updates.lastLeaveTime = null;
    updateSwitchesDisplay(0);
    updateTotalAwayDisplay(0);
  }

  await chrome.storage.local.set(updates);

  currentSavedName = name;
  currentSavedCode = code;

  editTrackingNotice.classList.add('hidden');
  setUnlockedState(true, name, code);
}

/**
 * Switches the details section into edit mode.
 * Stats remain fully visible so the student understands tracking is still live.
 */
function handleEditDetails() {
  detailsSummary.classList.add('hidden');
  editDetailsBtn.classList.add('hidden');
  detailsInputs.classList.remove('hidden');
  cancelDetailsBtn.classList.remove('hidden');
  editTrackingNotice.classList.remove('hidden');
  saveDetailsBtn.textContent = 'Save Changes';

  validateInputs();
  participantInput.focus();
}

/**
 * Cancels editing and reverts input fields back to their saved values.
 */
function handleCancelDetails() {
  // Revert inputs
  participantInput.value = currentSavedName;
  meetingCodeInput.value = currentSavedCode;

  // Restore views
  detailsInputs.classList.add('hidden');
  cancelDetailsBtn.classList.add('hidden');
  editTrackingNotice.classList.add('hidden');
  detailsSummary.classList.remove('hidden');
  editDetailsBtn.classList.remove('hidden');
  saveDetailsBtn.textContent = 'Save Details';

  validateInputs();
}

/**
 * Opens the Reset Confirmation view.
 */
function handleOpenResetConfirm() {
  resetInitialView.classList.add('hidden');
  resetConfirmView.classList.remove('hidden');
}

/**
 * Cancels the Reset action and returns to the initial view.
 */
function handleCancelReset() {
  resetConfirmView.classList.add('hidden');
  resetInitialView.classList.remove('hidden');
}

/**
 * Confirms resetting stats to 0.
 */
async function handleConfirmReset() {
  // Reset switches and away time only; keeps participant and meetingCode safe
  await chrome.storage.local.set({
    switches: 0,
    totalAway: 0,
    lastLeaveTime: null
  });

  updateSwitchesDisplay(0);
  updateTotalAwayDisplay(0);

  // Return to initial button view with brief success feedback
  resetConfirmView.classList.add('hidden');
  resetInitialView.classList.remove('hidden');

  const originalText = resetBtn.textContent;
  resetBtn.textContent = '✓ Stats Reset to 0!';
  resetBtn.disabled = true;

  setTimeout(() => {
    resetBtn.textContent = originalText;
    resetBtn.disabled = false;
  }, 1400);
}

/**
 * Initializes popup values and layout from chrome.storage.local.
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

  const name = (data.participant || '').trim();
  const code = cleanMeetingCode(data.meetingCode || '');

  currentSavedName = name;
  currentSavedCode = code;

  // Populate inputs
  participantInput.value = name;
  meetingCodeInput.value = code;

  // Update counters
  updateSwitchesDisplay(data.switches);
  updateTotalAwayDisplay(data.totalAway);

  // If both name and code are already present in storage, show unlocked stats
  if (name.length > 0 && code.length > 0) {
    setUnlockedState(true, name, code);
  } else {
    setUnlockedState(false);
    validateInputs();
  }
}

// Input event listeners for validation
participantInput.addEventListener('input', validateInputs);

meetingCodeInput.addEventListener('input', () => {
  validateInputs();
});

// Auto-clean pasted meeting code/URL immediately
meetingCodeInput.addEventListener('paste', (e) => {
  setTimeout(() => {
    meetingCodeInput.value = cleanMeetingCode(meetingCodeInput.value);
    validateInputs();
  }, 0);
});

// Allow pressing 'Enter' in either input to save details immediately
participantInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && validateInputs()) {
    handleSaveDetails();
  }
});

meetingCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && validateInputs()) {
    handleSaveDetails();
  }
});

// Session Details actions
saveDetailsBtn.addEventListener('click', handleSaveDetails);
cancelDetailsBtn.addEventListener('click', handleCancelDetails);
editDetailsBtn.addEventListener('click', handleEditDetails);

// Reset Focus Stats actions (Cancel & Confirm flow)
resetBtn.addEventListener('click', handleOpenResetConfirm);
resetCancelBtn.addEventListener('click', handleCancelReset);
resetConfirmBtn.addEventListener('click', handleConfirmReset);

/**
 * Listen for changes in chrome.storage.local and update the popup live.
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

  // Sync participant name if updated externally (only if not actively typing)
  if (changes.participant !== undefined && document.activeElement !== participantInput) {
    const newName = changes.participant.newValue || '';
    currentSavedName = newName;
    participantInput.value = newName;
    summaryName.textContent = newName;
    validateInputs();
  }

  // Sync meeting code if updated externally (e.g. detected by content script on Meet)
  if (changes.meetingCode !== undefined && document.activeElement !== meetingCodeInput) {
    const newCode = cleanMeetingCode(changes.meetingCode.newValue || '');
    currentSavedCode = newCode;
    meetingCodeInput.value = newCode;
    summaryCode.textContent = newCode;
    validateInputs();
  }
});

// Initialize when DOM content is loaded
document.addEventListener('DOMContentLoaded', initializePopup);
