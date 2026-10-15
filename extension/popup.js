/**
 * Meet Focus Tracker - Popup Script (Role 2)
 * 
 * Responsibilities:
 * - Load participant name and meeting code; require both before unlocking focus stats
 * - Provide a clear "Save Details" and "✏️ Edit" toggle so users can always edit their info
 * - Display live focus statistics (switches count & time away) only after setup is complete
 * - Provide a safe "Reset Focus Stats" button with 2-step confirmation to avoid confusion
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
const detailsSummary = document.getElementById('details-summary');
const summaryName = document.getElementById('summary-name');
const summaryCode = document.getElementById('summary-code');

// Stats section elements
const statsSection = document.getElementById('stats-section');
const statsLockedMessage = document.getElementById('stats-locked-message');
const statsContent = document.getElementById('stats-content');
const switchesDisplay = document.getElementById('switches-count');
const totalAwayDisplay = document.getElementById('total-away');
const resetBtn = document.getElementById('reset-btn');

// State tracking
let resetConfirmTimeout = null;

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
  const code = meetingCodeInput.value.trim();
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
    statsLockedMessage.classList.add('hidden');
    statsContent.classList.remove('hidden');

    // Switch details from inputs to summary
    detailsInputs.classList.add('hidden');
    detailsSummary.classList.remove('hidden');
    editDetailsBtn.classList.remove('hidden');

    // Populate summary values
    summaryName.textContent = name;
    summaryCode.textContent = code;

    // Update session status badge
    sessionBadge.textContent = 'Active';
    sessionBadge.className = 'badge rounded-pill bg-success-subtle text-success-emphasis';
  } else {
    // Show locked placeholder and hide stats
    statsSection.classList.add('locked');
    statsLockedMessage.classList.remove('hidden');
    statsContent.classList.add('hidden');

    // Switch details to input mode
    detailsInputs.classList.remove('hidden');
    detailsSummary.classList.add('hidden');
    editDetailsBtn.classList.add('hidden');

    // Update session status badge
    sessionBadge.textContent = 'Setup';
    sessionBadge.className = 'badge rounded-pill bg-warning-subtle text-warning-emphasis';
  }
}

/**
 * Saves participant name and meeting code to storage and unlocks stats.
 */
async function handleSaveDetails() {
  const name = participantInput.value.trim();
  const code = meetingCodeInput.value.trim();

  if (!name || !code) {
    return;
  }

  // Persist both values in chrome.storage.local
  await chrome.storage.local.set({
    participant: name,
    meetingCode: code
  });

  setUnlockedState(true, name, code);
}

/**
 * Switches the details section back to editable mode so the user can change their name or code.
 */
function handleEditDetails() {
  detailsSummary.classList.add('hidden');
  editDetailsBtn.classList.add('hidden');
  detailsInputs.classList.remove('hidden');

  validateInputs();
  participantInput.focus();
}

/**
 * Resets the confirmation state of the Reset button.
 */
function resetConfirmationState() {
  if (resetConfirmTimeout) {
    clearTimeout(resetConfirmTimeout);
    resetConfirmTimeout = null;
  }
  resetBtn.textContent = 'Reset Focus Stats';
  resetBtn.classList.remove('confirming', 'done');
}

/**
 * Handles the 2-step confirmation and execution for resetting stats.
 * This guarantees users never confuse resetting stats with editing their details.
 */
async function handleResetStats() {
  if (!resetBtn.classList.contains('confirming')) {
    // First click: Request confirmation
    resetBtn.classList.add('confirming');
    resetBtn.textContent = '⚠️ Confirm Reset?';

    // Auto-revert after 3.5 seconds if not clicked again
    resetConfirmTimeout = setTimeout(() => {
      resetConfirmationState();
    }, 3500);
  } else {
    // Second click: Confirmed reset
    if (resetConfirmTimeout) {
      clearTimeout(resetConfirmTimeout);
      resetConfirmTimeout = null;
    }

    // Reset switches and away time only; keeps participant and meetingCode safe
    await chrome.storage.local.set({
      switches: 0,
      totalAway: 0,
      lastLeaveTime: null
    });

    updateSwitchesDisplay(0);
    updateTotalAwayDisplay(0);

    resetBtn.classList.remove('confirming');
    resetBtn.classList.add('done');
    resetBtn.textContent = '✓ Stats Reset!';

    setTimeout(() => {
      resetConfirmationState();
    }, 1200);
  }
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
  const code = (data.meetingCode || '').trim();

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
meetingCodeInput.addEventListener('input', validateInputs);

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

// Save Details button click
saveDetailsBtn.addEventListener('click', handleSaveDetails);

// Edit Details button click
editDetailsBtn.addEventListener('click', handleEditDetails);

// Reset Stats button click
resetBtn.addEventListener('click', handleResetStats);

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
    participantInput.value = newName;
    summaryName.textContent = newName;
    validateInputs();
  }

  // Sync meeting code if updated externally (e.g. detected by content script on Meet)
  if (changes.meetingCode !== undefined && document.activeElement !== meetingCodeInput) {
    const newCode = changes.meetingCode.newValue || '';
    meetingCodeInput.value = newCode;
    summaryCode.textContent = newCode;
    validateInputs();
  }
});

// Initialize when DOM content is loaded
document.addEventListener('DOMContentLoaded', initializePopup);
