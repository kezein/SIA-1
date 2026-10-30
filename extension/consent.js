/**
 * Meet Focus Tracker - Consent Screen Logic (Role 5)
 * Handles user consent for focus tracking.
 * Saves consent choice to chrome.storage.local ('consentGiven': true | false).
 */

document.addEventListener('DOMContentLoaded', () => {
  const agreeBtn = document.getElementById('agree-btn');
  const declineBtn = document.getElementById('decline-btn');
  const statusMsg = document.getElementById('status-message');

  /**
   * Helper to display a friendly status message on the card.
   * @param {string} text - Message to display
   * @param {'success'|'warning'} type - Styling category
   */
  function setStatus(text, type) {
    if (!statusMsg) return;
    statusMsg.textContent = text;
    statusMsg.className = `status-banner ${type}`;
    statusMsg.style.display = 'block';
  }

  /**
   * Load existing consent state from chrome.storage.local on page load.
   */
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['consentGiven'], (result) => {
      if (result.consentGiven === true) {
        agreeBtn.classList.add('agreed');
        agreeBtn.textContent = '✔ Agreed';
        setStatus('✔ You have already agreed to focus tracking. You are ready to join Google Meet.', 'success');
      } else if (result.consentGiven === false) {
        agreeBtn.classList.remove('agreed');
        agreeBtn.textContent = 'I Agree';
        setStatus('✖ You previously declined consent. Focus tracking is currently disabled.', 'warning');
      }
    });
  }

  // Handle "I Agree" button click
  agreeBtn.addEventListener('click', () => {
    agreeBtn.classList.add('agreed');
    agreeBtn.textContent = '✔ Agreed';

    const onComplete = () => {
      setStatus('✔ Thank you! Consent granted. Returning to popup...', 'success');
      setTimeout(() => {
        // Try to trigger openPopup if supported by the browser
        if (typeof chrome !== 'undefined' && chrome.action && typeof chrome.action.openPopup === 'function') {
          try {
            chrome.action.openPopup().catch(() => {});
          } catch (e) {}
        }
        // Close the consent tab to return the user to the popup / previous page
        window.close();
      }, 600);
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ consentGiven: true }, onComplete);
    } else {
      // Fallback for previewing without Chrome extension runtime
      onComplete();
    }
  });

  // Handle "Decline" button click
  declineBtn.addEventListener('click', () => {
    agreeBtn.classList.remove('agreed');
    agreeBtn.textContent = 'I Agree';

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ consentGiven: false }, () => {
        setStatus('✖ Consent declined. Focus tracking will NOT run during your meetings.', 'warning');
      });
    } else {
      // Fallback for previewing without Chrome extension runtime
      setStatus('✖ Consent declined. Focus tracking will NOT run.', 'warning');
    }
  });
});
