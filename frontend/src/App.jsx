import React, { useState, useEffect } from "react";
import { Plus, Radio } from "lucide-react";

/*
================================================================================
MULTI-WINDOW MEDIA SEQUENCER - REACT FRONTEND
================================================================================
Non-Technical Explanation:
This dashboard renders all digital display screens. Each window loops through its
own sequence continuously. If a synchronized announcement is triggered, all
screens immediately pause their sequence, display the synchronized item, and
resume their original playlists when the timer expires.
================================================================================
*/

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

export default function App() {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState({ active: false, media: null, remaining: 0 });
  const [wsConnected, setWsConnected] = useState(false);

  // Sync Form State
  const [syncItem, setSyncItem] = useState({
    name: "Urgent Global Announcement",
    type: "image",
    url: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800",
    duration: 10,
  });

  // Add Media Modal State
  const [activeAddWindow, setActiveAddWindow] = useState(null);
  const [newMedia, setNewMedia] = useState({ name: "", type: "image", url: "", duration: 8 });

  // 1. Fetch Windows and Playlists from Backend
  const loadWindows = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/windows`);
      const data = await res.json();
      setWindows(data || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching windows:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWindows();
  }, []);

  // 2. Persistent WebSocket Listener for Live Overrides
  useEffect(() => {
    let ws;
    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.event === "SYNC_START") {
          setSyncState({
            active: true,
            media: msg.data.media,
            remaining: msg.data.duration,
          });
        } else if (msg.event === "SYNC_END") {
          setSyncState({ active: false, media: null, remaining: 0 });
        } else if (msg.event === "PLAYLIST_UPDATED") {
          loadWindows();
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connect, 3000);
      };
    };

    connect();
    return () => ws && ws.close();
  }, []);

  // Sync timer countdown
  useEffect(() => {
    if (!syncState.active || syncState.remaining <= 0) return;
    const timer = setInterval(() => {
      setSyncState((prev) => {
        if (prev.remaining <= 1) {
          return { active: false, media: null, remaining: 0 };
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [syncState.active, syncState.remaining]);

  // 3. Trigger Synchronized Broadcast
  const triggerSync = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media: syncItem,
          duration: Number(syncItem.duration),
        }),
      });
    } catch (err) {
      alert("Failed to broadcast sync");
    }
  };

  // 4. Submit New Media to a Specific Window
  const handleAddMedia = async (e) => {
    e.preventDefault();
    if (!activeAddWindow) return;

    try {
      await fetch(`${BACKEND_URL}/api/windows/${activeAddWindow}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMedia.name,
          type: newMedia.type,
          url: newMedia.url,
          duration: Number(newMedia.duration),
        }),
      });
      setActiveAddWindow(null);
      setNewMedia({ name: "", type: "image", url: "", duration: 8 });
      loadWindows();
    } catch (err) {
      alert("Failed to add media item");
    }
  };

  return (
    <div style={{ padding: "28px", maxWidth: "1440px", margin: "0 auto" }}>
      {/* App Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "800" }}>Multi-Window Media Sequencer</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>Continuous Playback Loop with Live Synchronized Overrides</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#1e293b", padding: "8px 16px", borderRadius: "9999px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: wsConnected ? "#22c55e" : "#ef4444" }} />
          <span style={{ fontSize: "14px" }}>{wsConnected ? "System Online" : "Connecting..."}</span>
        </div>
      </header>

      {/* Sync Active Banner */}
      {syncState.active && (
        <div style={{ backgroundColor: "#dc2626", color: "white", padding: "16px 20px", borderRadius: "8px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>SYNCHRONIZED BROADCAST ACTIVE</strong>
            <p style={{ fontSize: "14px" }}>Displaying "{syncState.media?.name}" on all display screens</p>
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", background: "rgba(0,0,0,0.3)", padding: "6px 16px", borderRadius: "6px" }}>
            Resuming Normal Playback in: {syncState.remaining}s
          </div>
        </div>
      )}

      {/* Sync Control Section */}
      <section style={{ backgroundColor: "#1e293b", borderRadius: "10px", padding: "20px", marginBottom: "28px", border: "1px solid #334155" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Radio size={18} color="#38bdf8" /> Trigger Synchronized Playback
        </h2>
        <form onSubmit={triggerSync} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <input
            type="text"
            placeholder="Sync Media Name"
            value={syncItem.name}
            onChange={(e) => setSyncItem({ ...syncItem, name: e.target.value })}
            style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", border: "1px solid #475569", color: "white" }}
            required
          />
          <select
            value={syncItem.type}
            onChange={(e) => setSyncItem({ ...syncItem, type: e.target.value })}
            style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", border: "1px solid #475569", color: "white" }}
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="blank">Blank State</option>
          </select>
          <input
            type="text"
            placeholder="Media URL"
            value={syncItem.url}
            onChange={(e) => setSyncItem({ ...syncItem, url: e.target.value })}
            style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", border: "1px solid #475569", color: "white" }}
            disabled={syncItem.type === "blank"}
          />
          <input
            type="number"
            min="2"
            max="60"
            placeholder="Duration (sec)"
            value={syncItem.duration}
            onChange={(e) => setSyncItem({ ...syncItem, duration: e.target.value })}
            style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", border: "1px solid #475569", color: "white" }}
            required
          />
          <button
            type="submit"
            style={{ padding: "9px 16px", backgroundColor: "#0284c7", color: "white", fontWeight: "600", borderRadius: "6px", border: "none", cursor: "pointer" }}
          >
            Broadcast Across Windows
          </button>
        </form>
      </section>

      {/* Screen Displays Grid */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#94a3b8" }}>Loading windows...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
          {windows.map((win) => (
            <WindowPlayer
              key={win.id}
              windowData={win}
              syncState={syncState}
              onOpenAdd={() => setActiveAddWindow(win.id)}
            />
          ))}
        </div>
      )}

      {/* Add Media Modal */}
      {activeAddWindow && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#1e293b", padding: "24px", borderRadius: "10px", width: "100%", maxWidth: "420px", border: "1px solid #334155" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px" }}>Add Media to Sequence</h3>
            <form onSubmit={handleAddMedia} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="text"
                placeholder="Media Name"
                value={newMedia.name}
                onChange={(e) => setNewMedia({ ...newMedia, name: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", border: "1px solid #475569", color: "white" }}
                required
              />
              <select
                value={newMedia.type}
                onChange={(e) => setNewMedia({ ...newMedia, type: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", border: "1px solid #475569", color: "white" }}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="blank">Blank State</option>
              </select>
              <input
                type="text"
                placeholder="Media URL"
                value={newMedia.url}
                onChange={(e) => setNewMedia({ ...newMedia, url: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", border: "1px solid #475569", color: "white" }}
                disabled={newMedia.type === "blank"}
              />
              <input
                type="number"
                placeholder="Duration (Seconds)"
                min="2"
                value={newMedia.duration}
                onChange={(e) => setNewMedia({ ...newMedia, duration: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", border: "1px solid #475569", color: "white" }}
                required
              />
              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setActiveAddWindow(null)}
                  style={{ flex: 1, padding: "8px", background: "#334155", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: "8px", background: "#16a34a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
                >
                  Add Media
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// WindowPlayer: Handles seamless cyclic playback per window
function WindowPlayer({ windowData, syncState, onOpenAdd }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const playlist = windowData.playlist || [];

  // Continuous loop: Advances sequentially and rolls over from last item to index 0
  useEffect(() => {
    if (syncState.active || playlist.length === 0) return;

    const currentItem = playlist[currentIndex];
    const duration = (currentItem?.duration || 5) * 1000;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [currentIndex, playlist, syncState.active]);

  const activeMedia = syncState.active ? syncState.media : playlist[currentIndex];

  return (
    <div style={{ backgroundColor: "#1e293b", borderRadius: "10px", border: "1px solid #334155", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Card Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: "15px", fontWeight: "600" }}>{windowData.name}</h3>
        <button
          onClick={onOpenAdd}
          style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", background: "#334155", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}
        >
          <Plus size={14} /> Add Media
        </button>
      </div>

      {/* Screen Viewport */}
      <div style={{ height: "230px", backgroundColor: "#020617", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {activeMedia ? (
          activeMedia.type === "video" ? (
            <video
              key={activeMedia.url + (syncState.active ? "-sync" : "-norm")}
              src={activeMedia.url}
              autoPlay
              muted
              playsInline
              loop
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : activeMedia.type === "image" ? (
            <img
              key={activeMedia.url + (syncState.active ? "-sync" : "-norm")}
              src={activeMedia.url}
              alt={activeMedia.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            // Configured Blank Display Item
            <div style={{ textAlign: "center", color: "#64748b" }}>
              <p style={{ fontSize: "14px" }}>Configured Blank State</p>
              <span style={{ fontSize: "12px" }}>({activeMedia.duration}s duration)</span>
            </div>
          )
        ) : (
          <p style={{ color: "#64748b" }}>Empty Playlist</p>
        )}

        {syncState.active && (
          <div style={{ position: "absolute", top: "10px", right: "10px", background: "#dc2626", color: "white", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
            SYNC OVERRIDE
          </div>
        )}
      </div>

      {/* Current Playback Details */}
      <div style={{ padding: "10px 16px", backgroundColor: "#0f172a", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
        <div>
          <span style={{ color: "#94a3b8" }}>Item: </span>
          <strong>{activeMedia ? activeMedia.name : "None"}</strong>
        </div>
        <div>
          <span style={{ color: "#94a3b8" }}>Duration: </span>
          <strong>{activeMedia ? `${activeMedia.duration}s` : "-"}</strong>
        </div>
      </div>

      {/* Playlist Items List */}
      <div style={{ padding: "12px 16px", flex: 1 }}>
        <h4 style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", marginBottom: "8px" }}>Playlist Sequence ({playlist.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "110px", overflowY: "auto" }}>
          {playlist.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                backgroundColor: !syncState.active && idx === currentIndex ? "#1e3a8a" : "#1e293b",
                border: !syncState.active && idx === currentIndex ? "1px solid #3b82f6" : "1px solid transparent",
              }}
            >
              <span>{idx + 1}. {item.name} ({item.type})</span>
              <span style={{ color: "#94a3b8" }}>{item.duration}s</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}