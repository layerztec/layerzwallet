import { Text as TamaguiText, styled, GetProps, useTheme } from 'tamagui';

// Create a styled Tamagui component
const StyledText = styled(TamaguiText, {
  name: 'BaseText',
  fontFamily: 'body',
  variants: {
    type: {
      headline: {
        fontFamily: '$body',
        fontSize: '$6',
        fontWeight: '$light',
        lineHeight: '$6',
        letterSpacing: '$4',
      },
      subHeadline: {
        fontFamily: '$body',
        fontSize: '$4',
        fontWeight: '$regular',
        lineHeight: '$4',
        letterSpacing: '$3',
      },
      paragraph: {
        fontFamily: '$body',
        fontSize: '$3',
        fontWeight: '$regular',
        lineHeight: '$3',
        letterSpacing: '$2',
      },
      defaultSemiBold: {
        fontFamily: '$body',
        fontSize: '$3',
        fontWeight: '$bold',
        lineHeight: '$3',
        letterSpacing: '$2',
      },
      link: {
        fontFamily: '$body',
        fontSize: '$3',
        fontWeight: '$regular',
        lineHeight: '$3',
        letterSpacing: '$2',
        color: '#0a7ea4',
      },
      title: {
        fontFamily: '$body',
        fontSize: '$6',
        fontWeight: '$light',
        lineHeight: '$6',
        letterSpacing: '$4',
      },
      subtitle: {
        fontFamily: '$body',
        fontSize: '$4',
        fontWeight: '$regular',
        lineHeight: '$4',
        letterSpacing: '$3',
      },
    },
  } as const,
  defaultVariants: {
    type: 'paragraph',
  },
});

export type ThemedTextProps = GetProps<typeof StyledText> & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
};

export function ThemedText({ type = 'default', lightColor, darkColor, color, ...props }: ThemedTextProps) {
  const theme = useTheme();

  // Handle custom color overrides
  const textColor = color || (theme.name === 'dark' ? darkColor : lightColor) || theme.text;

  // Map 'default' to 'paragraph'
  const textType = type === 'default' ? 'paragraph' : type;

  return <StyledText type={textType as any} color={textColor} {...props} />;
}
