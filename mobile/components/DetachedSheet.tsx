import React, { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import GorhomBottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RadialGradient } from 'react-native-gradients';
import { getNetworkPrimaryColor } from '@shared/constants/Colors';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_USDT } from '@shared/types/networks';
import PlatformBlurView from './PlatformBlurView';

interface DetachedSheetProps {
  children: React.ReactNode;
  variant?: string;
  layerNetwork?: string;
  onClose?: () => void;
  style?: ViewStyle;
  enableDynamicSizing?: boolean;
  enablePanDownToClose?: boolean;
  detached?: boolean;
  bottomInset?: number;
}

const DetachedSheet: React.FC<DetachedSheetProps> = ({
  children,
  variant = 'base',
  layerNetwork,
  onClose,
  style,
  enableDynamicSizing = true,
  enablePanDownToClose = true,
  detached = true,
  bottomInset,
}) => {
  const bottomSheetRef = useRef<GorhomBottomSheet>(null);
  const insets = useSafeAreaInsets();

  // Get the effective network for the radial gradient
  const effectiveNetwork = useMemo(() => {
    if (layerNetwork === NETWORK_LIGHTNING || layerNetwork === NETWORK_LIGHTNING_TESTNET) {
      return NETWORK_LIGHTNING;
    }
    if (layerNetwork === NETWORK_USDT) {
      return NETWORK_USDT;
    }
    if (variant === NETWORK_LIGHTNING || variant === NETWORK_LIGHTNING_TESTNET) {
      return NETWORK_LIGHTNING;
    }
    if (variant === NETWORK_USDT) {
      return NETWORK_USDT;
    }
    return variant;
  }, [variant, layerNetwork]);

  // Radial gradient color list
  const radialColorList = useMemo(() => {
    const primaryColor = getNetworkPrimaryColor(effectiveNetwork);
    const blackOpacity = Platform.OS === 'ios' ? '0' : '0.7';
    return [
      { offset: '0%', color: primaryColor, opacity: '1' },
      { offset: '100%', color: '#000000', opacity: blackOpacity },
    ];
  }, [effectiveNetwork]);

  const calculatedBottomInset = useMemo(() => {
    if (bottomInset !== undefined) return bottomInset;
    return insets.bottom;
  }, [bottomInset, insets.bottom]);

  // Open bottom sheet on mount - with dynamic sizing, it will auto-size to content
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomSheetRef.current?.expand();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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
          <View style={[backgroundStyle, styles.gradientContainer]}>
            <PlatformBlurView intensity={50} tint="light" style={styles.blurOverlay} />
            <View style={styles.radialGradientWrapper}>
              <RadialGradient colorList={radialColorList} x="50%" y={Platform.OS === 'ios' ? '-14%' : '-34%'} rx={Platform.OS === 'ios' ? '102%' : '80%'} ry={Platform.OS === 'ios' ? '95%' : '85%'} />
            </View>
            <View style={styles.borderOverlay} pointerEvents="none" />
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
    borderRadius: 32,
    overflow: 'hidden',
  },
  radialGradientWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 800,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomSheetContent: {
    flex: 1,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

export default DetachedSheet;
