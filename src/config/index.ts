// Centralized Configuration
// ─────────────────────────────────────────────────────────────────────────────
// Connection strategy (in priority order):
//   1. USB cable + adb reverse  →  HOST = '127.0.0.1'   (most reliable ✅)
//      Run once:  adb reverse tcp:3000 tcp:3000
//   2. Same WiFi LAN            →  HOST = '192.168.0.140' (your PC's IP)
//      Run: ip addr show | grep "inet " to confirm
// ─────────────────────────────────────────────────────────────────────────────

// ✅ USB + adb reverse — server runs on localhost
// const HOST = '127.0.0.1';
// const PORT = 3000;
// export const CONFIG = {
//   API_BASE_URL: `http://${HOST}:${PORT}`,
//   WS_BASE_URL: `ws://${HOST}:${PORT}`,
// };

// ☁️ Render Production Deployment
export const CONFIG = {
  API_BASE_URL: 'https://anya-mcp-server.onrender.com',
  WS_BASE_URL: 'wss://anya-mcp-server.onrender.com',
};
