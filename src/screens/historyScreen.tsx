import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  View,
  Modal,
  ScrollView,
  FlatList,
  TouchableWithoutFeedback,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Clipboard,
  Platform,
  Alert,
} from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CONFIG } from '../config/index';
import { ThemeContext } from '../../App';

import { HistoryAPI, ChatAPI, NudgeAPI, ReportAPI } from '../services/api';

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

const HistoryScreen: React.FC = () => {
  const { theme } = useContext(ThemeContext);
  const isDarkMode = theme === 'dark';
  const backgroundColor = isDarkMode ? '#0a0a0a' : '#f3f4f6';
  const textColor = isDarkMode ? '#ffffff' : '#111827';
  const cardBackgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff';
  const borderColor = isDarkMode ? '#333333' : '#e5e7eb';
  const subtextColor = isDarkMode ? '#9ca3af' : '#4b5563';

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState('');
  const [selectedItemDetails, setSelectedItemDetails] = useState('');
  const [selectedSessionMessages, setSelectedSessionMessages] = useState<any[] | null>(null);

  const [activeTab, setActiveTab] = useState('mcp-calls');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHistory = async (tab: string, isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      let json: any = null;
      if (tab === 'mcp-calls') {
        json = await HistoryAPI.getMCPHistory();
      } else if (tab === 'ai-calls') {
        // Fetch real session-based AI Chat History!
        json = await ChatAPI.listSessions();
      } else if (tab === 'leads') {
        json = await HistoryAPI.getLeadHistory();
      } else if (tab === 'nudges') {
        json = await NudgeAPI.list();
      } else if (tab === 'reports') {
        json = await ReportAPI.getWeeklyReports();
      }

      if (json && json.success && json.data) {
        setHistoryData(json.data);
      } else {
        setHistoryData([]);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setHistoryData([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchHistory(activeTab);
  }, [activeTab]);

  const onRefresh = () => {
    fetchHistory(activeTab, true);
  };

  const tabs = [
    { id: 'mcp-calls', label: 'MCP Tools' },
    { id: 'ai-calls', label: 'AI Chats' },
    { id: 'leads', label: 'Leads' },
    { id: 'nudges', label: 'Nudges' },
    { id: 'reports', label: '📊 Weekly' },
  ];

  const handleSessionPress = async (item: any) => {
    setIsLoading(true);
    try {
      const res = await ChatAPI.getSession(item.id);
      if (res && res.success && res.data) {
        setSelectedQuery(res.data.title || 'Anya Chat Session');
        setSelectedSessionMessages(res.data.messages || []);
        setSelectedItemDetails('');
        setModalVisible(true);
      } else {
        Alert.alert('Error', 'Could not load chat messages.');
      }
    } catch (err) {
      console.error('Failed to fetch session detail:', err);
      Alert.alert('Error', 'Failed to connect to backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    let copyText = '';
    if (selectedSessionMessages) {
      copyText = selectedSessionMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Anya'}: ${m.content}`)
        .join('\n\n');
    } else {
      copyText = selectedItemDetails;
    }
    Clipboard.setString(copyText);
    Alert.alert('Copied!', 'Details copied to clipboard.');
  };

  // ── Weekly Report Card renderer ───────────────────────────────────────────
  const CATEGORY_COLORS: Record<string, string> = {
    health: '#10b981', mind: '#8b5cf6', business: '#f59e0b',
    tech: '#3b82f6', body: '#ef4444', motivation: '#f97316',
    innovation: '#06b6d4', reflection: '#6b7280',
  };

  const renderReportCard = ({ item }: any) => {
    const data = item.report_data || {};
    const breakdown: { category: string; total: string }[] = data.breakdown || [];
    const totalNudges = data.totalNudges || 0;
    const topCategory = data.topCategory || '—';
    const weekLabel = item.week_start
      ? new Date(item.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Unknown week';
    const maxCount = Math.max(...breakdown.map((b: any) => parseInt(b.total, 10)), 1);

    return (
      <TouchableOpacity
        style={[
          styles.historyCard,
          { backgroundColor: cardBackgroundColor, borderColor, borderWidth: 1.5 },
        ]}
        onPress={() => {
          setSelectedQuery(`Week of ${weekLabel}`);
          setSelectedSessionMessages(null);
          setSelectedItemDetails(
            `📊 Total Nudges: ${totalNudges}\n🏆 Top Category: ${topCategory}\n\n` +
            breakdown.map((b: any) => `  • ${b.category}: ${b.total} nudge(s)`).join('\n')
          );
          setModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcon name="chart-bar" color="#8b5cf6" size={18} />
            <Text style={[styles.historyTitleText, { color: textColor }]}>Week of {weekLabel}</Text>
          </View>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>
            {new Date(item.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </Text>
        </View>

        {/* Summary pills */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View style={[styles.reportPill, { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.3)' }]}>
            <Text style={{ color: '#8b5cf6', fontSize: 13, fontWeight: '700' }}>{totalNudges} nudges</Text>
          </View>
          <View style={[styles.reportPill, { backgroundColor: `rgba(${topCategory === 'tech' ? '59,130,246' : '16,185,129'},0.12)`, borderColor: `rgba(${topCategory === 'tech' ? '59,130,246' : '16,185,129'},0.3)` }]}>
            <Text style={{ color: CATEGORY_COLORS[topCategory] || '#10b981', fontSize: 13, fontWeight: '700' }}>🏆 {topCategory}</Text>
          </View>
        </View>

        {/* Breakdown mini bar chart */}
        {breakdown.slice(0, 5).map((b: any) => {
          const count = parseInt(b.total, 10);
          const pct = Math.min(Math.round((count / maxCount) * 100), 100);
          const col = CATEGORY_COLORS[b.category] || '#9ca3af';
          return (
            <View key={b.category} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 11, color: subtextColor, textTransform: 'capitalize' }}>{b.category}</Text>
                <Text style={{ fontSize: 11, color: col, fontWeight: '700' }}>{b.total}</Text>
              </View>
              {/* Bar: flex-based instead of percentage string (Android-safe) */}
              <View style={{ flexDirection: 'row', height: 4, borderRadius: 4, backgroundColor: isDarkMode ? '#2a2a2a' : '#e5e7eb', overflow: 'hidden' }}>
                <View style={{ flex: pct, backgroundColor: col }} />
                <View style={{ flex: 100 - pct }} />
              </View>
            </View>
          );
        })}
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }: any) => {
    if (activeTab === 'reports') return renderReportCard({ item });
    let icon = 'history';
    let color = '#9ca3af';
    let title = '';
    let subtitle = '';
    let statusText = 'Executed';
    let isError = false;

    // Format based on the active tab
    if (activeTab === 'mcp-calls') {
      icon = 'hammer-wrench';
      color = '#3b82f6';
      title = item.tool || 'Tool Call';
      subtitle = item.input ? JSON.stringify(item.input) : 'No parameters';
      if (!item.success) {
        statusText = 'Failed';
        isError = true;
      }
    } else if (activeTab === 'ai-calls') {
      icon = 'chat-processing-outline';
      color = '#8b5cf6';
      title = item.title || 'Chat Session';
      subtitle = `${item.message_count || 0} messages exchanged`;
      statusText = item.last_message_at ? formatToIST(item.last_message_at) : 'Active';
    } else if (activeTab === 'leads') {
      icon = 'briefcase-outline';
      color = '#10b981';
      title = item.query || 'Lead Query';
      subtitle = item.results ? `${item.result_count || 0} qualified jobs matches found` : 'Searching...';
      statusText = 'Complete';
    } else if (activeTab === 'nudges') {
      icon = 'lightbulb-on-outline';
      color = '#f59e0b';
      title = item.category ? `Nudge: ${item.category}` : 'Anya Nudge';
      subtitle = item.message || '';
      statusText = item.engaged ? 'Engaged' : 'Sent';
    }

    return (
      <TouchableOpacity
        style={[
          styles.historyCard,
          { backgroundColor: cardBackgroundColor, borderColor },
        ]}
        onPress={() => {
          if (activeTab === 'ai-calls') {
            handleSessionPress(item);
          } else {
            setSelectedQuery(title);
            setSelectedSessionMessages(null);
            setSelectedItemDetails(JSON.stringify(item, null, 2));
            setModalVisible(true);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.historyHeader}>
          <View style={styles.statusContainer}>
            <MaterialCommunityIcon
              name={icon}
              color={color}
              size={18}
            />
            <Text style={[styles.historyTitleText, { color: textColor }]}>
              {title}
            </Text>
          </View>
          <View style={styles.timestampContainer}>
            <Text style={styles.timestamp}>
              {formatToIST(item.last_message_at || item.created_at || item.called_at || item.searched_at || item.sent_at)}
            </Text>
          </View>
        </View>
        <Text
          numberOfLines={2}
          style={[styles.historyQuery, { color: subtextColor }]}
        >
          {subtitle}
        </Text>
        <View style={styles.historyFooter}>
          <Text style={[styles.statusIndicator, { color: isError ? '#ef4444' : '#3b82f6' }]}>
            {statusText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundColor}
      />
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { color: textColor }]}>History Logs</Text>
      </View>

      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabButton,
                activeTab === tab.id ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' } : { backgroundColor: cardBackgroundColor, borderColor }
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[
                styles.tabButtonText,
                { color: activeTab === tab.id ? '#ffffff' : textColor }
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading && !isRefreshing ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
      ) : historyData.length === 0 ? (
        <Text style={[styles.emptyText, { color: isDarkMode ? '#6b7280' : '#9ca3af' }]}>
          No records found for {tabs.find(t => t.id === activeTab)?.label}.
        </Text>
      ) : (
        <FlatList
          data={historyData}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderHistoryItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.historyList}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={textColor} />
          }
        />
      )}

      {/* Modal Details View */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop absolute dismiss target */}
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.modalContent,
              { backgroundColor: cardBackgroundColor },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {selectedSessionMessages ? 'Conversation Brief' : 'Raw Details'}
              </Text>
              <TouchableOpacity onPress={copyToClipboard} style={{ padding: 4 }}>
                <MaterialCommunityIcon
                  name="content-copy"
                  color={textColor}
                  size={18}
                />
              </TouchableOpacity>
            </View>

            {/* Session Messages Layout */}
            {selectedSessionMessages ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={{ paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.sessionTitleHeader, { color: textColor }]}>
                  {selectedQuery}
                </Text>
                {selectedSessionMessages.length === 0 ? (
                  <Text style={[styles.emptyText, { color: subtextColor }]}>No messages exchanged in this session.</Text>
                ) : (
                  selectedSessionMessages.map((msg, index) => {
                    const isUser = msg.role === 'user';
                    return (
                      <View
                        key={msg.id || index}
                        style={[
                          styles.messageWrapper,
                          isUser ? styles.messageUserAlign : styles.messageAnyaAlign
                        ]}
                      >
                        <View
                          style={[
                            styles.messageBubble,
                            {
                              backgroundColor: isUser
                                ? '#3b82f6'
                                : isDarkMode ? '#2d2d2d' : '#f3f4f6',
                              borderColor
                            }
                          ]}
                        >
                          <Text
                            style={[
                              styles.messageText,
                              { color: isUser ? '#ffffff' : textColor }
                            ]}
                          >
                            {msg.content}
                          </Text>
                        </View>
                        <Text style={styles.messageTimeText}>
                          {formatToIST(msg.created_at)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            ) : (
              <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 60 }}>
                <Text style={[styles.modalText, { color: textColor, fontWeight: 'bold', marginBottom: 8 }]}>
                  {selectedQuery}
                </Text>
                <Text style={[styles.modalText, { color: textColor, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                  {selectedItemDetails}
                </Text>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close Brief</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingVertical: 20, paddingHorizontal: 20 },
  pageTitle: { fontSize: 28, fontWeight: 'bold' },

  tabsWrapper: { paddingHorizontal: 20, marginBottom: 16 },
  tabsContainer: { flexDirection: 'row' },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  tabButtonText: { fontSize: 14, fontWeight: '600' },

  historyList: { paddingHorizontal: 20, paddingBottom: 20 },
  historyCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  historyTitleText: { fontSize: 14, fontWeight: '700', marginLeft: 6 },
  timestampContainer: { flexDirection: 'row', alignItems: 'center' },
  timestamp: { fontSize: 12, marginLeft: 4, color: '#6b7280' },
  historyQuery: { fontSize: 14, lineHeight: 20, fontWeight: '500', marginBottom: 8 },
  historyFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
  statusIndicator: { fontSize: 12, fontWeight: '700' },

  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15, fontStyle: 'italic' },

  reportPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 0,
    width: '100%',
    maxHeight: '82%',
    flex: 1,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalScroll: { flexGrow: 1, flexShrink: 1, marginBottom: 8 },
  modalText: { fontSize: 14, lineHeight: 22 },
  modalCloseButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: { color: 'white', fontSize: 16, fontWeight: '600' },

  sessionTitleHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  messageUserAlign: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageAnyaAlign: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTimeText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    marginHorizontal: 8,
  },
});

export default HistoryScreen;
