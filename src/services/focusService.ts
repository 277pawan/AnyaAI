// src/services/focusService.ts
// All Focus OS API interactions — XP, Roadmap, Nutrition, Articles

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config/index';

const BASE = CONFIG.API_BASE_URL;
const DEFAULT_USER_ID = '89968338-6678-48e0-be01-f8472e550e1d';

const headers = {
  'Content-Type': 'application/json',
  'x-user-id': DEFAULT_USER_ID,
};

// ── XP & Level ────────────────────────────────────────────────────────────────

export interface XPState {
  total_xp: number;
  current_level: number;
  weekly_xp: number;
  week_start_date: string;
}

/** Fetch XP state from backend (handles weekly reset server-side) */
export async function fetchXPState(): Promise<XPState | null> {
  try {
    const res = await fetch(`${BASE}/api/focus/xp`, { headers });
    if (!res.ok) throw new Error('XP fetch failed');
    const json = await res.json();
    if (json.success) {
      await AsyncStorage.setItem('@focus_xp_state', JSON.stringify(json.data));
      return json.data;
    }
  } catch {
    // Offline fallback
    const cached = await AsyncStorage.getItem('@focus_xp_state');
    if (cached) return JSON.parse(cached);
  }
  return null;
}

/** Earn XP — syncs to backend, falls back to local increment */
export async function earnXPBackend(points: number, reason: string): Promise<XPState | null> {
  try {
    const res = await fetch(`${BASE}/api/focus/xp/earn`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ points, reason }),
    });
    const json = await res.json();
    if (json.success) {
      await AsyncStorage.setItem('@focus_xp_state', JSON.stringify(json.data));
      return json.data;
    }
  } catch {
    // Offline: update local cache only
    const cached = await AsyncStorage.getItem('@focus_xp_state');
    if (cached) {
      const state: XPState = JSON.parse(cached);
      state.weekly_xp += points;
      state.total_xp += points;
      state.current_level = Math.floor(state.weekly_xp / 100) + 1;
      await AsyncStorage.setItem('@focus_xp_state', JSON.stringify(state));
      return state;
    }
  }
  return null;
}

/** Weekly XP resets every Monday (handled server-side). Returns XP within current week. */
export const XP_PER_LEVEL = 100;
export const xpToNextLevel = (weeklyXp: number) => XP_PER_LEVEL - (weeklyXp % XP_PER_LEVEL);
export const xpProgressPct = (weeklyXp: number) => (weeklyXp % XP_PER_LEVEL) / XP_PER_LEVEL;

// ── Check-in ──────────────────────────────────────────────────────────────────

export async function syncCheckin(data: {
  protein_hit: string; workout_done: boolean; water_glasses: number;
  skipped_meal: boolean; dsa_solved: boolean; xp_earned: number; unusual_food?: string;
}) {
  try {
    await fetch(`${BASE}/api/focus/checkin`, {
      method: 'POST', headers, body: JSON.stringify(data),
    });
  } catch { /* offline — data still stored locally */ }
}

export async function fetchTodayCheckin() {
  try {
    const res = await fetch(`${BASE}/api/focus/checkin/today`, { headers });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch { return null; }
}

// ── Roadmap (roadmap.sh via backend proxy with DB cache) ─────────────────────

export type RoadmapType = 'frontend' | 'backend' | 'fullstack' | 'systemdesign' | 'devops' | 'dsa';

export interface RoadmapTopic {
  id: string;
  topic: string;
  pillar: string;
  type: string;
  read?: boolean;
  confidence?: number;
}

export async function fetchRoadmap(type: RoadmapType): Promise<RoadmapTopic[]> {
  const cacheKey = `@roadmap_cache_${type}`;
  try {
    const res = await fetch(`${BASE}/api/focus/content/roadmap/${type}`, { headers });
    const json = await res.json();
    if (json.success && json.data?.length) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(json.data));
      return json.data;
    }
  } catch { /* offline */ }
  // Fallback to device cache
  const cached = await AsyncStorage.getItem(cacheKey);
  return cached ? JSON.parse(cached) : [];
}

export async function fetchRoadmapProgress(): Promise<Record<string, { read: boolean; confidence: number }>> {
  try {
    const res = await fetch(`${BASE}/api/focus/roadmap`, { headers });
    const json = await res.json();
    const map: Record<string, any> = {};
    if (json.success) json.data.forEach((r: any) => { map[r.topic_id] = r; });
    return map;
  } catch { return {}; }
}

export async function syncRoadmapItem(item: {
  topic_id: string; topic_name: string; pillar: string;
  read_status: boolean; confidence: number; notes?: string;
}) {
  try {
    await fetch(`${BASE}/api/focus/roadmap`, {
      method: 'POST', headers, body: JSON.stringify(item),
    });
  } catch { /* offline */ }
}

// ── Articles / Study Content (DEV.to + HN proxy) ─────────────────────────────

export interface Article {
  id: string;
  title: string;
  pillar: string;
  summary?: string;
  readingTime?: number;
  url: string;
  author?: string;
  source: string;
}

export async function searchArticles(query: string): Promise<Article[]> {
  const cacheKey = `@articles_${query.toLowerCase().replace(/\s+/g, '_')}`;
  try {
    const res = await fetch(
      `${BASE}/api/focus/content/articles?q=${encodeURIComponent(query)}`,
      { headers }
    );
    const json = await res.json();
    if (json.success && json.data?.length) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(json.data));
      return json.data;
    }
  } catch { /* offline */ }
  const cached = await AsyncStorage.getItem(cacheKey);
  return cached ? JSON.parse(cached) : [];
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export interface FoodItem {
  name: string;
  calories_per100g: number;
  protein_per100g: number;
  carbs_per100g: number;
  fat_per100g: number;
  fiber_per100g: number;
  serving_size: string;
}

export interface BodyMetrics {
  weight_kg?: number; height_cm?: number; age_years?: number;
  body_goal?: string; activity_level?: string;
}

export interface MacroTargets {
  bmr: number; tdee: number; targetCalories: number;
  protein_g: number; carbs_g: number; fat_g: number; water_ml: number;
  body_goal: string; activity_level: string;
}

export async function searchFood(query: string): Promise<FoodItem[]> {
  try {
    const res = await fetch(`${BASE}/api/focus/nutrition/search?q=${encodeURIComponent(query)}`, { headers });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch { return []; }
}

export async function fetchNutritionTargets(): Promise<{ metrics: BodyMetrics; targets: MacroTargets | null }> {
  const cached = await AsyncStorage.getItem('@nutrition_targets');
  try {
    const res = await fetch(`${BASE}/api/focus/nutrition/targets`, { headers });
    const json = await res.json();
    if (json.success) {
      const result = { metrics: json.data, targets: json.data.targets || null };
      await AsyncStorage.setItem('@nutrition_targets', JSON.stringify(result));
      return result;
    }
  } catch { /* offline */ }
  if (cached) return JSON.parse(cached);
  return { metrics: {}, targets: null };
}

export async function saveBodyMetrics(metrics: BodyMetrics) {
  try {
    const res = await fetch(`${BASE}/api/focus/nutrition/metrics`, {
      method: 'PUT', headers, body: JSON.stringify(metrics),
    });
    const json = await res.json();
    if (json.success) await AsyncStorage.removeItem('@nutrition_targets'); // invalidate cache
    return json.success;
  } catch { return false; }
}

export async function logFood(item: {
  food_name: string; quantity_g: number;
  calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  fiber_g: number; source: string;
}) {
  try {
    const res = await fetch(`${BASE}/api/focus/nutrition/log`, {
      method: 'POST', headers, body: JSON.stringify(item),
    });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch { return null; }
}

export async function fetchTodayNutrition() {
  try {
    const res = await fetch(`${BASE}/api/focus/nutrition/today`, { headers });
    const json = await res.json();
    return json.success ? json.data : { logs: [], totals: {} };
  } catch { return { logs: [], totals: {} }; }
}

export async function deleteNutritionLog(id: string) {
  try {
    await fetch(`${BASE}/api/focus/nutrition/log/${id}`, { method: 'DELETE', headers });
  } catch { /* offline */ }
}

// ── Weekly History ────────────────────────────────────────────────────────────

export async function fetchWeeklyHistory() {
  try {
    const res = await fetch(`${BASE}/api/focus/weekly/history`, { headers });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch { return []; }
}
