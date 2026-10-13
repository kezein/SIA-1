# Privacy Policy & Statement

**Meet Focus Tracker** is designed with privacy and transparency as its core foundation. We believe participants have the right to know exactly what data is collected, why it is collected, and who has access to it.

---

## 1. What We Track

When you join a Google Meet call with Meet Focus Tracker active and consented, the extension tracks only high-level focus metrics:

- **Leaving Google Meet:** That you switched away from the Google Meet tab or minimized the browser window.
- **Timestamps:** The exact time you left the meeting tab and the exact time you returned.
- **Duration away:** The total time (in seconds or minutes) you spent away from the meeting tab.
- **Meeting metadata:** The participant name you entered in the extension popup and the Google Meet meeting code (e.g., `abc-defg-hij`).

---

## 2. What We NEVER Track

We believe in strict data minimization. The extension is technically incapable of seeing or storing the following:

- ❌ **No tab titles or URLs:** We do not track or record what other websites, tabs, or links you open.
- ❌ **No browsing history:** We do not read search queries, downloads, or visited pages.
- ❌ **No other applications:** We cannot see your other open programs, windows, files, or notifications.
- ❌ **No screen recordings or screenshots:** We never capture what is on your screen.
- ❌ **No keystrokes or mouse activity:** We do not log what you type or click outside the Meet tab.
- ❌ **No audio or video:** We do not listen to your microphone, access your webcam, or record meeting audio/video.

---

## 3. Where the Extension Runs

The extension operates **exclusively on `meet.google.com`**. 

As declared in our `manifest.json`, the extension content script has zero permissions to run on any other domain. If you navigate to any other website, the extension is completely inactive.

---

## 4. Who Can See Your Data

- **Your Teacher / Instructor:** The teacher views your switch count and total away time through the private web dashboard by entering the specific meeting code.
- **Yourself:** You can view your own switch count and away time directly in the extension popup.
- **No Third Parties:** Your data is not sold, shared, or used for advertising.

---

## 5. Participant Consent & Control

- **Affirmative Consent:** Focus tracking requires your explicit agreement on the consent screen (`consent.html`) before tracking begins.
- **Declining:** If you choose "Decline", the extension will remain inactive, and no switch events or timestamps will be sent.
- **Revoking Consent & Resetting Data:** You can decline consent at any time via the consent page or uninstall the extension from `chrome://extensions` to immediately remove all local data.
