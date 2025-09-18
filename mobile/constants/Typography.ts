import { Typography as SharedTypography, fontFamily } from '@shared/constants/Typography';

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
