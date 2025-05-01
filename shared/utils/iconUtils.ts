import { Platform } from 'react-native';

/**
 * Helper utility to get the appropriate icon for each platform
 *
 * @param options Icon options for different platforms
 * @returns The appropriate icon for the current platform
 */
export function getIcon<T, W>(options: { mobile: T; web: W; ios?: T; android?: T }): T | W {
  if (Platform.OS === 'ios') {
    return options.ios || options.mobile;
  }

  if (Platform.OS === 'android') {
    return options.android || options.mobile;
  }

  return options.web;
}

/**
 * Maps common icon names to platform-specific implementations
 * @param iconName A generic icon name
 * @returns Platform-specific icon name
 */
export function mapIconName(iconName: string): string {
  // Common icon name map for cross-platform consistency
  const ICON_MAP: Record<string, { mobile: string; ios?: string; android?: string; web: string }> = {
    send: {
      mobile: 'paperplane.fill',
      ios: 'paperplane.fill',
      android: 'send',
      web: 'send',
    },
    receive: {
      mobile: 'arrow.down',
      ios: 'arrow.down.circle.fill',
      web: 'arrow-down-circle',
    },
    settings: {
      mobile: 'gear',
      ios: 'gear',
      android: 'settings',
      web: 'settings',
    },
    scan: {
      mobile: 'qrcode.viewfinder',
      ios: 'qrcode.viewfinder',
      android: 'qr-code-scanner',
      web: 'scan',
    },
  };

  const iconMap = ICON_MAP[iconName];
  if (!iconMap) return iconName; // Fallback to the original name

  return getIcon(iconMap);
}
