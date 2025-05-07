import { Platform } from 'react-native';

const fontFamily = {
  light: Platform.select({ ios: 'Inter-Light', android: 'Inter-Light' }),
  regular: Platform.select({ ios: 'Inter-Regular', android: 'Inter-Regular' }),
  medium: Platform.select({ ios: 'Inter-Medium', android: 'Inter-Medium' }),
  bold: Platform.select({ ios: 'Inter-Bold', android: 'Inter-Bold' }),
  black: Platform.select({ ios: 'Inter-Black', android: 'Inter-Black' }),
};

export const Typography = {
  headline: {
    fontFamily: fontFamily.light,
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 40,
    letterSpacing: 0.2,
  },
  subHeadline: {
    fontFamily: fontFamily.regular,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 28,
    letterSpacing: 0.1,
  },
  paragraph: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0.05,
  },
};
