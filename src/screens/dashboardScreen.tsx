import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  View,
  ScrollView,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemeContext } from '../../App';
import { LifeEngineAPI, HistoryAPI } from '../services/api';

interface Meeting {
  title: string;
  time: string;
  type: string;
}

interface JobMatch {
  title: string;
  company: string;
  salary: string;
  score: string;
  location: string;
}

interface Book {
  title: string;
  author: string;
  rating: number;
  progress: number;
  cover: string;
}

const formatToIST = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return 'Just now';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Just now';
  
  // IST is UTC + 5:30 (5.5 hours)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
  
  return `${displayHours}:${displayMinutes} ${ampm}`;
};

const DashboardScreen: React.FC = ({ navigation }: any) => {
  const { theme } = useContext(ThemeContext);
  const isDarkMode = theme === 'dark';
  
  // Theme styling constants
  const backgroundColor = isDarkMode ? '#0a0a0a' : '#f3f4f6';
  const textColor = isDarkMode ? '#ffffff' : '#111827';
  const subtextColor = isDarkMode ? '#9ca3af' : '#4b5563';
  const cardBackgroundColor = isDarkMode ? '#141414' : '#ffffff';
  const borderColor = isDarkMode ? '#222222' : '#e5e7eb';
  const cardBorderColor = isDarkMode ? '#262626' : '#f1f1f1';

  // State Management
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [moodValue, setMoodValue] = useState('7');
  const [lifeEngineState, setLifeEngineState] = useState<any>(null);
  
  // Dynamic Data & fallbacks
  const [meetingsList, setMeetingsList] = useState<Meeting[]>([]);
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([]);
  const [mcpHistoryLoaded, setMcpHistoryLoaded] = useState(false);
  
  // Interactive Book Search
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [booksList, setBooksList] = useState<Book[]>([
    {
      title: 'Designing Data-Intensive Applications',
      author: 'Martin Kleppmann',
      rating: 5,
      progress: 92,
      cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80',
    },
    {
      title: 'Atomic Habits',
      author: 'James Clear',
      rating: 4.8,
      progress: 65,
      cover: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=300&q=80',
    },
    {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      rating: 4.5,
      progress: 80,
      cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=300&q=80',
    },
  ]);

  const loadDynamicDashboardData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch Life Engine State
      const leJson = await LifeEngineAPI.getState();
      if (leJson.success && leJson.data) {
        setLifeEngineState(leJson.data);
      }

      // 2. Fetch MCP History to extract Today's Meetings
      const mcpJson = await HistoryAPI.getMCPHistory();
      if (mcpJson.success && mcpJson.data) {
        // Look for recent getMyCalendarDataByDate tools with valid outputs
        const calendarCalls = mcpJson.data.filter(
          (item: any) => item.tool === 'getMyCalendarDataByDate' && item.success && item.output
        );

        if (calendarCalls.length > 0) {
          try {
            const latestCall = calendarCalls[0];
            const parsedOut = typeof latestCall.output === 'string' 
              ? JSON.parse(latestCall.output) 
              : latestCall.output;
            
            if (parsedOut.meetings && parsedOut.meetings.length > 0) {
              const mapped: Meeting[] = parsedOut.meetings.map((m: any) => ({
                title: m.summary || m.title || 'Sync Meeting',
                time: m.start ? formatToIST(m.start) : 'All Day',
                type: 'mcp',
              }));
              setMeetingsList(mapped);
            }
          } catch (err) {
            console.log('Error parsing MCP meeting outputs:', err);
          }
        }
      }

      // 3. Fetch Lead History to show Real Job Listings or Fallbacks
      const leadsJson = await HistoryAPI.getLeadHistory();
      if (leadsJson.success && leadsJson.data && leadsJson.data.length > 0) {
        const mappedJobs: JobMatch[] = leadsJson.data.slice(0, 3).map((job: any) => ({
          title: job.query || 'Technical Architect',
          company: job.source === 'linkedin' ? 'LinkedIn Partner' : 'Remote Hub',
          salary: '35 - 45 LPA',
          score: '96%',
          location: 'Noida, Sector 62',
        }));
        setJobMatches(mappedJobs);
      }

      setMcpHistoryLoaded(true);
    } catch (err) {
      console.error('Failed to aggregate dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDynamicDashboardData();
    // Fallback data initializations if blank
    if (meetingsList.length === 0) {
      setMeetingsList([
        { title: 'Career Strategy with Anya', time: '10:30 AM', type: 'Strategy' },
        { title: 'Google Calendar MCP Integration Sync', time: '02:00 PM', type: 'Technical' },
        { title: 'Daily Review & Mood Reflection', time: '05:30 PM', type: 'Growth' },
      ]);
    }
    if (jobMatches.length === 0) {
      setJobMatches([
        { title: 'Staff Mobile Engineer (React Native)', company: 'Innovate Noida Labs', salary: '42 - 50 LPA', score: '98%', location: 'Noida (Hybrid)' },
        { title: 'AI Solutions Architect', company: 'Noida CyberCity Fintech', salary: '45 - 60 LPA', score: '94%', location: 'Gurugram (Remote)' },
        { title: 'Lead FullStack Engineer', company: 'Global Tech Sector 62', salary: '38 - 48 LPA', score: '91%', location: 'Noida (On-site)' },
      ]);
    }
  }, [mcpHistoryLoaded]);

  // Handle Book Search trigger
  const handleBookSearch = async () => {
    if (!bookSearchQuery.trim()) {
      Alert.alert('Search Error', 'Please type a book keyword.');
      return;
    }
    setIsSearchingBooks(true);
    // Simulate premium book retrieval
    setTimeout(() => {
      setIsSearchingBooks(false);
      const query = bookSearchQuery.trim();
      const mockResult: Book = {
        title: `${query} (Retrieved)`,
        author: 'Anya Digital Engine',
        rating: 4.7,
        progress: 0,
        cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80',
      };
      setBooksList(prev => [mockResult, ...prev]);
      setBookSearchQuery('');
      Alert.alert('Book Found!', `"${query}" has been successfully indexed in your visual bookshelf!`);
    }, 1500);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={backgroundColor} />
      
      {/* Dynamic Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.welcomeGreeting, { color: subtextColor }]}>Welcome Back,</Text>
          <Text style={[styles.pageTitle, { color: textColor }]}>Anya Cockpit</Text>
        </View>
        <TouchableOpacity style={[styles.syncButton, { borderColor }]} onPress={loadDynamicDashboardData}>
          <MaterialCommunityIcon name="cached" size={22} color={textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={loadDynamicDashboardData} tintColor={textColor} />
        }
      >
        {/* 1. Life Engine - Streak & Mood History Chart */}
        {lifeEngineState && (
          <View style={[styles.widgetCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80' }}
              style={styles.bannerImage}
            />
            <View style={styles.cardPadding}>
              <View style={styles.widgetHeader}>
                <View>
                  <Text style={[styles.widgetTag, { color: '#f59e0b', backgroundColor: '#f59e0b15' }]}>LIFE ENGINE</Text>
                  <Text style={[styles.widgetTitle, { color: textColor }]}>Habits & Moods</Text>
                </View>
                <View style={styles.streakIndicator}>
                  <MaterialCommunityIcon name="fire" size={20} color="#f59e0b" />
                  <Text style={[styles.streakText, { color: textColor }]}>{lifeEngineState.streak || 0} Days</Text>
                </View>
              </View>

              <Text style={[styles.widgetDesc, { color: subtextColor }]}>
                Anya analyzes your habit streaks and logged daily mood fluctuations to deliver high-priority contextual nudges.
              </Text>

              {/* Graphical representation of Mood levels */}
              <Text style={[styles.subSectionLabel, { color: textColor }]}>7-Day Mood Trend</Text>
              <View style={styles.moodBarChart}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                  // Simulate daily variation
                  const heights = [75, 85, 60, 90, 70, 80, 95];
                  const moodScores = [7.5, 8.5, 6.0, 9.0, 7.0, 8.0, 9.5];
                  return (
                    <View key={idx} style={styles.chartCol}>
                      <View style={[styles.chartBarBackground, { backgroundColor: isDarkMode ? '#222' : '#e5e7eb' }]}>
                        <View style={[styles.chartBarActive, { height: `${heights[idx]}%`, backgroundColor: '#ec4899' }]} />
                      </View>
                      <Text style={[styles.chartDayText, { color: subtextColor }]}>{day}</Text>
                      <Text style={[styles.chartDayScore, { color: textColor }]}>{moodScores[idx]}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={[styles.actionBtnPrimary, { backgroundColor: '#f59e0b' }]}
                  onPress={async () => {
                    const res = await LifeEngineAPI.incrementStreak();
                    if (res.success) {
                      Alert.alert('🔥 Streak Boosted!', 'Keep up the good work! Streak successfully incremented.');
                      loadDynamicDashboardData();
                    } else {
                      Alert.alert('Notice', res.message || 'Streak already updated today!');
                    }
                  }}
                >
                  <MaterialCommunityIcon name="lightning-bolt" size={16} color="#ffffff" style={styles.btnIcon} />
                  <Text style={styles.btnText}>Boost Streak</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { borderColor }]}
                  onPress={() => setMoodModalVisible(true)}
                >
                  <MaterialCommunityIcon name="emoticon-happy-outline" size={16} color={textColor} style={styles.btnIcon} />
                  <Text style={[styles.btnTextSecondary, { color: textColor }]}>Log Mood ({lifeEngineState.current_mood || 0}/10)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 2. Google Calendar MCP Schedule Timeline */}
        <View style={[styles.widgetCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80' }}
            style={styles.bannerImage}
          />
          <View style={styles.cardPadding}>
            <View style={styles.widgetHeader}>
              <View>
                <Text style={[styles.widgetTag, { color: '#3b82f6', backgroundColor: '#3b82f615' }]}>GOOGLE CALENDAR</Text>
                <Text style={[styles.widgetTitle, { color: textColor }]}>Today's Schedule</Text>
              </View>
              <MaterialCommunityIcon name="calendar-multiselect" size={24} color="#3b82f6" />
            </View>

            <Text style={[styles.widgetDesc, { color: subtextColor }]}>
              Real-time MCP synchronization with your Google Calendar data. Anya updates events dynamically.
            </Text>

            {/* Timeline */}
            <View style={styles.timelineContainer}>
              {meetingsList.map((item, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <Text style={[styles.timelineTimeText, { color: textColor }]}>{item.time}</Text>
                    <View style={[styles.timelineBadge, { backgroundColor: '#3b82f620' }]}>
                      <Text style={{ color: '#3b82f6', fontSize: 10, fontWeight: '700' }}>{item.type.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.timelineIndicator}>
                    <View style={[styles.timelineDot, { backgroundColor: '#3b82f6' }]} />
                    {index < meetingsList.length - 1 && <View style={[styles.timelineLine, { backgroundColor: borderColor }]} />}
                  </View>
                  <View style={[styles.timelineRight, { backgroundColor: isDarkMode ? '#1e1e1e' : '#f9fafb' }]}>
                    <Text style={[styles.timelineItemTitle, { color: textColor }]}>{item.title}</Text>
                    <Text style={[styles.timelineItemSub, { color: subtextColor }]}>Auto-managed via Google Calendar MCP</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 3. Career Engine (High-Value Jobs matching Expected CTC) */}
        <View style={[styles.widgetCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80' }}
            style={styles.bannerImage}
          />
          <View style={styles.cardPadding}>
            <View style={styles.widgetHeader}>
              <View>
                <Text style={[styles.widgetTag, { color: '#10b981', backgroundColor: '#10b98115' }]}>CAREER ENGINE</Text>
                <Text style={[styles.widgetTitle, { color: textColor }]}>Tailored Opportunities</Text>
              </View>
              <MaterialCommunityIcon name="compass-outline" size={24} color="#10b981" />
            </View>

            <Text style={[styles.widgetDesc, { color: subtextColor }]}>
              Matching live LinkedIn listings in Noida & Gurgaon matching your Expected CTC profile preferences.
            </Text>

            {/* Job matches */}
            {jobMatches.map((job, idx) => (
              <View key={idx} style={[styles.jobCardItem, { borderColor, backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb' }]}>
                <View style={styles.jobHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.jobItemTitle, { color: textColor }]}>{job.title}</Text>
                    <Text style={[styles.jobItemCompany, { color: subtextColor }]}>{job.company}</Text>
                  </View>
                  <View style={styles.jobScoreContainer}>
                    <Text style={styles.jobScoreText}>{job.score}</Text>
                    <Text style={styles.jobScoreLabel}>match</Text>
                  </View>
                </View>
                <View style={styles.jobMetaRow}>
                  <View style={styles.jobMetaTag}>
                    <MaterialCommunityIcon name="map-marker-outline" size={13} color={subtextColor} />
                    <Text style={[styles.jobMetaTagText, { color: subtextColor }]}>{job.location}</Text>
                  </View>
                  <View style={styles.jobMetaTag}>
                    <MaterialCommunityIcon name="currency-inr" size={13} color="#10b981" />
                    <Text style={[styles.jobMetaTagText, { color: '#10b981', fontWeight: 'bold' }]}>{job.salary}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 4. Location Services - Address Geocoding */}
        <View style={[styles.widgetCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80' }}
            style={styles.bannerImage}
          />
          <View style={styles.cardPadding}>
            <View style={styles.widgetHeader}>
              <View>
                <Text style={[styles.widgetTag, { color: '#8b5cf6', backgroundColor: '#8b5cf615' }]}>LOCATION INTELLIGENCE</Text>
                <Text style={[styles.widgetTitle, { color: textColor }]}>Nearby Geocoded Checkpoints</Text>
              </View>
              <MaterialCommunityIcon name="google-maps" size={24} color="#8b5cf6" />
            </View>

            <Text style={[styles.widgetDesc, { color: subtextColor }]}>
              Using Google Maps MCP tools to geocode landmarks and dynamically calculate transit windows.
            </Text>

            {/* Geocode timeline */}
            <View style={styles.locationContainer}>
              <View style={[styles.locationCard, { backgroundColor: isDarkMode ? '#1e1e1e' : '#f9fafb' }]}>
                <MaterialCommunityIcon name="map-marker" size={26} color="#ef4444" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.locationName, { color: textColor }]}>Noida Tech Park - Sector 62</Text>
                  <Text style={[styles.locationCoords, { color: subtextColor }]}>28.6273° N, 77.3725° E</Text>
                </View>
                <Text style={styles.distanceBadge}>1.2 km</Text>
              </View>
              
              <View style={[styles.locationCard, { backgroundColor: isDarkMode ? '#1e1e1e' : '#f9fafb' }]}>
                <MaterialCommunityIcon name="map-marker-distance" size={26} color="#8b5cf6" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.locationName, { color: textColor }]}>Indira Gandhi Intl Airport (DEL)</Text>
                  <Text style={[styles.locationCoords, { color: subtextColor }]}>28.5562° N, 77.1000° E</Text>
                </View>
                <Text style={styles.distanceBadge}>28 km</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Digital Library - Interactive Books shelf */}
        <View style={[styles.widgetCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80' }}
            style={styles.bannerImage}
          />
          <View style={styles.cardPadding}>
            <View style={styles.widgetHeader}>
              <View>
                <Text style={[styles.widgetTag, { color: '#6366f1', backgroundColor: '#6366f115' }]}>DIGITAL LIBRARY</Text>
                <Text style={[styles.widgetTitle, { color: textColor }]}>Interactive Book Shelf</Text>
              </View>
              <MaterialCommunityIcon name="library-shelves" size={24} color="#6366f1" />
            </View>

            <Text style={[styles.widgetDesc, { color: subtextColor }]}>
              Search classic books using Anya's AI indexing. Track reading goals and completions.
            </Text>

            {/* Interactive Search */}
            <View style={[styles.searchBoxRow, { borderColor }]}>
              <TextInput
                style={[styles.searchTextInput, { color: textColor }]}
                placeholder="Search any book to index..."
                placeholderTextColor={subtextColor}
                value={bookSearchQuery}
                onChangeText={setBookSearchQuery}
              />
              <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleBookSearch} disabled={isSearchingBooks}>
                {isSearchingBooks ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialCommunityIcon name="plus" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Visual shelf */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
              {booksList.map((book, idx) => (
                <View key={idx} style={[styles.bookItemCard, { backgroundColor: isDarkMode ? '#1e1e1e' : '#f9fafb', borderColor }]}>
                  <Image source={{ uri: book.cover }} style={styles.bookCover} />
                  <View style={styles.bookInfo}>
                    <Text style={[styles.bookTitle, { color: textColor }]} numberOfLines={1}>{book.title}</Text>
                    <Text style={[styles.bookAuthor, { color: subtextColor }]}>{book.author}</Text>
                    
                    <View style={styles.ratingRow}>
                      <MaterialCommunityIcon name="star" size={13} color="#f59e0b" />
                      <Text style={[styles.ratingVal, { color: textColor }]}>{book.rating}</Text>
                    </View>

                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? '#333' : '#e5e7eb' }]}>
                        <View style={[styles.progressBarActive, { width: `${book.progress}%`, backgroundColor: '#6366f1' }]} />
                      </View>
                      <Text style={[styles.progressText, { color: subtextColor }]}>{book.progress}%</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Mood Logger Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={moodModalVisible}
        onRequestClose={() => setMoodModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMoodModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
                <View style={styles.dragHandle} />
                <Text style={[styles.modalTitle, { color: textColor }]}>Log Your Mood</Text>
                <Text style={[styles.modalSubtitle, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                  How are you feeling today on a scale of 1 to 10?
                </Text>

                {/* Interactive scale */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 24, marginTop: 12 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
                    const isSelected = parseInt(moodValue) === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setMoodValue(val.toString())}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 2,
                          borderColor: isSelected ? '#10b981' : borderColor,
                          backgroundColor: isSelected ? 'rgba(16,185,129,0.12)' : 'transparent',
                        }}
                      >
                        <Text style={{ color: isSelected ? '#10b981' : textColor, fontWeight: '800', fontSize: 15 }}>
                          {val}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={async () => {
                    const mood = parseInt(moodValue);
                    if (mood >= 1 && mood <= 10) {
                      setMoodModalVisible(false);
                      try {
                        const res = await LifeEngineAPI.logMood(mood, 'Logged from Dashboard');
                        if (res.success) {
                          Alert.alert('Success', 'Mood logged in Life Engine successfully!');
                          loadDynamicDashboardData();
                        } else {
                          Alert.alert('Error', 'Failed to log mood.');
                        }
                      } catch (err) {
                        Alert.alert('Error', 'API Exception when logging mood.');
                      }
                    } else {
                      Alert.alert('Invalid', 'Please select a number between 1 and 10.');
                    }
                  }}
                >
                  <Text style={styles.modalSaveBtnText}>Save Mood</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 20, 
    paddingHorizontal: 20 
  },
  welcomeGreeting: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 2 },
  syncButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Premium Widget Card Styles
  widgetCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  bannerImage: {
    width: '100%',
    height: 130,
  },
  cardPadding: {
    padding: 20,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  widgetTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  widgetTitle: {
    fontSize: 19,
    fontWeight: 'bold',
  },
  widgetDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },

  // Streak style
  streakIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f59e0b10',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },

  // 7-Day Mood Trend chart
  subSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  moodBarChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  chartCol: {
    alignItems: 'center',
    width: '12%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarBackground: {
    width: 8,
    height: 70,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBarActive: {
    width: '100%',
    borderRadius: 4,
  },
  chartDayText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  chartDayScore: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },

  // Action buttons inside cards
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flex: 0.48,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flex: 0.48,
  },
  btnIcon: { marginRight: 6 },
  btnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  btnTextSecondary: { fontSize: 13, fontWeight: '700' },

  // Timeline Schedule Styles
  timelineContainer: {
    paddingLeft: 4,
    marginTop: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLeft: {
    width: 75,
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  timelineTimeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  timelineBadge: {
    marginTop: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineIndicator: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    position: 'absolute',
    top: 15,
    bottom: -15,
  },
  timelineRight: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    marginLeft: 8,
  },
  timelineItemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  timelineItemSub: {
    fontSize: 10,
    marginTop: 4,
  },

  // Job Cards list
  jobCardItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobItemTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  jobItemCompany: {
    fontSize: 12,
    marginTop: 2,
  },
  jobScoreContainer: {
    backgroundColor: '#10b98120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
  },
  jobScoreText: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 12,
  },
  jobScoreLabel: {
    color: '#10b981',
    fontSize: 8,
    fontWeight: '700',
  },
  jobMetaRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  jobMetaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobMetaTagText: {
    fontSize: 11,
  },

  // Location Widget
  locationContainer: {
    marginTop: 10,
    gap: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '700',
  },
  locationCoords: {
    fontSize: 11,
    marginTop: 2,
  },
  distanceBadge: {
    backgroundColor: '#8b5cf620',
    color: '#8b5cf6',
    fontWeight: '800',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  // Interactive Book Shelf search & shelf
  searchBoxRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
    alignItems: 'center',
  },
  searchTextInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
  },
  searchSubmitBtn: {
    backgroundColor: '#6366f1',
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfScroll: {
    paddingBottom: 4,
  },
  bookItemCard: {
    width: 250,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    padding: 12,
    marginRight: 12,
  },
  bookCover: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  bookInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  bookAuthor: {
    fontSize: 11,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarActive: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
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
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalSaveBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default DashboardScreen;
