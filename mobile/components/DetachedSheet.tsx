import React, { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GorhomBottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients } from '@shared/constants/Colors';

interface DetachedSheetProps {
  children: React.ReactNode;
  variant?: string;
  onClose?: () => void;
  style?: ViewStyle;
  enableDynamicSizing?: boolean;
  enablePanDownToClose?: boolean;
  detached?: boolean;
  bottomInset?: number;
}

const DetachedSheet: React.FC<DetachedSheetProps> = ({ children, variant = 'base', onClose, style, enableDynamicSizing = true, enablePanDownToClose = true, detached = true, bottomInset }) => {
  const bottomSheetRef = useRef<GorhomBottomSheet>(null);
  const insets = useSafeAreaInsets();

  // Get gradient colors for the network (same logic as GradientFormSheet)
  const gradientColors = useMemo(() => {
    let id: keyof typeof gradients = 'base';
    for (const key of Object.keys(gradients)) {
      if (key.startsWith(variant)) {
        // this will work for liquid-testnet, for example.
        id = key as keyof typeof gradients;
        break;
      }
    }
    return gradients[id];
  }, [variant]);

  // Get network background color (first color of the gradient)
  const backgroundColor = useMemo(() => gradientColors[0], [gradientColors]);

  // Calculate bottom inset for detached mode (safe area)
  const calculatedBottomInset = useMemo(() => {
    if (bottomInset !== undefined) return bottomInset;
    return insets.bottom;
  }, [bottomInset, insets.bottom]);

  // Open bottom sheet on mount - with dynamic sizing, it will auto-size to content
  useEffect(() => {
    // Small delay to ensure the sheet is mounted and rendered
    const timer = setTimeout(() => {
      bottomSheetRef.current?.expand();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Render backdrop
  const renderBackdrop = (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} enableTouchThrough={false} />;

  return (
    <GestureHandlerRootView style={styles.gestureHandlerRoot}>
      <GorhomBottomSheet
        ref={bottomSheetRef}
        enableDynamicSizing={enableDynamicSizing}
        enablePanDownToClose={enablePanDownToClose}
        onClose={onClose}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        detached={detached}
        bottomInset={calculatedBottomInset}
        style={[styles.bottomSheetStyle, style]}
        backgroundComponent={({ style: backgroundStyle }) => (
          <View style={[backgroundStyle, styles.gradientContainer, { backgroundColor }]}>
            <View style={styles.blurView} />
          </View>
        )}
      >
        <BottomSheetView style={styles.bottomSheetContent}>{children}</BottomSheetView>
      </GorhomBottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  gestureHandlerRoot: {
    flex: 1,
  },
  bottomSheetStyle: {
    marginHorizontal: 12,
  },
  gradientContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurView: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    height: '120%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  bottomSheetContent: {
    flex: 1,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

export default DetachedSheet;
