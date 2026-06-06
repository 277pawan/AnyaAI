// src/screens/focusScreen.tsx
// Premium, Gamified, High-Friction/High-Engagement Focus & Personal OS System
// Forest Green & Deep Black Theme — Dynamic content from roadmap.sh + Open Food Facts

import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Alert, Dimensions, Linking, Modal, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemeContext } from '../../App';
import { anyaChat } from '../services/chatSocket';
import * as FocusService from '../services/focusService';
import { CONFIG } from '../config/index';
import type { RoadmapType, RoadmapTopic, Article, FoodItem, MacroTargets } from '../services/focusService';

const { width } = Dimensions.get('window');

const XP_PROTEIN = 5;
const XP_WATER = 5;
const XP_WORKOUT = 20;
const XP_STUDY_READ = 10;
const XP_DSA_CHALLENGE = 15;

const ROADMAP_TYPES: { key: RoadmapType; label: string; icon: string }[] = [
  { key: 'frontend', label: 'Frontend', icon: 'monitor-shimmer' },
  { key: 'backend', label: 'Backend', icon: 'server' },
  { key: 'fullstack', label: 'Full-Stack', icon: 'layers-triple' },
  { key: 'systemdesign', label: 'System Design', icon: 'sitemap' },
  { key: 'devops', label: 'DevOps', icon: 'docker' },
  { key: 'dsa', label: 'DSA', icon: 'graph' },
];

const DAILY_EXERCISES = [
  { id: 'pushups', name: 'Pushups (3 sets x 20 reps)', completed: false },
  { id: 'pullups', name: 'Pullups (3 sets x 8 reps)', completed: false },
  { id: 'squats', name: 'Squats (3 sets x 25 reps)', completed: false },
  { id: 'plank', name: 'Plank (3 sets x 1 min)', completed: false },
];

// All hardcoded roadmap/DSA/HLD/STUDY_KNOWLEDGE removed — now fetched dynamically


const FocusScreen = () => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  // --- Dynamic Color System (Green & Black Theme - Light Mode Aware) ---
  const bgColor = isDark ? '#000000' : '#f9fafb';
  const cardBg = isDark ? '#080808' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subtextColor = isDark ? '#a1a1aa' : '#6b7280';
  const borderColor = isDark ? '#1a1a1a' : '#e5e7eb';

  // Dynamic Green Accent (Neon Green for Dark, Forest Green for Light)
  const primaryBrand = isDark ? '#10b981' : '#059669';
  const transparentBrand = isDark ? 'rgba(16,185,129,0.06)' : 'rgba(5,150,105,0.06)';
  const transparentBrandActive = isDark ? 'rgba(16,185,129,0.12)' : 'rgba(5,150,105,0.12)';

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'checkin' | 'study' | 'fitness' | 'dsa' | 'weekly' | 'nutrition'>('checkin');

  // ── XP & Gamification (backend-synced, weekly reset on Monday) ────────────────
  const [weeklyXp, setWeeklyXp] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [weekStart, setWeekStart] = useState('');
  // Derived from weeklyXp locally
  const xp = weeklyXp;
  const xpInCurrentLevel = xp % 100;

  // ── Check-in ─────────────────────────────────────────────────────────────────
  const [proteinHit, setProteinHit] = useState<'yes' | 'no' | 'partial'>('no');
  const [workoutDone, setWorkoutDone] = useState(false);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [skippedMeal, setSkippedMeal] = useState(false);
  const [unusualFoodText, setUnusualFoodText] = useState('');

  // ── Study ─────────────────────────────────────────────────────────────────────
  const [activeRoadmapType, setActiveRoadmapType] = useState<RoadmapType>('frontend');
  const [roadmap, setRoadmap] = useState<RoadmapTopic[]>([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, any>>({});
  const [selectedStudyConcept, setSelectedStudyConcept] = useState<any | null>(null);
  const [searchTopic, setSearchTopic] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [dailyDigestText, setDailyDigestText] = useState('');
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);

  // ── Fitness ─────────────────────────────────────────────────────────────────
  const [exercises, setExercises] = useState(DAILY_EXERCISES);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingExerciseName, setEditingExerciseName] = useState('');
  const [workoutStreak, setWorkoutStreak] = useState(0);

  // ── DSA ──────────────────────────────────────────────────────────────────────
  const [dsaCompleted, setDsaCompleted] = useState(false);

  // ── Nutrition ────────────────────────────────────────────────────────────────
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [bodyMetrics, setBodyMetrics] = useState<any>({});
  const [foodSearch, setFoodSearch] = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [foodSearching, setFoodSearching] = useState(false);
  const [nutritionLog, setNutritionLog] = useState<any[]>([]);
  const [nutritionTotals, setNutritionTotals] = useState<any>({});
  const [showBodyMetricsModal, setShowBodyMetricsModal] = useState(false);
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGoal, setEditGoal] = useState('maintain');
  const [editActivity, setEditActivity] = useState('moderate');

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const syncDailyCheckin = (protein: string, workout: boolean, water: number,
    skip: boolean, dsa: boolean, earnedXp: number, unusual?: string) => {
    FocusService.syncCheckin({
      protein_hit: protein, workout_done: workout, water_glasses: water,
      skipped_meal: skip, dsa_solved: dsa, xp_earned: earnedXp, unusual_food: unusual,
    });
  };

  const syncRoadmapItem = (topicId: string, topicName: string, pillar: string,
    readStatus: boolean, confidence: number) => {
    FocusService.syncRoadmapItem({
      topic_id: topicId, topic_name: topicName,
      pillar, read_status: readStatus, confidence
    });
  };

  // ── Startup Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadAll = async () => {
      // 1. Local cache for instant paint
      try {
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
        const lastCheckedDate = await AsyncStorage.getItem('@focus_last_checked_date');

        let protein = await AsyncStorage.getItem('@focus_protein_hit');
        let workout = await AsyncStorage.getItem('@focus_workout_done');
        let water = await AsyncStorage.getItem('@focus_water_glasses');
        let skip = await AsyncStorage.getItem('@focus_skipped_meal');
        let dsaDone = await AsyncStorage.getItem('@focus_dsa_done');
        let exs = await AsyncStorage.getItem('@focus_exercises');

        // Check if a new day has started since last check-in
        if (lastCheckedDate !== todayStr) {
          console.log('[Focus OS] 🌅 New day detected! Resetting daily checklists...');
          protein = 'no';
          workout = 'false';
          water = '0';
          skip = 'false';
          dsaDone = 'false';

          await AsyncStorage.setItem('@focus_protein_hit', 'no');
          await AsyncStorage.setItem('@focus_workout_done', 'false');
          await AsyncStorage.setItem('@focus_water_glasses', '0');
          await AsyncStorage.setItem('@focus_skipped_meal', 'false');
          await AsyncStorage.setItem('@focus_dsa_done', 'false');

          // Reset completion status for all exercises (preserving custom exercises)
          let exerciseList = DAILY_EXERCISES;
          if (exs) {
            try {
              const parsed = JSON.parse(exs);
              exerciseList = parsed.map((ex: any) => ({ ...ex, completed: false }));
            } catch (_) { }
          }
          exs = JSON.stringify(exerciseList);
          await AsyncStorage.setItem('@focus_exercises', exs);
          await AsyncStorage.setItem('@focus_last_checked_date', todayStr);
        }

        const wXp = await AsyncStorage.getItem('@focus_weekly_xp');
        const tXp = await AsyncStorage.getItem('@focus_total_xp');
        const lvl = await AsyncStorage.getItem('@focus_level');
        const streak = await AsyncStorage.getItem('@focus_workout_streak');

        if (wXp) setWeeklyXp(parseInt(wXp, 10));
        if (tXp) setTotalXp(parseInt(tXp, 10));
        if (lvl) setLevel(parseInt(lvl, 10));
        if (streak) setWorkoutStreak(parseInt(streak, 10));

        if (protein) setProteinHit(protein as any);
        if (workout) setWorkoutDone(workout === 'true');
        if (water) setWaterGlasses(parseInt(water, 10));
        if (skip) setSkippedMeal(skip === 'true');
        if (dsaDone) setDsaCompleted(dsaDone === 'true');
        if (exs) setExercises(JSON.parse(exs));
        else await AsyncStorage.setItem('@focus_exercises', JSON.stringify(DAILY_EXERCISES));
      } catch (e) {
        console.warn('[FocusScreen] loadAll cache error:', e);
      }

      // 2. Backend sync (XP state — handles weekly reset server-side)
      const xpState = await FocusService.fetchXPState();
      if (xpState) {
        setWeeklyXp(xpState.weekly_xp);
        setTotalXp(xpState.total_xp);
        setLevel(xpState.current_level);
        setWeekStart(xpState.week_start_date);
        await AsyncStorage.setItem('@focus_weekly_xp', String(xpState.weekly_xp));
        await AsyncStorage.setItem('@focus_total_xp', String(xpState.total_xp));
        await AsyncStorage.setItem('@focus_level', String(xpState.current_level));
      }

      // 3. Today's check-in
      const checkin = await FocusService.fetchTodayCheckin();
      if (checkin) {
        setProteinHit(checkin.protein_hit);
        setWorkoutDone(checkin.workout_done);
        setWaterGlasses(checkin.water_glasses);
        setSkippedMeal(checkin.skipped_meal);
        setDsaCompleted(checkin.dsa_solved);
      }

      // 4. Nutrition targets
      const { metrics, targets } = await FocusService.fetchNutritionTargets();
      setBodyMetrics(metrics);
      setMacroTargets(targets);
      if (metrics.weight_kg) setEditWeight(String(metrics.weight_kg));
      if (metrics.height_cm) setEditHeight(String(metrics.height_cm));
      if (metrics.age_years) setEditAge(String(metrics.age_years));
      if (metrics.body_goal) setEditGoal(metrics.body_goal);
      if (metrics.activity_level) setEditActivity(metrics.activity_level);

      // 5. Today's nutrition log
      const nutri = await FocusService.fetchTodayNutrition();
      setNutritionLog(nutri.logs);
      setNutritionTotals(nutri.totals);

      // 6. Roadmap progress from DB
      const prog = await FocusService.fetchRoadmapProgress();
      setProgressMap(prog);
    };
    loadAll();
  }, []);

  // Load roadmap from roadmap.sh when type changes
  useEffect(() => {
    const loadRoadmap = async () => {
      setRoadmapLoading(true);
      const topics = await FocusService.fetchRoadmap(activeRoadmapType);
      // Merge with saved progress
      const withProgress = topics.map(t => ({
        ...t,
        read: progressMap[t.id]?.read_status || false,
        confidence: progressMap[t.id]?.confidence || 0,
      }));
      setRoadmap(withProgress);
      setRoadmapLoading(false);
    };
    loadRoadmap();
  }, [activeRoadmapType, progressMap]);

  // Weekly XP level watcher (purely local display — backend is source of truth)
  useEffect(() => {
    if (weeklyXp > 0) {
      const newLvl = Math.floor(weeklyXp / 100) + 1;
      if (newLvl !== level) {
        setLevel(newLvl);
        Alert.alert('Level Up! 🚀', `You reached Level ${newLvl} this week! Keep going Pawan!`);
      }
    }
  }, [weeklyXp]);

  // earnXp — syncs to backend DB (handles weekly reset server-side)
  const earnXp = async (points: number, reason = 'action') => {
    const updated = await FocusService.earnXPBackend(points, reason);
    if (updated) {
      setWeeklyXp(updated.weekly_xp);
      setTotalXp(updated.total_xp);
      setLevel(updated.current_level);
    } else {
      // Offline: increment locally
      setWeeklyXp(prev => prev + points);
      setTotalXp(prev => prev + points);
    }
  };

  // ── Pillar 1: Check-in Handlers ──────────────────────────────────────────────
  const addWaterAmount = async (amount: number) => {
    const nextGlasses = Math.min(waterGlasses + amount, 20); // Cap at 5 liters (20 glasses) to prevent overflow
    setWaterGlasses(nextGlasses);
    await AsyncStorage.setItem('@focus_water_glasses', String(nextGlasses));
    const xpReward = XP_WATER * amount;
    earnXp(xpReward);
    syncDailyCheckin(proteinHit, workoutDone, nextGlasses, skippedMeal, dsaCompleted, xpReward);
  };

  const saveCheckinMetric = async (key: string, val: string) => {
    await AsyncStorage.setItem(key, val);
    if (key === '@focus_protein_hit') {
      syncDailyCheckin(val, workoutDone, waterGlasses, skippedMeal, dsaCompleted, val === 'yes' ? XP_PROTEIN : 0);
    } else if (key === '@focus_skipped_meal') {
      syncDailyCheckin(proteinHit, workoutDone, waterGlasses, val === 'true', dsaCompleted, 0);
    }
  };

  // ── Pillar 2: Study Tracker Handlers ──────────────────────────────────────────
  const toggleTopicRead = async (id: string) => {
    let targetItem: any = null;
    const updated = roadmap.map(t => {
      if (t.id === id) {
        const nextState = !t.read;
        if (nextState) earnXp(XP_STUDY_READ);
        targetItem = { ...t, read: nextState, lastReviewed: nextState ? new Date().toISOString() : null };
        return targetItem;
      }
      return t;
    });
    setRoadmap(updated);
    await AsyncStorage.setItem('@focus_roadmap', JSON.stringify(updated));
    if (targetItem) {
      syncRoadmapItem(targetItem.id, targetItem.topic, targetItem.pillar, targetItem.read, targetItem.confidence || 0);
    }
  };



  // ── Pillar 3: Fitness Custom Workout Handlers ──────────────────────────────
  const toggleExercise = async (id: string) => {
    const updated = exercises.map(ex => {
      if (ex.id === id) {
        const nextState = !ex.completed;
        if (nextState) earnXp(5);
        return { ...ex, completed: nextState };
      }
      return ex;
    });
    setExercises(updated);
    await AsyncStorage.setItem('@focus_exercises', JSON.stringify(updated));

    // If all exercises are done today, trigger workout bonus
    const allDone = updated.every(ex => ex.completed);
    if (allDone && !workoutDone) {
      setWorkoutDone(true);
      setWorkoutStreak(prev => prev + 1);
      await AsyncStorage.setItem('@focus_workout_done', 'true');
      await AsyncStorage.setItem('@focus_workout_streak', String(workoutStreak + 1));
      earnXp(XP_WORKOUT);
      Alert.alert('All Exercises Done! 🏆', 'Bonus XP + Workout completed for today!');
    }
  };

  const addCustomExercise = async () => {
    if (!newExerciseName.trim()) {
      Alert.alert('Error', 'Please enter a name for the exercise.');
      return;
    }
    const newEx = {
      id: `custom-${Date.now()}`,
      name: newExerciseName.trim(),
      completed: false,
    };
    const updated = [...exercises, newEx];
    setExercises(updated);
    setNewExerciseName('');
    await AsyncStorage.setItem('@focus_exercises', JSON.stringify(updated));
    earnXp(5);
  };

  const deleteExercise = async (id: string) => {
    const updated = exercises.filter(ex => ex.id !== id);
    setExercises(updated);
    await AsyncStorage.setItem('@focus_exercises', JSON.stringify(updated));
  };

  const startEditExerciseName = (id: string, name: string) => {
    setEditingExerciseId(id);
    setEditingExerciseName(name);
  };

  const saveEditedExerciseName = async () => {
    if (!editingExerciseName.trim()) {
      Alert.alert('Error', 'Exercise name cannot be empty.');
      return;
    }
    const updated = exercises.map(ex => {
      if (ex.id === editingExerciseId) {
        return { ...ex, name: editingExerciseName.trim() };
      }
      return ex;
    });
    setExercises(updated);
    setEditingExerciseId(null);
    setEditingExerciseName('');
    await AsyncStorage.setItem('@focus_exercises', JSON.stringify(updated));
  };

  const completeDsa = async () => {
    if (!dsaCompleted) {
      setDsaCompleted(true);
      await AsyncStorage.setItem('@focus_dsa_done', 'true');
      earnXp(XP_DSA_CHALLENGE, 'dsa_solved');
      syncDailyCheckin(proteinHit, workoutDone, waterGlasses, skippedMeal, true, XP_DSA_CHALLENGE);
      Alert.alert('DSA Challenge Done! 💻', 'Great job keeping your engineering mind sharp! (+15 XP)');
    }
  };

  // ── Article Search (replaces hardcoded offline content) ──────────────────────
  const handleSearchArticles = async () => {
    const q = searchTopic.trim();
    if (!q) { Alert.alert('Enter a topic', 'Type any concept, framework or language to search.'); return; }
    setArticlesLoading(true);
    const results = await FocusService.searchArticles(q);
    setArticles(results);
    setArticlesLoading(false);
    if (!results.length) Alert.alert('No results', 'Try a different search term. Results cached for offline use.');
  };

  const openRoadmapStudyModal = async (item: any) => {
    setArticlesLoading(true);
    // Fetch real articles from DEV.to/HackerNews for this roadmap topic
    const results = await FocusService.searchArticles(item.topic);
    setArticlesLoading(false);

    // Open the premium reader modal with the real articles injected!
    setSelectedStudyConcept({
      id: item.id,
      title: item.topic,
      pillar: item.pillar,
      explanation: "Explore the highly-rated community articles below from DEV.to and HackerNews to master this concept.",
      links: results.map((r: any) => ({ name: r.title, url: r.url })),
      source: 'roadmap'
    });

    if (!results.length) {
      Alert.alert('No articles found', 'Try asking Anya directly for an explanation.');
    }
  };

  // ── Nutrition handlers ────────────────────────────────────────────────────────
  const handleFoodSearch = async () => {
    if (!foodSearch.trim()) return;
    setFoodSearching(true);
    const results = await FocusService.searchFood(foodSearch.trim());
    setFoodResults(results);
    setFoodSearching(false);
    if (!results.length) Alert.alert('Not found', 'Try a more specific food name.');
  };

  const handleLogFood = async (food: any, quantityG: number = 100) => {
    const ratio = quantityG / 100;
    const logged = await FocusService.logFood({
      food_name: food.name, quantity_g: quantityG,
      calories_kcal: food.calories_per100g * ratio,
      protein_g: food.protein_per100g * ratio,
      carbs_g: food.carbs_per100g * ratio,
      fat_g: food.fat_per100g * ratio,
      fiber_g: food.fiber_per100g * ratio,
      source: 'openfoodfacts',
    });
    if (logged) {
      const nutri = await FocusService.fetchTodayNutrition();
      setNutritionLog(nutri.logs);
      setNutritionTotals(nutri.totals);
      setFoodResults([]);
      setFoodSearch('');
      // Earn XP for logging nutrition
      earnXp(2, 'nutrition_log');
    }
  };

  const handleDeleteNutritionEntry = async (id: string) => {
    await FocusService.deleteNutritionLog(id);
    const nutri = await FocusService.fetchTodayNutrition();
    setNutritionLog(nutri.logs);
    setNutritionTotals(nutri.totals);
  };

  const handleSaveBodyMetrics = async () => {
    const saved = await FocusService.saveBodyMetrics({
      weight_kg: parseFloat(editWeight) || undefined,
      height_cm: parseFloat(editHeight) || undefined,
      age_years: parseInt(editAge, 10) || undefined,
      body_goal: editGoal,
      activity_level: editActivity,
    });
    if (saved) {
      const { metrics, targets } = await FocusService.fetchNutritionTargets();
      setBodyMetrics(metrics);
      setMacroTargets(targets);
      setShowBodyMetricsModal(false);
      Alert.alert('✅ Metrics Saved', 'Your TDEE and macro targets have been recalculated!');
    }
  };

  // ── Ask Anya Helper ──────────────────────────────────────────────────────────
  const askAnyaAboutFocus = (promptText: string) => {
    if (anyaChat.isConnected()) {
      anyaChat.sendMessage(promptText);
      Alert.alert('Anya is on it!', 'Switched to home to hear Anya\'s explanation!');
    } else {
      Alert.alert('Anya offline', 'WebSocket is currently offline. Enable adb connection.');
    }
  };

  // handleGenerateCustomConcept removed — use handleSearchArticles instead

  const handleGenerateDailyDigestText = async () => {
    setIsGeneratingDigest(true);
    setDailyDigestText('');

    try {
      const readTopicsCount = roadmap.filter(r => r.read).length;
      const dsaDoneText = dsaCompleted ? 'Yes' : 'No';
      const skippedText = skippedMeal ? 'Yes' : 'No';
      const proteinText = proteinHit;

      const fullPrompt = `Here is my daily Focus digest:
- Level & XP: Level ${level} (${xp} XP)
- Nutrition: Protein targets: ${proteinText}, Skipped meal: ${skippedText}, Water Intake: ${((waterGlasses * 250) / 1000).toFixed(2)}L.
- Study: ${readTopicsCount} total engineering topics marked read.
- Fitness: Workout completed: ${workoutDone ? 'Yes' : 'No'}.
- Career: DSA Problem today solved: ${dsaDoneText}.

Give me a 5-line performance review. Rate my day from 1-10. Tell me what I did well, what I slipped on, and one priority action for tomorrow.`;

      if (anyaChat.isConnected()) {
        anyaChat.sendMessage(fullPrompt);
      }

      let sessionId = await AsyncStorage.getItem('@anya_session_id');
      if (!sessionId) {
        const sessionRes = await fetch(`${CONFIG.API_BASE_URL}/api/chat/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': '89968338-6678-48e0-be01-f8472e550e1d' },
          body: JSON.stringify({ title: `Anya Focus Digest` }),
        });
        const sessionData = await sessionRes.json();
        sessionId = sessionData.data?.id;
        if (sessionId) {
          await AsyncStorage.setItem('@anya_session_id', sessionId);
        }
      }

      if (!sessionId) throw new Error('Could not connect to Anya.');

      const response = await fetch(`${CONFIG.API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': '89968338-6678-48e0-be01-f8472e550e1d',
        },
        body: JSON.stringify({ sessionId, content: fullPrompt }),
      });

      if (!response.ok) throw new Error('Anya is busy right now.');

      const data = await response.json();
      const content = data.data?.content || 'No text digest returned.';
      setDailyDigestText(content);
    } catch (err: any) {
      setDailyDigestText(`⚠️ Could not retrieve local text: ${err.message || 'Check network connection.'}\n\nSwitch to the Home screen to hear Anya speak the review!`);
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  const progressPercent = `${xpInCurrentLevel}%` as any;

  // Week display helper
  const weekLabel = weekStart
    ? `Week of ${new Date(weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
    : 'This Week';

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* ── Gamified Weekly Header ────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerLevel, { color: textColor }]}>Level {level}</Text>
            <Text style={[styles.headerTitle, { color: subtextColor }]}>Weekly Performance OS</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: transparentBrandActive }]}>
            <MaterialCommunityIcons name="star-circle" size={18} color={primaryBrand} />
            <Text style={[styles.badgeText, { color: primaryBrand }]}>{weeklyXp} XP this week</Text>
          </View>
        </View>

        {/* Level XP Bar */}
        <View style={styles.xpBarBackground}>
          <View style={[styles.xpBarFill, { width: progressPercent, backgroundColor: primaryBrand }]} />
        </View>
        <Text style={[styles.xpText, { color: subtextColor }]}>
          {xpInCurrentLevel}/100 XP to Level {level + 1}
        </Text>
      </View>

      {/* ── Pillar Selector Tab bar ─────────────────────────────────────────── */}
      <View style={[styles.tabBar, { borderBottomColor: borderColor }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {[
            { id: 'checkin', icon: 'check-bold', label: '60s Checkin' },
            { id: 'study', icon: 'book-open-page-variant', label: 'Study & Read' },
            { id: 'fitness', icon: 'weight-lifter', label: 'Fitness Hub' },
            { id: 'dsa', icon: 'code-tags', label: 'DSA / HLD' },
            { id: 'weekly', icon: 'clipboard-pulse', label: 'Weekly AI' },
            { id: 'nutrition', icon: 'food-apple', label: 'Nutrition' },
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                style={[
                  styles.tabButton,
                  active && { borderBottomColor: primaryBrand, backgroundColor: transparentBrand },
                ]}
              >
                <MaterialCommunityIcons name={tab.icon} size={15} color={active ? primaryBrand : subtextColor} />
                <Text style={[styles.tabLabel, { color: active ? primaryBrand : subtextColor, fontWeight: active ? '700' : '500' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.contentScroll}>

        {/* ── PILLAR 1: 60-Second Daily Check-in ───────────────────────────────── */}
        {activeTab === 'checkin' && (
          <View style={styles.cardContainer}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>⚡ Fast Daily Check-in</Text>

            {/* Protein Check */}
            <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: textColor }]}>🍳 Hitting Protein Targets?</Text>
                <Text style={[styles.settingDesc, { color: subtextColor }]}>Did you reach your necessary daily protein intake?</Text>
              </View>
              <View style={styles.toggleGroup}>
                {(['yes', 'no', 'partial'] as const).map(option => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => {
                      if (proteinHit === option) return; // Prevent duplicate XP award from multiple taps
                      setProteinHit(option);
                      saveCheckinMetric('@focus_protein_hit', option);
                      if (option === 'yes') earnXp(XP_PROTEIN);
                    }}
                    style={[
                      styles.smallPill,
                      proteinHit === option && { backgroundColor: primaryBrand },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: proteinHit === option ? '#fff' : subtextColor, textTransform: 'capitalize' }}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Skipped Meal */}
            <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: textColor }]}>🍽️ Skip Any Meal?</Text>
                <Text style={[styles.settingDesc, { color: subtextColor }]}>Friction / skipping decreases consistent performance</Text>
              </View>
              <Switch
                value={skippedMeal}
                onValueChange={v => {
                  setSkippedMeal(v);
                  saveCheckinMetric('@focus_skipped_meal', String(v));
                }}
                trackColor={{ false: '#374151', true: primaryBrand }}
                thumbColor={skippedMeal ? '#ffffff' : '#9ca3af'}
              />
            </View>

            {/* Water Tracker */}
            <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.settingTitle, { color: textColor }]}>💧 Scientific Water Tracker</Text>
                <View style={[styles.badge, { backgroundColor: transparentBrandActive, paddingVertical: 2, paddingHorizontal: 8 }]}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: primaryBrand }}>
                    {((waterGlasses * 250) / 1000).toFixed(2)}L / 3.50L Goal
                  </Text>
                </View>
              </View>

              <Text style={[styles.settingDesc, { color: subtextColor, marginBottom: 8 }]}>
                Track daily cellular hydration levels in Liters. Optimizing fluid intake prevents afternoon cognitive fatigue.
              </Text>

              {/* Progress Visual Bar */}
              <View style={{ height: 8, backgroundColor: isDark ? '#1a1a1a' : '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginVertical: 8 }}>
                <View style={{ height: '100%', width: `${Math.min(((waterGlasses * 250) / 3500) * 100, 100).toFixed(0)}%` as any, backgroundColor: primaryBrand, borderRadius: 4 }} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: subtextColor }}>
                  Progress: {Math.min(((waterGlasses * 250) / 3500) * 100, 100).toFixed(0)}% Completed
                </Text>
                <Text style={{ fontSize: 10, fontStyle: 'italic', color: subtextColor }}>
                  {waterGlasses * 250} ml logged
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={() => addWaterAmount(1)}
                  style={[styles.waterTapBtn, { backgroundColor: primaryBrand }]}
                >
                  <MaterialCommunityIcons name="water" size={15} color="#fff" />
                  <Text style={styles.waterTapText}>+250ml Glass</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => addWaterAmount(2)}
                  style={[styles.waterTapBtn, { backgroundColor: isDark ? '#1a1a1a' : '#e5e7eb' }]}
                >
                  <MaterialCommunityIcons name="bottle-wine-outline" size={15} color={textColor} />
                  <Text style={[styles.waterTapText, { color: textColor }]}>+500ml Bottle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const xpDeducted = waterGlasses * XP_WATER;
                    setWeeklyXp(prev => Math.max(prev - xpDeducted, 0));
                    setTotalXp(prev => Math.max(prev - xpDeducted, 0));
                    setWaterGlasses(0);
                    await AsyncStorage.setItem('@focus_water_glasses', '0');
                    syncDailyCheckin(proteinHit, workoutDone, 0, skippedMeal, dsaCompleted, -xpDeducted);
                  }}
                  style={styles.resetBtn}
                >
                  <Text style={{ color: subtextColor, fontSize: 12, fontWeight: '700' }}>Reset</Text>
                </TouchableOpacity>
              </View>

              {/* Scientific Reference Box */}
              <View style={{ padding: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: primaryBrand }}>
                <Text style={{ fontSize: 11, color: subtextColor, lineHeight: 16 }}>
                  💡 <Text style={{ fontWeight: '700', color: textColor }}>Health Standard:</Text> The National Academies of Sciences recommend <Text style={{ fontWeight: '700', color: primaryBrand }}>3.7 Liters (3700ml)</Text> of daily fluids for adult males. Peak hydration speeds up recovery, helps prevent visual strain during long coding sessions, and boosts overall cognitive bandwidth.
                </Text>
              </View>
            </View>

            {/* Unusual Food Log */}
            <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor, flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Text style={[styles.settingTitle, { color: textColor }]}>🥩 Log Unusual / Heavy Meals</Text>
              <Text style={[styles.settingDesc, { color: subtextColor, marginBottom: 10 }]}>
                Anya will calculate and score high calorie / outlier nutrition habits
              </Text>
              <TextInput
                style={[styles.input, { borderColor, color: textColor }]}
                placeholder="e.g. 2 slices of pepperoni pizza and Pepsi"
                placeholderTextColor={subtextColor}
                value={unusualFoodText}
                onChangeText={setUnusualFoodText}
              />
              <TouchableOpacity
                onPress={() => {
                  if (!unusualFoodText) return;
                  askAnyaAboutFocus(`I logged an unusual food today: "${unusualFoodText}". Review my nutrition impact, guess macro counts roughly, and give me a 2-line advice.`);
                  setUnusualFoodText('');
                }}
                style={[styles.submitFoodBtn, { backgroundColor: primaryBrand }]}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Ask Anya to Evaluate Meal</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── PILLAR 2: Study Tracker ─────────────────────────────────────────── */}
        {activeTab === 'study' && (
          <View style={styles.cardContainer}>


            {/* Infinite AI Concept Generator & Search */}
            <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor, flexDirection: 'column', alignItems: 'stretch', marginVertical: 8 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.settingTitle, { color: textColor }]}>🔍 Infinite AI Study Search</Text>
                <View style={[styles.badge, { backgroundColor: transparentBrandActive, paddingVertical: 2, paddingHorizontal: 6 }]}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: primaryBrand }}>Powered by Anya AI</Text>
                </View>
              </View>
              <Text style={[styles.settingDesc, { color: subtextColor, marginBottom: 8 }]}>
                Type any language, framework, database, or system design concept (e.g. "OAuth2 flow", "Docker multi-stage", "Kubernetes pods"). Anya will generate a customized complete textbook guide for you to read.
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <TextInput
                  style={[styles.input, { flex: 1, borderColor, color: textColor, marginBottom: 0, paddingVertical: 6 }]}
                  placeholder="e.g. Docker multi-stage builds"
                  placeholderTextColor={subtextColor}
                  value={searchTopic}
                  onChangeText={setSearchTopic}
                />
                <TouchableOpacity
                  onPress={handleSearchArticles}
                  disabled={articlesLoading}
                  style={[styles.waterTapBtn, { backgroundColor: primaryBrand, minWidth: 80, height: 42, justifyContent: 'center' }]}
                >
                  {articlesLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MaterialCommunityIcons name="book-search-outline" size={15} color="#fff" />
                      <Text style={[styles.waterTapText, { marginHorizontal: 0 }]}>Search</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Roadmap Type Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                {ROADMAP_TYPES.map(rt => (
                  <TouchableOpacity
                    key={rt.key}
                    onPress={() => setActiveRoadmapType(rt.key)}
                    style={[styles.tabButton,
                    activeRoadmapType === rt.key && { borderBottomColor: primaryBrand, backgroundColor: transparentBrandActive }
                    ]}
                  >
                    <MaterialCommunityIcons name={rt.icon as any} size={14}
                      color={activeRoadmapType === rt.key ? primaryBrand : subtextColor} />
                    <Text style={[styles.tabLabel, {
                      color: activeRoadmapType === rt.key ? primaryBrand : subtextColor,
                      fontWeight: activeRoadmapType === rt.key ? '700' : '500'
                    }]}>{rt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: textColor, marginTop: 12 }]}>📘 Core Roadmap Syllabus (Read to Study)</Text>
            <Text style={{ color: subtextColor, fontSize: 11, marginBottom: 12 }}>
              Tap any concept topic below to open the comprehensive study guide, detailed dynamic notes, and resource links directly in-app!
            </Text>

            {roadmapLoading ? (
              <View style={{ alignItems: 'center', padding: 24 }}>
                <ActivityIndicator size="large" color={primaryBrand} />
                <Text style={{ color: subtextColor, marginTop: 8, fontSize: 12 }}>
                  Fetching roadmap from roadmap.sh...
                </Text>
              </View>
            ) : roadmap.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 24 }}>
                <MaterialCommunityIcons name="wifi-off" size={32} color={subtextColor} />
                <Text style={{ color: subtextColor, marginTop: 8, fontSize: 13, textAlign: 'center' }}>
                  Offline — connect to load roadmap.sh content.\nOnce loaded, it works offline too.
                </Text>
              </View>
            ) : null}
            {!roadmapLoading && roadmap.map(item => (
              <View key={item.id} style={[styles.roadmapRow, { backgroundColor: cardBg, borderColor }]}>
                <TouchableOpacity onPress={() => toggleTopicRead(item.id)} style={styles.checkbox}>
                  <MaterialCommunityIcons
                    name={item.read ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={20}
                    color={item.read ? primaryBrand : subtextColor}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openRoadmapStudyModal(item)}
                  style={{ flex: 1 }}
                >
                  <Text style={[styles.roadmapTopic, { color: textColor, textDecorationLine: item.read ? 'line-through' : 'none' }]}>
                    {item.topic}
                  </Text>
                  <Text style={[styles.roadmapPillar, { color: subtextColor }]}>
                    {item.pillar}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => askAnyaAboutFocus(`Explain "${item.topic}" as if I'm preparing for a full-stack system design interview. Max 3 paragraphs.`)}
                  style={styles.askIconBtn}
                >
                  <MaterialCommunityIcons name="robot-outline" size={16} color={primaryBrand} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── PILLAR 3: Fitness Tracker (Dynamic Addition, Removal, Editing) ── */}
        {activeTab === 'fitness' && (
          <View style={styles.cardContainer}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>🏋️ Workout Checklist</Text>

            <View style={styles.streakIndicator}>
              <MaterialCommunityIcons name="fire" size={24} color="#f59e0b" />
              <Text style={[styles.streakText, { color: textColor }]}>Current Streak: {workoutStreak} Days</Text>
            </View>

            {/* Dynamic Exercise Input Form */}
            <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor, flexDirection: 'column', alignItems: 'stretch' }]}>
              <Text style={[styles.settingTitle, { color: textColor }]}>➕ Add Custom Exercise</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, borderColor, color: textColor, marginBottom: 0 }]}
                  placeholder="e.g. Bench Press (3 sets x 10 reps)"
                  placeholderTextColor={subtextColor}
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                />
                <TouchableOpacity
                  onPress={addCustomExercise}
                  style={[styles.waterTapBtn, { backgroundColor: primaryBrand }]}
                >
                  <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                  <Text style={styles.waterTapText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Exercises List */}
            {exercises.map(ex => (
              <View key={ex.id} style={[styles.roadmapRow, { backgroundColor: cardBg, borderColor, justifyContent: 'space-between' }]}>
                {editingExerciseId === ex.id ? (
                  <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { flex: 1, borderColor, color: textColor, marginVertical: 0 }]}
                      value={editingExerciseName}
                      onChangeText={setEditingExerciseName}
                    />
                    <TouchableOpacity onPress={saveEditedExerciseName} style={[styles.recallActionBtn, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                      <Text style={{ color: primaryBrand, fontSize: 12, fontWeight: '700' }}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingExerciseId(null)}>
                      <MaterialCommunityIcons name="close" size={20} color={subtextColor} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => toggleExercise(ex.id)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    >
                      <MaterialCommunityIcons
                        name={ex.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                        size={20}
                        color={ex.completed ? primaryBrand : subtextColor}
                      />
                      <Text style={[styles.exerciseName, { color: textColor, textDecorationLine: ex.completed ? 'line-through' : 'none', flexShrink: 1 }]}>
                        {ex.name}
                      </Text>
                    </TouchableOpacity>

                    {/* Action buttons (Edit & Delete) */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => startEditExerciseName(ex.id, ex.name)}
                        style={{ padding: 4 }}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={16} color={subtextColor} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteExercise(ex.id)}
                        style={{ padding: 4 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ))}

            {/* Physique Score Prompter */}
            <TouchableOpacity
              onPress={() => askAnyaAboutFocus(`Evaluate my weekly training profile. This week I completed ${workoutStreak > 0 ? '100%' : '50%'} of workouts. Recommend one specific change to optimize my training plan.`)}
              style={[styles.physiqueButton, { backgroundColor: primaryBrand }]}
            >
              <MaterialCommunityIcons name="heart-pulse" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Get Physique & Fitness Evaluation</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PILLAR 4: Career, DSA & HLD ─────────────────────────────────────── */}
        {activeTab === 'dsa' && (
          <View style={styles.cardContainer}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>💻 DSA & System Design</Text>
            <Text style={{ color: subtextColor, fontSize: 12, marginBottom: 16, lineHeight: 18 }}>
              Search real DSA articles, mark daily challenge done, or ask Anya to explain any algorithm.
            </Text>

            {/* Daily DSA Challenge */}
            <View style={[styles.activeRecallCard, { borderColor: primaryBrand }]}>
              <View style={styles.flexRow}>
                <MaterialCommunityIcons name="code-string" size={18} color={primaryBrand} />
                <Text style={[styles.activeRecallTitle, { color: primaryBrand }]}>DSA Challenge of the Day</Text>
                {dsaCompleted && (
                  <View style={[styles.dsaTag, { backgroundColor: primaryBrand, marginLeft: 'auto' }]}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Solved ✅</Text>
                  </View>
                )}
              </View>
              <View style={{ backgroundColor: '#1f2937', padding: 12, borderRadius: 10, marginTop: 12, marginBottom: 8, borderWidth: 1, borderColor: '#374151' }}>
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
                  Today's Problem:
                </Text>
                <Text style={{ color: '#d1d5db', fontSize: 13, lineHeight: 20 }}>
                  {(() => {
                    const problems = [
                      "Two Sum: Find two numbers in an array that add up to target.",
                      "Best Time to Buy and Sell Stock: Find max profit from a single buy/sell.",
                      "Contains Duplicate: Check if any value appears at least twice in an array.",
                      "Product of Array Except Self: Return array where answer[i] is product of all elements except nums[i].",
                      "Maximum Subarray: Find the contiguous subarray with the largest sum.",
                      "Reverse Linked List: Reverse a singly linked list in-place.",
                      "Valid Anagram: Check if two strings contain the exact same characters.",
                      "Valid Parentheses: Determine if a string of brackets is validly closed.",
                      "Merge Two Sorted Lists: Splice two sorted linked lists together.",
                      "Climbing Stairs: You can climb 1 or 2 steps. How many ways to reach n?"
                    ];
                    return problems[new Date().getDate() % problems.length];
                  })()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  onPress={completeDsa}
                  style={[styles.recallActionBtn, { backgroundColor: dsaCompleted ? 'rgba(16,185,129,0.2)' : transparentBrandActive }]}
                >
                  <Text style={{ color: primaryBrand, fontSize: 12, fontWeight: '700' }}>
                    {dsaCompleted ? '✅ Solved Today' : 'Mark Solved (+15 XP)'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => askAnyaAboutFocus('Give me a medium-difficulty DSA problem (arrays or graphs) with optimal solution and time complexity.')}
                  style={[styles.recallActionBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
                >
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700' }}>Ask Anya for a Problem</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Article Search */}
            <Text style={[styles.sectionTitle, { color: textColor, marginTop: 8 }]}>🔍 Search DSA & System Design Articles</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={[styles.input, { flex: 1, borderColor, color: textColor, marginBottom: 0 }]}
                placeholder="e.g. dynamic programming, consistent hashing"
                placeholderTextColor={subtextColor}
                value={searchTopic}
                onChangeText={setSearchTopic}
              />
              <TouchableOpacity
                onPress={handleSearchArticles}
                disabled={articlesLoading}
                style={[styles.waterTapBtn, { backgroundColor: primaryBrand, minWidth: 80, justifyContent: 'center' }]}
              >
                {articlesLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialCommunityIcons name="magnify" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
            {articles.map(a => (
              <TouchableOpacity
                key={a.id}
                onPress={() => Linking.openURL(a.url)}
                style={[styles.roadmapRow, { backgroundColor: cardBg, borderColor, flexDirection: 'column', alignItems: 'flex-start' }]}
              >
                <Text style={[styles.roadmapTopic, { color: textColor }]}>{a.title}</Text>
                <Text style={[styles.roadmapPillar, { color: subtextColor }]}>
                  {a.source === 'devto' ? 'DEV.to' : 'Hacker News'} · {a.pillar}
                  {a.readingTime ? ` · ${a.readingTime} min read` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {activeTab === 'nutrition' && (
          <View style={styles.cardContainer}>
            {/* Body Metrics Banner */}
            <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.settingTitle, { color: textColor }]}>⚙️ Body Metrics & TDEE</Text>
                <TouchableOpacity
                  onPress={() => setShowBodyMetricsModal(true)}
                  style={[styles.recallActionBtn, { backgroundColor: transparentBrandActive }]}
                >
                  <Text style={{ color: primaryBrand, fontSize: 12, fontWeight: '700' }}>
                    {macroTargets ? 'Update Metrics' : 'Set Up Now →'}
                  </Text>
                </TouchableOpacity>
              </View>
              {macroTargets ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: subtextColor, fontSize: 12, marginBottom: 6 }}>
                    Goal: <Text style={{ color: primaryBrand, fontWeight: '700', textTransform: 'capitalize' }}>{macroTargets.body_goal}</Text>
                    {'  '}Activity: <Text style={{ color: primaryBrand, fontWeight: '700', textTransform: 'capitalize' }}>{macroTargets.activity_level}</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { label: 'Calories', val: `${macroTargets.targetCalories} kcal`, icon: '🔥' },
                      { label: 'Protein', val: `${macroTargets.protein_g}g`, icon: '💪' },
                      { label: 'Carbs', val: `${macroTargets.carbs_g}g`, icon: '🌾' },
                      { label: 'Fat', val: `${macroTargets.fat_g}g`, icon: '🥑' },
                      { label: 'Water', val: `${(macroTargets.water_ml / 1000).toFixed(1)}L`, icon: '💧' },
                    ].map(m => (
                      <View key={m.label} style={{ alignItems: 'center', backgroundColor: transparentBrand, borderRadius: 10, padding: 10, minWidth: 68 }}>
                        <Text style={{ fontSize: 18 }}>{m.icon}</Text>
                        <Text style={{ color: primaryBrand, fontSize: 13, fontWeight: '800' }}>{m.val}</Text>
                        <Text style={{ color: subtextColor, fontSize: 10 }}>{m.label}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: subtextColor, fontSize: 11, marginTop: 8 }}>
                    BMR: {macroTargets.bmr} kcal · TDEE: {macroTargets.tdee} kcal (Mifflin-St Jeor formula)
                  </Text>
                </View>
              ) : (
                <Text style={{ color: subtextColor, fontSize: 12, marginTop: 8 }}>
                  Set your weight, height, age & goal to get accurate daily macro and calorie targets calculated via TDEE.
                </Text>
              )}
            </View>

            {/* Today's Macro Progress */}
            {macroTargets && (
              <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor, flexDirection: 'column', alignItems: 'stretch' }]}>
                <Text style={[styles.settingTitle, { color: textColor }]}>📊 Today's Intake vs Target</Text>
                {[
                  { label: 'Calories', eaten: nutritionTotals.calories || 0, target: macroTargets.targetCalories },
                  { label: 'Protein (g)', eaten: nutritionTotals.protein || 0, target: macroTargets.protein_g },
                  { label: 'Carbs (g)', eaten: nutritionTotals.carbs || 0, target: macroTargets.carbs_g },
                  { label: 'Fat (g)', eaten: nutritionTotals.fat || 0, target: macroTargets.fat_g },
                ].map(m => {
                  const pct = Math.min((m.eaten / m.target) * 100, 100);
                  return (
                    <View key={m.label} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: textColor, fontSize: 12, fontWeight: '600' }}>{m.label}</Text>
                        <Text style={{ color: pct >= 90 ? primaryBrand : subtextColor, fontSize: 12, fontWeight: '700' }}>
                          {Math.round(m.eaten)} / {m.target}
                        </Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: isDark ? '#1a1a1a' : '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${pct}%` as any, backgroundColor: primaryBrand, borderRadius: 3 }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Food Search */}
            <Text style={[styles.sectionTitle, { color: textColor }]}>🔍 Search & Log Food (Open Food Facts)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={[styles.input, { flex: 1, borderColor, color: textColor, marginBottom: 0 }]}
                placeholder="e.g. banana, chicken breast, oats"
                placeholderTextColor={subtextColor}
                value={foodSearch}
                onChangeText={setFoodSearch}
                onSubmitEditing={handleFoodSearch}
              />
              <TouchableOpacity
                onPress={handleFoodSearch}
                disabled={foodSearching}
                style={[styles.waterTapBtn, { backgroundColor: primaryBrand, minWidth: 70, justifyContent: 'center' }]}
              >
                {foodSearching
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialCommunityIcons name="magnify" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>

            {foodResults.map((food, idx) => (
              <View key={idx} style={[styles.roadmapRow, { backgroundColor: cardBg, borderColor, flexDirection: 'column', alignItems: 'stretch' }]}>
                <Text style={[styles.roadmapTopic, { color: textColor }]}>{food.name}</Text>
                <Text style={[styles.roadmapPillar, { color: subtextColor }]}>
                  {food.calories_per100g} kcal · P:{food.protein_per100g}g · C:{food.carbs_per100g}g · F:{food.fat_per100g}g per 100g
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {[50, 100, 150, 200].map(qty => (
                    <TouchableOpacity
                      key={qty}
                      onPress={() => handleLogFood(food, qty)}
                      style={[styles.recallActionBtn, { backgroundColor: transparentBrandActive }]}
                    >
                      <Text style={{ color: primaryBrand, fontSize: 11, fontWeight: '700' }}>+{qty}g</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {/* Today's Log */}
            {nutritionLog.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: textColor, marginTop: 12 }]}>📋 Today's Food Log</Text>
                {nutritionLog.map((entry: any) => (
                  <View key={entry.id} style={[styles.roadmapRow, { backgroundColor: cardBg, borderColor, justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roadmapTopic, { color: textColor }]}>{entry.food_name}</Text>
                      <Text style={[styles.roadmapPillar, { color: subtextColor }]}>
                        {entry.quantity_g}g · {Math.round(parseFloat(entry.calories_kcal) * entry.quantity_g / 100)} kcal
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteNutritionEntry(entry.id)} style={{ padding: 4 }}>
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {activeTab === 'weekly' && (
          <View style={styles.cardContainer}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>📊 Weekly AI Digest & Performance Score</Text>
            <Text style={[styles.settingDesc, { color: subtextColor, marginBottom: 16 }]}>
              Analyze your full personal health, roadmap checklists, workout completion rates, and learning retention.
            </Text>

            <TouchableOpacity
              onPress={handleGenerateDailyDigestText}
              disabled={isGeneratingDigest}
              style={[styles.weeklyAnyaBtn, { backgroundColor: primaryBrand, height: 46, justifyContent: 'center' }]}
            >
              {isGeneratingDigest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="robot" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Generate Daily Performance Digest</Text>
                </View>
              )}
            </TouchableOpacity>

            {dailyDigestText ? (
              <View style={[styles.activeRecallCard, { borderColor: primaryBrand, backgroundColor: isDark ? '#050505' : '#ffffff', marginTop: 16, borderLeftWidth: 4 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="comment-text-multiple-outline" size={18} color={primaryBrand} />
                    <Text style={[styles.activeRecallTitle, { color: primaryBrand }]}>Anya's Focus Report</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDailyDigestText('')}>
                    <MaterialCommunityIcons name="close" size={16} color={subtextColor} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: textColor, fontSize: 13, lineHeight: 20 }}>
                  {dailyDigestText}
                </Text>
              </View>
            ) : null}

            <View style={[styles.activeRecallCard, { borderColor, backgroundColor: cardBg, marginTop: 16 }]}>
              <Text style={[styles.activeRecallTitle, { color: textColor }]}>💡 Self-Study Accountability</Text>
              <Text style={{ color: subtextColor, fontSize: 11, marginTop: 6, lineHeight: 16 }}>
                Anya tracks topics you're marking low confidence in to keep them prioritized on your next recall run. Make sure to log realistic confidence levels inside the Study tab!
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ─── Premium In-App Concept Knowledge Reader Modal ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!selectedStudyConcept}
        onRequestClose={() => setSelectedStudyConcept(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: cardBg, borderColor }]}>

            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <View>
                <Text style={[styles.modalPillarText, { color: primaryBrand }]}>
                  {selectedStudyConcept?.pillar} CONCEPT NOTES
                </Text>
                <Text style={[styles.modalTitleText, { color: textColor }]}>
                  {selectedStudyConcept?.title}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedStudyConcept(null)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Modal Scrollable Content */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>

              {/* Theoretical Explanation */}
              <Text style={[styles.modalSectionLabel, { color: primaryBrand }]}>Theoretical Breakdown</Text>
              <Text style={[styles.modalBodyText, { color: textColor }]}>
                {selectedStudyConcept?.explanation}
              </Text>

              {/* Code Snippet Box */}
              {selectedStudyConcept?.codeSnippet && (
                <View>
                  <Text style={[styles.modalSectionLabel, { color: primaryBrand, marginTop: 16 }]}>Interactive Implementation</Text>
                  <View style={[styles.codeBoxContainer, { backgroundColor: isDark ? '#000000' : '#f3f4f6' }]}>
                    <Text style={styles.codeText}>
                      {selectedStudyConcept?.codeSnippet}
                    </Text>
                  </View>
                </View>
              )}

              {/* Curated Resources / Documentation Links */}
              <Text style={[styles.modalSectionLabel, { color: primaryBrand, marginTop: 20 }]}>Curated Interactive Documentation</Text>
              {selectedStudyConcept?.links.map((link: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => Linking.openURL(link.url)}
                  style={[styles.linkRow, { borderBottomColor: borderColor }]}
                >
                  <MaterialCommunityIcons name="earth" size={16} color={primaryBrand} />
                  <Text style={[styles.linkText, { color: primaryBrand }]}>{link.name}</Text>
                  <MaterialCommunityIcons name="open-in-new" size={12} color={subtextColor} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              ))}

              <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modal Action Footer */}
            <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
              <TouchableOpacity
                onPress={() => {
                  if (selectedStudyConcept.source === 'roadmap') {
                    toggleTopicRead(selectedStudyConcept.id);
                    Alert.alert("Success! 🎓", `Pillar topic "${selectedStudyConcept.title}" marked as read & completed! (+10 XP)`);
                  } else if (selectedStudyConcept.source === 'dsa') {
                    completeDsa();
                  } else if (selectedStudyConcept.source === 'hld' || selectedStudyConcept.source === 'dynamic') {
                    earnXp(10, 'concept_read');
                    Alert.alert("Success! 🌐", `"${selectedStudyConcept.title}" marked as mastered! (+10 XP)`);
                  }
                  setSelectedStudyConcept(null);
                }}
                style={[styles.modalActionBtn, { backgroundColor: primaryBrand }]}
              >
                <MaterialCommunityIcons name="check-decagram" size={20} color="#fff" />
                <Text style={styles.modalActionText}>Mark Done & Complete Concept (+10 XP)</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Body Metrics Setup Modal */}
      <Modal animationType="slide" transparent visible={showBodyMetricsModal}
        onRequestClose={() => setShowBodyMetricsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitleText, { color: textColor }]}>⚙️ Body Metrics</Text>
              <TouchableOpacity onPress={() => setShowBodyMetricsModal(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={[styles.modalSectionLabel, { color: primaryBrand }]}>Used for TDEE & Macro Calculation (Mifflin-St Jeor)</Text>
              {[
                { label: 'Weight (kg)', val: editWeight, set: setEditWeight, placeholder: 'e.g. 72' },
                { label: 'Height (cm)', val: editHeight, set: setEditHeight, placeholder: 'e.g. 175' },
                { label: 'Age (years)', val: editAge, set: setEditAge, placeholder: 'e.g. 22' },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: 14 }}>
                  <Text style={{ color: textColor, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, { borderColor, color: textColor, marginBottom: 0 }]}
                    placeholder={f.placeholder} placeholderTextColor={subtextColor}
                    value={f.val} onChangeText={f.set} keyboardType="numeric"
                  />
                </View>
              ))}
              <Text style={{ color: textColor, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Goal</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['bulk', 'cut', 'maintain', 'recomp'].map(g => (
                  <TouchableOpacity key={g} onPress={() => setEditGoal(g)}
                    style={[styles.recallActionBtn, { backgroundColor: editGoal === g ? primaryBrand : transparentBrand }]}>
                    <Text style={{ color: editGoal === g ? '#fff' : subtextColor, fontWeight: '700', textTransform: 'capitalize', fontSize: 13 }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ color: textColor, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Activity Level</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {['sedentary', 'light', 'moderate', 'active', 'very_active'].map(a => (
                  <TouchableOpacity key={a} onPress={() => setEditActivity(a)}
                    style={[styles.recallActionBtn, { backgroundColor: editActivity === a ? primaryBrand : transparentBrand }]}>
                    <Text style={{ color: editActivity === a ? '#fff' : subtextColor, fontWeight: '700', fontSize: 11, textTransform: 'capitalize' }}>{a.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
              <TouchableOpacity onPress={handleSaveBodyMetrics} style={[styles.modalActionBtn, { backgroundColor: primaryBrand }]}>
                <MaterialCommunityIcons name="check-decagram" size={20} color="#fff" />
                <Text style={styles.modalActionText}>Calculate My TDEE & Macros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLevel: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerTitle: {
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  xpBarBackground: {
    height: 6,
    backgroundColor: '#1c1c1e',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  xpBarFill: {
    height: '100%',
  },
  xpText: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  tabBar: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  tabLabel: {
    fontSize: 12,
  },
  contentScroll: {
    paddingBottom: 40,
  },
  cardContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  smallPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
  },
  waterTapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  waterTapText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    width: '100%',
    marginBottom: 8,
  },
  submitFoodBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeRecallCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#090909',
    marginBottom: 16,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeRecallTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  activeRecallBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#9ca3af',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  rateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeRecallSubmit: {
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  roadmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  checkbox: {
    padding: 2,
  },
  roadmapTopic: {
    fontSize: 13,
    fontWeight: '600',
  },
  roadmapPillar: {
    fontSize: 11,
    marginTop: 2,
  },
  askIconBtn: {
    padding: 6,
  },
  streakIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseName: {
    fontSize: 13,
    fontWeight: '500',
  },
  physiqueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  dsaTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  dsaTag: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recallActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  weeklyAnyaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
  },

  // --- Premium Study Reader Modal Overlay Styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalPillarText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalBodyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  codeBoxContainer: {
    padding: 14,
    borderRadius: 10,
    marginVertical: 8,
  },
  codeText: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: '#10b981',
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
  },
  modalActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default FocusScreen;
