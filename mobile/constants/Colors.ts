/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const primaryColor = '#011474';
const accent1 = '#FD5D2B';
const accent2 = '#9DF9EC';
const accent3 = '#D9FD5F';
const accent4 = '#F5B9CD';
const neutral = '#CECDCD';

export const gradients = {
  gradient1: [accent1, accent2],
  gradient2: [accent3, accent4],
};

export const Colors = {
  light: {
    text: primaryColor,
    background: '#fff',
    tint: primaryColor,
    icon: accent1,
    tabIconDefault: neutral,
    tabIconSelected: accent1,
  },
  dark: {
    text: '#fff',
    background: primaryColor,
    tint: '#fff',
    icon: accent2,
    tabIconDefault: neutral,
    tabIconSelected: accent2,
  },
};
