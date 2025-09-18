export const fontFamily = {
  light: 'Inter-Light',
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  bold: 'Inter-Bold',
  black: 'Inter-Black',
} as const;

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
  button: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: -0.32,
    textAlign: 'center',
  },
} as const;
