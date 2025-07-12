import { Typography as SharedTypography } from '@shared/constants/Typography';
import { Platform } from 'react-native';

const fontFamily = {
  light: Platform.select({ ios: 'Inter-Light', android: 'Inter-Light' }),
  regular: Platform.select({ ios: 'Inter-Regular', android: 'Inter-Regular' }),
  medium: Platform.select({ ios: 'Inter-Medium', android: 'Inter-Medium' }),
  bold: Platform.select({ ios: 'Inter-Bold', android: 'Inter-Bold' }),
  black: Platform.select({ ios: 'Inter-Black', android: 'Inter-Black' }),
};

export const Typography = {
  ...SharedTypography,
  headline: {
    ...SharedTypography.headline,
    fontFamily: fontFamily.light,
  },
  subHeadline: {
    ...SharedTypography.subHeadline,
    fontFamily: fontFamily.regular,
  },
  paragraph: {
    ...SharedTypography.paragraph,
    fontFamily: fontFamily.regular,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold' as const,
    fontFamily: fontFamily.bold,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: fontFamily.medium,
  },
};
