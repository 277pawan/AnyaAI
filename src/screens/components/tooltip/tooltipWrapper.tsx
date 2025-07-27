import React, { ReactNode, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  useColorScheme,
} from 'react-native';
import Tooltip from 'react-native-walkthrough-tooltip';

type TooltipWrapperProps = {
  children: ReactNode; // Element to wrap (icon, button, etc.)
  tooltipText: string; // Text to show inside tooltip
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right'; // optional
  tooltipStyle?: object; // custom style for tooltip container
  textStyle?: object; // custom style for tooltip text
  onLongPressDelay?: number; // delay in ms for long press (default 300)
};

function TooltipWrapper({
  children,
  tooltipText,
  tooltipPlacement = 'top',
  tooltipStyle,
  textStyle,
  onLongPressDelay = 300,
}: TooltipWrapperProps) {
  const [visible, setVisible] = useState(false);

  const theme = useColorScheme();
  const textColor = theme === 'dark' ? 'black' : 'white';
  const backgroundColor = theme === 'dark' ? 'white' : '#0a0a0a';

  const styles = StyleSheet.create({
    tooltipContent: {
      backgroundColor: backgroundColor,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    tooltipText: {
      color: textColor,
      fontWeight: '500',
      fontSize: 14,
    },
  });

  return (
    <Tooltip
      isVisible={visible}
      content={
        <View style={[styles.tooltipContent, tooltipStyle]}>
          <Text style={[styles.tooltipText, textStyle]}>{tooltipText}</Text>
        </View>
      }
      placement={tooltipPlacement}
      onClose={() => setVisible(false)}
      showChildInTooltip={false}
      disableShadow
      backgroundColor="transparent"
    >
      <TouchableOpacity
        onLongPress={() => setVisible(true)}
        delayLongPress={onLongPressDelay}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    </Tooltip>
  );
}

export default TooltipWrapper;
