# Multi-Window Media Sequencer with Sync Playback

A full-stack distributed display application where multiple browser windows continuously stream media in their own configured sequence, featuring dynamic playlist management and instantaneous, synchronized overrides across all screens.

## Live Deployment Links
- **Frontend Web Application**: [https://multi-window-media-sequencer-ui-app-1.onrender.com](https://multi-window-media-sequencer-ui-app-1.onrender.com)
- **Backend API Service**: [https://multi-window-media-sequencer-app.onrender.com](https://multi-window-media-sequencer-app.onrender.com)
- **GitHub Repository**: [https://github.com/surpanch111/Multi-Window-Media-Sequencer-App](https://github.com/surpanch111/Multi-Window-Media-Sequencer-App)

---

## Overview

This project allows users to organize media clips, sequence them in custom windows, and control playback or editing workflows from a rich user interface powered by JavaScript on the frontend and Go on the backend.

## Why this project exists

Media editing and sequencing often involve multiple views and workflows running side by side. This app aims to provide a flexible multi-window environment for organizing, previewing, and sequencing media with improved productivity and workflow clarity.

## Features

- Multi-window layout for media workflows
- Timeline-based media sequencing
- Media asset organization and management
- Fast backend APIs for retrieving and processing media data
- Web-based UI for interaction and control
- Extensible architecture for future plugin or automation features
- Cross-platform friendly design

 ---
  
## Non-Technical System Explanation
Imagine a retail store or airport terminal with several digital billboard screens:
- **Window 1 (Main Hall)** showcases promotional photos and scenic nature videos.
- **Window 2 (Lobby Screen)** showcases architectural banners, videos, and an intentional short blackout period.
- **Window 3 (Outdoor Display)** displays high-energy event videos and image posters.

Under normal conditions, each screen operates independently, looping its configured media playlist continuously without stopping or introducing unintended blank screens.

When an operator triggers an **Emergency or Synchronized Broadcast** (e.g., an urgent announcement):
1. Every active screen immediately pauses its current sequence at the exact same instant.
2. All screens switch to display the synchronized announcement media.
3. Once the broadcast duration expires, each screen automatically resumes its normal sequence without losing its original position or playlist configuration.

---

## Core Scenarios & Implementation Logic

### 1. The 5-Hour Playback Cycle
- Each window is configured with an ordered playlist of media assets (images, videos, or explicit blank states).
- The system models playback as an endless cyclic sequence (`(currentIndex + 1) % playlist.length`). If a playlist contains 30 seconds of total media, it seamlessly loops 600 times across a 5-hour operational period.
- Transitions between media items occur immediately without downtime. An intentional blank screen only appears if an administrator explicitly includes a `"blank"` media item in that window's playlist.

### 2. Synchronized Playback (Sync Engine)
- The Go backend manages active client connections using high-performance WebSockets (`/ws`).
- When a client sends a sync request via `POST /api/sync`, the backend broadcasts a `SYNC_START` payload to every connected screen.
- A concurrent Goroutine on the backend manages an authoritative timer. When the configured duration expires, the server broadcasts `SYNC_END`, signaling all screens to revert back to their normal sequences simultaneously.
- Because timing is coordinated by server broadcast events, screens remain synchronized regardless of network latency or browser differences.

---

## Technical Stack & Architecture

- **Backend**: Golang (`net/http`, `gorilla/websocket`, `modernc.org/sqlite`)
- **Frontend**: React 18 (Vite, Lucide Icons)
- **Database**: SQLite (pure Go embedded engine, auto-migrated and seeded on startup)
- **Real-Time Communication**: Bidirectional WebSockets

---

## Database Schema & Seed Data
The backend automatically creates and seeds two relational tables upon startup if no data exists:

- **`windows`**: Stores display screen metadata (`id`, `name`, `created_at`).
- **`playlist_items`**: Stores ordered media sequences (`id`, `window_id`, `name`, `type`, `url`, `duration`, `position`).

Default seed data includes 3 pre-configured display windows containing a realistic mix of image URLs, streaming MP4 video URLs, and configured blank slides.

---

## API Documentation

### 1. Health Status
- **Method**: `GET /`
- **Response**:
```json
{
  "status": "online",
  "service": "Multi-Window Media Sequencer API"
}
```
---

## Architecture

```text
Frontend (JavaScript)
    |
    | REST API / WebSocket communication
    v
Backend (Go)
    |
    | Media processing / sequencing logic
    v
Storage / File System / Media Assets
