import { Networks } from '../types/networks';
import { getPartnersList } from '../models/partners-list';

/**
 * Shared hook for managing partners view model logic
 * Used by both mobile and extension implementations
 */
export function usePartnersViewModel(network: Networks) {
  const list = getPartnersList(network);

  // Simply return all partners without pagination
  const getCurrentPagePartners = () => list;

  return {
    list,
    getCurrentPagePartners,
  };
}
