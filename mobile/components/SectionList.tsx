import React, { useMemo } from 'react';
import { SectionList as RNSectionList, SectionListProps, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function SectionList<ItemT, SectionT>(props: SectionListProps<ItemT, SectionT>) {
  const { contentContainerStyle, ...rest } = props;
  const insets = useSafeAreaInsets();

  const paddedContentStyle = useMemo<StyleProp<ViewStyle>>(() => [{ paddingTop: insets.top, paddingBottom: insets.bottom }, contentContainerStyle], [contentContainerStyle, insets.bottom, insets.top]);

  return <RNSectionList {...rest} contentContainerStyle={paddedContentStyle} />;
}
