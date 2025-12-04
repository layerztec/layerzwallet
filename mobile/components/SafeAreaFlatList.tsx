import React from 'react';
import { FlatList, FlatListProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function SafeAreaFlatList<T>(props: FlatListProps<T>) {
  const insets = useSafeAreaInsets();
  const { contentContainerStyle, ...rest } = props;

  return <FlatList {...rest} contentContainerStyle={[contentContainerStyle, { paddingBottom: (StyleSheet.flatten(contentContainerStyle)?.paddingBottom || 0) + insets.bottom }]} />;
}
