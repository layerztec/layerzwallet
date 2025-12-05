import React from 'react';
import { FlatList as RNFlatList, FlatListProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function FlatList<T>(props: FlatListProps<T>) {
  const insets = useSafeAreaInsets();
  const { contentContainerStyle, ...rest } = props;
  const flattenedStyle = StyleSheet.flatten(contentContainerStyle) || {};
  const getNumericPadding = (value: unknown) => (typeof value === 'number' ? value : 0);
  const paddingBottom = getNumericPadding(flattenedStyle.paddingBottom) + insets.bottom;
  const paddingTop = getNumericPadding(flattenedStyle.paddingTop) + insets.top;

  return <RNFlatList {...rest} contentContainerStyle={[contentContainerStyle, { paddingBottom, paddingTop }]} />;
}
