import React from 'react';
import { SectionList as RNSectionList, SectionListProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function SectionList<ItemT, SectionT>(props: SectionListProps<ItemT, SectionT>) {
  const insets = useSafeAreaInsets();
  const { contentContainerStyle, ...rest } = props;
  const flattenedStyle = StyleSheet.flatten(contentContainerStyle) || {};
  const getNumericPadding = (value: unknown) => (typeof value === 'number' ? value : 0);
  const paddingBottom = getNumericPadding(flattenedStyle.paddingBottom) + insets.bottom;
  const paddingTop = getNumericPadding(flattenedStyle.paddingTop) + insets.top;

  return <RNSectionList {...rest} contentContainerStyle={[contentContainerStyle, { paddingBottom, paddingTop }]} />;
}
