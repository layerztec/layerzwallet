import { StyleSheet, StyleProp, TextStyle } from 'react-native';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'transparent',
  },
  title: {
    textAlign: 'center',
    color: 'white',
  },
});

export const buildScreenHeaderOptions = (config: NativeStackNavigationOptions = {}): NativeStackNavigationOptions => {
  const { headerTitle, headerStyle, headerBackVisible, headerRight } = config as NativeStackNavigationOptions & { testID?: string };

  return {
    ...config,
    headerTransparent: config.headerTransparent ?? true,
    headerBackVisible: headerBackVisible ?? true,
    headerBackButtonDisplayMode: config.headerBackButtonDisplayMode ?? 'minimal',
    headerTitleAlign: config.headerTitleAlign ?? 'center',
    headerTintColor: config.headerTintColor ?? '#fff',
    headerStyle: StyleSheet.compose(styles.header, headerStyle as StyleProp<{ backgroundColor?: string }>),
    headerTitle,
    headerTitleStyle: StyleSheet.compose(styles.title, config.headerTitleStyle),
    headerRight,
  };
};

export default buildScreenHeaderOptions;
