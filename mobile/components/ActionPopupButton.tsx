import React, { useRef, useState, useEffect, cloneElement, ReactElement } from 'react';
import { View, TouchableOpacity, Text, Modal, StyleSheet, Dimensions, Animated, TouchableOpacityProps } from 'react-native';

interface Action {
  label: string;
  onClick: () => void;
}

interface ActionPopupButtonProps {
  children: ReactElement<TouchableOpacityProps>;
  actions: Action[];
}

export const ActionPopupButton: React.FC<ActionPopupButtonProps> = ({ children, actions }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [progress, setProgress] = useState(0);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Clone the original component and inject onPress for multiple actions
  const handlePressWithRef = (event: any) => {
    // Get the target from the press event for positioning
    const target = event.target || event.currentTarget;
    if (target && target.measureInWindow) {
      target.measureInWindow((x: number, y: number, width: number, height: number) => {
        const screenWidth = Dimensions.get('window').width;
        const popupWidth = 200; // Approximate popup width

        // Center the popup above the button
        const popupX = Math.max(10, Math.min(x + width / 2 - popupWidth / 2, screenWidth - popupWidth - 10));
        const popupY = y - 200; // Position above the button

        setPopupPosition({ x: popupX, y: popupY });
      });
    }

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
              },
            ]}
          >
            {actions.map((action, index) => (
              <TouchableOpacity key={index} onPress={() => handleActionPress(action.onClick)} style={[styles.actionButton, index === 0 && styles.defaultActionButton]} activeOpacity={0.7}>
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
                <Text style={styles.actionButtonText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  popupContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    minWidth: 200,
    zIndex: 1000,
  },
  actionButton: {
    backgroundColor: '#282c34',
    borderWidth: 1,
    borderColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  defaultActionButton: {
    // Additional styles for the default button if needed
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    zIndex: 1,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 5,
    backgroundColor: 'white',
  },
});
