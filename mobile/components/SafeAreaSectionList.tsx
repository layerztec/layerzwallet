import React from 'react';
import { SectionList, SectionListProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function SafeAreaSectionList<ItemT, SectionT>(props: SectionListProps<ItemT, SectionT>) {
  const insets = useSafeAreaInsets();
  const { contentContainerStyle, ...rest } = props;

  return <SectionList {...rest} contentContainerStyle={[contentContainerStyle, { paddingBottom: (StyleSheet.flatten(contentContainerStyle)?.paddingBottom || 0) + insets.bottom }]} />;
}
