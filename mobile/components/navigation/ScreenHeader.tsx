import React from 'react';
import { StyleSheet, StyleProp, View, TouchableOpacity } from 'react-native';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';

type ScreenHeaderProps = {
  title?: string;
  subtitle?: string;
  onBackPress?: () => void;
  showBackButton?: boolean;
  rightElement?: React.ReactNode;
};

const stackHeaderStyles = StyleSheet.create({
  header: {
    backgroundColor: 'transparent',
  },
  title: {
    textAlign: 'center',
    color: 'white',
  },
});

const componentStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  title: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  rightContainer: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, onBackPress, showBackButton, rightElement }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const canGoBack = navigation.canGoBack();
  const shouldShowBack = showBackButton ?? canGoBack;

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (canGoBack) {
      navigation.goBack();
    }
  };

  return (
    <View style={[componentStyles.container, { paddingTop: (insets.top || 0) + 8 }]}>
      <View style={componentStyles.row}>
        {shouldShowBack ? (
          <TouchableOpacity onPress={handleBack} style={componentStyles.iconButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="ScreenHeaderBackButton">
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={componentStyles.placeholder} />
        )}

        <View style={componentStyles.titleContainer}>
          {title ? <ThemedText style={componentStyles.title}>{title}</ThemedText> : null}
          {subtitle ? <ThemedText style={componentStyles.subtitle}>{subtitle}</ThemedText> : null}
        </View>

        <View style={componentStyles.rightContainer}>{rightElement ?? <View style={componentStyles.placeholder} />}</View>
      </View>
    </View>
  );
};

export const buildScreenHeaderOptions = (config: NativeStackNavigationOptions = {}): NativeStackNavigationOptions => {
  const { headerTitle, headerStyle, headerBackVisible, headerRight } = config as NativeStackNavigationOptions & { testID?: string };

  return {
    ...config,
    headerTransparent: config.headerTransparent ?? true,
    headerBackVisible: headerBackVisible ?? true,
    headerBackButtonDisplayMode: config.headerBackButtonDisplayMode ?? 'minimal',
    headerTitleAlign: config.headerTitleAlign ?? 'center',
    headerTintColor: config.headerTintColor ?? '#fff',
    headerStyle: StyleSheet.compose(stackHeaderStyles.header, headerStyle as StyleProp<{ backgroundColor?: string }>),
    headerTitle,
    headerTitleStyle: StyleSheet.compose(stackHeaderStyles.title, config.headerTitleStyle),
    headerRight,
  };
};

export default ScreenHeader;
