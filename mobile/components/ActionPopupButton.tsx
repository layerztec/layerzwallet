import React, { cloneElement, ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';

import { getGradientColors } from '@/utils/gradientUtils';
import { NetworkContext } from '@shared/hooks/NetworkContext';

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
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
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
  };

  const handleActionPress = (action: () => void) => {
    // Trigger the clicked action
    action();
    setShowPopup(false);
  };

  const handleClose = useCallback(() => {
    setShowPopup(false);
  }, []);

  const enhancedChild = cloneElement(children, {
    onPress: handlePressWithRef,
  });

  // dismiss popup when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        handleClose();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleClose]);

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
                <TouchableOpacity key={index} onPress={() => handleActionPress(action.onClick)} style={styles.actionItem} activeOpacity={0.8}>
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
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: ACTION_ITEM_HEIGHT,
    paddingHorizontal: 16,
  },
});
