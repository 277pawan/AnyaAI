// src/screens/anyaSettings.tsx
// Dedicated Anya AI Settings screen — tab in bottom navigator

import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Tts from 'react-native-tts';
import { ThemeContext } from '../../App';
import {
  startRecording,
  stopRecording,
  extractVoicePrint,
  saveVoiceProfile,
  clearVoiceProfile,
  hasVoiceProfile,
} from '../services/voiceBiometrics';
import { CONFIG } from '../config/index';

const AnyaSettings = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#050505' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subtextColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#222222' : '#e5e7eb';

  // ── Audio settings ──────────────────────────────────────────────────────────
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [autoGain, setAutoGain] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [bluetoothSco, setBluetoothSco] = useState(true);
  const [voiceReaderEnabled, setVoiceReaderEnabled] = useState(true);
  const [bgVoiceReaderEnabled, setBgVoiceReaderEnabled] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'earpiece' | 'speaker'>(
    'earpiece',
  );

  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  const [femaleVoices, setFemaleVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');

  // ── Voice Biometrics ─────────────────────────────────────────────────────────
  const [hasVoiceId, setHasVoiceId] = useState(false);
  const [isVoiceIdModalVisible, setIsVoiceIdModalVisible] = useState(false);
  const [voiceIdStep, setVoiceIdStep] = useState(1);
  const [voiceIdRecording, setVoiceIdRecording] = useState(false);
  const [collectedVectors, setCollectedVectors] = useState<number[][]>([]);

  // ── Model Health ─────────────────────────────────────────────────────────────
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  const [modelHealthData, setModelHealthData] = useState<any>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // ── Load all settings on mount ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const ns = await AsyncStorage.getItem('@anya_noise_suppression');
        const ag = await AsyncStorage.getItem('@anya_auto_gain');
        const ec = await AsyncStorage.getItem('@anya_echo_cancellation');
        const bt = await AsyncStorage.getItem('@anya_bluetooth_sco');
        const vm = await AsyncStorage.getItem('@anya_voice_mode');
        const vid = await AsyncStorage.getItem('@anya_selected_voice');
        const vr = await AsyncStorage.getItem('@anya_voice_reader_enabled');
        const bvr = await AsyncStorage.getItem('@anya_bg_voice_reader_enabled');

        if (ns !== null) setNoiseSuppression(ns === 'true');
        if (ag !== null) setAutoGain(ag === 'true');
        if (ec !== null) setEchoCancellation(ec === 'true');
        if (bt !== null) setBluetoothSco(bt === 'true');
        if (vm !== null) setVoiceMode(vm as 'earpiece' | 'speaker');
        if (vid !== null) setSelectedVoiceId(vid);
        setVoiceReaderEnabled(vr === null ? true : vr === 'true');
        setBgVoiceReaderEnabled(bvr === null ? false : bvr === 'true');
      } catch (e) {
        console.warn('[AnyaSettings] load error:', e);
      }

      // Voice ID
      const active = await hasVoiceProfile();
      setHasVoiceId(active);

      // TTS voices
      try {
        await Tts.getInitStatus();
        const voices = await Tts.voices();
        const filtered = voices.filter(
          v =>
            v.language?.toLowerCase().startsWith('en') ||
            v.language?.toLowerCase().startsWith('hi') ||
            v.id.toLowerCase().includes('female') ||
            v.id.toLowerCase().includes('network') ||
            (v as any).gender === 'female',
        );
        setFemaleVoices(filtered.length > 0 ? filtered : voices);
      } catch (e) {
        console.warn('[AnyaSettings] TTS voice load error:', e);
      }
    };
    load();
  }, []);

  const save = (key: string, value: string) => AsyncStorage.setItem(key, value);

  const handleSelectVoice = async (voiceId: string) => {
    try {
      setSelectedVoiceId(voiceId);
      await AsyncStorage.setItem('@anya_selected_voice', voiceId);
      await Tts.setDefaultVoice(voiceId);
      Tts.stop();
      Tts.speak('Hello Pawan, this is your new Anya voice.');
    } catch (e) {
      console.warn('[AnyaSettings] voice select error:', e);
    }
  };

  // ── Voice ID ─────────────────────────────────────────────────────────────────
  const startVoiceCalibration = () => {
    setVoiceIdStep(1);
    setCollectedVectors([]);
    setVoiceIdRecording(false);
    setIsVoiceIdModalVisible(true);
  };

  const handleStepRecord = async () => {
    if (voiceIdRecording) {
      setVoiceIdRecording(false);
      try {
        const filePath = await stopRecording();
        const vector = await extractVoicePrint(filePath);
        const newVectors = [...collectedVectors, vector];
        setCollectedVectors(newVectors);

        if (voiceIdStep < 3) {
          setVoiceIdStep(voiceIdStep + 1);
        } else {
          setIsVoiceIdModalVisible(false);
          const masterVector = Array(26)
            .fill(0)
            .map(
              (_, i) =>
                (newVectors[0][i] + newVectors[1][i] + newVectors[2][i]) / 3,
            );
          const mag = Math.sqrt(masterVector.reduce((s, v) => s + v * v, 0));
          const norm = mag > 0 ? masterVector.map(v => v / mag) : masterVector;
          const saved = await saveVoiceProfile(norm);
          if (saved) {
            setHasVoiceId(true);
            Alert.alert('Success 🎉', 'Voice ID calibrated successfully!');
          } else {
            Alert.alert('Error', 'Failed to store voice profile.');
          }
        }
      } catch (err) {
        Alert.alert('Error', 'Calibration failed. Please try again.');
      }
    } else {
      try {
        setVoiceIdRecording(true);
        await startRecording();
      } catch {
        setVoiceIdRecording(false);
        Alert.alert('Error', 'Microphone unavailable.');
      }
    }
  };

  const handleDeleteVoiceId = () => {
    Alert.alert(
      'Delete Voice ID?',
      'This will disable biometric verification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await clearVoiceProfile();
            setHasVoiceId(false);
            Alert.alert('Deleted', 'Voice ID removed.');
          },
        },
      ],
    );
  };

  const fetchModelHealth = async () => {
    setIsLoadingHealth(true);
    setIsHealthModalVisible(true);
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/admin/model-health`);
      const data = await res.json();
      if (data.success) {
        setModelHealthData(data);
      } else {
        Alert.alert('Error', data.error || 'Failed to fetch model health');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const SettingRow = ({
    icon,
    title,
    desc,
    value,
    onToggle,
  }: {
    icon: string;
    title: string;
    desc: string;
    value: boolean;
    onToggle: (v: boolean) => void;
  }) => (
    <View style={[styles.settingRow, { backgroundColor: cardBg, borderColor }]}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color="#8b5cf6"
        style={{ marginRight: 2 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.settingDesc, { color: subtextColor }]}>
          {desc}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#374151', true: '#8b5cf6' }}
        thumbColor={value ? '#a78bfa' : '#9ca3af'}
      />
    </View>
  );

  const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon} size={15} color="#8b5cf6" />
      <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: bgColor, borderBottomColor: borderColor },
        ]}
      >
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="robot-excited-outline"
            size={24}
            color="#8b5cf6"
          />
          <Text style={[styles.headerTitle, { color: textColor }]}>
            Anya AI Settings
          </Text>
        </View>
        <Text style={[styles.headerSub, { color: subtextColor }]}>
          Voice · Audio · Biometrics
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* ── Voice & Audio ─────────────────────────────────────────────── */}
        <SectionHeader icon="microphone-settings" title="Voice & Audio" />

        <SettingRow
          icon="waveform"
          title="Noise Suppression"
          desc="DSP-level background noise filter during mic capture"
          value={noiseSuppression}
          onToggle={v => {
            setNoiseSuppression(v);
            save('@anya_noise_suppression', String(v));
          }}
        />
        <SettingRow
          icon="signal-variant"
          title="Auto Gain Control (AGC)"
          desc="Boosts mic sensitivity for far-field / earbud use"
          value={autoGain}
          onToggle={v => {
            setAutoGain(v);
            save('@anya_auto_gain', String(v));
          }}
        />
        <SettingRow
          icon="volume-off"
          title="Echo Cancellation (AEC)"
          desc="Prevents Anya's voice from feeding back into the mic"
          value={echoCancellation}
          onToggle={v => {
            setEchoCancellation(v);
            save('@anya_echo_cancellation', String(v));
          }}
        />
        <SettingRow
          icon="bluetooth-audio"
          title="Bluetooth Earbud Mic (SCO)"
          desc="Route mic input through Bluetooth earbuds when connected"
          value={bluetoothSco}
          onToggle={v => {
            setBluetoothSco(v);
            save('@anya_bluetooth_sco', String(v));
          }}
        />

        {/* ── Audio Output ──────────────────────────────────────────────── */}
        <SectionHeader icon="volume-high" title="Audio Output" />
        <View
          style={[
            styles.settingRow,
            { backgroundColor: cardBg, borderColor, flexWrap: 'wrap', gap: 10 },
          ]}
        >
          <MaterialCommunityIcons name="speaker" size={20} color="#8b5cf6" />
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text style={[styles.settingTitle, { color: textColor }]}>
              Playback Route
            </Text>
            <Text style={[styles.settingDesc, { color: subtextColor }]}>
              Earpiece = private (phone-call style). Speaker = hands-free.
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 8,
              width: '100%',
              paddingLeft: 28,
            }}
          >
            {(['earpiece', 'speaker'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                id={`voice-mode-${mode}`}
                onPress={() => {
                  setVoiceMode(mode);
                  save('@anya_voice_mode', mode);
                }}
                style={[
                  styles.modeBtn,
                  { borderColor: voiceMode === mode ? '#8b5cf6' : borderColor },
                  voiceMode === mode && {
                    backgroundColor: 'rgba(139,92,246,0.2)',
                  },
                ]}
              >
                <Text
                  style={{
                    color: voiceMode === mode ? '#8b5cf6' : subtextColor,
                    fontWeight: voiceMode === mode ? '700' : '400',
                    fontSize: 13,
                  }}
                >
                  {mode === 'earpiece' ? '🎧 Earpiece' : '🔊 Speaker'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Voice Reader ───────────────────────────────────────────────── */}
        <SectionHeader icon="text-to-speech" title="Voice Reader" />
        <SettingRow
          icon="volume-high"
          title="Read Responses Aloud"
          desc="Anya speaks normal chat responses (default: on)"
          value={voiceReaderEnabled}
          onToggle={v => {
            setVoiceReaderEnabled(v);
            save('@anya_voice_reader_enabled', String(v));
          }}
        />
        <SettingRow
          icon="briefcase-search-outline"
          title="Background Task Voice"
          desc="Speak job search & background results (default: off)"
          value={bgVoiceReaderEnabled}
          onToggle={v => {
            setBgVoiceReaderEnabled(v);
            save('@anya_bg_voice_reader_enabled', String(v));
          }}
        />

        {/* ── Anya Voice (TTS) ─────────────────────────────────────────── */}
        <SectionHeader icon="account-voice" title="Anya Voice" />
        <View
          style={[
            styles.settingRow,
            {
              backgroundColor: cardBg,
              borderColor,
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 8,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons
              name="microphone-settings"
              size={20}
              color="#8b5cf6"
            />
            <Text style={[styles.settingTitle, { color: textColor }]}>
              Text-to-Speech Voice
            </Text>
          </View>
          <Text
            style={[
              styles.settingDesc,
              { color: subtextColor, paddingLeft: 28 },
            ]}
          >
            Active: {selectedVoiceId?.split('/')?.pop() ?? 'System Default'}
          </Text>
          <TouchableOpacity
            id="open-voice-picker-btn"
            onPress={() => setIsVoiceModalVisible(true)}
            style={[
              styles.actionBtn,
              {
                borderColor: 'rgba(139,92,246,0.4)',
                backgroundColor: 'rgba(139,92,246,0.1)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="playlist-edit"
              size={16}
              color="#8b5cf6"
            />
            <Text style={{ color: '#8b5cf6', fontWeight: '600', fontSize: 13 }}>
              Change Voice
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Voice Biometrics ─────────────────────────────────────────── */}
        <SectionHeader icon="shield-account" title="Voice Biometrics" />
        <View
          style={[
            styles.settingRow,
            {
              backgroundColor: cardBg,
              borderColor,
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 10,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons
              name={hasVoiceId ? 'shield-check' : 'shield-off-outline'}
              size={20}
              color={hasVoiceId ? '#10b981' : subtextColor}
            />
            <Text style={[styles.settingTitle, { color: textColor }]}>
              Voice ID {hasVoiceId ? '(Active ✅)' : '(Not Set)'}
            </Text>
          </View>
          <Text
            style={[
              styles.settingDesc,
              { color: subtextColor, paddingLeft: 28 },
            ]}
          >
            Biometric verification — only your voice can trigger Anya.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, paddingLeft: 28 }}>
            <TouchableOpacity
              id="calibrate-voice-id-btn"
              onPress={startVoiceCalibration}
              style={[
                styles.actionBtn,
                {
                  borderColor: 'rgba(16,185,129,0.4)',
                  backgroundColor: 'rgba(16,185,129,0.1)',
                },
              ]}
            >
              <MaterialCommunityIcons
                name="microphone-plus"
                size={15}
                color="#10b981"
              />
              <Text
                style={{ color: '#10b981', fontWeight: '600', fontSize: 13 }}
              >
                {hasVoiceId ? 'Recalibrate' : 'Calibrate'}
              </Text>
            </TouchableOpacity>
            {hasVoiceId && (
              <TouchableOpacity
                id="delete-voice-id-btn"
                onPress={handleDeleteVoiceId}
                style={[
                  styles.actionBtn,
                  {
                    borderColor: 'rgba(239,68,68,0.4)',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={15}
                  color="#ef4444"
                />
                <Text
                  style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}
                >
                  Delete
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Appearance ───────────────────────────────────────────────── */}
        <SectionHeader icon="palette" title="Appearance" />
        <SettingRow
          icon="theme-light-dark"
          title="Dark Mode"
          desc="Toggle between dark and light interface"
          value={isDark}
          onToggle={toggleTheme}
        />

        {/* ── System Health ──────────────────────────────────────────────── */}
        <SectionHeader icon="heart-pulse" title="System Health" />
        <View
          style={[
            styles.settingRow,
            {
              backgroundColor: cardBg,
              borderColor,
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 8,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons
              name="server-network"
              size={20}
              color="#8b5cf6"
            />
            <Text style={[styles.settingTitle, { color: textColor }]}>
              AI Models & APIs Status
            </Text>
          </View>
          <Text
            style={[
              styles.settingDesc,
              { color: subtextColor, paddingLeft: 28 },
            ]}
          >
            Check live health and connectivity of Gemini, Mistral, Groq, and
            Cloudflare models.
          </Text>
          <TouchableOpacity
            onPress={fetchModelHealth}
            style={[
              styles.actionBtn,
              {
                borderColor: 'rgba(139,92,246,0.4)',
                backgroundColor: 'rgba(139,92,246,0.1)',
                marginLeft: 28,
              },
            ]}
          >
            <MaterialCommunityIcons name="refresh" size={16} color="#8b5cf6" />
            <Text style={{ color: '#8b5cf6', fontWeight: '600', fontSize: 13 }}>
              Check Live Health
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── TTS Voice Picker Modal ─────────────────────────────────────── */}
      <Modal
        visible={isVoiceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsVoiceModalVisible(false);
          setVoiceSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop absolute dismiss target */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => {
              setIsVoiceModalVisible(false);
              setVoiceSearchQuery('');
            }}
          />

          <View
            style={[
              styles.modalSheet,
              { backgroundColor: isDark ? '#161616' : '#fff', maxHeight: '80%' },
            ]}
          >
            <View style={styles.dragHandle} />
            <Text style={[styles.modalTitle, { color: textColor, fontSize: 18, fontWeight: '800', marginBottom: 16 }]}>
              Choose Anya's Voice
            </Text>

            {/* Search Input for Voice Selection */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#222' : '#f3f4f6',
                borderRadius: 12,
                paddingHorizontal: 12,
                marginBottom: 16,
                height: 44,
                borderWidth: 1,
                borderColor: isDark ? '#333' : '#e5e7eb',
              }}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={subtextColor} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search dynamic voices..."
                placeholderTextColor={subtextColor}
                value={voiceSearchQuery}
                onChangeText={setVoiceSearchQuery}
                style={{ flex: 1, color: textColor, fontSize: 14, padding: 0 }}
              />
              {voiceSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setVoiceSearchQuery('')}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={subtextColor} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={femaleVoices.filter(item => {
                const voiceName = (item.id?.split('/')?.pop() || item.id || '').toLowerCase();
                const voiceLang = (item.language || '').toLowerCase();
                const query = voiceSearchQuery.toLowerCase();
                return voiceName.includes(query) || voiceLang.includes(query);
              })}
              keyExtractor={item => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => {
                const isSelected = selectedVoiceId === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      handleSelectVoice(item.id);
                      setIsVoiceModalVisible(false);
                      setVoiceSearchQuery('');
                    }}
                    style={[
                      styles.voiceItem,
                      { borderColor: isSelected ? '#8b5cf6' : borderColor },
                      isSelected && { backgroundColor: 'rgba(139,92,246,0.08)' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'check-circle' : 'circle-outline'}
                      size={20}
                      color={isSelected ? '#8b5cf6' : subtextColor}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 14,
                          fontWeight: isSelected ? '800' : '500',
                        }}
                      >
                        {item.id?.split('/')?.pop() || item.id}
                      </Text>
                      <Text style={{ color: subtextColor, fontSize: 11, marginTop: 2 }}>
                        {item.language}{' '}
                        {(item as any).gender
                          ? `· ${(item as any).gender}`
                          : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              onPress={() => {
                setIsVoiceModalVisible(false);
                setVoiceSearchQuery('');
              }}
              style={styles.modalDoneBtn}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Voice ID Calibration Modal ─────────────────────────────────── */}
      {/* ── Voice ID Calibration Modal ─────────────────────────────────── */}
      <Modal visible={isVoiceIdModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {/* Backdrop absolute dismiss target */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setIsVoiceIdModalVisible(false)}
          />

          <View
            style={[
              styles.modalSheet,
              { backgroundColor: isDark ? '#121212' : '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
            ]}
          >
            <View style={styles.dragHandle} />
            <Text style={[styles.modalTitle, { color: textColor, textAlign: 'center', fontSize: 18, fontWeight: '800' }]}>
              Voice ID Calibration — Step {voiceIdStep}/3
            </Text>
            <Text
              style={[
                styles.settingDesc,
                { color: subtextColor, marginBottom: 20, textAlign: 'center' },
              ]}
            >
              {voiceIdStep === 1 &&
                'Say: "Hey Anya, activate voice ID" clearly.'}
              {voiceIdStep === 2 && 'Say: "My name is Pawan Bisht" clearly.'}
              {voiceIdStep === 3 &&
                'Say: "Anya, you are my AI assistant" clearly.'}
            </Text>

            {/* Visualizer animation placeholder */}
            <View style={{ height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
              {voiceIdRecording ? (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((_, i) => (
                    <View key={i} style={{ width: 4, height: 16 + Math.sin(i) * 12, backgroundColor: '#ef4444', borderRadius: 2 }} />
                  ))}
                </View>
              ) : (
                <View style={{ width: 100, height: 2, backgroundColor: isDark ? '#333' : '#e5e7eb' }} />
              )}
            </View>

            <TouchableOpacity
              onPress={handleStepRecord}
              style={[
                styles.actionBtn,
                {
                  alignSelf: 'center',
                  paddingHorizontal: 28,
                  paddingVertical: 14,
                  borderRadius: 20,
                  backgroundColor: voiceIdRecording
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(16,185,129,0.12)',
                  borderColor: voiceIdRecording ? '#ef4444' : '#10b981',
                  borderWidth: 1.5,
                  shadowColor: voiceIdRecording ? '#ef4444' : '#10b981',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={voiceIdRecording ? 'stop-circle' : 'microphone'}
                size={20}
                color={voiceIdRecording ? '#ef4444' : '#10b981'}
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  color: voiceIdRecording ? '#ef4444' : '#10b981',
                  fontWeight: '800',
                  fontSize: 14,
                }}
              >
                {voiceIdRecording ? 'Stop Recording' : 'Start Recording'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsVoiceIdModalVisible(false)}
              style={{ marginTop: 20, alignSelf: 'center', padding: 8 }}
            >
              <Text style={{ color: '#8b5cf6', fontWeight: '700', fontSize: 13 }}>Cancel Calibration</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Model Health Modal ─────────────────────────────────────────── */}
      <Modal visible={isHealthModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {/* Backdrop absolute dismiss target */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setIsHealthModalVisible(false)}
          />

          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#121212' : '#fff',
                maxHeight: '85%',
                flex: 1,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
              },
            ]}
          >
            <View style={styles.dragHandle} />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: textColor, marginBottom: 0, fontSize: 18, fontWeight: '800' },
                ]}
              >
                Model Health Dashboard
              </Text>
              <TouchableOpacity onPress={fetchModelHealth} style={{ padding: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                <MaterialCommunityIcons
                  name="refresh"
                  size={20}
                  color="#8b5cf6"
                />
              </TouchableOpacity>
            </View>

            {isLoadingHealth ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text
                  style={{
                    color: subtextColor,
                    textAlign: 'center',
                    marginTop: 12,
                    fontSize: 13,
                    fontWeight: '500',
                  }}
                >
                  Checking API health connections...
                </Text>
              </View>
            ) : modelHealthData ? (
              <ScrollView
                style={{ flex: 1, width: '100%' }}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {/* Stats Summary Panel */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 20,
                    backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                    padding: 16,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text
                      style={{
                        color: subtextColor,
                        fontSize: 10,
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Total
                    </Text>
                    <Text
                      style={{
                        color: textColor,
                        fontSize: 20,
                        fontWeight: '800',
                      }}
                    >
                      {modelHealthData.summary?.total || 0}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text
                      style={{
                        color: subtextColor,
                        fontSize: 10,
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Healthy
                    </Text>
                    <Text
                      style={{
                        color: '#10b981',
                        fontSize: 20,
                        fontWeight: '800',
                      }}
                    >
                      {modelHealthData.summary?.healthy || 0}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text
                      style={{
                        color: subtextColor,
                        fontSize: 10,
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Failed
                    </Text>
                    <Text
                      style={{
                        color: '#ef4444',
                        fontSize: 20,
                        fontWeight: '800',
                      }}
                    >
                      {modelHealthData.summary?.failed || 0}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text
                      style={{
                        color: subtextColor,
                        fontSize: 10,
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Score
                    </Text>
                    <Text
                      style={{
                        color: '#8b5cf6',
                        fontSize: 20,
                        fontWeight: '800',
                      }}
                    >
                      {modelHealthData.summary?.health_pct || 0}%
                    </Text>
                  </View>
                </View>

                {/* Model Cards */}
                {modelHealthData.models?.map((model: any, index: number) => (
                  <View
                    key={index}
                    style={{
                      marginBottom: 12,
                      padding: 16,
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: model.is_healthy
                        ? 'rgba(16,185,129,0.2)'
                        : 'rgba(239,68,68,0.2)',
                      backgroundColor: model.is_healthy
                        ? 'rgba(16,185,129,0.04)'
                        : 'rgba(239,68,68,0.04)',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={{
                            color: textColor,
                            fontWeight: '800',
                            fontSize: 14,
                          }}
                        >
                          {model.model}
                        </Text>
                        <Text
                          style={{
                            color: subtextColor,
                            fontSize: 11,
                            fontWeight: '600',
                            marginTop: 2,
                          }}
                        >
                          {model.provider?.toUpperCase()}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: model.is_healthy
                            ? 'rgba(16,185,129,0.1)'
                            : 'rgba(239,68,68,0.1)',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                          gap: 4,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={model.is_healthy ? 'check-circle' : 'alert-circle'}
                          size={14}
                          color={model.is_healthy ? '#10b981' : '#ef4444'}
                        />
                        <Text
                          style={{
                            color: model.is_healthy ? '#10b981' : '#ef4444',
                            fontSize: 10,
                            fontWeight: '800',
                          }}
                        >
                          {model.is_healthy ? 'ONLINE' : 'ERROR'}
                        </Text>
                      </View>
                    </View>

                    {model.latency_ms > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <MaterialCommunityIcons name="timer-outline" size={11} color={subtextColor} />
                        <Text style={{ color: subtextColor, fontSize: 11 }}>
                          Latency: {model.latency_ms}ms
                        </Text>
                      </View>
                    )}

                    {!model.is_healthy && model.last_error && (
                      <View
                        style={{
                          marginTop: 8,
                          padding: 8,
                          borderRadius: 8,
                          backgroundColor: 'rgba(239,68,68,0.06)',
                          borderWidth: 1,
                          borderColor: 'rgba(239,68,68,0.1)',
                        }}
                      >
                        <Text
                          style={{ color: '#ef4444', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
                        >
                          {model.last_error}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ color: subtextColor, textAlign: 'center', marginVertical: 40 }}>
                No health data logged yet. Click check live health to poll status.
              </Text>
            )}
            <TouchableOpacity
              onPress={() => setIsHealthModalVisible(false)}
              style={styles.modalDoneBtn}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Close Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    paddingLeft: 34,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
    paddingLeft: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
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
  modeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dragHandle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.25)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 8,
    backgroundColor: 'rgba(128,128,128,0.02)',
  },
  modalDoneBtn: {
    marginTop: 20,
    backgroundColor: '#8b5cf6',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});

export default AnyaSettings;
