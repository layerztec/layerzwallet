import { Text, type TextProps, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/ThemeContext';
import { ThemeOverrideProps, textStyles } from '@/hooks/useThemeHook';

export type TextVariant =
  | 'displayLarge'
  | 'displayMedium'
  | 'displaySmall'
  | 'headingLarge'
  | 'headingMedium'
  | 'headingSmall'
  | 'subtitleLarge'
  | 'subtitleMedium'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'labelLarge'
  | 'labelMedium'
  | 'labelSmall'
  | 'button'
  | 'link'
  | 'caption'
  | 'overline'
  | 'default'
  | 'title'
  | 'defaultSemiBold'
  | 'subtitle'; // Legacy variants

export type ThemedTextProps = TextProps &
  ThemeOverrideProps & {
    variant?: TextVariant;
    type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link'; // For legacy support
  };

export function ThemedText({
  style,
  lightColor,
  darkColor,
  variant,
  type, // Legacy prop
  ...rest
}: ThemedTextProps) {
  const { getColor } = useTheme();
  const color = getColor(lightColor && darkColor ? { lightColor, darkColor } : 'text');

  // Map legacy type prop to variant if variant is not specified
  if (!variant && type) {
    switch (type) {
      case 'title':
        variant = 'headingLarge';
        break;
      case 'subtitle':
        variant = 'subtitleLarge';
        break;
      case 'defaultSemiBold':
        variant = 'bodyLarge';
        break;
      case 'link':
        variant = 'link';
        break;
      default:
        variant = 'bodyLarge';
        break;
    }
  }

  // Default to bodyMedium if no variant specified
  if (!variant) {
    variant = 'bodyMedium';
  }

  return (
    <Text
      style={[
        { color, overflow: 'visible' },
        // Apply typography style based on variant
        textStyles[variant] || textStyles.bodyMedium,
        style,
      ]}
      {...rest}
    />
  );
}
