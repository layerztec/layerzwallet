import React, { useContext, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, FlatList } from 'react-native';
import { getPartnersList } from '../../shared/models/partners-list';
import { PartnerInfo } from '../../shared/types/partner-info';
import { Ionicons } from '@expo/vector-icons';
import { NetworkContext } from '@shared/hooks/NetworkContext';

const PARTNERS_PER_PAGE = 4;

const PartnersView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const [currentPage, setCurrentPage] = useState(0);
  const partners: PartnerInfo[] = getPartnersList(network);
  const totalPages = Math.ceil(partners.length / PARTNERS_PER_PAGE);

  const getCurrentPagePartners = () => {
    const start = currentPage * PARTNERS_PER_PAGE;
    return partners.slice(start, start + PARTNERS_PER_PAGE);
  };

  return (
    <View style={styles.container}>
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity onPress={() => setCurrentPage((prev) => Math.max(0, prev - 1))} disabled={currentPage === 0} style={[styles.arrowButton, currentPage === 0 && styles.arrowButtonDisabled]}>
            <Ionicons name="chevron-back" size={24} color={currentPage === 0 ? '#ccc' : '#333'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            style={[styles.arrowButton, currentPage === totalPages - 1 && styles.arrowButtonDisabled]}
          >
            <Ionicons name="chevron-forward" size={24} color={currentPage === totalPages - 1 ? '#ccc' : '#333'} />
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={getCurrentPagePartners()}
        keyExtractor={(_, idx) => idx.toString()}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.url)} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              {item.imgUrl ? <Image source={{ uri: item.imgUrl }} style={styles.logo} resizeMode="contain" /> : null}
              <Text style={styles.name}>{item.name}</Text>
              <Ionicons name="open-outline" size={16} color="#888" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.description}>{item.description}</Text>
          </TouchableOpacity>
        )}
        style={{ width: '100%' }}
        contentContainerStyle={{ gap: 12 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    width: '100%',
    paddingLeft: 20,
    paddingRight: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  arrowButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  arrowButtonDisabled: {
    backgroundColor: '#eee',
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    margin: 4,
    minWidth: 140,
    maxWidth: '48%',
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  name: {
    fontWeight: '600',
    fontSize: 14,
    flexShrink: 1,
    color: '#222',
  },
  description: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'left',
  },
});

export default PartnersView;
