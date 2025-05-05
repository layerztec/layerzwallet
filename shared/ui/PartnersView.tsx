import React, { useState } from 'react';
import { Networks } from '../types/networks';
import { PartnerInfo } from '../types/partner-info';
import { getPartnersList } from '../models/partners-list';

export interface PartnersViewProps {
  network: Networks;
  // Platform-specific rendering functions
  renderContainer: (children: React.ReactNode) => React.ReactElement;
  renderGrid: (children: React.ReactNode) => React.ReactElement;
  renderNavigationButton: (direction: 'left' | 'right', onClick: () => void, disabled: boolean) => React.ReactElement;
  renderPartnerCard: (partner: PartnerInfo, index: number, onCardPress: (url: string) => void) => React.ReactElement;
}

export const usePartnersViewModel = (network: Networks) => {
  const list = getPartnersList(network);
  const [currentPage, setCurrentPage] = useState(0);
  const partnersPerPage = 4;
  const totalPages = Math.ceil(list.length / partnersPerPage);

  const getCurrentPagePartners = () => {
    const start = currentPage * partnersPerPage;
    return list.slice(start, start + partnersPerPage);
  };

  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(0, prev - 1));
  const goToNextPage = () => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));

  return {
    list,
    currentPage,
    totalPages,
    partnersPerPage,
    getCurrentPagePartners,
    goToPreviousPage,
    goToNextPage,
    showPagination: list.length > partnersPerPage,
  };
};

export const PartnersView: React.FC<PartnersViewProps> = ({ network, renderContainer, renderGrid, renderNavigationButton, renderPartnerCard }) => {
  const { getCurrentPagePartners, goToPreviousPage, goToNextPage, currentPage, totalPages, showPagination } = usePartnersViewModel(network);

  const handleOpenUrl = (url: string) => {
    // This will be implemented differently on mobile vs extension
    window.open(url, '_blank');
  };

  return renderContainer(
    <>
      {showPagination && (
        <>
          {renderNavigationButton('left', goToPreviousPage, currentPage === 0)}
          {renderNavigationButton('right', goToNextPage, currentPage === totalPages - 1)}
        </>
      )}
      {renderGrid(getCurrentPagePartners().map((partner, index) => renderPartnerCard(partner, index, handleOpenUrl)))}
    </>
  );
};
