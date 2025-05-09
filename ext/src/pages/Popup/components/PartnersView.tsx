import React, { useContext } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { usePartnersViewModel } from '@shared/hooks/usePartnersViewModel';

const PartnersView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const { getCurrentPagePartners, goToPreviousPage, goToNextPage, currentPage, totalPages, showPagination } = usePartnersViewModel(network);

  const currentPartners = getCurrentPagePartners();

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
      {showPagination && (
        <>
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 0}
            style={{
              position: 'absolute',
              left: '-30px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: currentPage === 0 ? 'default' : 'pointer',
              opacity: currentPage === 0 ? 0.5 : 1,
            }}
            data-testid="partners-prev-button"
          >
            <ChevronLeft size={24} />
          </button>

          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages - 1}
            style={{
              position: 'absolute',
              right: '-30px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
              opacity: currentPage === totalPages - 1 ? 0.5 : 1,
            }}
            data-testid="partners-next-button"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {currentPartners.map((partner, index) => (
          <a
            key={`partner-card-${index}`}
            href={partner.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
            data-testid={`PartnerCard-${index}`}
            aria-label={`Partner ${partner.name}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              {partner.imgUrl && <img alt={partner.name + ' logo'} src={partner.imgUrl} style={{ width: '30px', height: '30px', marginRight: '0.5rem', objectFit: 'contain' }} />}
              <span style={{ fontWeight: '600', fontSize: '0.875rem', paddingRight: '10px' }}>{partner.name}</span>
              <ExternalLink
                size={18}
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenUrl(partner.url);
                }}
              />
            </div>
            {partner.description && <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, textAlign: 'left' }}>{partner.description}</p>}
          </a>
        ))}
      </div>
    </div>
  );
};

export default PartnersView;
