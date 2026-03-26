# Daily Rhythm Dashboard API

The Daily Rhythm module provides interactive widgets that display today's daily workflow status. The dashboard displays morning reports, gym nudges, afternoon reviews, and evening check-ins.

## API Endpoint

**URL:** `/api/daily-rhythm`

### GET Request
Returns today's rhythm state. Auto-resets to new day if data is from yesterday.

### POST Request
Updates rhythm data from cron jobs or user interactions.

## Cron Job Integration

Update your cron job prompts to also POST data to the dashboard API after sending Telegram messages:

### Morning Report (6:30am cron)
```bash
curl -X POST http://localhost:3001/api/daily-rhythm \
  -H "Content-Type: application/json" \
  -d '{
    "type": "morning-report",
    "data": {
      "weather": "20°C sunny",
      "events": [
        {"time": "10:00", "title": "COMM1100 Lecture"},
        {"time": "14:00", "title": "Team standup"}
      ],
      "tasks": [
        {"text": "Headland naming options", "status": "pending", "priority": "high"},
        {"text": "Bristlecone slides review", "status": "pending", "priority": "medium"}
      ],
      "overdue": ["Headland naming — 2 days overdue"],
      "research": {
        "topic": "Headland naming",
        "summary": "5 naming patterns analysed..."
      }
    }
  }'
```

### Gym Nudge (3:00pm cron)
```bash
# When sending the nudge
curl -X POST http://localhost:3001/api/daily-rhythm \
  -H "Content-Type: application/json" \
  -d '{
    "type": "gym-nudge",
    "data": {
      "action": "sent"
    }
  }'
```

### Arvo Review (4:30pm cron)
```bash
curl -X POST http://localhost:3001/api/daily-rhythm \
  -H "Content-Type: application/json" \
  -d '{
    "type": "arvo-review",
    "data": {
      "taskResults": "Task completion review summary..."
    }
  }'
```

### Evening Check-in (8:30pm cron)
```bash
curl -X POST http://localhost:3001/api/daily-rhythm \
  -H "Content-Type: application/json" \
  -d '{
    "type": "evening-checkin",
    "data": {
      "responses": "Daily tracker responses summary..."
    }
  }'
```

## Interactive Features

### Task Status Updates
Users can click task status buttons to update completion:
- ✅ Done
- 🔄 Partial
- ❌ Skipped

### Gym Responses
Users can respond to gym nudges:
- Did it ✅ (completed)
- Skipped ❌ (skipped)  
- Rest 😴 (rest)

## Data Structure

The dashboard stores data in `data/daily-rhythm.json`:

```json
{
  "date": "2026-03-26",
  "morningReport": {
    "postedAt": "2026-03-26T06:30:00",
    "weather": "20°C sunny",
    "events": [...],
    "tasks": [...],
    "overdue": [...],
    "research": {...}
  },
  "arvoReview": {
    "postedAt": null,
    "taskResults": null
  },
  "eveningCheckin": {
    "postedAt": null,
    "responses": null
  },
  "gym": {
    "nudgeSent": false,
    "completed": null
  }
}
```

## Timeline States

The dashboard shows different states based on time of day:
- **Upcoming**: Dimmed cards for future events
- **Active**: Highlighted cards for current/actionable items
- **Complete**: Past events that were completed

Auto-refreshes every 30 seconds to stay current.