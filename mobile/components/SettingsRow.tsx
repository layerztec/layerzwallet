import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle, Platform, Switch } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@shared/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface SettingsRowProps {
  title: string;
  description?: string;
  onPress?: () => void;
  showBottomDivider?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  showSwitch?: boolean;
  switchValue?: boolean;
  onSwitchToggle?: (value: boolean) => void;
}

export default function SettingsRow({
  title,
  description,
  onPress,
  showBottomDivider = false,
  disabled = false,
  testID,
  style,
  showSwitch = false,
  switchValue = false,
  onSwitchToggle,
}: SettingsRowProps) {
  const ContainerComponent = onPress && !showSwitch ? Pressable : View;

  const rippleConfig =
    Platform.OS === 'android'
      ? {
          color: 'rgba(255, 255, 255, 0.1)',
          borderless: false,
        }
      : undefined;

  return (
    <ContainerComponent
      style={({ pressed }: { pressed?: boolean }) => [styles.container, disabled && styles.disabledContainer, Platform.OS === 'ios' && pressed && styles.iosPressed, style]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      android_ripple={rippleConfig}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <ThemedText style={[styles.title, disabled && styles.disabledText]} darkColor={disabled ? Colors.dark.text : Colors.dark.buttonText}>
            {title}
          </ThemedText>
          {description && (
            <ThemedText style={[styles.description, disabled && styles.disabledText]} darkColor={disabled ? Colors.dark.text : Colors.dark.text}>
              {description}
            </ThemedText>
          )}
        </View>

        {showSwitch ? (
          <View style={styles.switchContainer}>
            <Switch
              value={switchValue}
              onValueChange={onSwitchToggle}
              disabled={disabled}
              trackColor={{
                false: Colors.dark.tabIconDefault,
                true: Colors.dark.buttonPrimary,
              }}
              thumbColor={switchValue ? Colors.dark.buttonText : Colors.dark.text}
            />
          </View>
        ) : (
          onPress && (
            <View style={styles.chevronContainer}>
              <Ionicons name="chevron-forward" size={20} color={disabled ? Colors.dark.tabIconDefault : Colors.dark.buttonText} />
            </View>
          )
        )}
      </View>

      {showBottomDivider && <View style={[styles.divider, disabled && styles.disabledDivider]} />}
    </ContainerComponent>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  disabledContainer: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    minHeight: 56,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 4,
  },
  chevronContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.buttonBorder,
  },
  disabledText: {
    opacity: 0.6,
  },
  disabledDivider: {
    opacity: 0.3,
  },
  iosPressed: {
    opacity: 0.7,
  },
});
