import React, { useContext, useState } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getPartnersList } from '@shared/models/partners-list';

const PartnersView: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const list = getPartnersList(network);
  const [currentPage, setCurrentPage] = useState(0);
  const partnersPerPage = 4;
  const totalPages = Math.ceil(list.length / partnersPerPage);

  const getCurrentPagePartners = () => {
    const start = currentPage * partnersPerPage;
    return list.slice(start, start + partnersPerPage);
  };

  return (
    <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
      {list.length > partnersPerPage && (
        <>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
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
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
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
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {getCurrentPagePartners().map((partner, index) => (
          <a
            key={index}
            href={partner.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '1rem',
              backgroundColor: '#13286c',
              borderRadius: '9px',
              border: '0px solid #e5e7eb',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#13286c';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              {partner.imgUrl && <img alt={partner.name + ' logo'} src={partner.imgUrl} style={{ width: '30px', height: '30px', marginRight: '0.5rem', objectFit: 'contain' }} />}
              <span style={{ fontWeight: '600', fontSize: '0.875rem', paddingRight: '10px' }}>{partner.name}</span>
              <ExternalLink size={18} onClick={async () => window.open(partner.url, '_blank')} />
            </div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, textAlign: 'left' }}>{partner.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
};

export default PartnersView;
