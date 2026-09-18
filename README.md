# Multi-Window Media Sequencer with Sync Playback

A full-stack application featuring continuous cyclic media playback across multiple digital display windows, dynamic playlist manipulation, and synchronized real-time overrides.

## Live Deployment Links
- **Frontend Application**: [https://your-frontend.onrender.com](https://your-frontend.onrender.com)
- **Backend API Service**: [https://your-backend.onrender.com](https://your-backend.onrender.com)

---

## Non-Technical Overview
This application functions like a synchronized digital signage network:
1. Multiple display windows show independent loops of videos, images, and explicit blank pauses.
2. When a global broadcast is triggered, every screen immediately interrupts its current item to show the broadcast item simultaneously.
3. Once the broadcast duration ends, each screen automatically resumes its normal sequence without losing its place or configuration.

---

## Continuous 5-Hour Cycle Implementation
Each display window cycles through its assigned sequence in order. When the last item completes, the sequencer seamlessly loops back to the first item (Index 0). The playlist repeats continuously to fulfill the 5-hour cycle without stopping or injecting unintended blank spaces. An intentional blank state only occurs if an administrator adds a "Blank State" media item.

---

## Tech Stack
- **Backend**: Golang (`net/http`, `gorilla/websocket`, `modernc.org/sqlite`)
- **Frontend**: React (Vite, Lucide Icons)
- **Database**: SQLite (Embedded persistent storage)
- **Synchronization**: Real-time WebSockets

---

## API Documentation

### 1. Get Windows & Sequences
- **Endpoint**: `GET /api/windows`
- **Description**: Returns all display screens along with their ordered playlists.

### 2. Append Media to Sequence
- **Endpoint**: `POST /api/windows/{window_id}/media`
- **Request Body**:
```json
{
  "name": "Summer Promotion",
  "type": "image",
  "url": "[https://example.com/banner.jpg](https://example.com/banner.jpg)",
  "duration": 10
}