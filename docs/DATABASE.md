# Database & Backend Integration Guide

**Role 3:** Aaron Celindro (Backend + Integration)  
**Project:** Meet Focus Tracker  
**Date:** October 2026  
**Reference Specification:** [`docs/EVENT_FORMAT.md`](EVENT_FORMAT.md)

---

## Table of Contents
1. [Overview](#overview)
2. [Database Schema (`focus_events`)](#database-schema-focus_events)
3. [Row Level Security (RLS) Rules](#row-level-security-rls-rules)
4. [Analytics View (`meeting_summary`)](#analytics-view-meeting_summary)
5. [Role 2 Integration Snippet (`extension/background.js`)](#role-2-integration-snippet-extensionbackgroundjs)
6. [Role 4 Integration Snippet (`dashboard/data.js`)](#role-4-integration-snippet-dashboarddatajs)
7. [Step-by-Step Supabase Setup](#step-by-step-supabase-setup)
8. [Testing & Verification](#testing--verification)

---

## Overview

The Meet Focus Tracker backend uses **Supabase (PostgreSQL)** to store, secure, and aggregate focus tracking events.

```
Student Browser (Extension) 
    ──[ POST /rest/v1/focus_events (Anon Key) ]──▶ Supabase (PostgreSQL + RLS)
                                                         │
                                                  [ Realtime / SELECT ]
                                                         ▼
                                            Teacher Dashboard (Web App)
```

### Role 3 Deliverables on `feat/backend-integration`:
- `backend/schema.sql`: Complete PostgreSQL table definitions, indexes, RLS policies, and views.
- `docs/DATABASE.md`: Integration guide and copy-paste code snippets for Role 2 and Role 4.
- `extension/config.example.js`: Template for Supabase URL and public anonymous key.
- `extension/supabaseClient.js`: Zero-dependency, lightweight REST client for Chrome MV3 with an offline retry queue.
- `scripts/test-supabase.js`: Automated CLI test suite verifying API connectivity and RLS permissions.

---

## Database Schema (`focus_events`)

The full SQL script is located at [`backend/schema.sql`](../backend/schema.sql).

### Table Structure

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique event ID |
| `participant` | `TEXT` | `NOT NULL` | Participant name entered in extension popup |
| `"meetingCode"` | `TEXT` | `NOT NULL` | Google Meet code (e.g. `abc-defg-hij`) |
| `type` | `TEXT` | `NOT NULL CHECK (type IN ('left', 'returned'))` | Focus state |
| `timestamp` | `BIGINT` | `NOT NULL` | Unix epoch time in milliseconds (`Date.now()`) |
| `duration` | `BIGINT` | `NULL` | Time away in ms (present only on `returned` events) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now() NOT NULL` | Database insertion timestamp |

### Indexes
- `idx_focus_events_meeting_code` on `("meetingCode")`
- `idx_focus_events_meeting_participant` on `("meetingCode", participant)`
- `idx_focus_events_timestamp` on `(timestamp DESC)`

---

## Row Level Security (RLS) Rules

Row Level Security is enabled on `focus_events`. By default, all access is denied unless explicitly permitted by an RLS policy:

1. **`INSERT` Policy (Extension / Participants):**  
   Allowed for `anon` and `authenticated` roles. Requires valid non-empty `participant`, non-empty `"meetingCode"`, valid `type` (`left` or `returned`), and `timestamp > 0`.
2. **`SELECT` Policy (Teacher Dashboard):**  
   Restricted to `authenticated` teachers. Participants holding the extension's public `anonKey` **cannot** read or list events (returns `0` rows for privacy protection).
3. **`UPDATE` Policy:**  
   Disabled for all roles. Tracking events are immutable and append-only.
4. **`DELETE` Policy:**  
   Restricted to `authenticated` teachers to clear old meetings.

---

## Analytics View (`meeting_summary`)

To eliminate the need for the teacher dashboard to calculate totals manually across thousands of rows, a pre-aggregated SQL view is provided:

```sql
CREATE OR REPLACE VIEW public.meeting_summary
WITH (security_invoker = true)
AS
SELECT
    "meetingCode",
    participant,
    COUNT(*) FILTER (WHERE type = 'left') AS switch_count,
    COALESCE(SUM(duration) FILTER (WHERE type = 'returned'), 0) AS total_duration_ms,
    ROUND(COALESCE(SUM(duration) FILTER (WHERE type = 'returned'), 0) / 1000.0, 1) AS total_duration_seconds,
    MIN(timestamp) AS first_event_at,
    MAX(timestamp) AS last_event_at,
    COUNT(*) AS total_events
FROM public.focus_events
GROUP BY "meetingCode", participant;
```

---

## Role 2 Integration Snippet (`extension/background.js`)

**For:** Francis John Tamayo (Background Script + Popup)  
**Goal:** Connect your existing `handleFocusEvent` logic to Supabase without changing any storage keys or dropping the consent check.

### Step 1: Import the Client at the Very Top of `background.js`
Add this at line 1 of [`extension/background.js`](../extension/background.js):

```javascript
// Import Supabase configuration and client (Role 3 Integration)
try {
  importScripts('config.js', 'supabaseClient.js');
} catch (err) {
  console.error('[Meet Focus Tracker] Failed to import Supabase scripts:', err);
}
```

### Step 2: Implement `sendToBackend(event)`
Replace the placeholder `sendToBackend` function in `background.js` with:

```javascript
/**
 * Sends the formatted event to the Supabase backend.
 * Uses SupabaseClient with automatic offline retry queue.
 * @param {Object} event - The shared event object { participant, meetingCode, type, timestamp, duration }
 */
async function sendToBackend(event) {
  if (typeof SupabaseClient !== 'undefined' && SupabaseClient.sendFocusEvent) {
    const result = await SupabaseClient.sendFocusEvent(event);
    if (!result.success) {
      throw new Error(result.error || 'Failed to send event to Supabase');
    }
    return result;
  } else {
    console.warn('[Meet Focus Tracker] SupabaseClient not loaded. Check script imports.');
  }
}
```

### Notes for Role 2:
- **Zero Storage Changes:** Keep your exact storage keys (`participant`, `switches`, `totalAway`, `lastLeaveTime`).
- **Consent Guard Preserved:** Your `if (data.consentGiven !== true) return;` guard remains 100% in charge.
- **Fail-Safe:** Your existing `try / catch` around `sendToBackend` ensures that a network failure will never interrupt local counting or popup display.

---

## Role 4 Integration Snippet (`dashboard/data.js`)

**For:** Francis Conguis (Teacher Dashboard)  
**Goal:** Query live meeting focus events from Supabase instead of mock data.

### Step 1: Add `config.js` to `dashboard/index.html`
In `dashboard/index.html`, load `config.js` before `data.js`:

```html
  <!-- Application Logic Scripts -->
  <script src="config.js"></script>
  <script src="data.js"></script>
  <script src="app.js"></script>
```

### Step 2: Replace `getEvents(meetingCode)` in `dashboard/data.js`
In `dashboard/data.js`, update `getEvents(meetingCode)`:

```javascript
/**
 * Fetches events for a specific meetingCode from Supabase PostgREST API.
 * Falls back to mock events if Supabase is offline.
 * 
 * @param {string} meetingCode - Google Meet code (e.g. 'abc-defg-hij')
 * @returns {Promise<Array>} Array of event objects
 */
async function getEvents(meetingCode) {
  if (!meetingCode) return [];
  const normalizedCode = meetingCode.trim();

  // Role 3 + Role 4 Integration: Query Supabase REST API
  if (typeof CONFIG !== 'undefined' && CONFIG.BACKEND_PROVIDER === 'supabase' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    try {
      const baseUrl = CONFIG.SUPABASE_URL.replace(/\/+$/, '');
      const url = `${baseUrl}/rest/v1/focus_events?meetingCode=ilike.${encodeURIComponent(normalizedCode)}&order=timestamp.asc`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });

      if (response.ok) {
        const events = await response.json();
        console.log(`[Dashboard] Supabase returned ${events.length} event(s) for meeting "${normalizedCode}"`);
        if (Array.isArray(events) && events.length > 0) {
          return events;
        }
      } else {
        console.warn(`[Dashboard] Supabase returned status ${response.status}:`, await response.text());
      }
    } catch (err) {
      console.warn('[Dashboard] Could not fetch from Supabase, checking fallback:', err);
    }
  }

  // Fallback dataset (mockEvents.json or built-in fallback)
  const allEvents = await loadAllEvents();
  return allEvents.filter(event => 
    event.meetingCode && event.meetingCode.trim().toLowerCase() === normalizedCode.toLowerCase()
  );
}
```

### Step 3: Optional Helper for Meeting Codes Dropdown
To populate meeting code auto-suggestions from real database records:

```javascript
async function getAvailableMeetingCodes() {
  if (typeof CONFIG !== 'undefined' && CONFIG.BACKEND_PROVIDER === 'supabase' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    try {
      const baseUrl = CONFIG.SUPABASE_URL.replace(/\/+$/, '');
      const url = `${baseUrl}/rest/v1/focus_events?select=meetingCode`;
      const response = await fetch(url, {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });
      if (response.ok) {
        const rows = await response.json();
        const codes = Array.from(new Set(rows.map(r => r.meetingCode).filter(Boolean)));
        if (codes.length > 0) return codes;
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch meeting codes from Supabase:', err);
    }
  }

  const allEvents = await loadAllEvents();
  const codesSet = new Set();
  allEvents.forEach(e => {
    if (e.meetingCode) codesSet.add(e.meetingCode.trim());
  });
  return Array.from(codesSet);
}
```

> **Testing Note for Role 4:** During development before teacher login is hooked up, run this in Supabase SQL Editor to allow anonymous SELECT:  
> `CREATE POLICY "Dev only: allow anon read" ON public.focus_events FOR SELECT TO anon USING (true);`

---

## Step-by-Step Supabase Setup

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** on the left menu.
3. Paste the contents of [`backend/schema.sql`](../backend/schema.sql) and click **Run**.
4. In **Project Settings** -> **API**, copy your **Project URL** and **anon public key**.
5. Copy `extension/config.example.js` to `extension/config.js` and paste your credentials.

---

## Testing & Verification

Run the automated verification script from your terminal:

```bash
node scripts/test-supabase.js
```

### Expected Output:
```text
=============================================================
 Meet Focus Tracker - Backend & Security Verification
 Target URL: https://xyz.supabase.co
=============================================================

--- [1] Checking Database Table & Connection ---
✔ Connected to Supabase PostgREST API successfully.
✔ Table "focus_events" exists and is accessible.

--- [2] Testing Anonymous INSERT (Extension Flow) ---
✔ Anonymous INSERT succeeded! (Status: 201)

--- [3] Testing Anonymous SELECT (Security Rule / RLS) ---
✔ RLS Verified! Anon query returned 0 rows (reading is blocked for anonymous users).
```
