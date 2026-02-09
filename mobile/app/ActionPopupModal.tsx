import React, { useContext, useEffect } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import Pressable from '../components/Pressable';
import { useRouter } from 'expo-router';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getGradientColors } from '@/utils/gradientUtils';
import { useActionPopup } from '@/contexts/ActionPopupContext';
import { Ionicons } from '@expo/vector-icons';

const ACTION_ITEM_HEIGHT = 68;
const ACTION_ITEM_GAP = 22;
const TITLE_HEIGHT = 32;
const ACTIONS_PADDING = 16;

export default function ActionPopupModal() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const backgroundColor = getGradientColors(network)[1];
  const { getActions, clearActions } = useActionPopup();
  const { actions, title } = getActions();

  const handleActionPress = (action: () => void, index: number) => {
    console.debug('[ActionPopupModal] Button pressed, index:', index);
    // Dismiss the modal first to allow the action's navigation to work
    console.debug('[ActionPopupModal] Dismissing modal');
    router.back();
    // Trigger the clicked action after a small delay to ensure modal dismisses first
    setTimeout(() => {
      try {
        console.debug('[ActionPopupModal] Executing action...');
        action();
        console.debug('[ActionPopupModal] Action executed successfully');
      } catch (error) {
        console.error('[ActionPopupModal] Error executing action:', error);
      }
    }, 100);
  };

  const handleClose = () => {
    router.back();
  };

  // Clear actions when modal is unmounted
  useEffect(() => {
    return () => {
      clearActions();
    };
  }, [clearActions]);

  // accessibility is disabled on some wrappers for maestro to be able to see the buttons

  return (
    <Pressable accessible={false} style={styles.modalOverlay} activeOpacity={1} onPress={handleClose}>
      <Pressable accessible={false} activeOpacity={1} onPress={(e: GestureResponderEvent) => e.stopPropagation()}>
        <View accessible={false} style={[styles.popupContainer, { backgroundColor }]}>
          <View style={styles.actionsContainer}>
            <View style={styles.headerRow}>
              {title ? (
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>{title}</Text>
                </View>
              ) : (
                <View style={styles.titleContainer} />
              )}
              <Pressable style={styles.closeButton} onPress={handleClose} accessibilityLabel="Close menu" accessibilityRole="button">
                <Ionicons name="close" size={20} color="white" />
              </Pressable>
            </View>
            {actions.map((action, index) => {
              const isSection = action.variant === 'section';
              return (
                <Pressable
                  accessible={true}
                  key={index}
                  onPress={() => {
                    if (!action.disabled && !isSection) {
                      handleActionPress(action.onClick, index);
                    }
                  }}
                  style={[styles.actionItem, isSection ? styles.sectionItem : null, action.disabled ? styles.actionItemDisabled : null]}
                  activeOpacity={0.8}
                  disabled={action.disabled || isSection}
                >
                  <View style={styles.actionContent}>{action.children}</View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    paddingBottom: 50,
    paddingHorizontal: 16,
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
    maxWidth: 370,
    alignSelf: 'center',
    width: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    height: TITLE_HEIGHT,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: 'white',
    fontSize: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  actionItemDisabled: {
    opacity: 0.7,
  },
  sectionItem: {
    backgroundColor: 'transparent',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: ACTION_ITEM_HEIGHT,
    paddingHorizontal: 16,
  },
});
