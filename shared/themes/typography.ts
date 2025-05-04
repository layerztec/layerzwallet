export const FontFamily = {
  Regular: 'Inter-Regular',
  Light: 'Inter-Light',
  Medium: 'Inter-Medium',
  Bold: 'Inter-Bold',
  Black: 'Inter-Black',
};

export const Typography = {
  Headline: {
    fontFamily: FontFamily.Light,
    fontWeight: '300',
    fontSize: 32,
    lineHeight: 40,
  },
  Subheadline: {
    fontFamily: FontFamily.Regular,
    fontWeight: '400',
    fontSize: 24,
    lineHeight: 32,
  },
  Paragraph: {
    fontFamily: FontFamily.Regular,
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
  },
  Medium: {
    fontFamily: FontFamily.Medium,
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24,
  },
  Bold: {
    fontFamily: FontFamily.Bold,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
  },
  Black: {
    fontFamily: FontFamily.Black,
    fontWeight: '900',
    fontSize: 16,
    lineHeight: 24,
  },
  Caption: {
    fontFamily: FontFamily.Regular,
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
  },
  Button: {
    fontFamily: FontFamily.Bold,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
};
