# Personal Brain — Gemini Function Calling Tool Contracts

This document defines the interface and execution contracts for the tools exposed to Gemini 2.0 Flash function calling as specified in `SPEC.md` Section 3 & 4.

---

## 1. `search_emails`

Searches stored emails in the local GBrain persistent entity store matching the specified criteria. Emails are returned sorted newest first.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | No | Search keyword matching subject, snippet, body text, recipient, or label. |
| `from` | `string` | No | Email address or display name fragment of the sender or recipient to filter by. |
| `after` | `string` | No | ISO 8601 date boundary (e.g. `2026-09-01`). Matches emails sent at or after this date. |
| `before` | `string` | No | ISO 8601 date boundary (e.g. `2026-09-30`). Matches emails sent at or before this date. |

### Return Shape

```json
{
  "status": "success" | "no results found",
  "resultCount": 1,
  "emails": [
    {
      "type": "email",
      "threadId": "thread_stripe_001",
      "messageId": "msg_stripe_001",
      "from": "support@stripe.com",
      "to": ["user@personalbrain.local"],
      "subject": "Failed payment for invoice #10892",
      "snippet": "Your scheduled subscription payment...",
      "bodyText": "Hello, We were unable to process...",
      "date": "2026-09-21T18:00:00.000Z",
      "hasAttachments": false,
      "labels": ["INBOX"]
    }
  ]
}
```

### Failure Modes & Degradation
- If no files match the criteria: returns `{ "status": "no results found", "resultCount": 0, "emails": [] }`.
- If a corrupt JSON file is encountered: error is logged and the file is skipped; valid matching files continue to be processed.

---

## 2. `search_calendar_events`

Searches stored Google Calendar events in the local GBrain persistent entity store matching date ranges or keywords. Events are returned sorted earliest start time first.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | No | Keyword to match event summary, description, location, or attendee name/email. |
| `startDate` | `string` | No | ISO 8601 start date boundary (e.g. `2026-09-24T00:00:00Z`). |
| `endDate` | `string` | No | ISO 8601 end date boundary (e.g. `2026-09-25T23:59:59Z`). |

### Return Shape

```json
{
  "status": "success" | "no results found",
  "resultCount": 1,
  "events": [
    {
      "type": "event",
      "eventId": "event_alice_101",
      "summary": "Q1 Product Sync with Alice",
      "description": "Quarterly product roadmap alignment meeting.",
      "start": "2026-09-24T10:00:00.000Z",
      "end": "2026-09-24T11:00:00.000Z",
      "attendees": [
        {
          "email": "alice@acme.com",
          "displayName": "Alice Smith",
          "responseStatus": "accepted"
        }
      ],
      "organizer": "alice@acme.com",
      "location": "Google Meet"
    }
  ]
}
```

### Failure Modes & Degradation
- If no events match the date window: returns `{ "status": "no results found", "resultCount": 0, "events": [] }`.
- Events without start or end times are omitted during ingestion.
