package main

/*
================================================================================
MULTI-WINDOW MEDIA SEQUENCER - GOLANG BACKEND SERVICE
================================================================================
Non-Technical Architecture Summary:
This service functions as the central controller for all connected display
screens. It manages a persistent SQLite database storing media sequences and
runs an active WebSocket broadcasting server. When media is added or a sync
playback is triggered, it informs all active display screens instantaneously.
================================================================================
*/

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	_ "modernc.org/sqlite"
)

// MediaItem represents an image, video, or explicit blank slide.
type MediaItem struct {
	ID       string `json:"id"`
	WindowID string `json:"window_id"`
	Name     string `json:"name"`
	Type     string `json:"type"` // "image", "video", or "blank"
	URL      string `json:"url"`
	Duration int    `json:"duration"` // Duration in seconds
	Position int    `json:"position"` // Order in sequence
}

// Window represents an individual screen holding an ordered playlist.
type Window struct {
	ID        string      `json:"id"`
	Name      string      `json:"name"`
	CreatedAt string      `json:"created_at"`
	Playlist  []MediaItem `json:"playlist"`
}

// SyncPayload carries media to display on all windows simultaneously.
type SyncPayload struct {
	Media    MediaItem `json:"media"`
	Duration int       `json:"duration"`
}

// WSMessage models broadcast messages sent over WebSockets.
type WSMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

var (
	db       *sql.DB
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all incoming connections across deployed domains
		},
	}
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex
)

// initDB initializes the persistent SQLite database tables and seed data.
func initDB() {
	var err error
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "sequencer.db"
	}

	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Database connection error: %v", err)
	}

	createTablesQuery := `
	CREATE TABLE IF NOT EXISTS windows (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS playlist_items (
		id TEXT PRIMARY KEY,
		window_id TEXT NOT NULL,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		url TEXT NOT NULL,
		duration INTEGER NOT NULL,
		position INTEGER NOT NULL,
		FOREIGN KEY(window_id) REFERENCES windows(id) ON DELETE CASCADE
	);`

	if _, err := db.Exec(createTablesQuery); err != nil {
		log.Fatalf("Database table creation failed: %v", err)
	}

	seedInitialData()
}

// seedInitialData populates three sample display windows if database is empty.
func seedInitialData() {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM windows").Scan(&count)
	if err != nil || count > 0 {
		return
	}

	log.Println("Seeding initial windows and playlist sequences...")

	windows := []struct {
		ID   string
		Name string
	}{
		{"win-1", "Window 1 (Main Hall)"},
		{"win-2", "Window 2 (Lobby Screen)"},
		{"win-3", "Window 3 (Outdoor Display)"},
	}

	for _, w := range windows {
		_, err := db.Exec("INSERT INTO windows (id, name) VALUES (?, ?)", w.ID, w.Name)
		if err != nil {
			log.Printf("Failed to insert window %s: %v", w.Name, err)
		}
	}

	sampleMedia := []MediaItem{
		// Window 1: Mixed Image and Video
		{ID: "m-101", WindowID: "win-1", Name: "Nature Poster", Type: "image", URL: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800", Duration: 8, Position: 1},
		{ID: "m-102", WindowID: "win-1", Name: "Ocean Waves Video", Type: "video", URL: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", Duration: 15, Position: 2},
		{ID: "m-103", WindowID: "win-1", Name: "Mountain View", Type: "image", URL: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800", Duration: 10, Position: 3},

		// Window 2: Video, Image, and Configured Blank State
		{ID: "m-201", WindowID: "win-2", Name: "City Timelapse", Type: "video", URL: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", Duration: 15, Position: 1},
		{ID: "m-202", WindowID: "win-2", Name: "Architecture Banner", Type: "image", URL: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800", Duration: 9, Position: 2},
		{ID: "m-203", WindowID: "win-2", Name: "Configured Blackout", Type: "blank", URL: "", Duration: 5, Position: 3},

		// Window 3: Image, Image, Video
		{ID: "m-301", WindowID: "win-3", Name: "Forest Trail", Type: "image", URL: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800", Duration: 7, Position: 1},
		{ID: "m-302", WindowID: "win-3", Name: "Desert Sunset", Type: "image", URL: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800", Duration: 8, Position: 2},
		{ID: "m-303", WindowID: "win-3", Name: "Tech Animation Video", Type: "video", URL: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4", Duration: 12, Position: 3},
	}

	for _, m := range sampleMedia {
		_, err := db.Exec(
			"INSERT INTO playlist_items (id, window_id, name, type, url, duration, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
			m.ID, m.WindowID, m.Name, m.Type, m.URL, m.Duration, m.Position,
		)
		if err != nil {
			log.Printf("Failed to insert media %s: %v", m.Name, err)
		}
	}
	log.Println("Seeding complete.")
}

// broadcastMessage transmits a JSON payload to all connected display screens.
func broadcastMessage(msg WSMessage) {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	for client := range clients {
		if err := client.WriteJSON(msg); err != nil {
			client.Close()
			delete(clients, client)
		}
	}
}

// enableCORS sets headers allowing cross-origin requests from the React frontend.
func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// handleGetWindows returns all windows with their ordered media playlists.
func handleGetWindows(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	rows, err := db.Query("SELECT id, name, created_at FROM windows ORDER BY id ASC")
	if err != nil {
		http.Error(w, "Failed to retrieve windows", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var windows []Window
	for rows.Next() {
		var win Window
		if err := rows.Scan(&win.ID, &win.Name, &win.CreatedAt); err != nil {
			continue
		}

		itemRows, err := db.Query("SELECT id, window_id, name, type, url, duration, position FROM playlist_items WHERE window_id = ? ORDER BY position ASC", win.ID)
		if err == nil {
			for itemRows.Next() {
				var item MediaItem
				if err := itemRows.Scan(&item.ID, &item.WindowID, &item.Name, &item.Type, &item.URL, &item.Duration, &item.Position); err == nil {
					win.Playlist = append(win.Playlist, item)
				}
			}
			itemRows.Close()
		}
		if win.Playlist == nil {
			win.Playlist = []MediaItem{}
		}
		windows = append(windows, win)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(windows)
}

// handleAddMedia appends a new media item to a window's sequence.
func handleAddMedia(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extracts windowID from path format: /api/windows/{id}/media
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid path format", http.StatusBadRequest)
		return
	}
	windowID := pathParts[2]

	var req struct {
		Name     string `json:"name"`
		Type     string `json:"type"`
		URL      string `json:"url"`
		Duration int    `json:"duration"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if req.Duration <= 0 {
		req.Duration = 10
	}

	var maxPos sql.NullInt64
	db.QueryRow("SELECT MAX(position) FROM playlist_items WHERE window_id = ?", windowID).Scan(&maxPos)
	nextPos := 1
	if maxPos.Valid {
		nextPos = int(maxPos.Int64) + 1
	}

	itemID := fmt.Sprintf("m-%d", time.Now().UnixNano())
	_, err := db.Exec(
		"INSERT INTO playlist_items (id, window_id, name, type, url, duration, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
		itemID, windowID, req.Name, req.Type, req.URL, req.Duration, nextPos,
	)
	if err != nil {
		http.Error(w, "Failed to insert media item", http.StatusInternalServerError)
		return
	}

	// Broadcast playlist update notification to frontend players
	broadcastMessage(WSMessage{
		Event: "PLAYLIST_UPDATED",
		Data:  windowID,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      itemID,
	})
}

// handleSync broadcasts an immediate override across all active windows.
func handleSync(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload SyncPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid sync body", http.StatusBadRequest)
		return
	}

	if payload.Duration <= 0 {
		payload.Duration = 10
	}

	// 1. Notify all screens to immediately display the sync media
	broadcastMessage(WSMessage{
		Event: "SYNC_START",
		Data:  payload,
	})

	// 2. Server-side timer to signal sync completion and return to individual loops
	go func(dur int) {
		time.Sleep(time.Duration(dur) * time.Second)
		broadcastMessage(WSMessage{
			Event: "SYNC_END",
			Data:  nil,
		})
	}(payload.Duration)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"duration": payload.Duration,
	})
}

// handleWebSocket manages persistent browser connections.
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()

	go func() {
		defer func() {
			clientsMu.Lock()
			delete(clients, conn)
			clientsMu.Unlock()
			conn.Close()
		}()

		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}

func main() {
	initDB()
	defer db.Close()

	http.HandleFunc("/api/windows", handleGetWindows)
	http.HandleFunc("/api/windows/", handleAddMedia)
	http.HandleFunc("/api/sync", handleSync)
	http.HandleFunc("/ws", handleWebSocket)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server listening on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server startup failed: %v", err)
	}
}