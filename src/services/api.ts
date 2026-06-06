// src/services/api.ts
// Centralized API client for all Anya MCP Server endpoints
// Auto-injects x-user-id header on every request

import { CONFIG } from '../config/index';

const USER_ID = '89968338-6678-48e0-be01-f8472e550e1d';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-user-id': USER_ID,
});

const get = async (path: string) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, { headers: headers() });
  return res.json();
};

const post = async (path: string, body?: any) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    method: 'POST', headers: headers(), body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

const put = async (path: string, body?: any) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    method: 'PUT', headers: headers(), body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

const patch = async (path: string, body?: any) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    method: 'PATCH', headers: headers(), body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

const del = async (path: string) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    method: 'DELETE', headers: headers(),
  });
  return res.json();
};

// ─── USER ────────────────────────────────────────────────────────────────────
export const UserAPI = {
  getProfile:        ()           => get('/api/user/profile'),
  updateProfile:     (data: any)  => put('/api/user/profile', data),
  getSkills:         ()           => get('/api/user/skills'),
  replaceSkills:     (skills: string[]) => put('/api/user/skills', { skills }),
  getGoals:          ()           => get('/api/user/goals'),
  createGoal:        (data: any)  => post('/api/user/goals', data),
  updateGoal:        (id: string, data: any) => patch(`/api/user/goals/${id}`, data),
  deleteGoal:        (id: string) => del(`/api/user/goals/${id}`),
  getPreferences:    ()           => get('/api/user/preferences'),
  updatePreferences: (data: any)  => put('/api/user/preferences', data),
  replaceWorkTypes:  (types: string[]) => put('/api/user/work-types', { workTypes: types }),
};

// ─── CHAT ─────────────────────────────────────────────────────────────────────
export const ChatAPI = {
  createSession:   (title?: string)    => post('/api/chat/session', { title }),
  listSessions:    (limit = 20, offset = 0) => get(`/api/chat/sessions?limit=${limit}&offset=${offset}`),
  getSession:      (id: string)        => get(`/api/chat/session/${id}`),
  deleteSession:   (id: string)        => del(`/api/chat/session/${id}`),
  sendMessage:     (sessionId: string, content: string) =>
                     post('/api/chat/message', { sessionId, content }),
  searchMessages:  (q: string, limit = 20) => get(`/api/chat/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  synthesizeSpeech: (text: string) => post('/api/chat/tts', { text }),
};

// ─── LIFE ENGINE ──────────────────────────────────────────────────────────────
export const LifeEngineAPI = {
  getState:           ()           => get('/api/life-engine/state'),
  updateStreak:       (data: any)  => put('/api/life-engine/streak', data),
  incrementStreak:    ()           => post('/api/life-engine/streak/increment'),
  logMood:            (mood: number, note?: string) => post('/api/life-engine/mood', { mood, note }),
  getMoodHistory:     ()           => get('/api/life-engine/mood/history'),
  getWeeklyStats:     ()           => get('/api/life-engine/stats/weekly'),
  getEngagementSummary: ()         => get('/api/life-engine/stats/summary'),
  cleanupAndInsights: ()           => post('/api/life-engine/cleanup'),
};

// ─── NUDGES ───────────────────────────────────────────────────────────────────
export const NudgeAPI = {
  list:               ()           => get('/api/nudges'),
  record:             (data: any)  => post('/api/nudges', data),
  engage:             (id: string) => patch(`/api/nudges/${id}/engage`),
  getTodayCount:      ()           => get('/api/nudges/today/count'),
  getCategories:      ()           => get('/api/nudges/categories'),
  updateCategory:     (name: string, data: any) => put(`/api/nudges/categories/${name}`, data),
  getSchedule:        ()           => get('/api/nudges/schedule'),
  updateScheduleSlot: (slot: string, data: any) => put(`/api/nudges/schedule/${slot}`, data),
};

// ─── HISTORY ──────────────────────────────────────────────────────────────────
export const HistoryAPI = {
  getMCPHistory:          ()           => get('/api/history/mcp-calls'),
  getAIHistory:           ()           => get('/api/history/ai-calls'),
  getAIStats:             ()           => get('/api/history/ai-calls/stats'),
  getLeadHistory:         ()           => get('/api/history/leads'),
  getLead:                (id: string) => get(`/api/history/leads/${id}`),
  getNotifications:       ()           => get('/api/history/notifications'),
  markNotificationRead:   (id: string) => patch(`/api/history/notifications/${id}/read`),
  markAllRead:            ()           => patch('/api/history/notifications/read-all'),
};
