import { StyleSheet, StyleProp } from 'react-native';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'transparent',
  },
  title: {
    textAlign: 'center',
    color: 'white',
    opacity: 0.8,
  },
});

export const buildScreenHeaderOptions = (config: NativeStackNavigationOptions = {}): NativeStackNavigationOptions => {
  const { headerTitle, headerStyle, headerBackVisible, headerRight } = config as NativeStackNavigationOptions & { testID?: string };

  return {
    ...config,
    headerTransparent: config.headerTransparent ?? true,
    headerShadowVisible: config.headerShadowVisible ?? false,
    headerBackVisible: headerBackVisible ?? true,
    headerBackButtonDisplayMode: config.headerBackButtonDisplayMode ?? 'default',
    headerTitleAlign: config.headerTitleAlign ?? 'center',
    headerTintColor: config.headerTintColor ?? '#fff',
    headerStyle: StyleSheet.compose(styles.header, headerStyle as StyleProp<{ backgroundColor?: string }>),
    headerTitle: headerTitle,
    headerRight,
  };
};

export default buildScreenHeaderOptions;
