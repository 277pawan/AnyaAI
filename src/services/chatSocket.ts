// src/services/chatSocket.ts
// Manages the persistent WebSocket connection to Anya MCP Server
// Handles session creation, streaming chunks, and reconnection

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { CONFIG } from '../config/index';

const USER_ID = '89968338-6678-48e0-be01-f8472e550e1d';
const SESSION_KEY = '@anya_session_id';

export interface ChatCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullText: string, latency: number) => void;
  onError: (msg: string) => void;
  onConnected: (sessionId: string) => void;
  onDisconnected?: () => void;
  onBackgroundResult: (text: string) => void;
  onNotification?: (title: string, body: string, data: any) => void;
}

class AnyaChatSocket {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private callbacks: ChatCallbacks | null = null;
  private fullResponse: string = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;

  setCallbacks(cb: ChatCallbacks) {
    this.callbacks = cb;
  }

  private async getOrCreateSession(): Promise<string> {
    // Try stored session first
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      if (stored) {
        // Verify session still exists
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/chat/session/${stored}`, {
          headers: { 'x-user-id': USER_ID },
        });
        if (res.ok) {
          console.log('[AnyaChat] Reusing session:', stored);
          return stored;
        }
      }
    } catch (e) {
      console.warn('[AnyaChat] Error checking stored session:', e);
    }

    // Create new session
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
      body: JSON.stringify({ title: `Anya Session ${new Date().toLocaleDateString('en-IN')}` }),
    });
    const data = await res.json();
    const newId = data.data?.id;
    if (!newId) throw new Error('Failed to create session');
    await AsyncStorage.setItem(SESSION_KEY, newId);
    console.log('[AnyaChat] Created new session:', newId);
    return newId;
  }

  async connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    this.isConnecting = true;

    try {
      this.sessionId = await this.getOrCreateSession();
      const wsUrl = `${CONFIG.WS_BASE_URL}/ws/chat/${this.sessionId}?userId=${USER_ID}`;
      console.log('[AnyaChat] Connecting WS:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log('[AnyaChat] WebSocket connected');
        this.callbacks?.onConnected(this.sessionId!);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.event) {
            case 'chunk':
              this.fullResponse += msg.text;
              this.callbacks?.onChunk(msg.text);
              break;
            case 'done':
              const full = this.fullResponse;
              this.fullResponse = '';
              this.callbacks?.onDone(full, msg.latency_ms || 0);
              break;
            case 'background_result':
              this.callbacks?.onBackgroundResult(msg.text);
              break;
            case 'device_command':
              try {
                const { NativeModules } = require('react-native');
                const { AnyaService } = NativeModules;
                if (AnyaService && AnyaService.executeDeviceCommand) {
                  console.log('[AnyaChat] Executing device command from WS:', msg);
                  AnyaService.executeDeviceCommand(
                    msg.command || '',
                    msg.query || null,
                    msg.packageName || null,
                    msg.url || null
                  );
                } else {
                  console.warn('[AnyaChat] AnyaService.executeDeviceCommand not available');
                }
              } catch (e) {
                console.error('[AnyaChat] Error executing device command:', e);
              }
              break;
            case 'notification':
              // Emit global event emitter notification so that any active screen or App.tsx receives it!
              try {
                DeviceEventEmitter.emit('anya-notification', {
                  title: msg.title || 'Anya Alert',
                  body: msg.body || msg.text || '',
                  data: msg
                });
              } catch (ee) {
                console.warn('[AnyaChat] Failed to emit global notification event:', ee);
              }

              // Maintain legacy screen-specific callback if registered
              this.callbacks?.onNotification?.(
                msg.title || 'Anya Alert',
                msg.body || msg.text || '',
                msg
              );
              break;
            case 'background_log':
              try {
                DeviceEventEmitter.emit('anya-background-log', {
                  message: msg.message,
                  taskType: msg.taskType,
                  timestamp: msg.timestamp || new Date().toISOString(),
                });
              } catch (ee) {
                console.log('[AnyaChat] Failed to emit background log:', ee);
              }
              break;
            case 'error':
              this.callbacks?.onError(msg.message || 'Unknown error');
              break;
          }
        } catch (e) {
          console.log('[AnyaChat] Bad message:', event.data);
        }
      };

      this.ws.onerror = (e) => {
        this.isConnecting = false;
        console.log('[AnyaChat] WS error:', e);
        this.callbacks?.onError('Connection error. Reconnecting...');
        this.scheduleReconnect();
      };

      this.ws.onclose = (e) => {
        this.isConnecting = false;
        console.log('[AnyaChat] WS closed:', e.code, e.reason);
        this.callbacks?.onDisconnected?.();
        if (e.code !== 1000) this.scheduleReconnect();
      };
    } catch (err: any) {
      this.isConnecting = false;
      console.log('[AnyaChat] Connection failed:', err);
      this.callbacks?.onError(`Server unreachable: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  sendMessage(text: string) {
    this.fullResponse = '';
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ content: text }));
      return true;
    } else {
      this.callbacks?.onError('Not connected to Anya. Reconnecting...');
      this.connect();
      return false;
    }
  }

  sendCancel() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[AnyaChat] Sending cancel event to backend');
      this.ws.send(JSON.stringify({ event: 'cancel' }));
      return true;
    }
    return false;
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close(1000, 'App closed');
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSessionId() {
    return this.sessionId;
  }
}

// Singleton
export const anyaChat = new AnyaChatSocket();
