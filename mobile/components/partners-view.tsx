import React, { useContext } from 'react';
import { View, TouchableOpacity, Image, Linking, StyleSheet } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { NetworkContext } from '../../shared/hooks/NetworkContext';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { usePartnersViewModel } from '../../shared/hooks/usePartnersViewModel';

const PartnersView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const { getCurrentPagePartners } = usePartnersViewModel(network);

  // Get all partners instead of paginated partners
  const allPartners = getCurrentPagePartners();

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <ThemedView style={{ marginBottom: 24, position: 'relative' }} testID="PartnersView">
      <View style={styles.gridContainer} testID="partners-grid">
        {allPartners.length === 0 ? (
          <TouchableOpacity style={styles.partnerCard} testID="PartnerCard-0">
            <View style={styles.partnerCardHeader}>
              <ThemedText style={styles.partnerName}>No partners available</ThemedText>
            </View>
          </TouchableOpacity>
        ) : (
          allPartners.map((partner, index) => (
            <TouchableOpacity
              key={`partner-card-${index}`}
              style={styles.partnerCard}
              onPress={() => Linking.openURL(partner.url)}
              activeOpacity={0.7}
              testID={`PartnerCard-${index}`}
              accessibilityLabel={`Partner ${partner.name}`}
            >
              <View style={styles.partnerCardHeader}>
                {partner.imgUrl && <Image source={{ uri: partner.imgUrl }} style={styles.partnerLogo} resizeMode="contain" />}
                <ThemedText style={styles.partnerName}>{partner.name}</ThemedText>
                <AntDesign
                  name="export"
                  size={18}
                  color="#5a5a5a"
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleOpenUrl(partner.url);
                  }}
                />
              </View>
              {partner.description && <ThemedText style={styles.partnerDescription}>{partner.description}</ThemedText>}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
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
