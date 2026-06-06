import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Switch,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  PermissionsAndroid,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import Tts from 'react-native-tts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemeContext } from '../../App';
import { CONFIG } from '../config/index';
import { UserAPI, LifeEngineAPI } from '../services/api';
import {
  startRecording,
  stopRecording,
  extractVoicePrint,
  saveVoiceProfile,
  clearVoiceProfile,
  hasVoiceProfile,
} from '../services/voiceBiometrics';
import { SweetLoader } from './components/SweetLoader';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';



// --- Pure Vanilla JS SHA-1 Implementation for Signed Cloudinary Requests ---
function sha1(string: string): string {
  function rotateLeft(n: number, s: number): number {
    return (n << s) | (n >>> (32 - s));
  }
  const block: number[] = [];
  const str = unescape(encodeURIComponent(string));
  const len = str.length;
  let i, j;
  for (i = 0; i < len; i++) {
    block[i >> 2] |= str.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  block[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  block[((len + 8) >> 6) * 16 + 15] = len * 8;

  let h0 = 1732584193;
  let h1 = -271733879;
  let h2 = -1732584194;
  let h3 = 271733878;
  let h4 = -1009589776;

  for (i = 0; i < block.length; i += 16) {
    const w: number[] = [];
    for (j = 0; j < 80; j++) {
      if (j < 16) {
        w[j] = block[i + j];
      } else {
        w[j] = rotateLeft(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      }
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (j = 0; j < 80; j++) {
      let f = 0;
      let k = 0;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 1518500249;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 1859775393;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = -1894007588;
      } else {
        f = b ^ c ^ d;
        k = -899497514;
      }
      const temp = (rotateLeft(a, 5) + f + e + k + (w[j] || 0)) | 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30) | 0;
      b = a;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const result = [h0, h1, h2, h3, h4];
  return result
    .map(num => {
      const hex = (num >>> 0).toString(16);
      return ('00000000' + hex).slice(-8);
    })
    .join('');
}

// --- Pure Vanilla JS Base64 Encoder for text document uploads ---
function base64Encode(str: string): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let block = 0;
  let charCode;
  let i = 0;
  let map = chars;

  for (
    ;
    str.charAt(i | 0) || ((map = '='), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = str.charCodeAt((i += 3 / 4));
    if (charCode > 0xff) {
      throw new Error(
        'btoa failed: The string to be encoded contains characters outside of the Latin1 range.',
      );
    }
    block = (block << 8) | charCode;
  }
  return output;
}

const Settings = ({ navigation }: any) => {
  const { theme, toggleTheme } = useContext(ThemeContext);


  // Voice Biometrics (Voice ID) states
  const [isVoiceIdModalVisible, setIsVoiceIdModalVisible] = useState(false);
  const [voiceIdStep, setVoiceIdStep] = useState(1); // 1, 2, 3
  const [voiceIdRecording, setVoiceIdRecording] = useState(false);
  const [collectedVectors, setCollectedVectors] = useState<number[][]>([]);
  const [hasVoiceId, setHasVoiceId] = useState(false);

  useEffect(() => {
    const checkVoiceId = async () => {
      const active = await hasVoiceProfile();
      setHasVoiceId(active);
    };
    checkVoiceId();
  }, []);

  // Voice selection states
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  const [femaleVoices, setFemaleVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = async () => {
      try {
        await Tts.getInitStatus();
        const saved = await AsyncStorage.getItem('@anya_selected_voice');
        setSelectedVoiceId(saved);
        
        const voices = await Tts.voices();
        console.log('[Settings] Loaded raw TTS voices:', voices.length);
        
        let filtered = voices.filter(v =>
          v.language?.toLowerCase().startsWith('en') ||
          v.language?.toLowerCase().startsWith('hi') ||
          v.id.toLowerCase().includes('female') ||
          v.id.toLowerCase().includes('network') ||
          (v as any).gender === 'female'
        );
        
        if (filtered.length === 0) {
          filtered = voices; // fail-safe fallback
        }
        
        setFemaleVoices(filtered);
      } catch (e) {
        console.warn('[Settings] Error loading TTS voices:', e);
      }
    };
    loadVoices();
  }, []);

  const handleSelectVoice = async (voiceId: string) => {
    try {
      setSelectedVoiceId(voiceId);
      await AsyncStorage.setItem('@anya_selected_voice', voiceId);
      await Tts.setDefaultVoice(voiceId);
      Tts.stop();
      // Instantly speak a beautiful customized audio preview so Pawan can hear it!
      Tts.speak("Hello Pawan, this is your new voice for Anya.");
    } catch (e) {
      console.error('[Settings] Error setting default voice:', e);
    }
  };

  const previewVoiceDirectly = async (voiceId: string) => {
    try {
      Tts.stop();
      await Tts.setDefaultVoice(voiceId);
      Tts.speak("Testing Anya voice profile.");
      // Restore selected default voice after test if needed, or set it as selected
      if (selectedVoiceId) {
        setTimeout(async () => {
          await Tts.setDefaultVoice(selectedVoiceId);
        }, 3000);
      }
    } catch (e) {
      console.warn('[Settings] Error previewing voice:', e);
    }
  };

  const startVoiceCalibration = () => {
    setVoiceIdStep(1);
    setCollectedVectors([]);
    setVoiceIdRecording(false);
    setIsVoiceIdModalVisible(true);
  };

  const handleStepRecord = async () => {
    if (voiceIdRecording) {
      // STOP RECORDING
      setVoiceIdRecording(false);
      try {
        const filePath = await stopRecording();
        const vector = await extractVoicePrint(filePath);
        const newVectors = [...collectedVectors, vector];
        setCollectedVectors(newVectors);

        if (voiceIdStep < 3) {
          setVoiceIdStep(voiceIdStep + 1);
        } else {
          // STEP 3 COMPLETED: AVERAGE AND SAVE PROFILE
          setIsVoiceIdModalVisible(false);
          
          // Average the 3 26-dim vectors element-by-element
          const masterVector = Array(26).fill(0).map((_, i) => {
            return (newVectors[0][i] + newVectors[1][i] + newVectors[2][i]) / 3;
          });

          // Normalize the averaged master vector
          const magnitude = Math.sqrt(masterVector.reduce((sum, val) => sum + val * val, 0));
          const normalizedMaster = magnitude > 0 ? masterVector.map(val => val / magnitude) : masterVector;

          const saved = await saveVoiceProfile(normalizedMaster);
          if (saved) {
            setHasVoiceId(true);
            Alert.alert('Success 🎉', 'Anya Voice ID successfully calibrated and stored securely! Biometric verification is now active.');
          } else {
            Alert.alert('Error', 'Failed to store voice profile.');
          }
        }
      } catch (error) {
        console.error('Error in voice training step:', error);
        Alert.alert('Error', 'An error occurred during calibration. Please try again.');
      }
    } else {
      // START RECORDING
      try {
        setVoiceIdRecording(true);
        await startRecording();
      } catch (error) {
        setVoiceIdRecording(false);
        console.error('Failed to start recording:', error);
        Alert.alert('Permission/Hardware Error', 'Make sure microphone permission is granted.');
      }
    }
  };

  const handleDeleteVoiceId = async () => {
    Alert.alert(
      'Delete Voice ID?',
      'Are you sure you want to remove your secure Voice Biometric signature? This will disable hands-free security verification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const cleared = await clearVoiceProfile();
            if (cleared) {
              setHasVoiceId(false);
              Alert.alert('Deleted', 'Voice ID signature successfully removed.');
            }
          },
        },
      ]
    );
  };

  const isDark = theme === 'dark';

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [cronEnabled, setCronEnabled] = useState(true);

  // User Profile State
  const [userProfile, setUserProfile] = useState<any>(null);

  // Dynamic life engine context insights
  const [lifeContext, setLifeContext] = useState<any>(null);
  const [isSyncingInsights, setIsSyncingInsights] = useState(false);

  // ── Sweet Loader ────────────────────────────────────────────────────────
  const [loaderLabel, setLoaderLabel] = useState<string | null>(null);
  const showLoader = (label: string) => setLoaderLabel(label);
  const hideLoader = () => setLoaderLabel(null);

  // ── Pull-to-Refresh ─────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    UserAPI.getProfile()
      .then(json => {
        if (json.success && json.data) {
          const profile = json.data;
          setUserProfile(profile);
          setEditName(profile.name || '');
          setEditEmail(profile.email || '');
          setEditContact(profile.contact || '');
          setEditGithubUrl(profile.github_url || '');
          setEditLinkedinUrl(profile.linkedin_url || '');
          setEditLocation(profile.location || '');
          setEditTimezone(profile.timezone || '');
          setEditAvailability(profile.availability || '');
          setEditStreak(String(profile.streak || 0));
          setEditLongestStreak(String(profile.longest_streak || 0));
          setCurrentMood(profile.current_mood || 4);
          setEditEduDegree(profile.edu_degree || '');
          setEditEduUniversity(profile.edu_university || '');
          setEditEduYear(profile.edu_year || '');
          setEditEduCgpa(profile.edu_cgpa ? String(profile.edu_cgpa) : '');
          setEditRateMin(profile.rate_min ? String(profile.rate_min) : '');
          setEditRateMax(profile.rate_max ? String(profile.rate_max) : '');
          setEditRateCurrency(profile.rate_currency || 'USD');
          if (profile.skills) setSkillsList(profile.skills);
          if (profile.work_types) setWorkTypesList(profile.work_types);
          // Load avatar from real DB column
          if (profile.avatar_url) {
            setAvatarUrl(profile.avatar_url);
            setCustomAvatarUrl(profile.avatar_url);
          }
          if (profile.preferences) {
            setPreferences(profile.preferences);
            if (profile.preferences.life_context) setLifeContext(profile.preferences.life_context);
            if (profile.preferences.current_ctc) setEditCurrentCtc(String(profile.preferences.current_ctc));
            if (profile.preferences.expected_ctc) setEditExpectedCtc(String(profile.preferences.expected_ctc));
            if (profile.preferences.alert_timing) {
              setAlertTiming(Number(profile.preferences.alert_timing));
            } else if (profile.preferences.notifications?.alert_timing) {
              setAlertTiming(Number(profile.preferences.notifications.alert_timing));
            }
            if (profile.preferences.maxNudgesPerDay) {
              setMaxNudgesPerDay(Number(profile.preferences.maxNudgesPerDay));
            } else if (profile.preferences.notifications?.maxNudgesPerDay) {
              setMaxNudgesPerDay(Number(profile.preferences.notifications.maxNudgesPerDay));
            }
            if (profile.preferences.preferredLocations) setPreferredLocationsList(profile.preferences.preferredLocations);
          }
        }
      })
      .catch(err => console.error('[Refresh] Error refreshing profile:', err))
      .finally(() => setIsRefreshing(false));
  }, []);

  // Custom interactive editing states
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeEditField, setActiveEditField] = useState<string | null>(null);
  const [isResumeModalVisible, setIsResumeModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Profile Picture Upload and Option States
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isAvatarModalVisible, setIsAvatarModalVisible] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  // Profile edit input values (including new whitelisted schema fields)
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editGithubUrl, setEditGithubUrl] = useState('');
  const [editLinkedinUrl, setEditLinkedinUrl] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTimezone, setEditTimezone] = useState('');
  const [editAvailability, setEditAvailability] = useState('');

  const [editStreak, setEditStreak] = useState('0');
  const [editLongestStreak, setEditLongestStreak] = useState('0');
  const [currentMood, setCurrentMood] = useState<number>(4);

  // Education fields
  const [editEduDegree, setEditEduDegree] = useState('');
  const [editEduUniversity, setEditEduUniversity] = useState('');
  const [editEduYear, setEditEduYear] = useState('');
  const [editEduCgpa, setEditEduCgpa] = useState('');

  // Rates fields
  const [editRateMin, setEditRateMin] = useState('');
  const [editRateMax, setEditRateMax] = useState('');
  const [editRateCurrency, setEditRateCurrency] = useState('');
  const [editCurrentCtc, setEditCurrentCtc] = useState('');
  const [editExpectedCtc, setEditExpectedCtc] = useState('');

  // Interactive Skills, Work Types & Preferences States
  const [skillsList, setSkillsList] = useState<any[]>([]);
  const [workTypesList, setWorkTypesList] = useState<string[]>([]);
  const [newSkillCategory, setNewSkillCategory] = useState('');
  const [newSkillName, setNewSkillName] = useState('');

  // Preferences
  const [preferences, setPreferences] = useState<any>({});
  const [alertTiming, setAlertTiming] = useState(10);
  const [maxNudgesPerDay, setMaxNudgesPerDay] = useState(5);
  const [preferredLocationsList, setPreferredLocationsList] = useState<
    string[]
  >([]);
  const [newPreferredLocation, setNewPreferredLocation] = useState('');

  // Structured Resume state
  const [resumeSummary, setResumeSummary] = useState('');
  const [resumeExperiences, setResumeExperiences] = useState<any[]>([]);
  const [resumeProjects, setResumeProjects] = useState<any[]>([]);

  // Section inputs
  const [expCompany, setExpCompany] = useState('');
  const [expRole, setExpRole] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expDesc, setExpDesc] = useState('');

  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projUrl, setProjUrl] = useState('');

  const [isFormatting, setIsFormatting] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [selectedSimulatedFile, setSelectedSimulatedFile] =
    useState('Pawan_Bisht_CV.pdf');
  const [uploadedResumeUrl, setUploadedResumeUrl] = useState('');

  const fetchProfile = (silent = false) => {
    if (!silent) showLoader('Loading Profile…');
    UserAPI.getProfile()
      .then(json => {
        if (json.success && json.data) {
          const profile = json.data;
          setUserProfile(profile);

          setEditName(profile.name || '');
          setEditEmail(profile.email || '');
          setEditContact(profile.contact || '');
          setEditGithubUrl(profile.github_url || '');
          setEditLinkedinUrl(profile.linkedin_url || '');
          setEditLocation(profile.location || '');
          setEditTimezone(profile.timezone || '');
          setEditAvailability(profile.availability || '');

          setEditStreak(String(profile.streak || 0));
          setEditLongestStreak(String(profile.longest_streak || 0));
          setCurrentMood(profile.current_mood || 4);

          setEditEduDegree(profile.edu_degree || '');
          setEditEduUniversity(profile.edu_university || '');
          setEditEduYear(profile.edu_year || '');
          setEditEduCgpa(profile.edu_cgpa ? String(profile.edu_cgpa) : '');

          setEditRateMin(profile.rate_min ? String(profile.rate_min) : '');
          setEditRateMax(profile.rate_max ? String(profile.rate_max) : '');
          setEditRateCurrency(profile.rate_currency || 'USD');

          if (profile.skills) {
            setSkillsList(profile.skills);
          }
          if (profile.work_types) {
            setWorkTypesList(profile.work_types);
          }
          // Load avatar from real DB column
          if (profile.avatar_url) {
            setAvatarUrl(profile.avatar_url);
            setCustomAvatarUrl(profile.avatar_url);
          }
          if (profile.preferences) {
            setPreferences(profile.preferences);
            if (profile.preferences.life_context) {
              setLifeContext(profile.preferences.life_context);
            }
            if (profile.preferences.current_ctc) {
              setEditCurrentCtc(String(profile.preferences.current_ctc));
            }
            if (profile.preferences.expected_ctc) {
              setEditExpectedCtc(String(profile.preferences.expected_ctc));
            }
            if (profile.preferences.alert_timing) {
              setAlertTiming(Number(profile.preferences.alert_timing));
            } else if (profile.preferences.notifications?.alert_timing) {
              setAlertTiming(Number(profile.preferences.notifications.alert_timing));
            }
            if (profile.preferences.maxNudgesPerDay) {
              setMaxNudgesPerDay(Number(profile.preferences.maxNudgesPerDay));
            } else if (profile.preferences.notifications?.maxNudgesPerDay) {
              setMaxNudgesPerDay(Number(profile.preferences.notifications.maxNudgesPerDay));
            }
            if (profile.preferences.preferredLocations) {
              setPreferredLocationsList(profile.preferences.preferredLocations);
            }
            if (profile.preferences.resume) {
              setUploadedResumeUrl(profile.preferences.resume.url || '');
              setResumeText(profile.preferences.resume.raw_text || '');
              setSelectedSimulatedFile(
                profile.preferences.resume.fileName || 'Pawan_Bisht_CV.pdf',
              );
              if (profile.preferences.resume.summary) {
                setResumeSummary(profile.preferences.resume.summary);
              }
              if (profile.preferences.resume.experiences) {
                setResumeExperiences(profile.preferences.resume.experiences);
              }
              if (profile.preferences.resume.projects) {
                setResumeProjects(profile.preferences.resume.projects);
              }
            }
          }
        }
      })
      .catch(err => console.error('Error fetching user profile:', err))
      .finally(() => { if (!silent) hideLoader(); });
  };

  const handleSaveAvatar = async (url: string) => {
    if (!url) {
      Alert.alert('Error', 'Please select or provide a valid profile picture URL!');
      return;
    }

    showLoader('Saving Picture…');
    try {
      // 1. Cache locally for fast display on next launch
      await AsyncStorage.setItem('@focus_avatar_url', url);
      setAvatarUrl(url);
      setCustomAvatarUrl(url);

      // 2. Save to the real avatar_url column in the users table
      const res = await UserAPI.updateProfile({ avatar_url: url });
      if (res.success) {
        setUserProfile((prev: any) => ({ ...prev, avatar_url: url }));
        Alert.alert('Success', 'Profile picture successfully updated!');
      } else {
        console.warn('[Avatar Update] Sync to server returned failure:', res);
      }
    } catch (e) {
      console.error('[Avatar Update] Error saving picture:', e);
      Alert.alert('Saved Locally', 'Saved locally, offline synchronization will sync on next launch.');
    } finally {
      hideLoader();
      setIsAvatarModalVisible(false);
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission Required',
          message: 'AnyaAI needs storage permissions to open your photo gallery.',
          buttonNeutral: 'Ask Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('[Gallery] Storage permission denied or legacy API; trying to proceed anyway...');
      }

      launchImageLibrary(
        {
          mediaType: 'photo',
          quality: 0.8,
          maxWidth: 600,
          maxHeight: 600,
        },
        (response: any) => {
          if (response.didCancel) {
            console.log('[Gallery] User cancelled picker');
          } else if (response.errorCode) {
            console.warn('[Gallery Error]', response.errorMessage);
            Alert.alert('Error', response.errorMessage || 'Failed to open gallery. Make sure you have run "npm run android" to install native components!');
          } else if (response.assets && response.assets.length > 0) {
            const uri = response.assets[0].uri;
            if (uri) {
              handleSaveAvatar(uri);
            }
          }
        }
      );
    } catch (e: any) {
      console.error('[Gallery Error]', e);
      Alert.alert('Error', 'Failed to launch gallery: ' + e.message);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const cameraGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'AnyaAI needs camera access to take a profile picture.',
          buttonNeutral: 'Ask Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );
      
      if (cameraGranted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
        return;
      }

      launchCamera(
        {
          mediaType: 'photo',
          quality: 0.8,
          maxWidth: 600,
          maxHeight: 600,
          saveToPhotos: true,
        },
        (response: any) => {
          if (response.didCancel) {
            console.log('[Camera] User cancelled camera');
          } else if (response.errorCode) {
            console.warn('[Camera Error]', response.errorMessage);
            Alert.alert('Error', response.errorMessage || 'Failed to open camera. Make sure you have run "npm run android" to install native components!');
          } else if (response.assets && response.assets.length > 0) {
            const uri = response.assets[0].uri;
            if (uri) {
              handleSaveAvatar(uri);
            }
          }
        }
      );
    } catch (e: any) {
      console.error('[Camera Error]', e);
      Alert.alert('Error', 'Failed to launch camera: ' + e.message);
    }
  };

  const handleTestPushNotification = async () => {
    showLoader('Firing nudge…');
    try {
      await fetch(`${CONFIG.API_BASE_URL}/debug/fire-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom',
          title: 'Anya Live Nudge 🔔',
          body: 'Pawan! Take a deep breath. Focus on your studies and get closer to your career goals today! 🚀'
        })
      });
      // No in-app dialog — the real push notification will arrive in the system tray
    } catch (err: any) {
      console.error('[Test Nudge] Error:', err.message);
    } finally {
      hideLoader();
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('@focus_avatar_url').then(val => {
      if (val) {
        setAvatarUrl(val);
        setCustomAvatarUrl(val);
      }
    });
    fetchProfile();
  }, []);

  // Save specific inline field on blur or submit
  const handleInlineSave = (fieldKey: string) => {
    if (fieldKey === 'name' && !editName.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty.');
      setEditName(userProfile?.name || '');
      setActiveEditField(null);
      return;
    }

    const updatedProfileFields = {
      name: editName.trim(),
      email: editEmail.trim(),
      contact: editContact.trim(),
      github_url: editGithubUrl.trim(),
      linkedin_url: editLinkedinUrl.trim(),
      location: editLocation.trim(),
      timezone: editTimezone.trim(),
      availability: editAvailability.trim(),
      streak: editStreak ? parseInt(editStreak, 10) : 0,
      longest_streak: editLongestStreak ? parseInt(editLongestStreak, 10) : 0,
      current_mood: currentMood,
      edu_degree: editEduDegree.trim(),
      edu_university: editEduUniversity.trim(),
      edu_year: editEduYear.trim(),
      edu_cgpa: editEduCgpa ? parseFloat(editEduCgpa) : null,
      rate_min: editRateMin ? parseFloat(editRateMin) : null,
      rate_max: editRateMax ? parseFloat(editRateMax) : null,
      rate_currency: editRateCurrency.trim(),
    };

    showLoader('Saving…');
    UserAPI.updateProfile(updatedProfileFields)
      .then(json => {
        if (json.success) {
          setUserProfile({ ...userProfile, ...updatedProfileFields });
          setActiveEditField(null);
        } else {
          Alert.alert('Save Error', json.error || 'Failed to save value.');
        }
      })
      .catch(err => {
        console.error('Error saving inline:', err);
        setActiveEditField(null);
      })
      .finally(hideLoader);
  };

  // Direct Mood update handler
  const handleMoodSelect = (moodVal: number) => {
    setCurrentMood(moodVal);

    // Instantly save to db
    UserAPI.updateProfile({ current_mood: moodVal })
      .then(json => {
        if (json.success) {
          setUserProfile((prev: any) => ({ ...prev, current_mood: moodVal }));
          console.log('Mood updated successfully inside backend database!');
        }
      })
      .catch(err => console.error('Error updating mood:', err));
  };

  // Sync Preferred Locations to Backend
  const handleAddPreferredLocation = () => {
    if (!newPreferredLocation.trim()) return;
    const newList = [...preferredLocationsList, newPreferredLocation.trim()];
    savePreferredLocations(newList, 'Adding Location…');
  };

  const handleDeletePreferredLocation = (index: number) => {
    const newList = preferredLocationsList.filter((_, i) => i !== index);
    savePreferredLocations(newList, 'Removing Location…');
  };

  const savePreferredLocations = (list: string[], loaderMsg = 'Syncing…') => {
    showLoader(loaderMsg);
    const updatedPrefs = { ...preferences, preferredLocations: list };
    UserAPI.updatePreferences(updatedPrefs)
      .then(json => {
        if (json.success) {
          setPreferredLocationsList(list);
          setPreferences(updatedPrefs);
          setNewPreferredLocation('');
        }
      })
      .catch(err => console.error('Error saving locations:', err))
      .finally(hideLoader);
  };

  const handleSaveMaxNudges = () => {
    showLoader('Saving Nudge Limit…');
    const updatedPrefs = {
      ...preferences,
      maxNudgesPerDay,
      notifications: {
        ...(preferences.notifications || {}),
        maxNudgesPerDay
      }
    };
    UserAPI.updatePreferences(updatedPrefs)
      .then(json => {
        if (json.success) {
          setPreferences(updatedPrefs);
          setActiveEditField(null);
        }
      })
      .catch(err => console.error('Error saving max nudges:', err))
      .finally(hideLoader);
  };

  const handleSaveCtc = (type: 'current' | 'expected', value: string) => {
    showLoader('Saving CTC…');
    const updatedPrefs = {
      ...preferences,
      [type === 'current' ? 'current_ctc' : 'expected_ctc']: value,
    };
    UserAPI.updatePreferences(updatedPrefs)
      .then(json => {
        if (json.success) {
          setPreferences(updatedPrefs);
          setActiveEditField(null);
        }
      })
      .catch(err => console.error('Error saving CTC:', err))
      .finally(hideLoader);
  };

  // Work Types replacement
  const handleToggleWorkType = (type: string) => {
    const normalized = type.toLowerCase().trim();
    let newList;
    if (workTypesList.includes(normalized)) {
      newList = workTypesList.filter(t => t !== normalized);
    } else {
      newList = [...workTypesList, normalized];
    }

    showLoader('Updating Work Types…');
    UserAPI.replaceWorkTypes(newList)
      .then(json => {
        if (json.success && json.data) {
          setWorkTypesList(json.data);
        } else {
          Alert.alert('Save Error', 'Failed to update work types.');
        }
      })
      .catch(err => console.error('Error toggling work types:', err))
      .finally(hideLoader);
  };

  // Compiles all visual fields into standard beautifully aligned Markdown
  const compileMarkdownResume = () => {
    let md = `# ${editName || 'Pawan Bisht'}\n`;
    md += `Email: ${editEmail || 'bpawan277@gmail.com'} | Contact: ${editContact || '9068509220'
      }\n`;
    md += `GitHub: ${editGithubUrl || 'github.com/277pawan'} | LinkedIn: ${editLinkedinUrl || 'linkedin.com'
      }\n\n`;

    md += `## Professional Summary\n${resumeSummary}\n\n`;

    md += `## Work Experience\n`;
    if (resumeExperiences.length === 0) {
      md += `*No work experience listed.*\n\n`;
    } else {
      resumeExperiences.forEach(exp => {
        md += `### ${exp.role} at ${exp.company} (${exp.duration})\n${exp.description}\n\n`;
      });
    }

    md += `## Projects\n`;
    if (resumeProjects.length === 0) {
      md += `*No projects listed.*\n\n`;
    } else {
      resumeProjects.forEach(proj => {
        md += `### ${proj.name} — ${proj.url || 'No URL'}\n${proj.description
          }\n\n`;
      });
    }
    return md;
  };

  // AI formatter function
  const handleAIAutoFormat = () => {
    setIsFormatting(true);
    setTimeout(() => {
      setIsFormatting(false);

      // 1. Capitalize first letter of every summary sentence
      let formattedSummary = resumeSummary.trim();
      if (formattedSummary) {
        formattedSummary =
          formattedSummary.charAt(0).toUpperCase() + formattedSummary.slice(1);
      }
      setResumeSummary(formattedSummary);

      // 2. Format experiences: capitalize company/role, ensure desc starts with bullet
      const formattedExps = resumeExperiences.map(exp => {
        let desc = exp.description.trim();
        if (desc && !desc.startsWith('•') && !desc.startsWith('-')) {
          desc = '• ' + desc;
        }
        return {
          ...exp,
          company: exp.company
            .trim()
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
          role: exp.role
            .trim()
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: desc,
        };
      });
      setResumeExperiences(formattedExps);

      // 3. Format projects: capitalize name
      const formattedProjs = resumeProjects.map(proj => {
        let desc = proj.description.trim();
        if (desc && !desc.startsWith('•') && !desc.startsWith('-')) {
          desc = '• ' + desc;
        }
        return {
          ...proj,
          name: proj.name
            .trim()
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: desc,
        };
      });
      setResumeProjects(formattedProjs);

      Alert.alert(
        'AI Formatter Success',
        'Anya has polished your summary text, capitalized headers, and aligned bullet lists successfully!',
      );
    }, 1500);
  };

  // Cloudinary Signed Upload Integration
  const handleCloudinaryResumeUpload = async () => {
    const compiledText = compileMarkdownResume();
    if (
      !resumeSummary.trim() &&
      resumeExperiences.length === 0 &&
      resumeProjects.length === 0
    ) {
      Alert.alert(
        'Validation Error',
        'Please complete at least one section before uploading.',
      );
      return;
    }

    setIsUploading(true);
    try {
      const cloudName = 'dc30b7tnj';
      const apiKey = '476665488391659';
      const apiSecret = 'd0udX-BDyMyITJDFCBkhvrRKpEM';
      const timestamp = Math.floor(Date.now() / 1000);

      const signatureString = `timestamp=${timestamp}${apiSecret}`;
      const signature = sha1(signatureString);

      const base64Content = base64Encode(compiledText);
      const dataUri = `data:text/plain;base64,${base64Content}`;

      const formData = new FormData();
      formData.append('file', dataUri);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const result = await response.json();

      if (result.secure_url) {
        const liveUrl = result.secure_url;
        const updatedPrefs = {
          ...preferences,
          resume: {
            url: liveUrl,
            raw_text: compiledText,
            fileName: selectedSimulatedFile,
            summary: resumeSummary,
            experiences: resumeExperiences,
            projects: resumeProjects,
            uploadedAt: new Date().toISOString(),
          },
        };

        const prefResponse = await fetch(
          `${CONFIG.API_BASE_URL}/api/user/preferences`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': '89968338-6678-48e0-be01-f8472e550e1d',
            },
            body: JSON.stringify(updatedPrefs),
          },
        );

        const prefJson = await prefResponse.json();

        if (prefJson.success) {
          setUploadedResumeUrl(liveUrl);
          setPreferences(updatedPrefs);
          setResumeText(compiledText);
          setIsResumeModalVisible(false);
          Alert.alert(
            'Success',
            'Resume formatted by AI and uploaded to Cloudinary successfully!',
          );
        } else {
          Alert.alert(
            'Save Error',
            'Failed to save resume link inside preferences.',
          );
        }
      } else {
        Alert.alert(
          'Upload Failed',
          result.error?.message || 'Failed uploading to Cloudinary.',
        );
      }
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      Alert.alert(
        'System Error',
        error.message || 'An error occurred during Cloudinary upload.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSkill = () => {
    if (!newSkillCategory.trim() || !newSkillName.trim()) {
      Alert.alert(
        'Validation Error',
        'Both Category and Skill Name are required.',
      );
      return;
    }

    const updatedSkills = [
      ...skillsList,
      { category: newSkillCategory.trim(), name: newSkillName.trim() },
    ];

    showLoader('Adding Skill…');
    UserAPI.replaceSkills(updatedSkills)
      .then(json => {
        if (json.success) {
          setSkillsList(updatedSkills);
          setNewSkillCategory('');
          setNewSkillName('');
        } else {
          Alert.alert('Error', json.error || 'Failed to add skill.');
        }
      })
      .catch(err => console.error('Error adding skill:', err))
      .finally(hideLoader);
  };

  const handleDeleteSkill = (index: number) => {
    showLoader('Removing Skill…');
    const updatedSkills = skillsList.filter((_, i) => i !== index);

    UserAPI.replaceSkills(updatedSkills)
      .then(json => {
        if (json.success) {
          setSkillsList(updatedSkills);
        } else {
          Alert.alert('Error', json.error || 'Failed to delete skill.');
        }
      })
      .catch(err => console.error('Error deleting skill:', err))
      .finally(hideLoader);
  };

  const handleTogglePreference = (key: string) => {
    const updatedPrefs = { ...preferences, [key]: !preferences[key] };

    UserAPI.updatePreferences(updatedPrefs)
      .then(json => {
        if (json.success) {
          setPreferences(updatedPrefs);
        } else {
          Alert.alert('Error', 'Failed to update preferences.');
        }
      })
      .catch(err => console.error('Error updating preferences:', err));
  };

  const handleSelectAlertTiming = () => {
    Alert.alert(
      'Alert Timing',
      'Select how many minutes before a meeting you want to receive proactive nudges:',
      [
        { text: '5 Minutes', onPress: () => handleSaveAlertTiming(5) },
        { text: '10 Minutes', onPress: () => handleSaveAlertTiming(10) },
        { text: '15 Minutes', onPress: () => handleSaveAlertTiming(15) },
        { text: '30 Minutes', onPress: () => handleSaveAlertTiming(30) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleSaveAlertTiming = (minutes: number) => {
    showLoader(`Setting Alert to ${minutes} min…`);
    const updatedPrefs = {
      ...preferences,
      alert_timing: minutes,
      notifications: {
        ...(preferences.notifications || {}),
        alert_timing: minutes
      }
    };

    UserAPI.updatePreferences(updatedPrefs)
      .then(json => {
        if (json.success) {
          setAlertTiming(minutes);
          setPreferences(updatedPrefs);
          Alert.alert('Success', `Alert timing updated to ${minutes} minutes!`);
        } else {
          Alert.alert('Error', 'Failed to update alert timing.');
        }
      })
      .catch(err => console.error('Error updating alert timing:', err))
      .finally(hideLoader);
  };

  const handleSyncInsights = () => {
      setIsSyncingInsights(true);
      showLoader('Syncing AI Insights…');
      LifeEngineAPI.cleanupAndInsights()
        .then(json => {
          setIsSyncingInsights(false);
          if (json.success) {
            if (json.insights) {
              setLifeContext(json.insights);
              Alert.alert(
                'AI Struggles & Insights Synced',
                'Anya has analyzed your recent conversations and updated her understanding of your struggles, focus goals, and emotional state.',
              );
            } else {
              Alert.alert(
                'Insights Synced',
                'Successfully triggered cleanup. Not enough recent conversations to build a detailed personal struggle profile yet. Keep chatting with Anya!',
              );
              setLifeContext(null);
            }
            fetchProfile(true);
          } else {
            Alert.alert('Sync Error', json.error || 'Failed to sync insights.');
          }
        })
        .catch(err => {
          setIsSyncingInsights(false);
          console.error('Error syncing insights:', err);
          Alert.alert(
            'Connection Error',
            'Failed to reach the backend server.',
          );
        })
        .finally(hideLoader);
    };

    const bgColor = isDark ? '#050505' : '#f3f4f6';
    const cardBgColor = isDark ? '#121212' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#111827';
    const subtextColor = isDark ? '#9ca3af' : '#6b7280';
    const borderColor = isDark ? '#222222' : '#e5e7eb';
    const inputBgColor = isDark ? '#1f1f1f' : '#f9fafb';

    const moods = [
      { value: 1, icon: 'emoticon-sad-outline', label: 'Sad' },
      { value: 2, icon: 'emoticon-neutral-outline', label: 'Neutral' },
      { value: 3, icon: 'emoticon-happy-outline', label: 'Happy' },
      { value: 4, icon: 'emoticon-excited-outline', label: 'Great' },
      { value: 5, icon: 'emoticon-cool-outline', label: 'Perfect' },
    ];

    return (
      <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* ✨ Sweet Loader */}
      <SweetLoader
        visible={loaderLabel !== null}
        label={loaderLabel ?? 'Loading…'}
        isDark={isDark}
        mode="overlay"
      />

      {/* ─── Profile ScrollView ─────────────────────────────────────────────── */}
      <ScrollView
        style={[styles.container, { backgroundColor: bgColor }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#7C3AED', '#A855F7']}
            tintColor="#7C3AED"
            title="Refreshing profile…"
            titleColor={isDark ? '#A855F7' : '#7C3AED'}
          />
        }
      >

        {/* 🚀 Dashboard Edit Mode Toggle Switch Header */}
        <View style={styles.dashboardHeader}>
          <View>
            <Text style={[styles.dashboardTitle, { color: textColor }]}>
              Interactive Portfolio
            </Text>
            <Text style={[styles.dashboardSubtitle, { color: subtextColor }]}>
              {isEditMode
                ? 'Tap any field highlighted in blue to edit instantly'
                : 'View your profile details'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.dashboardEditToggleBtn,
              {
                backgroundColor: isEditMode
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'rgba(128, 128, 128, 0.08)',
              },
            ]}
            onPress={() => {
              setIsEditMode(!isEditMode);
              setActiveEditField(null);
            }}
          >
            <MaterialCommunityIcons
              name={isEditMode ? 'pencil' : 'pencil-lock-outline'}
              size={18}
              color={isEditMode ? '#3b82f6' : subtextColor}
            />
            <Text
              style={[
                styles.dashboardEditToggleText,
                { color: isEditMode ? '#3b82f6' : textColor },
              ]}
            >
              {isEditMode ? 'Edit Mode ON' : 'Lock Mode'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* User Profile Header Card */}
        <View
          style={[
            styles.profileHeaderCard,
            { backgroundColor: cardBgColor, borderColor },
          ]}
        >
          <View style={styles.profileHeaderTop}>
            <TouchableOpacity 
              onPress={() => setIsAvatarModalVisible(true)}
              style={styles.avatarContainer}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialCommunityIcons name="account" size={36} color="#fff" />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <MaterialCommunityIcons name="camera" size={10} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <View style={styles.nameStreakRow}>
                {/* 🖊️ INLINE NAME EDITING */}
                {isEditMode && activeEditField === 'name' ? (
                  <TextInput
                    style={[
                      styles.inlineInputBold,
                      {
                        color: textColor,
                        backgroundColor: inputBgColor,
                        borderColor: '#3b82f6',
                      },
                    ]}
                    value={editName}
                    onChangeText={setEditName}
                    onBlur={() => handleInlineSave('name')}
                    onSubmitEditing={() => handleInlineSave('name')}
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity
                    disabled={!isEditMode}
                    onPress={() => setActiveEditField('name')}
                    style={isEditMode ? styles.editableContainer : null}
                  >
                    <Text style={[styles.profileName, { color: textColor }]}>
                      {userProfile?.name || 'Pawan Bisht'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 🖊️ INLINE STREAK EDITING */}
                {isEditMode && activeEditField === 'streak' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>🔥</Text>
                    <TextInput
                      style={[
                        styles.inlineInputCompact,
                        {
                          color: textColor,
                          backgroundColor: inputBgColor,
                          borderColor: '#3b82f6',
                          width: 40,
                        },
                      ]}
                      value={editStreak}
                      onChangeText={setEditStreak}
                      onBlur={() => handleInlineSave('streak')}
                      onSubmitEditing={() => handleInlineSave('streak')}
                      autoFocus
                      keyboardType="numeric"
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    disabled={!isEditMode}
                    onPress={() => setActiveEditField('streak')}
                    style={[
                      styles.streakBadge,
                      isEditMode ? styles.editableContainer : null,
                    ]}
                  >
                    <Text style={styles.streakText}>
                      🔥 {userProfile?.streak || 0}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 🖊️ INLINE LONGEST STREAK EDITING */}
                {isEditMode && activeEditField === 'longest_streak' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: subtextColor }}>
                      Max:
                    </Text>
                    <TextInput
                      style={[
                        styles.inlineInputCompact,
                        {
                          color: textColor,
                          backgroundColor: inputBgColor,
                          borderColor: '#3b82f6',
                          width: 40,
                        },
                      ]}
                      value={editLongestStreak}
                      onChangeText={setEditLongestStreak}
                      onBlur={() => handleInlineSave('longest_streak')}
                      onSubmitEditing={() => handleInlineSave('longest_streak')}
                      autoFocus
                      keyboardType="numeric"
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    disabled={!isEditMode}
                    onPress={() => setActiveEditField('longest_streak')}
                    style={[
                      styles.longestStreakBadge,
                      isEditMode ? styles.editableContainer : null,
                    ]}
                  >
                    <Text style={styles.longestStreakText}>
                      🏆 Max: {userProfile?.longest_streak || 0}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 🖊️ INLINE EMAIL EDITING */}
              {isEditMode && activeEditField === 'email' ? (
                <TextInput
                  style={[
                    styles.inlineInputCompact,
                    {
                      color: textColor,
                      backgroundColor: inputBgColor,
                      borderColor: '#3b82f6',
                      width: 200,
                    },
                  ]}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  onBlur={() => handleInlineSave('email')}
                  onSubmitEditing={() => handleInlineSave('email')}
                  autoFocus
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <TouchableOpacity
                  disabled={!isEditMode}
                  onPress={() => setActiveEditField('email')}
                  style={isEditMode ? styles.editableContainer : null}
                >
                  <Text style={[styles.profileEmail, { color: subtextColor }]}>
                    {userProfile?.email || 'bpawan277@gmail.com'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 🖊️ INLINE CONTACT PHONE EDITING */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 4,
                  gap: 4,
                }}
              >
                <MaterialCommunityIcons
                  name="phone"
                  size={13}
                  color={subtextColor}
                />
                {isEditMode && activeEditField === 'contact' ? (
                  <TextInput
                    style={[
                      styles.inlineInputCompact,
                      {
                        color: textColor,
                        backgroundColor: inputBgColor,
                        borderColor: '#3b82f6',
                        width: 140,
                      },
                    ]}
                    value={editContact}
                    onChangeText={setEditContact}
                    onBlur={() => handleInlineSave('contact')}
                    onSubmitEditing={() => handleInlineSave('contact')}
                    autoFocus
                    keyboardType="phone-pad"
                  />
                ) : (
                  <TouchableOpacity
                    disabled={!isEditMode}
                    onPress={() => setActiveEditField('contact')}
                    style={isEditMode ? styles.editableContainer : null}
                  >
                    <Text
                      style={[styles.profileEmail, { color: subtextColor }]}
                    >
                      {userProfile?.contact || '9068509220'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Location, Timezone & Availability row */}
          <View style={[styles.headerInfoRow, { borderTopColor: borderColor }]}>
            {/* 🖊️ INLINE LOCATION EDITING */}
            {isEditMode && activeEditField === 'location' ? (
              <TextInput
                style={[
                  styles.inlineInputCompact,
                  {
                    color: textColor,
                    backgroundColor: inputBgColor,
                    borderColor: '#3b82f6',
                    width: 100,
                  },
                ]}
                value={editLocation}
                onChangeText={setEditLocation}
                onBlur={() => handleInlineSave('location')}
                onSubmitEditing={() => handleInlineSave('location')}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                disabled={!isEditMode}
                onPress={() => setActiveEditField('location')}
                style={[
                  styles.infoCol,
                  isEditMode ? styles.editableContainer : null,
                ]}
              >
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={14}
                  color={subtextColor}
                />
                <Text style={[styles.infoText, { color: textColor }]}>
                  {userProfile?.location || 'India'}
                </Text>
              </TouchableOpacity>
            )}

            {/* 🖊️ INLINE TIMEZONE EDITING */}
            {isEditMode && activeEditField === 'timezone' ? (
              <TextInput
                style={[
                  styles.inlineInputCompact,
                  {
                    color: textColor,
                    backgroundColor: inputBgColor,
                    borderColor: '#3b82f6',
                    width: 110,
                  },
                ]}
                value={editTimezone}
                onChangeText={setEditTimezone}
                onBlur={() => handleInlineSave('timezone')}
                onSubmitEditing={() => handleInlineSave('timezone')}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                disabled={!isEditMode}
                onPress={() => setActiveEditField('timezone')}
                style={[
                  styles.infoCol,
                  isEditMode ? styles.editableContainer : null,
                ]}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={subtextColor}
                />
                <Text style={[styles.infoText, { color: textColor }]}>
                  {userProfile?.timezone || 'Asia/Kolkata'}
                </Text>
              </TouchableOpacity>
            )}

            {/* 🖊️ INLINE AVAILABILITY EDITING */}
            {isEditMode && activeEditField === 'availability' ? (
              <TextInput
                style={[
                  styles.inlineInputCompact,
                  {
                    color: textColor,
                    backgroundColor: inputBgColor,
                    borderColor: '#3b82f6',
                    width: 140,
                  },
                ]}
                value={editAvailability}
                onChangeText={setEditAvailability}
                onBlur={() => handleInlineSave('availability')}
                onSubmitEditing={() => handleInlineSave('availability')}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                disabled={!isEditMode}
                onPress={() => setActiveEditField('availability')}
                style={isEditMode ? styles.editableContainer : null}
              >
                <View style={styles.availabilityPill}>
                  <Text style={styles.availabilityText}>
                    {userProfile?.availability || 'Open to opportunities'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Education Highlight (Direct Inline Editable) */}
          <View
            style={[styles.eduHighlightRow, { borderTopColor: borderColor }]}
          >
            <MaterialCommunityIcons
              name="school-outline"
              size={18}
              color="#10b981"
            />
            <View style={styles.eduHighlightInfo}>
              {/* 🖊️ INLINE DEGREE EDITING */}
              {isEditMode && activeEditField === 'edu_degree' ? (
                <TextInput
                  style={[
                    styles.inlineInputCompact,
                    {
                      color: textColor,
                      backgroundColor: inputBgColor,
                      borderColor: '#3b82f6',
                      marginVertical: 2,
                    },
                  ]}
                  value={editEduDegree}
                  onChangeText={setEditEduDegree}
                  onBlur={() => handleInlineSave('edu_degree')}
                  onSubmitEditing={() => handleInlineSave('edu_degree')}
                  autoFocus
                />
              ) : (
                <TouchableOpacity
                  disabled={!isEditMode}
                  onPress={() => setActiveEditField('edu_degree')}
                  style={isEditMode ? styles.editableContainer : null}
                >
                  <Text style={[styles.eduDegreeText, { color: textColor }]}>
                    {userProfile?.edu_degree || 'B.Tech in CSE'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 🖊️ INLINE UNIVERSITY / CGPA ROW EDITING */}
              <View style={styles.eduSubRow}>
                {isEditMode && activeEditField === 'edu_university' ? (
                  <TextInput
                    style={[
                      styles.inlineInputCompact,
                      {
                        color: textColor,
                        backgroundColor: inputBgColor,
                        borderColor: '#3b82f6',
                        width: 130,
                      },
                    ]}
                    value={editEduUniversity}
                    onChangeText={setEditEduUniversity}
                    onBlur={() => handleInlineSave('edu_university')}
                    onSubmitEditing={() => handleInlineSave('edu_university')}
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity
                    disabled={!isEditMode}
                    onPress={() => setActiveEditField('edu_university')}
                    style={isEditMode ? styles.editableContainer : null}
                  >
                    <Text
                      style={[
                        styles.eduUniversityText,
                        { color: subtextColor },
                      ]}
                    >
                      {userProfile?.edu_university || 'Uttaranchal University'}
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={{ color: subtextColor }}> • </Text>

                {isEditMode && activeEditField === 'edu_year' ? (
                  <TextInput
                    style={[
                      styles.inlineInputCompact,
                      {
                        color: textColor,
                        backgroundColor: inputBgColor,
                        borderColor: '#3b82f6',
                        width: 80,
                      },
                    ]}
                    value={editEduYear}
                    onChangeText={setEditEduYear}
                    onBlur={() => handleInlineSave('edu_year')}
                    onSubmitEditing={() => handleInlineSave('edu_year')}
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity
                    disabled={!isEditMode}
                    onPress={() => setActiveEditField('edu_year')}
                    style={isEditMode ? styles.editableContainer : null}
                  >
                    <Text
                      style={[
                        styles.eduUniversityText,
                        { color: subtextColor },
                      ]}
                    >
                      {userProfile?.edu_year || '2020-2024'}
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={{ color: subtextColor }}> • </Text>

                {isEditMode && activeEditField === 'edu_cgpa' ? (
                  <TextInput
                    style={[
                      styles.inlineInputCompact,
                      {
                        color: textColor,
                        backgroundColor: inputBgColor,
                        borderColor: '#3b82f6',
                        width: 45,
                      },
                    ]}
                    value={editEduCgpa}
                    onChangeText={setEditEduCgpa}
                    onBlur={() => handleInlineSave('edu_cgpa')}
                    onSubmitEditing={() => handleInlineSave('edu_cgpa')}
                    autoFocus
                    keyboardType="decimal-pad"
                  />
                ) : (
                  <TouchableOpacity
                    disabled={!isEditMode}
                    onPress={() => setActiveEditField('edu_cgpa')}
                    style={isEditMode ? styles.editableContainer : null}
                  >
                    <Text
                      style={[
                        styles.eduUniversityText,
                        { color: subtextColor },
                      ]}
                    >
                      {userProfile?.edu_cgpa || '8.7'} CGPA
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Salary Rates Info (Inline Editable) */}
          <View style={[styles.rateInfoRow, { borderTopColor: borderColor }]}>
            <MaterialCommunityIcons
              name="currency-usd"
              size={18}
              color="#3b82f6"
            />
            <View style={styles.ratesInlineContainer}>
              <Text style={[styles.rateText, { color: textColor }]}>
                Rate:{' '}
              </Text>

              {/* 🖊️ RATE CURRENCY */}
              {isEditMode && activeEditField === 'rate_currency' ? (
                <TextInput
                  style={[
                    styles.inlineInputCompact,
                    {
                      color: textColor,
                      backgroundColor: inputBgColor,
                      borderColor: '#3b82f6',
                      width: 45,
                    },
                  ]}
                  value={editRateCurrency}
                  onChangeText={setEditRateCurrency}
                  onBlur={() => handleInlineSave('rate_currency')}
                  onSubmitEditing={() => handleInlineSave('rate_currency')}
                  autoFocus
                />
              ) : (
                <TouchableOpacity
                  disabled={!isEditMode}
                  onPress={() => setActiveEditField('rate_currency')}
                  style={isEditMode ? styles.editableContainer : null}
                >
                  <Text style={[styles.boldText, { color: textColor }]}>
                    {userProfile?.rate_currency || 'USD'}{' '}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 🖊️ RATE MIN */}
              {isEditMode && activeEditField === 'rate_min' ? (
                <TextInput
                  style={[
                    styles.inlineInputCompact,
                    {
                      color: textColor,
                      backgroundColor: inputBgColor,
                      borderColor: '#3b82f6',
                      width: 50,
                    },
                  ]}
                  value={editRateMin}
                  onChangeText={setEditRateMin}
                  onBlur={() => handleInlineSave('rate_min')}
                  onSubmitEditing={() => handleInlineSave('rate_min')}
                  autoFocus
                  keyboardType="numeric"
                />
              ) : (
                <TouchableOpacity
                  disabled={!isEditMode}
                  onPress={() => setActiveEditField('rate_min')}
                  style={isEditMode ? styles.editableContainer : null}
                >
                  <Text style={[styles.boldText, { color: textColor }]}>
                    {userProfile?.rate_min || '50.00'}
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={{ color: textColor }}> - </Text>

              {/* 🖊️ RATE MAX */}
              {isEditMode && activeEditField === 'rate_max' ? (
                <TextInput
                  style={[
                    styles.inlineInputCompact,
                    {
                      color: textColor,
                      backgroundColor: inputBgColor,
                      borderColor: '#3b82f6',
                      width: 50,
                    },
                  ]}
                  value={editRateMax}
                  onChangeText={setEditRateMax}
                  onBlur={() => handleInlineSave('rate_max')}
                  onSubmitEditing={() => handleInlineSave('rate_max')}
                  autoFocus
                  keyboardType="numeric"
                />
              ) : (
                <TouchableOpacity
                  disabled={!isEditMode}
                  onPress={() => setActiveEditField('rate_max')}
                  style={isEditMode ? styles.editableContainer : null}
                >
                  <Text style={[styles.boldText, { color: textColor }]}>
                    {userProfile?.rate_max || '100.00'}
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.rateText, { color: textColor }]}> / hr</Text>
            </View>
          </View>

          <View
            style={[
              styles.headerInfoRow,
              {
                borderTopColor: borderColor,
                paddingTop: 10,
                marginTop: 10,
                paddingBottom: 0,
                borderBottomWidth: 0,
              },
            ]}
          >
            <View style={styles.iconTextRow}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={16}
                color={subtextColor}
              />
              <Text style={{ color: subtextColor, marginLeft: 6 }}>
                Current CTC:{' '}
              </Text>
              {isEditMode && activeEditField === 'current_ctc' ? (
                <TextInput
                  style={[
                    styles.inlineInputCompact,
                    {
                      color: textColor,
                      backgroundColor: inputBgColor,
                      borderColor: '#3b82f6',
                      width: 60,
                    },
                  ]}
                  value={editCurrentCtc}
                  onChangeText={setEditCurrentCtc}
                  onBlur={() => handleSaveCtc('current', editCurrentCtc)}
                  onSubmitEditing={() =>
                    handleSaveCtc('current', editCurrentCtc)
                  }
                  autoFocus
                  keyboardType="numeric"
                />
              ) : (
                <TouchableOpacity
                  disabled={!isEditMode}
                  onPress={() => setActiveEditField('current_ctc')}
                  style={isEditMode ? styles.editableContainer : null}
                >
                  <Text style={[styles.boldText, { color: textColor }]}>
                    {preferences?.current_ctc || 'N/A'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.iconTextRow, { marginLeft: 16 }]}>
              <MaterialCommunityIcons
                name="bullseye-arrow"
                size={16}
                color={subtextColor}
              />
              <Text style={{ color: subtextColor, marginLeft: 6 }}>
                Expected CTC:{' '}
              </Text>
              {isEditMode && activeEditField === 'expected_ctc' ? (
                <TextInput
                  style={[
                    styles.inlineInputCompact,
                    {
                      color: textColor,
                      backgroundColor: inputBgColor,
                      borderColor: '#3b82f6',
                      width: 60,
                    },
                  ]}
                  value={editExpectedCtc}
                  onChangeText={setEditExpectedCtc}
                  onBlur={() => handleSaveCtc('expected', editExpectedCtc)}
                  onSubmitEditing={() =>
                    handleSaveCtc('expected', editExpectedCtc)
                  }
                  autoFocus
                  keyboardType="numeric"
                />
              ) : (
                <TouchableOpacity
                  disabled={!isEditMode}
                  onPress={() => setActiveEditField('expected_ctc')}
                  style={isEditMode ? styles.editableContainer : null}
                >
                  <Text style={[styles.boldText, { color: textColor }]}>
                    {preferences?.expected_ctc || 'N/A'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Social Links (Inline Editable) */}
          <View style={styles.socialBadgesRow}>
            {/* 🖊️ INLINE GITHUB EDIT */}
            {isEditMode && activeEditField === 'github_url' ? (
              <TextInput
                style={[
                  styles.inlineInputCompact,
                  {
                    color: textColor,
                    backgroundColor: inputBgColor,
                    borderColor: '#3b82f6',
                    width: 140,
                  },
                ]}
                value={editGithubUrl}
                onChangeText={setEditGithubUrl}
                onBlur={() => handleInlineSave('github_url')}
                onSubmitEditing={() => handleInlineSave('github_url')}
                autoFocus
                keyboardType="url"
                autoCapitalize="none"
              />
            ) : (
              <TouchableOpacity
                style={[
                  styles.socialBadge,
                  { backgroundColor: isDark ? '#222' : '#f3f4f6' },
                  isEditMode ? styles.editableContainer : null,
                ]}
                onPress={() => {
                  if (isEditMode) {
                    setActiveEditField('github_url');
                  } else {
                    Alert.alert(
                      'GitHub Profile',
                      userProfile?.github_url || 'https://github.com/277pawan',
                    );
                  }
                }}
              >
                <MaterialCommunityIcons
                  name="github"
                  size={16}
                  color={textColor}
                />
                <Text style={[styles.socialText, { color: textColor }]}>
                  GitHub
                </Text>
              </TouchableOpacity>
            )}

            {/* 🖊️ INLINE LINKEDIN EDIT */}
            {isEditMode && activeEditField === 'linkedin_url' ? (
              <TextInput
                style={[
                  styles.inlineInputCompact,
                  {
                    color: textColor,
                    backgroundColor: inputBgColor,
                    borderColor: '#3b82f6',
                    width: 140,
                  },
                ]}
                value={editLinkedinUrl}
                onChangeText={setEditLinkedinUrl}
                onBlur={() => handleInlineSave('linkedin_url')}
                onSubmitEditing={() => handleInlineSave('linkedin_url')}
                autoFocus
                keyboardType="url"
                autoCapitalize="none"
              />
            ) : (
              <TouchableOpacity
                style={[
                  styles.socialBadge,
                  { backgroundColor: isDark ? '#222' : '#f3f4f6' },
                  isEditMode ? styles.editableContainer : null,
                ]}
                onPress={() => {
                  if (isEditMode) {
                    setActiveEditField('linkedin_url');
                  } else {
                    Alert.alert(
                      'LinkedIn Profile',
                      userProfile?.linkedin_url ||
                      'https://linkedin.com/in/pawan-bisht',
                    );
                  }
                }}
              >
                <MaterialCommunityIcons
                  name="linkedin"
                  size={16}
                  color="#0077b5"
                />
                <Text style={[styles.socialText, { color: textColor }]}>
                  LinkedIn
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 🖊️ INLINE MOOD SELECTOR CARD */}
          <View
            style={[styles.moodSectionRow, { borderTopColor: borderColor }]}
          >
            <Text style={[styles.moodHeaderTitle, { color: textColor }]}>
              Current Mood:{' '}
            </Text>
            <View style={styles.moodPillsRow}>
              {moods.map(m => {
                const active = currentMood === m.value;
                return (
                  <TouchableOpacity
                    key={m.value}
                    style={[
                      styles.moodPill,
                      {
                        backgroundColor: active
                          ? '#3b82f6'
                          : isDark
                            ? '#222'
                            : '#e5e7eb',
                        borderColor: active ? '#3b82f6' : borderColor,
                      },
                    ]}
                    onPress={() => handleMoodSelect(m.value)}
                  >
                    <MaterialCommunityIcons
                      name={m.icon}
                      size={16}
                      color={active ? '#fff' : textColor}
                    />
                    <Text
                      style={[
                        styles.moodPillText,
                        { color: active ? '#fff' : textColor },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 📊 Life Engine Interaction Stats Dashboard (Pradeep whitelisted columns) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Life Engine Integration Stats
          </Text>
          <View style={[styles.statsDashboardGrid]}>
            <View
              style={[
                styles.statsDashboardCard,
                { backgroundColor: cardBgColor, borderColor },
              ]}
            >
              <MaterialCommunityIcons
                name="bell-outline"
                size={24}
                color="#f59e0b"
              />
              <Text style={[styles.statsDashValue, { color: textColor }]}>
                {userProfile?.total_nudges_sent || 8}
              </Text>
              <Text style={[styles.statsDashLabel, { color: subtextColor }]}>
                Nudges Sent
              </Text>
            </View>
            <View
              style={[
                styles.statsDashboardCard,
                { backgroundColor: cardBgColor, borderColor },
              ]}
            >
              <MaterialCommunityIcons
                name="message-draw"
                size={24}
                color="#10b981"
              />
              <Text style={[styles.statsDashValue, { color: textColor }]}>
                {userProfile?.total_nudges_engaged || 4}
              </Text>
              <Text style={[styles.statsDashLabel, { color: subtextColor }]}>
                Responded
              </Text>
            </View>
            <View
              style={[
                styles.statsDashboardCard,
                { backgroundColor: cardBgColor, borderColor },
              ]}
            >
              <MaterialCommunityIcons
                name="history"
                size={24}
                color="#3b82f6"
              />
              <Text style={[styles.statsDashValue, { color: textColor }]}>
                {userProfile?.total_sessions || 14}
              </Text>
              <Text style={[styles.statsDashLabel, { color: subtextColor }]}>
                Sessions Logged
              </Text>
            </View>
          </View>
        </View>

        {/* 🖊️ INLINE WORK TYPES INTERACTIVE CHIPS */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Preferred Work Types
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBgColor, borderColor, padding: 16 },
            ]}
          >
            <Text
              style={[
                styles.subTitleText,
                { color: subtextColor, marginBottom: 12 },
              ]}
            >
              {isEditMode
                ? 'Tap a work type below to toggle it on or off:'
                : 'Your target job structures:'}
            </Text>
            <View style={styles.workTypesGrid}>
              {[
                { id: 'full-time', label: 'Full-Time' },
                { id: 'contract', label: 'Contract' },
                { id: 'freelance', label: 'Freelance' },
                { id: 'part-time', label: 'Part-Time' },
                { id: 'remote', label: 'Remote' },
                { id: 'hybrid', label: 'Hybrid' },
              ].map(type => {
                const active = workTypesList.includes(type.id);
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.workTypePill,
                      {
                        backgroundColor: active
                          ? '#10b981'
                          : isDark
                            ? '#1a1a1a'
                            : '#f3f4f6',
                        borderColor: active ? '#10b981' : borderColor,
                      },
                    ]}
                    onPress={() => handleToggleWorkType(type.id)}
                  >
                    <MaterialCommunityIcons
                      name={active ? 'check-circle' : 'circle-outline'}
                      size={14}
                      color={active ? '#fff' : textColor}
                    />
                    <Text
                      style={[
                        styles.workTypePillText,
                        { color: active ? '#fff' : textColor },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Cloudinary Resume Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Resume & Portfolio
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBgColor, borderColor, padding: 16 },
            ]}
          >
            <View style={styles.resumeInfoBlock}>
              <View style={styles.resumeIconCircle}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={24}
                  color="#3b82f6"
                />
              </View>
              <View style={styles.resumeDetails}>
                <Text style={[styles.resumeStatusTitle, { color: textColor }]}>
                  {uploadedResumeUrl ? 'Resume Active' : 'No Resume Uploaded'}
                </Text>
                <Text
                  style={[styles.resumeStatusSubtitle, { color: subtextColor }]}
                  numberOfLines={1}
                >
                  {uploadedResumeUrl
                    ? selectedSimulatedFile
                    : 'Upload your resume to grab job opportunities!'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {uploadedResumeUrl ? (
                  <TouchableOpacity
                    style={[styles.manageResumeBtn, { backgroundColor: '#10b981' }]}
                    onPress={() => {
                      if (uploadedResumeUrl) {
                        Linking.openURL(uploadedResumeUrl).catch(err => {
                          Alert.alert('Error', 'Could not open resume link: ' + err.message);
                        });
                      }
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Preview</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.manageResumeBtn}
                  onPress={() => setIsResumeModalVisible(true)}
                >
                  <Text style={styles.manageResumeText}>Manage</Text>
                </TouchableOpacity>
              </View>
            </View>

            {uploadedResumeUrl ? (
              <View
                style={[
                  styles.resumeLinkContainer,
                  { backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' },
                ]}
              >
                <Text style={[styles.resumeLinkLabel, { color: subtextColor }]}>
                  Cloudinary Live Link:
                </Text>
                <Text
                  style={[styles.resumeLinkText, { color: '#3b82f6' }]}
                  numberOfLines={1}
                >
                  {uploadedResumeUrl}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            App Settings
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBgColor, borderColor },
            ]}
          >
            {/* Dark Mode Theme Context Switch */}
            <View
              style={[styles.itemContainer, { borderBottomColor: borderColor }]}
            >
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name="moon-waning-crescent"
                  size={20}
                  color="#3b82f6"
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: textColor }]}>
                  Dark Mode
                </Text>
                <Text style={[styles.itemSubtitle, { color: subtextColor }]}>
                  Toggle dark theme across the entire app
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                thumbColor={'#ffffff'}
              />
            </View>

            <View style={[styles.itemContainer, { borderBottomColor: borderColor }]}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name="microphone"
                  size={20}
                  color="#3b82f6"
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: textColor }]}>
                  Voice Interface
                </Text>
                <Text style={[styles.itemSubtitle, { color: subtextColor }]}>
                  Enable voice assistant controls
                </Text>
              </View>
              <Switch
                value={voiceEnabled}
                onValueChange={setVoiceEnabled}
                trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                thumbColor={'#ffffff'}
              />
            </View>



            {/* ⚡ Live Notification Test Trigger Button */}
            <TouchableOpacity onPress={handleTestPushNotification}>
              <View style={[styles.itemContainer, { borderBottomColor: borderColor, borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 12 }]}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <MaterialCommunityIcons
                    name="bell-ring"
                    size={20}
                    color="#ef4444"
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.itemTitle, { color: textColor }]}>
                    ⚡ Test Live Nudge
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: subtextColor }]}>
                    Trigger an immediate push notification
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={24}
                  color="#ef4444"
                />
              </View>
            </TouchableOpacity>

            <View style={[styles.itemContainer, { borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 12, marginTop: 4 }]}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name="fingerprint"
                  size={20}
                  color={hasVoiceId ? '#10b981' : '#f59e0b'}
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: textColor }]}>
                  Anya Voice ID
                </Text>
                <Text style={[styles.itemSubtitle, { color: hasVoiceId ? '#10b981' : subtextColor, fontWeight: hasVoiceId ? '600' : 'normal' }]}>
                  {hasVoiceId ? 'Biometric Signature: Active' : 'Not Calibrated'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {hasVoiceId && (
                  <TouchableOpacity
                    style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                    onPress={handleDeleteVoiceId}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: '#3b82f6',
                  }}
                  onPress={startVoiceCalibration}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    {hasVoiceId ? 'Retrain' : 'Calibrate'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Life Engine (Background Tasks) Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Life Engine (Background Tasks)
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBgColor, borderColor },
            ]}
          >
            <View
              style={[styles.itemContainer, { borderBottomColor: borderColor }]}
            >
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name="bell-ring-outline"
                  size={20}
                  color="#10b981"
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: textColor }]}>
                  Proactive Notifications
                </Text>
                <Text style={[styles.itemSubtitle, { color: subtextColor }]}>
                  Allow Anya to scan schedules automatically
                </Text>
              </View>
              <Switch
                value={cronEnabled}
                onValueChange={setCronEnabled}
                trackColor={{ false: '#d1d5db', true: '#10b981' }}
                thumbColor={'#ffffff'}
              />
            </View>

            <Pressable onPress={handleSelectAlertTiming}>
              <View
                style={[
                  styles.itemContainer,
                  { borderBottomColor: borderColor },
                ]}
              >
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons
                    name="timer-outline"
                    size={20}
                    color="#10b981"
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.itemTitle, { color: textColor }]}>
                    Alert Timing
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: subtextColor }]}>
                    {alertTiming} minutes before meetings
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={subtextColor}
                />
              </View>
            </Pressable>

            {/* 🖊️ INLINE MAX NUDGES PER DAY EDITING */}
            <View style={styles.itemContainer}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name="numeric-5-box-outline"
                  size={20}
                  color="#10b981"
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: textColor }]}>
                  Max Nudges Daily
                </Text>
                <Text style={[styles.itemSubtitle, { color: subtextColor }]}>
                  Maximum interventions generated per day
                </Text>
              </View>
              {isEditMode && activeEditField === 'maxNudgesPerDay' ? (
                <TextInput
                  style={[
                    styles.inlineInputCompact,
                    {
                      color: textColor,
                      backgroundColor: inputBgColor,
                      borderColor: '#3b82f6',
                      width: 45,
                    },
                  ]}
                  value={String(maxNudgesPerDay)}
                  onChangeText={v => setMaxNudgesPerDay(parseInt(v, 10) || 5)}
                  onBlur={handleSaveMaxNudges}
                  onSubmitEditing={handleSaveMaxNudges}
                  autoFocus
                  keyboardType="numeric"
                />
              ) : (
                <TouchableOpacity
                  disabled={!isEditMode}
                  onPress={() => setActiveEditField('maxNudgesPerDay')}
                  style={isEditMode ? styles.editableContainer : null}
                >
                  <Text
                    style={[
                      styles.boldText,
                      { color: textColor, fontSize: 15 },
                    ]}
                  >
                    {maxNudgesPerDay}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 🧠 Life Context & Struggles Section (Anya Dynamic Motivation Engine) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Anya's Life Intelligence
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBgColor, borderColor, padding: 16 },
            ]}
          >
            <Text
              style={[
                styles.subTitleText,
                { color: subtextColor, marginBottom: 12 },
              ]}
            >
              Insights Anya has dynamically recognized from your recent chats to
              personalize her motivational nudges:
            </Text>

            {lifeContext ? (
              <View style={{ gap: 12, marginBottom: 16 }}>
                {/* Emotional State */}
                <View
                  style={[
                    styles.insightRow,
                    { borderBottomColor: borderColor },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="heart-pulse"
                    size={18}
                    color="#ef4444"
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={[styles.insightLabel, { color: subtextColor }]}
                    >
                      Emotional State
                    </Text>
                    <Text style={[styles.insightValue, { color: textColor }]}>
                      {lifeContext.emotionalState || 'Stable & Balanced'}
                    </Text>
                  </View>
                </View>

                {/* Struggles */}
                <View
                  style={[
                    styles.insightRow,
                    { borderBottomColor: borderColor, paddingBottom: 8 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="lightning-bolt"
                    size={18}
                    color="#f59e0b"
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={[
                        styles.insightLabel,
                        { color: subtextColor, marginBottom: 6 },
                      ]}
                    >
                      Current Struggles & Obstacles
                    </Text>
                    <View style={styles.tagsContainer}>
                      {lifeContext.struggles &&
                        lifeContext.struggles.length > 0 ? (
                        lifeContext.struggles.map(
                          (str: string, index: number) => (
                            <View
                              key={index}
                              style={[
                                styles.skillTag,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(245, 158, 11, 0.08)',
                                  borderColor: isDark
                                    ? 'rgba(245, 158, 11, 0.3)'
                                    : 'rgba(245, 158, 11, 0.2)',
                                },
                              ]}
                            >
                              <Text
                                style={[styles.tagName, { color: textColor }]}
                              >
                                {str}
                              </Text>
                            </View>
                          ),
                        )
                      ) : (
                        <Text
                          style={[styles.emptyText, { color: subtextColor }]}
                        >
                          No active struggles identified.
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Focus Goals */}
                <View
                  style={[
                    styles.insightRow,
                    { borderBottomColor: borderColor, paddingBottom: 8 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="target"
                    size={18}
                    color="#3b82f6"
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={[
                        styles.insightLabel,
                        { color: subtextColor, marginBottom: 6 },
                      ]}
                    >
                      Current Focus & Goals
                    </Text>
                    <View style={styles.tagsContainer}>
                      {lifeContext.focusGoals &&
                        lifeContext.focusGoals.length > 0 ? (
                        lifeContext.focusGoals.map(
                          (goal: string, index: number) => (
                            <View
                              key={index}
                              style={[
                                styles.skillTag,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(59, 130, 246, 0.15)'
                                    : 'rgba(59, 130, 246, 0.08)',
                                  borderColor: isDark
                                    ? 'rgba(59, 130, 246, 0.3)'
                                    : 'rgba(59, 130, 246, 0.2)',
                                },
                              ]}
                            >
                              <Text
                                style={[styles.tagName, { color: textColor }]}
                              >
                                {goal}
                              </Text>
                            </View>
                          ),
                        )
                      ) : (
                        <Text
                          style={[styles.emptyText, { color: subtextColor }]}
                        >
                          No specific focus goals identified.
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Motivation Strategy */}
                <View style={styles.insightRow}>
                  <MaterialCommunityIcons
                    name="bullseye-arrow"
                    size={18}
                    color="#10b981"
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={[styles.insightLabel, { color: subtextColor }]}
                    >
                      Anya's Motivation Angle
                    </Text>
                    <Text style={[styles.insightValue, { color: textColor }]}>
                      {lifeContext.motivationStrategy ||
                        'Warm supportive encouragement'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.emptyInsightsContainer,
                  {
                    backgroundColor: isDark ? '#111' : '#f9fafb',
                    borderColor,
                    padding: 16,
                    borderRadius: 8,
                    alignItems: 'center',
                    marginBottom: 16,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="brain"
                  size={32}
                  color={subtextColor}
                  style={{ marginBottom: 8 }}
                />
                <Text
                  style={[
                    styles.emptyInsightsText,
                    { color: subtextColor, textAlign: 'center', fontSize: 13 },
                  ]}
                >
                  Anya hasn't mapped your life context yet. Run sync or chat
                  with her to build your personalized struggles profile!
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.syncInsightsBtn,
                {
                  backgroundColor: isSyncingInsights ? subtextColor : '#3b82f6',
                },
              ]}
              disabled={isSyncingInsights}
              onPress={handleSyncInsights}
            >
              <MaterialCommunityIcons
                name={isSyncingInsights ? 'cog-sync' : 'sync'}
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.syncInsightsText}>
                {isSyncingInsights
                  ? 'Syncing & Analyzing Conversations...'
                  : 'Sync AI Struggles & Insights'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🖊️ INLINE PREFERRED JOB LOCATIONS */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Target Job Locations
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBgColor, borderColor, padding: 16 },
            ]}
          >
            <Text
              style={[
                styles.subTitleText,
                { color: subtextColor, marginBottom: 12 },
              ]}
            >
              List cities or regions where you want Anya to scan for openings:
            </Text>

            <View style={styles.tagsContainer}>
              {preferredLocationsList.length === 0 ? (
                <Text style={[styles.emptyText, { color: subtextColor }]}>
                  No target locations added.
                </Text>
              ) : (
                preferredLocationsList.map((loc, index) => (
                  <View
                    key={index}
                    style={[
                      styles.skillTag,
                      {
                        backgroundColor: isDark
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(16, 185, 129, 0.08)',
                        borderColor: isDark
                          ? 'rgba(16, 185, 129, 0.4)'
                          : 'rgba(16, 185, 129, 0.2)',
                      },
                    ]}
                  >
                    <Text style={[styles.tagName, { color: textColor }]}>
                      {loc}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeletePreferredLocation(index)}
                      style={styles.deleteTagBtn}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={14}
                        color="#ef4444"
                      />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            <View
              style={[styles.addSkillForm, { borderTopColor: borderColor }]}
            >
              <Text style={[styles.formLabel, { color: textColor }]}>
                Add Preferred Location
              </Text>
              <View style={styles.formInputsRow}>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: textColor,
                      borderColor,
                      backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                    },
                  ]}
                  value={newPreferredLocation}
                  onChangeText={setNewPreferredLocation}
                  placeholder="e.g. Bangalore, Remote, Noida"
                  placeholderTextColor={subtextColor}
                />
                <TouchableOpacity
                  style={styles.addSkillBtn}
                  onPress={handleAddPreferredLocation}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={24}
                    color="#ffffff"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Focus & Growth Areas (Preferences) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Growth Focus Preferences
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBgColor, borderColor, padding: 16 },
            ]}
          >
            <Text
              style={[
                styles.subTitleText,
                { color: subtextColor, marginBottom: 12 },
              ]}
            >
              Choose areas Anya should prioritize for proactive coaching:
            </Text>
            <View style={styles.pillContainer}>
              {[
                { key: 'coaching_career', label: 'Career Growth' },
                { key: 'coaching_health', label: 'Health & Wellness' },
                { key: 'coaching_productivity', label: 'Productivity' },
                { key: 'coaching_coding', label: 'Software Engineering' },
                { key: 'coaching_mindfulness', label: 'Mindfulness' },
              ].map(pill => {
                const active = !!preferences[pill.key];
                return (
                  <TouchableOpacity
                    key={pill.key}
                    style={[
                      styles.preferencePill,
                      {
                        backgroundColor: active
                          ? '#3b82f6'
                          : isDark
                            ? '#1f1f1f'
                            : '#f3f4f6',
                        borderColor: active ? '#3b82f6' : borderColor,
                      },
                    ]}
                    onPress={() => handleTogglePreference(pill.key)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: active ? '#ffffff' : textColor },
                      ]}
                    >
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Interactive User Skills Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Skills & Talents
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBgColor, borderColor, padding: 16 },
            ]}
          >
            <Text
              style={[
                styles.subTitleText,
                { color: subtextColor, marginBottom: 12 },
              ]}
            >
              Your registered skills:
            </Text>

            <View style={styles.tagsContainer}>
              {skillsList.length === 0 ? (
                <Text style={[styles.emptyText, { color: subtextColor }]}>
                  No skills added yet.
                </Text>
              ) : (
                skillsList.map((skill, index) => (
                  <View
                    key={index}
                    style={[
                      styles.skillTag,
                      {
                        backgroundColor: isDark
                          ? 'rgba(59, 130, 246, 0.15)'
                          : 'rgba(59, 130, 246, 0.08)',
                        borderColor: isDark
                          ? 'rgba(59, 130, 246, 0.4)'
                          : 'rgba(59, 130, 246, 0.2)',
                      },
                    ]}
                  >
                    <Text style={[styles.tagCategory, { color: '#3b82f6' }]}>
                      {skill.category}:{' '}
                    </Text>
                    <Text style={[styles.tagName, { color: textColor }]}>
                      {skill.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteSkill(index)}
                      style={styles.deleteTagBtn}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={14}
                        color="#ef4444"
                      />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            <View
              style={[styles.addSkillForm, { borderTopColor: borderColor }]}
            >
              <Text style={[styles.formLabel, { color: textColor }]}>
                Add New Skill
              </Text>
              <View style={styles.formInputsRow}>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: textColor,
                      borderColor,
                      backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                    },
                  ]}
                  value={newSkillCategory}
                  onChangeText={setNewSkillCategory}
                  placeholder="Category"
                  placeholderTextColor={subtextColor}
                />
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: textColor,
                      borderColor,
                      backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                    },
                  ]}
                  value={newSkillName}
                  onChangeText={setNewSkillName}
                  placeholder="Skill Name"
                  placeholderTextColor={subtextColor}
                />
                <TouchableOpacity
                  style={styles.addSkillBtn}
                  onPress={handleAddSkill}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={24}
                    color="#ffffff"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 60 }} />

        {/* 2. PREMIUM RESUME & CLOUDINARY MODAL */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isResumeModalVisible}
          onRequestClose={() => setIsResumeModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setIsResumeModalVisible(false)}
          >
            <Pressable
              onPress={e => e.stopPropagation()}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <View
                style={[styles.modalContent, { backgroundColor: cardBgColor }]}
              >
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[styles.modalTitle, { color: textColor }]}>
                    Resume Portfolio Manager
                  </Text>

                  {/* ✨ Anya AI Auto-Format Assistant */}
                  <View
                    style={[
                      styles.aiAssistPanel,
                      {
                        backgroundColor: isDark
                          ? 'rgba(59, 130, 246, 0.08)'
                          : 'rgba(59, 130, 246, 0.04)',
                        borderColor: '#3b82f6',
                      },
                    ]}
                  >
                    <View style={styles.aiAssistHeader}>
                      <MaterialCommunityIcons
                        name="auto-fix"
                        size={18}
                        color="#3b82f6"
                      />
                      <Text
                        style={[styles.aiAssistTitle, { color: textColor }]}
                      >
                        Anya AI Formatting Assistant
                      </Text>
                    </View>
                    <Text
                      style={[styles.aiAssistSubtitle, { color: subtextColor }]}
                    >
                      Tapping format will automatically capitalize company
                      titles, align bullets (•), and polish text grammar!
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.aiFormatBtn,
                        { backgroundColor: '#3b82f6' },
                      ]}
                      onPress={handleAIAutoFormat}
                      disabled={isFormatting}
                    >
                      {isFormatting ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <MaterialCommunityIcons
                            name="loading"
                            size={16}
                            color="#fff"
                            style={styles.spinningIcon}
                          />
                          <Text style={styles.aiFormatBtnText}>
                            Formatting your CV...
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <MaterialCommunityIcons
                            name="sparkles"
                            size={16}
                            color="#fff"
                          />
                          <Text style={styles.aiFormatBtnText}>
                            Format & Align CV
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* 1. Professional Summary Card */}
                  <Text
                    style={[
                      styles.formSectionHeading,
                      { color: '#3b82f6', marginTop: 14 },
                    ]}
                  >
                    1. Professional Summary
                  </Text>
                  <View
                    style={[
                      styles.cvFormCard,
                      {
                        backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                        borderColor,
                      },
                    ]}
                  >
                    <TextInput
                      multiline
                      numberOfLines={4}
                      style={[styles.cvInputMultiline, { color: textColor }]}
                      value={resumeSummary}
                      onChangeText={setResumeSummary}
                      placeholder="Write your professional summary. E.g. Experienced developer specializing in personal AI helpers..."
                      placeholderTextColor={subtextColor}
                    />
                  </View>

                  {/* 2. Work Experiences Card */}
                  <Text
                    style={[
                      styles.formSectionHeading,
                      { color: '#10b981', marginTop: 20 },
                    ]}
                  >
                    2. Work Experiences
                  </Text>
                  <View
                    style={[
                      styles.cvFormCard,
                      {
                        backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                        borderColor,
                      },
                    ]}
                  >
                    {/* List Experiences */}
                    {resumeExperiences.map((exp, idx) => (
                      <View
                        key={exp.id || idx}
                        style={[
                          styles.cvItemPill,
                          { borderBottomColor: borderColor },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.cvItemTitle, { color: textColor }]}
                          >
                            {exp.role} @ {exp.company}
                          </Text>
                          <Text
                            style={[styles.cvItemSub, { color: '#10b981' }]}
                          >
                            {exp.duration}
                          </Text>
                          <Text
                            style={[styles.cvItemDesc, { color: subtextColor }]}
                          >
                            {exp.description}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.cvItemDelete}
                          onPress={() => {
                            setResumeExperiences(prev =>
                              prev.filter(item => item.id !== exp.id),
                            );
                          }}
                        >
                          <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={18}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* Add Experience Inline block */}
                    <View
                      style={[
                        styles.cvFormBlock,
                        { borderTopColor: borderColor },
                      ]}
                    >
                      <Text style={[styles.cvBlockLabel, { color: textColor }]}>
                        Add Work Experience
                      </Text>
                      <TextInput
                        style={[
                          styles.cvMiniInput,
                          {
                            color: textColor,
                            borderColor,
                            backgroundColor: isDark ? '#111' : '#fff',
                          },
                        ]}
                        value={expCompany}
                        onChangeText={setExpCompany}
                        placeholder="Company (e.g. Google Deepmind)"
                        placeholderTextColor={subtextColor}
                      />
                      <TextInput
                        style={[
                          styles.cvMiniInput,
                          {
                            color: textColor,
                            borderColor,
                            backgroundColor: isDark ? '#111' : '#fff',
                          },
                        ]}
                        value={expRole}
                        onChangeText={setExpRole}
                        placeholder="Role (e.g. Software Engineer)"
                        placeholderTextColor={subtextColor}
                      />
                      <TextInput
                        style={[
                          styles.cvMiniInput,
                          {
                            color: textColor,
                            borderColor,
                            backgroundColor: isDark ? '#111' : '#fff',
                          },
                        ]}
                        value={expDuration}
                        onChangeText={setExpDuration}
                        placeholder="Duration (e.g. 2022 - 2023)"
                        placeholderTextColor={subtextColor}
                      />
                      <TextInput
                        style={[
                          styles.cvMiniInput,
                          {
                            color: textColor,
                            borderColor,
                            backgroundColor: isDark ? '#111' : '#fff',
                          },
                        ]}
                        value={expDesc}
                        onChangeText={setExpDesc}
                        placeholder="Key Achievement Description"
                        placeholderTextColor={subtextColor}
                      />
                      <TouchableOpacity
                        style={[
                          styles.cvAddPillBtn,
                          { backgroundColor: '#10b981' },
                        ]}
                        onPress={() => {
                          if (!expCompany.trim() || !expRole.trim()) {
                            Alert.alert(
                              'Validation Error',
                              'Please complete Company and Role.',
                            );
                            return;
                          }
                          const newExp = {
                            id: Date.now().toString(),
                            company: expCompany.trim(),
                            role: expRole.trim(),
                            duration: expDuration.trim() || '2023',
                            description:
                              expDesc.trim() ||
                              '• Contributed to code development.',
                          };
                          setResumeExperiences(prev => [...prev, newExp]);
                          setExpCompany('');
                          setExpRole('');
                          setExpDuration('');
                          setExpDesc('');
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={16}
                            color="#fff"
                          />
                          <Text
                            style={{
                              color: '#fff',
                              fontWeight: 'bold',
                              fontSize: 12,
                            }}
                          >
                            Add Experience
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 3. Projects Card */}
                  <Text
                    style={[
                      styles.formSectionHeading,
                      { color: '#8b5cf6', marginTop: 20 },
                    ]}
                  >
                    3. Personal Projects
                  </Text>
                  <View
                    style={[
                      styles.cvFormCard,
                      {
                        backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
                        borderColor,
                      },
                    ]}
                  >
                    {/* List Projects */}
                    {resumeProjects.map((proj, idx) => (
                      <View
                        key={proj.id || idx}
                        style={[
                          styles.cvItemPill,
                          { borderBottomColor: borderColor },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.cvItemTitle, { color: textColor }]}
                          >
                            {proj.name}
                          </Text>
                          <Text
                            style={[styles.cvItemSub, { color: '#8b5cf6' }]}
                          >
                            {proj.url}
                          </Text>
                          <Text
                            style={[styles.cvItemDesc, { color: subtextColor }]}
                          >
                            {proj.description}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.cvItemDelete}
                          onPress={() => {
                            setResumeProjects(prev =>
                              prev.filter(item => item.id !== proj.id),
                            );
                          }}
                        >
                          <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={18}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* Add Project Inline block */}
                    <View
                      style={[
                        styles.cvFormBlock,
                        { borderTopColor: borderColor },
                      ]}
                    >
                      <Text style={[styles.cvBlockLabel, { color: textColor }]}>
                        Add Project
                      </Text>
                      <TextInput
                        style={[
                          styles.cvMiniInput,
                          {
                            color: textColor,
                            borderColor,
                            backgroundColor: isDark ? '#111' : '#fff',
                          },
                        ]}
                        value={projName}
                        onChangeText={setProjName}
                        placeholder="Project Name (e.g. Nitro Scraper)"
                        placeholderTextColor={subtextColor}
                      />
                      <TextInput
                        style={[
                          styles.cvMiniInput,
                          {
                            color: textColor,
                            borderColor,
                            backgroundColor: isDark ? '#111' : '#fff',
                          },
                        ]}
                        value={projUrl}
                        onChangeText={setProjUrl}
                        placeholder="Link (e.g. github.com/277pawan/nitro)"
                        placeholderTextColor={subtextColor}
                      />
                      <TextInput
                        style={[
                          styles.cvMiniInput,
                          {
                            color: textColor,
                            borderColor,
                            backgroundColor: isDark ? '#111' : '#fff',
                          },
                        ]}
                        value={projDesc}
                        onChangeText={setProjDesc}
                        placeholder="Project Description Details"
                        placeholderTextColor={subtextColor}
                      />
                      <TouchableOpacity
                        style={[
                          styles.cvAddPillBtn,
                          { backgroundColor: '#8b5cf6' },
                        ]}
                        onPress={() => {
                          if (!projName.trim()) {
                            Alert.alert(
                              'Validation Error',
                              'Project Name cannot be empty.',
                            );
                            return;
                          }
                          const newProj = {
                            id: Date.now().toString(),
                            name: projName.trim(),
                            url: projUrl.trim() || 'github.com',
                            description:
                              projDesc.trim() || '• Engineered application.',
                          };
                          setResumeProjects(prev => [...prev, newProj]);
                          setProjName('');
                          setProjUrl('');
                          setProjDesc('');
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={16}
                            color="#fff"
                          />
                          <Text
                            style={{
                              color: '#fff',
                              fontWeight: 'bold',
                              fontSize: 12,
                            }}
                          >
                            Add Project
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 2. File Explorer Selection Simulation */}
                  <Text
                    style={[
                      styles.formSectionHeading,
                      { color: '#10b981', marginTop: 16 },
                    ]}
                  >
                    Document Selector (PDF/DOCX)
                  </Text>
                  <Text
                    style={[
                      styles.subTitleText,
                      { color: subtextColor, marginBottom: 8 },
                    ]}
                  >
                    Simulate picking an offline file to compile & sync:
                  </Text>
                  <View
                    style={{
                      borderWidth: 1.5,
                      borderColor: '#10b981',
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <MaterialCommunityIcons name="file-pdf-box" size={24} color="#10b981" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>
                        Active File Name
                      </Text>
                      <TextInput
                        style={{
                          fontSize: 14,
                          fontWeight: 'bold',
                          color: textColor,
                          padding: 0,
                          marginTop: 2,
                        }}
                        value={selectedSimulatedFile}
                        onChangeText={setSelectedSimulatedFile}
                        placeholder="Enter resume filename (e.g. My_Resume.pdf)"
                        placeholderTextColor={subtextColor}
                      />
                    </View>
                  </View>

                  <View
                    style={[
                      styles.cloudinaryBrandingBlock,
                      {
                        backgroundColor: isDark
                          ? 'rgba(59, 130, 246, 0.05)'
                          : 'rgba(59, 130, 246, 0.03)',
                        borderColor,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="cloud-upload-outline"
                      size={16}
                      color="#3b82f6"
                    />
                    <Text
                      style={[
                        styles.cloudinaryBrandingText,
                        { color: subtextColor },
                      ]}
                    >
                      Secure direct upload to Cloudinary (Preset: Signed
                      HMAC-SHA1)
                    </Text>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        { backgroundColor: 'transparent' },
                      ]}
                      onPress={() => setIsResumeModalVisible(false)}
                      disabled={isUploading}
                    >
                      <Text
                        style={[
                          styles.modalButtonText,
                          { color: subtextColor },
                        ]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        {
                          backgroundColor: '#3b82f6',
                          flexDirection: 'row',
                          alignItems: 'center',
                        },
                      ]}
                      onPress={handleCloudinaryResumeUpload}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <MaterialCommunityIcons
                            name="loading"
                            size={16}
                            color="#fff"
                            style={styles.spinningIcon}
                          />
                          <Text
                            style={[
                              styles.modalButtonText,
                              { color: '#ffffff', marginLeft: 6 },
                            ]}
                          >
                            Uploading...
                          </Text>
                        </>
                      ) : (
                        <Text
                          style={[styles.modalButtonText, { color: '#ffffff' }]}
                        >
                          Upload & Save
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* 🎙️ Anya Voice ID Calibration Modal */}
        <Modal
          visible={isVoiceIdModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsVoiceIdModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: cardBgColor, width: '85%' }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Anya Voice ID Calibration</Text>
              
              <Text style={{ textAlign: 'center', color: subtextColor, fontSize: 13, marginBottom: 20 }}>
                Anya uses real-time biometrics to verify your identity. Let's record 3 simple samples of your voice.
              </Text>

              {/* Progress steps */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                {[1, 2, 3].map((step) => (
                  <View
                    key={step}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: voiceIdStep === step
                        ? '#3b82f6'
                        : voiceIdStep > step
                          ? '#10b981'
                          : 'rgba(128, 128, 128, 0.15)',
                    }}
                  >
                    {voiceIdStep > step ? (
                      <MaterialCommunityIcons name="check" size={16} color="#fff" />
                    ) : (
                      <Text style={{ color: voiceIdStep === step ? '#fff' : subtextColor, fontWeight: '700', fontSize: 12 }}>
                        {step}
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Phrase prompting */}
              <View style={{ padding: 18, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderWidth: 1, borderColor, alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Say clearly:
                </Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor, textAlign: 'center', lineHeight: 26 }}>
                  {voiceIdStep === 1 && '"Hi Anya"'}
                  {voiceIdStep === 2 && '"Hi Anya, it\'s Pawan"'}
                  {voiceIdStep === 3 && '"Open my assistant"'}
                </Text>
              </View>

              {/* Pulse / Wave Animation */}
              {voiceIdRecording && (
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>
                    🎙️ RECORDING... Speak now
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <TouchableOpacity
                style={{
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: voiceIdRecording ? '#ef4444' : '#3b82f6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  elevation: 2,
                }}
                onPress={handleStepRecord}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  {voiceIdRecording ? 'Stop Recording' : 'Start Recording'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setIsVoiceIdModalVisible(false)}
              >
                <Text style={{ color: subtextColor, fontSize: 13, fontWeight: '600' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>



        {/* 🖼️ Choose Profile Picture Modal */}
        <Modal
          visible={isAvatarModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsAvatarModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setIsAvatarModalVisible(false)}
          >
            <Pressable
              onPress={e => e.stopPropagation()}
              style={{ width: '90%', alignItems: 'center' }}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[
                  styles.modalContent,
                  { backgroundColor: cardBgColor, maxHeight: '85%', padding: 20, width: '100%' }
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 }}>
                  <Text style={[styles.modalTitle, { color: textColor }]}>
                    Choose Profile Picture
                  </Text>
                  <TouchableOpacity onPress={() => setIsAvatarModalVisible(false)}>
                    <MaterialCommunityIcons name="close" size={20} color={subtextColor} />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  style={{ width: '100%' }} 
                  contentContainerStyle={{ paddingBottom: 60 }} 
                  showsVerticalScrollIndicator={false}
                >
                  {/* Option A: Real Device Camera and Gallery Pickers */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, marginBottom: 8 }}>
                    📸 Capture or Select Real Image
                  </Text>
                  
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    {/* Camera Button */}
                    <TouchableOpacity
                      onPress={handleTakePhoto}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        paddingVertical: 14,
                        borderRadius: 12,
                      }}
                    >
                      <MaterialCommunityIcons name="camera" size={18} color="#10b981" />
                      <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 12 }}>
                        Use Camera
                      </Text>
                    </TouchableOpacity>

                    {/* Gallery Button */}
                    <TouchableOpacity
                      onPress={handleChooseFromGallery}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        paddingVertical: 14,
                        borderRadius: 12,
                      }}
                    >
                      <MaterialCommunityIcons name="image" size={18} color="#3b82f6" />
                      <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 12 }}>
                        Open Gallery
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Option B: Premium Stock Curated Avatars */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, marginBottom: 8 }}>
                    🚀 Select an Elite Developer Avatar
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                    {[
                      { name: 'Coding Bot', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80' },
                      { name: 'Tech Neon', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&q=80' },
                      { name: 'Secure Globe', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=300&q=80' },
                      { name: 'Green Matrix', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&q=80' },
                      { name: 'Developer Desk', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300&q=80' },
                      { name: 'Geek Boy', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&q=80' },
                      { name: 'Tech Girl', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&q=80' },
                      { name: 'Startup Builder', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=300&q=80' }
                    ].map((item, idx) => {
                      const isSelected = avatarUrl === item.url;
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => handleSaveAvatar(item.url)}
                          style={{
                            position: 'relative',
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: isSelected ? '#3b82f6' : 'transparent',
                            padding: 2,
                          }}
                        >
                          <Image
                            source={{ uri: item.url }}
                            style={{ width: 62, height: 62, borderRadius: 10 }}
                          />
                          {isSelected && (
                            <View style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              backgroundColor: '#3b82f6',
                              borderRadius: 8,
                              width: 16,
                              height: 16,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <MaterialCommunityIcons name="check" size={10} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Option C: Custom Web URL */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, marginBottom: 6 }}>
                    🔗 Or Paste Custom Image/Avatar URL
                  </Text>
                  <TextInput
                    style={{
                      height: 44,
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      color: textColor,
                      backgroundColor: inputBgColor,
                      fontSize: 12,
                      marginBottom: 10,
                    }}
                    placeholder="https://example.com/avatar.jpg"
                    placeholderTextColor={subtextColor}
                    value={customAvatarUrl}
                    onChangeText={setCustomAvatarUrl}
                  />
                  <TouchableOpacity
                    onPress={() => handleSaveAvatar(customAvatarUrl)}
                    style={{
                      backgroundColor: '#3b82f6',
                      borderRadius: 10,
                      height: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                      Apply Custom Image URL
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </KeyboardAvoidingView>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    // Dashboard switch styling
    dashboardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 6,
    },
    dashboardTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    dashboardSubtitle: {
      fontSize: 11,
      marginTop: 2,
      maxWidth: '90%',
    },
    dashboardEditToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      gap: 4,
      borderWidth: 1.2,
      borderColor: 'rgba(59, 130, 246, 0.25)',
    },
    dashboardEditToggleText: {
      fontSize: 11,
      fontWeight: '700',
    },

    profileHeaderCard: {
      margin: 16,
      borderRadius: 24,
      borderWidth: 1,
      padding: 20,
      elevation: 3,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    profileHeaderTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarPlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#3b82f6',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 16,
    },
    avatarImage: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 1.5,
      borderColor: '#3b82f6',
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      backgroundColor: '#3b82f6',
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#111',
    },
    profileInfo: {
      flex: 1,
    },
    nameStreakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    profileName: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    streakBadge: {
      backgroundColor: 'rgba(249, 115, 22, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(249, 115, 22, 0.3)',
    },
    streakText: {
      color: '#f97316',
      fontSize: 11,
      fontWeight: 'bold',
    },
    longestStreakBadge: {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    longestStreakText: {
      color: '#3b82f6',
      fontSize: 11,
      fontWeight: 'bold',
    },
    profileEmail: {
      fontSize: 12,
      marginTop: 2,
    },
    headerInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      flexWrap: 'wrap',
      gap: 12,
    },
    infoCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    infoText: {
      fontSize: 13,
      fontWeight: '500',
    },
    availabilityPill: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    availabilityText: {
      color: '#10b981',
      fontSize: 11,
      fontWeight: '700',
    },
    eduHighlightRow: {
      flexDirection: 'row',
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      gap: 10,
    },
    eduHighlightInfo: {
      flex: 1,
    },
    eduDegreeText: {
      fontSize: 13,
      fontWeight: '700',
    },
    eduSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    eduUniversityText: {
      fontSize: 12,
    },
    rateInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      gap: 10,
    },
    ratesInlineContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      flexWrap: 'wrap',
    },
    rateText: {
      fontSize: 13,
      fontWeight: '500',
    },
    boldText: {
      fontWeight: '700',
    },
    socialBadgesRow: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 12,
    },
    socialBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 6,
    },
    socialText: {
      fontSize: 12,
      fontWeight: '600',
    },

    // Interactive Mood Styles
    moodSectionRow: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
    },
    moodHeaderTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 8,
    },
    moodPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    moodPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      gap: 4,
    },
    moodPillText: {
      fontSize: 11,
      fontWeight: '600',
    },

    // whitelisted Stats Dashboard Grid
    statsDashboardGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    statsDashboardCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 16,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    statsDashValue: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 6,
    },
    statsDashLabel: {
      fontSize: 10,
      fontWeight: '600',
      marginTop: 2,
      textAlign: 'center',
    },

    // whitelisted work types grid
    workTypesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    workTypePill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      gap: 6,
    },
    workTypePillText: {
      fontSize: 12,
      fontWeight: '600',
    },

    // 🖊️ Interactive Inline Editing visual styling
    editableContainer: {
      borderBottomWidth: 1,
      borderBottomColor: '#3b82f6',
      borderStyle: 'dashed',
      paddingBottom: 2,
    },
    inlineInputBold: {
      fontSize: 16,
      fontWeight: 'bold',
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      minWidth: 140,
    },
    inlineInputCompact: {
      fontSize: 12,
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginVertical: 1,
    },

    section: {
      marginHorizontal: 16,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 10,
      marginLeft: 4,
    },
    sectionCard: {
      borderRadius: 20,
      borderWidth: 1,
      overflow: 'hidden',
    },
    resumeInfoBlock: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    resumeIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    resumeDetails: {
      flex: 1,
    },
    resumeStatusTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    resumeStatusSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    manageResumeBtn: {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    manageResumeText: {
      color: '#3b82f6',
      fontSize: 13,
      fontWeight: '700',
    },
    resumeLinkContainer: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(128, 128, 128, 0.15)',
    },
    resumeLinkLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 4,
    },
    resumeLinkText: {
      fontSize: 12,
      fontWeight: '500',
    },
    itemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
      backgroundColor: 'rgba(128, 128, 128, 0.1)',
    },
    textContainer: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '600',
    },
    itemSubtitle: {
      fontSize: 12,
      marginTop: 3,
    },
    pillContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    preferencePill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    pillText: {
      fontSize: 12,
      fontWeight: '600',
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    emptyText: {
      fontStyle: 'italic',
      fontSize: 12,
    },
    skillTag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 12,
      paddingRight: 8,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
    },
    tagCategory: {
      fontSize: 12,
      fontWeight: '700',
    },
    tagName: {
      fontSize: 12,
      fontWeight: '600',
    },
    deleteTagBtn: {
      marginLeft: 6,
      padding: 2,
    },
    addSkillForm: {
      borderTopWidth: 1,
      paddingTop: 16,
    },
    formLabel: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 8,
    },
    formInputsRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    formInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 12,
    },
    addSkillBtn: {
      backgroundColor: '#3b82f6',
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Modal styling (for Cloudinary)
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContent: {
      borderRadius: 24,
      padding: 24,
      width: '90%',
      maxHeight: '85%',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
      textAlign: 'center',
    },
    formSectionHeading: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 8,
      marginBottom: 10,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 20,
      gap: 12,
    },
    modalButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    modalButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },

    // Resume specific UI
    resumeTextArea: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      fontSize: 13,
      minHeight: 140,
      textAlignVertical: 'top',
    },
    fileSelectorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    fileOptionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      gap: 6,
      width: '48%',
    },
    fileOptionText: {
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },
    cloudinaryBrandingBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 8,
      gap: 8,
    },
    cloudinaryBrandingText: {
      fontSize: 11,
      fontWeight: '500',
      flex: 1,
    },
    spinningIcon: {
      // optional animation placeholder
    },
    // Structured Resume Visual styles
    aiAssistPanel: {
      borderWidth: 1.5,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
    },
    aiAssistHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    aiAssistTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    aiAssistSubtitle: {
      fontSize: 11,
      lineHeight: 16,
      marginBottom: 10,
    },
    aiFormatBtn: {
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiFormatBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
    },
    cvFormCard: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
    },
    cvInputMultiline: {
      fontSize: 13,
      lineHeight: 20,
      textAlignVertical: 'top',
      padding: 0,
    },
    cvItemPill: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    cvItemTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    cvItemSub: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    cvItemDesc: {
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
    },
    cvItemDelete: {
      padding: 6,
    },
    cvFormBlock: {
      borderTopWidth: 1.5,
      marginTop: 14,
      paddingTop: 14,
    },
    cvBlockLabel: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 10,
    },
    cvMiniInput: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 12,
      marginBottom: 8,
    },
    cvAddPillBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignSelf: 'flex-start',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconTextRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    subTitleText: {
      fontSize: 13,
      lineHeight: 18,
    },
    insightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    insightLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    insightValue: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 2,
    },
    emptyInsightsContainer: {
      borderWidth: 1,
      borderRadius: 12,
      borderStyle: 'dashed',
    },
    emptyInsightsText: {
      fontWeight: '500',
    },
    syncInsightsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
    },
    syncInsightsText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
  });
export default Settings;
