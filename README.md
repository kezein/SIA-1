# Meet Focus Tracker

A Chrome extension and web dashboard that detects when a participant leaves a Google Meet tab (switching tabs, opening a new tab, or alt-tabbing to another app) and reports how many times it happened and for how long.

> **Privacy note:** The extension only detects *that* the participant left Meet and *for how long*. It does **not** record which tabs, websites, or apps were opened.

---

## Table of Contents
- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Event Format](#event-format)
- [Privacy and Consent](#privacy-and-consent)
- [Known Limitations](#known-limitations)
- [Team](#team)

---

## Features
- Detects tab switches, new tabs, and alt-tab while in Google Meet
- Counts the number of times a participant left Meet
- Measures total time away
- Consent screen shown before tracking starts
- Popup showing the participant's own results
- Dashboard where the teacher views each participant's results by meeting code

## How It Works

1. A **content script** runs on `meet.google.com` and listens for `visibilitychange`, `blur`, and `focus` events.
2. When the participant leaves or returns, it sends an event to the **background script**.
3. The background script counts switches, adds up time away, and saves the data.
4. Events are sent to the **database**, tagged with the participant name and meeting code.
5. The teacher opens the **dashboard**, enters the meeting code, and sees the results.

```
Student's browser (extension) --> Database --> Dashboard --> Teacher
```

The extension is installed on **each participant's** browser. The teacher does not need it.

## Tech Stack

| Part | Technology |
|---|---|
| Extension | Chrome Extension (Manifest V3), JavaScript |
| Backend / Database | [Firebase / Supabase: fill in] |
| Dashboard | [HTML, CSS, JavaScript / React: fill in] |

## Project Structure

```
meet-focus-tracker/
├── extension/
│   ├── manifest.json      # Extension settings and permissions
│   ├── content.js         # Detects leaving/returning on Google Meet
│   ├── background.js      # Counts switches and time away
│   ├── popup.html         # Popup window UI
│   ├── popup.js           # Popup logic (name, meeting code, results)
│   └── consent.html       # Consent screen shown on first use
├── dashboard/             # Teacher dashboard (web app)
├── docs/
│   └── EVENT_FORMAT.md    # Shared event format
└── README.md
```

## Installation

### Extension (for participants)
1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension` folder.
5. The extension icon should appear in the Chrome toolbar.

### Dashboard (for the teacher)
1. Go to the `dashboard` folder.
2. Add your database settings (see `.env.example` or the config file).
3. Run the dashboard:
   ```bash
   # replace with your actual commands
   npm install
   npm start
   ```

### Backend setup
1. Create a project in [Firebase / Supabase].
2. Create the events table/collection using the fields in [Event Format](#event-format).
3. Set the security rules so participants can only add events and only the teacher can read them.
4. Add your project keys to the extension and dashboard config files.

## Usage

**Participants:**
1. Click the extension icon.
2. Read and accept the consent screen.
3. Enter your name and the Google Meet code.
4. Join the meeting. Tracking runs automatically while you are on the Meet tab.

**Teacher:**
1. Open the dashboard and log in.
2. Enter the meeting code.
3. View each participant's number of switches and total time away.

## Event Format

Every part of the system uses the same JSON format for events:

```json
{
  "participant": "Maria",
  "meetingCode": "abc-defg-hij",
  "type": "left",
  "timestamp": 1760000000000,
  "duration": 30000
}
```

| Field | Description |
|---|---|
| `participant` | Name entered by the participant |
| `meetingCode` | The Google Meet code |
| `type` | `"left"` or `"returned"` |
| `timestamp` | When it happened, in milliseconds (`Date.now()`) |
| `duration` | Time away in milliseconds (only on `"returned"` events) |

Do not change field names without agreement from the whole team.

## Privacy and Consent
- Participants must accept a consent screen before tracking starts.
- Only these are recorded: that the participant left Meet, when, and for how long.
- Tab titles, URLs, and other apps are **never** read or stored.
- The extension only runs on `meet.google.com`.

## Known Limitations
- Meet's own screen-share picker, notifications, or clicking DevTools may trigger false "left" events.
- It cannot tell whether leaving Meet was for a legitimate reason.
- It cannot detect activity on a second device.
- Everyone being tracked must install the extension.

## Team

| Role | Member |
|---|---|
| 1. Project lead + Content script | Kezia Villegas |
| 2. Background script + Popup | Francis John Tamayo |
| 3. Backend + Integration | Aaron Celindro |
| 4. Dashboard | Francis Conguis |
| 5. UI/UX, QA, Documentation | Janeah Gasis|

**Course / Subject:** [fill in]
**School:** [fill in]
**Date:** October 2026
