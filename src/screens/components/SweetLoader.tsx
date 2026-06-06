/**
 * SweetLoader.tsx
 * A beautiful, premium animated overlay loader for Anya's profile/settings page.
 * Used for: syncing contacts, adding/deleting items, alert time changes, data fetches.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface SweetLoaderProps {
  visible: boolean;
  label?: string;
  isDark?: boolean;
  /** 'inline' = no modal overlay, just the spinner row  */
  mode?: 'overlay' | 'inline';
}

export const SweetLoader: React.FC<SweetLoaderProps> = ({
  visible,
  label = 'Syncing…',
  isDark = true,
  mode = 'overlay',
}) => {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.92)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      // Continuous spin
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();

      // Gentle pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.08,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0.92,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start();
      spin.stopAnimation();
      spin.setValue(0);
      pulse.stopAnimation();
      pulse.setValue(0.92);
    }
  }, [visible]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const colors = {
    overlay: isDark ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.72)',
    card: isDark ? '#18181b' : '#ffffff',
    ring: isDark ? '#6366f1' : '#4f46e5',
    ringTrack: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.10)',
    icon: isDark ? '#a5b4fc' : '#6366f1',
    text: isDark ? '#e2e8f0' : '#1e293b',
    subtext: isDark ? '#64748b' : '#94a3b8',
  };

  const spinnerEl = (
    <Animated.View
      style={[
        styles.spinnerWrapper,
        { opacity: fadeAnim },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View style={[styles.ringTrack, { borderColor: colors.ringTrack }]}>
          <Animated.View
            style={[
              styles.ring,
              { borderTopColor: colors.ring, transform: [{ rotate }] },
            ]}
          />
          <View style={styles.iconCenter}>
            <MaterialCommunityIcons
              name="sync"
              size={20}
              color={colors.icon}
            />
          </View>
        </View>
      </Animated.View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.sublabel, { color: colors.subtext }]}>
        please wait…
      </Text>
    </Animated.View>
  );

  if (!visible && mode === 'inline') return null;
  if (mode === 'inline') {
    return (
      <Animated.View style={[styles.inlineRow, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.ringSmall,
            { borderTopColor: colors.ring, transform: [{ rotate }] },
          ]}
        />
        <Text style={[styles.inlineLabel, { color: colors.text }]}>{label}</Text>
      </Animated.View>
    );
  }

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View
        style={[
          styles.overlay,
          {
            backgroundColor: colors.overlay,
            opacity: fadeAnim,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {spinnerEl}
        </View>
      </Animated.View>
    </Modal>
  );
};

const SIZE = 68;
const BORDER = 4;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    minWidth: 180,
  },
  spinnerWrapper: {
    alignItems: 'center',
  },
  ringTrack: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: BORDER,
    borderColor: 'transparent',
    borderTopWidth: BORDER,
  },
  iconCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    marginTop: 18,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  sublabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  // Inline (no modal) variant
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  ringSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopWidth: 2.5,
  },
  inlineLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SweetLoader;
