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

const FlatListInner = <ItemT,>(props: FlatListProps<ItemT>, ref: React.ForwardedRef<RNFlatList<ItemT>>) => {
  const { contentContainerStyle, ...rest } = props;
  const padding = useSafeAreaPadding();

  return <RNFlatList ref={ref} {...rest} contentContainerStyle={[padding, contentContainerStyle]} />;
};

const SectionListInner = <ItemT, SectionT>(props: SectionListProps<ItemT, SectionT>, ref: React.ForwardedRef<RNSectionList<ItemT>>) => {
  const { contentContainerStyle, ...rest } = props;
  const padding = useSafeAreaPadding();

  return <RNSectionList ref={ref} {...rest} contentContainerStyle={[padding, contentContainerStyle]} />;
};

const FlatListWithRef = forwardRef(FlatListInner);
FlatListWithRef.displayName = 'SafeAreaFlatList';

const SectionListWithRef = forwardRef(SectionListInner);
SectionListWithRef.displayName = 'SafeAreaSectionList';

export const FlatList = FlatListWithRef as <ItemT = any>(props: FlatListProps<ItemT> & { ref?: React.Ref<RNFlatList<ItemT>> }) => ReturnType<typeof FlatListInner>;

export const SectionList = SectionListWithRef as <ItemT = any, SectionT = any>(
  props: SectionListProps<ItemT, SectionT> & { ref?: React.Ref<RNSectionList<ItemT>> }
) => ReturnType<typeof SectionListInner>;
