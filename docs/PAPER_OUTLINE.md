# Project Paper Outline: Meet Focus Tracker

**Title:** Meet Focus Tracker: A Privacy-Preserving Engagement Tracking System for Google Meet  
**Authors:** Kezia Villegas, Francis John Tamayo, Aaron Celindro, Francis Conguis, Janeah Gasis  
**Date:** October 2026  

---

## 1. Introduction
- **Background & Context:** The transition to hybrid and online education via virtual meeting platforms such as Google Meet.
- **The Challenge of Remote Engagement:** Maintaining student attention and understanding engagement during online lectures and discussions.
- **Project Overview:** A brief introduction to **Meet Focus Tracker**, a lightweight Chrome extension and web dashboard designed to observe window and tab switching with student consent.
- **Core Philosophy:** Privacy-by-design — prioritizing transparency and minimal data collection over invasive proctoring.

---

## 2. Problem Statement
- **Invisible Multitasking:** During virtual classes, teachers cannot see if students switch away from the meeting to social media, games, or other applications.
- **Overly Invasive Proctoring Tools:** Existing commercial monitoring tools often record full screens, log keystrokes, track URLs, or record webcams, causing student distress and raising privacy concerns.
- **The Need for a Balanced Solution:** Teachers need visibility into student focus and attendance without infringing on personal privacy or device sovereignty.

---

## 3. Objectives
- **General Objective:** To design, build, and evaluate a privacy-conscious focus tracking system for Google Meet sessions.
- **Specific Objectives:**
  1. Develop a Manifest V3 Chrome extension that reliably detects when a participant switches tabs or windows away from `meet.google.com`.
  2. Implement a 500 ms anti-jitter threshold to prevent accidental switches (such as brief clicks or system popups) from being recorded.
  3. Ensure zero collection of external URLs, tab titles, application names, or screen recordings.
  4. Implement an explicit participant consent screen (`consent.html`) with opt-in and opt-out controls.
  5. Provide a participant popup interface showing individual focus statistics.
  6. Develop a centralized teacher dashboard allowing instructors to view switch counts and total time away per meeting code.
  7. Formulate a comprehensive test suite to validate system accuracy and boundary conditions.

---

## 4. Scope and Limitations
- **Scope:**
  - Operates exclusively on desktop Google Chrome browsers on `meet.google.com`.
  - Measures frequency of leaving Google Meet and duration of absence (in milliseconds/seconds).
  - Collects only participant name, meeting code, switch events (`left` / `returned`), timestamps, and away duration.
  - Aggregates and displays session focus metrics for teachers by meeting code.
- **Limitations:**
  - **Single Device Limitation:** Cannot detect if a participant is distracted by a secondary device (e.g., smartphone or second computer).
  - **Context-Agnostic Switching:** Cannot discern whether leaving the tab was for a legitimate task (e.g., opening a lecture document) or distraction.
  - **Native Browser & OS Overlays:** System dialogs (e.g., Google Meet screen-share picker, OS notifications) may trigger false-positive blur events if open for longer than 500 ms.
  - **Extension Dependency:** Requires every participating student to install and enable the unpacked extension in their Chrome browser.

---

## 5. System Design
- **Architecture Overview:**
  - `Participant Browser (Extension)` ➔ `Cloud Database (Firebase / Supabase)` ➔ `Web Dashboard (Teacher)`
- **Component Breakdown:**
  - **Content Script (`content.js`):** Injected into `meet.google.com/*`. Listens for `visibilitychange`, `blur`, and `focus` events; applies 500 ms debounce timer; extracts meeting code from URL.
  - **Background Service Worker (`background.js`):** Manages extension lifecycle; tallies switch counts; aggregates time away; syncs events with backend database.
  - **Popup UI (`popup.html` & `popup.js`):** Allows participant to enter their name, view meeting code, and check their real-time switch count and away time.
  - **Consent Module (`consent.html` & `consent.js`):** Explicit user onboarding displaying what is tracked, what is never tracked, and managing the `consentGiven` flag in `chrome.storage.local`.
  - **Database & Backend:** Real-time event storage strictly adhering to `docs/EVENT_FORMAT.md`.
  - **Teacher Dashboard:** Web application where instructors enter the meeting code to view participant summaries.

---

## 6. Methodology
- **Development Model:** Agile collaborative workflow divided into five specialized roles:
  - Role 1: Project Lead & Content Script
  - Role 2: Background Script & Popup UI
  - Role 3: Backend & Database Integration
  - Role 4: Teacher Dashboard
  - Role 5: UI/UX, Quality Assurance & Documentation
- **Event-Driven Detection Logic:**
  - Utilization of `document.visibilityState` for tab switching and window minimization.
  - Utilization of `window.onblur` and `window.onfocus` for alt-tabbing to other desktop applications.
  - 500 ms debounce filter to distinguish accidental blips from actual task switching.
- **QA & Testing Strategy:**
  - Execution of 13 structured test cases detailed in `docs/TEST_CASES.md`.
  - Verification across edge cases: short blips, multiple windows, reload mid-meeting, unconsented state, and concurrency.

---

## 7. Results from Testing
- **Test Execution Summary:**
  - *[Placeholder: Total number of test cases executed, passed, failed, and blocked across all functional modules]*
- **Focus Detection Accuracy:**
  - *[Placeholder: Quantitative accuracy of tab-switching and window-blur detection; verification of the 500 ms debounce threshold]*
- **Latency & Synchronization:**
  - *[Placeholder: Time taken from participant focus switch to dashboard update in seconds]*
- **Edge Case Observations:**
  - *[Placeholder: Findings on screen-share picker dialogs, system notifications, and multi-window behavior]*
- **Participant UI & Consent Verification:**
  - *[Placeholder: Verification that unconsented sessions produce zero events in local storage and the remote database]*

---

## 8. Ethical Considerations
- **Informed Consent:** Prioritizing user autonomy by mandating an unambiguous consent screen before any focus tracking is initiated.
- **Data Minimization:** Collecting only the minimum data required to calculate focus time (switch events and timestamps) rather than capturing invasive content (URLs, screen captures, keystrokes, audio, or video).
- **Proportionality:** Providing teachers with high-level awareness rather than punitive, hyper-surveilled monitoring.
- **Transparency:** Clear documentation of system boundaries and known limitations accessible to both educators and students.

---

## 9. Conclusion
- **Summary of Findings:** Summary of how Meet Focus Tracker successfully meets the need for simple, transparent engagement tracking in virtual learning environments.
- **Practical Implications:** Demonstrates that meaningful learning analytics can be gathered without invasive proctoring mechanisms.
- **Future Work:**
  - Automatic whitelisting of educational domains or Google Docs tabs.
  - Teacher-configurable debounce thresholds.
  - Automated report exporting (CSV/PDF) on the teacher dashboard.
