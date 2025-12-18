import React, { forwardRef } from 'react';
import { FlatList as RNFlatList, SectionList as RNSectionList, type FlatListProps, type SectionListProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Shared padding helpers so list content does not clash with notches/home indicators
const useSafeAreaPadding = () => {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: insets.top + 8,
    paddingBottom: insets.bottom + 16,
  } as const;
};

export const FlatList = forwardRef<RNFlatList<any>, FlatListProps<any>>((props, ref) => {
  const { contentContainerStyle, ...rest } = props;
  const padding = useSafeAreaPadding();

  return <RNFlatList ref={ref} {...rest} contentContainerStyle={[padding, contentContainerStyle]} />;
});

export const SectionList = forwardRef<RNSectionList<any>, SectionListProps<any>>((props, ref) => {
  const { contentContainerStyle, ...rest } = props;
  const padding = useSafeAreaPadding();

  return <RNSectionList ref={ref} {...rest} contentContainerStyle={[padding, contentContainerStyle]} />;
});

FlatList.displayName = 'SafeAreaFlatList';
SectionList.displayName = 'SafeAreaSectionList';
