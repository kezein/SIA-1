# Shared Event Format

This document specifies the shared JSON event schema used across all components of the project (Extension, Background Script, Database, and Dashboard).

## Event Schema

```json
{
  "participant": "Maria",
  "meetingCode": "abc-defg-hij",
  "type": "left",
  "timestamp": 1760000000000,
  "duration": 30000
}
```

## Field Descriptions

| Field | Type | Description | Provided By |
|---|---|---|---|
| `participant` | `string` | Name entered in the popup by the participant. | Added by the background script |
| `meetingCode` | `string` | The Google Meet code extracted from the URL (e.g., `abc-defg-hij`). | Extracted by the content script |
| `type` | `string` | Event indicator: either `"left"` or `"returned"`. | Sent by the content script |
| `timestamp` | `number` | Unix epoch time in milliseconds (`Date.now()`). | Sent by the content script |
| `duration` | `number` (optional) | Total time away in milliseconds. Only present on `"returned"` events. | Added by the background script |

---

> **IMPORTANT NOTE:**  
> Field names must **not** be changed without the whole team agreeing. Every component (content script, background script, database, and dashboard) relies on this exact structure.
