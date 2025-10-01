import { getGradientColors } from '@/utils/gradientUtils';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import React, { useRef, useState, useEffect, cloneElement, ReactElement, useContext } from 'react';
import { View, TouchableOpacity, Text, Modal, StyleSheet, Dimensions, Animated, TouchableOpacityProps } from 'react-native';

interface Action {
  onClick: () => void;
  children: ReactElement;
}

interface ActionPopupButtonProps {
  children: ReactElement<TouchableOpacityProps>;
  actions: Action[];
  title?: string;
}

const ACTION_ITEM_HEIGHT = 68;
const ACTION_ITEM_GAP = 22;
const TITLE_HEIGHT = 32;
const ACTIONS_PADDING = 16;

export const ActionPopupButton: React.FC<ActionPopupButtonProps> = ({ children, actions, title }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [progress, setProgress] = useState(0);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const { network } = useContext(NetworkContext);
  const backgroundColor = getGradientColors(network)[1];

  // Handle press to show popup at bottom of screen
  const handlePressWithRef = () => {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const popupWidth = Math.min(370, screenWidth - 32); // Max 370px or screen width minus margins
    const popupHeight = actions.length * ACTION_ITEM_HEIGHT + (title ? TITLE_HEIGHT : 0) + (actions.length - 1 + (title ? 1 : 0)) * ACTION_ITEM_GAP + ACTIONS_PADDING * 2;

    // Center the popup horizontally at the bottom of the screen
    const popupX = (screenWidth - popupWidth) / 2;
    const popupY = screenHeight - popupHeight - 50; // 50px from bottom for safe area

    setPopupPosition({ x: popupX, y: popupY });

    setShowPopup(true);
    setProgress(0);
    progressAnimation.setValue(0);

    // Start progress for default button (first action)
    intervalRef.current = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress < 100) {
          const newProgress = prevProgress + (100 * 10) / 2000; // 2 sec
          progressAnimation.setValue(newProgress);
          return newProgress;
        }
        clearInterval(intervalRef.current!);
        // Trigger default action when progress reaches 100%
        setTimeout(() => actions[0]?.onClick(), 200); // propagate
        setShowPopup(false);
        return 100;
      });
    }, 10);
  };

  const handleActionPress = (action: () => void) => {
    // Clear the progress interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    // Trigger the clicked action
    action();
    setShowPopup(false);
    setProgress(0);
    progressAnimation.setValue(0);
  };

  const handleClose = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setShowPopup(false);
    setProgress(0);
    progressAnimation.setValue(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const enhancedChild = cloneElement(children, {
    onPress: handlePressWithRef,
  });

  return (
    <>
      {enhancedChild}

      <Modal visible={showPopup} transparent={true} animationType="fade" onRequestClose={handleClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleClose}>
          <View
            style={[
              styles.popupContainer,
              {
                position: 'absolute',
                top: popupPosition.y,
                left: popupPosition.x,
                width: Math.min(370, Dimensions.get('window').width - 32),
                backgroundColor,
              },
            ]}
          >
            <View style={styles.actionsContainer}>
              {title && (
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>{title}</Text>
                </View>
              )}
              {actions.map((action, index) => (
                <TouchableOpacity key={index} onPress={() => handleActionPress(action.onClick)} style={[styles.actionItem, index === 0 && styles.defaultActionItem]} activeOpacity={0.8}>
                  {index === 0 && progress > 0 && (
                    <Animated.View
                      style={[
                        styles.progressBar,
                        {
                          width: progressAnimation.interpolate({
                            inputRange: [0, 100],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  )}

                  <View style={styles.actionContent}>{action.children}</View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  popupContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 1000,
  },
  titleContainer: {
    alignItems: 'center',
    height: TITLE_HEIGHT,
  },
  title: {
    color: 'white',
    fontSize: 20,
  },
  actionsContainer: {
    padding: ACTIONS_PADDING,
    gap: ACTION_ITEM_GAP,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  defaultActionItem: {
    // Additional styles for the default action if needed
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: ACTION_ITEM_HEIGHT,
    paddingHorizontal: 16,
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
});
