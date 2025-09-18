import { Typography as SharedTypography } from '@shared/constants/Typography';

const fontFamily = {
  light: 'Inter-Light',
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  bold: 'Inter-Bold',
  black: 'Inter-Black',
} as const;

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
  button: {
    ...SharedTypography.button,
    fontFamily: fontFamily.medium,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    fontFamily: fontFamily.bold,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: fontFamily.medium,
    fontWeight: '500',
  },
} as const;
