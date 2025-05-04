/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const primaryColor = '#011474';
const accentGradient1 = ['#FD5D2B', '#9DF9EC'];
const accentGradient2 = ['#D9FD5F', '#F5B9CD'];
const neutral = '#CECDCD';

export const Colors = {
  light: {
    text: primaryColor,
    background: '#fff',
    tint: primaryColor,
    icon: accentGradient1[0],
    tabIconDefault: neutral,
    tabIconSelected: accentGradient1[0],
    accentGradient1,
    accentGradient2,
  },
  dark: {
    text: '#fff',
    background: primaryColor,
    tint: '#fff',
    icon: accentGradient1[1],
    tabIconDefault: neutral,
    tabIconSelected: accentGradient1[1],
    accentGradient1,
    accentGradient2,
  },
};
