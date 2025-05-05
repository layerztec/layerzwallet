import React, { useContext } from 'react';
import { View, TouchableOpacity, Image, Linking, StyleSheet } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { PartnersView as SharedPartnersView } from '@shared/ui/PartnersView';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { PartnerInfo } from '@shared/types/partner-info';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

const PartnersView: React.FC = () => {
  const { network } = useContext(NetworkContext);

  const renderContainer = (children: React.ReactNode) => <ThemedView style={{ marginBottom: 24, position: 'relative' }}>{children}</ThemedView>;

  const renderGrid = (children: React.ReactNode) => <View style={styles.gridContainer}>{children}</View>;

  const renderNavigationButton = (direction: 'left' | 'right', onClick: () => void, disabled: boolean) => (
    <TouchableOpacity
      onPress={onClick}
      disabled={disabled}
      style={[
        styles.navigationButton,
        {
          left: direction === 'left' ? -15 : undefined,
          right: direction === 'right' ? -15 : undefined,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <AntDesign name={direction === 'left' ? 'left' : 'right'} size={24} color="#007AFF" />
    </TouchableOpacity>
  );

  const renderPartnerCard = (partner: PartnerInfo, index: number, onCardPress: (url: string) => void) => (
    <TouchableOpacity key={index} style={styles.partnerCard} onPress={() => Linking.openURL(partner.url)} activeOpacity={0.7}>
      <View style={styles.partnerCardHeader}>
        {partner.imgUrl && <Image source={{ uri: partner.imgUrl }} style={styles.partnerLogo} resizeMode="contain" />}
        <ThemedText style={styles.partnerName}>{partner.name}</ThemedText>
        <AntDesign
          name="export"
          size={18}
          color="#5a5a5a"
          onPress={(e) => {
            // Stop propagation to parent TouchableOpacity
            e.stopPropagation?.();
            onCardPress(partner.url);
          }}
        />
      </View>
      {partner.description && <ThemedText style={styles.partnerDescription}>{partner.description}</ThemedText>}
    </TouchableOpacity>
  );

  return <SharedPartnersView network={network} renderContainer={renderContainer} renderGrid={renderGrid} renderNavigationButton={renderNavigationButton} renderPartnerCard={renderPartnerCard} />;
};

const styles = StyleSheet.create({
  gridContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  navigationButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -12 }],
    backgroundColor: 'transparent',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerCard: {
    width: '48%', // To match the 2-column grid of the extension
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  partnerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  partnerLogo: {
    width: 30,
    height: 30,
    marginRight: 8,
  },
  partnerName: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
    paddingRight: 10,
  },
  partnerDescription: {
    fontSize: 14,
    color: '#6b7280',
    margin: 0,
    textAlign: 'left',
  },
});

export default PartnersView;
