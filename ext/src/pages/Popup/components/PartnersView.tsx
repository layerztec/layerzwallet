import React, { useContext } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { PartnersView as SharedPartnersView } from '@shared/ui/PartnersView';
import { PartnerInfo } from '@shared/types/partner-info';

const PartnersView: React.FC = () => {
  const { network } = useContext(NetworkContext);

  const renderContainer = (children: React.ReactNode) => <div style={{ marginBottom: '1.5rem', position: 'relative' }}>{children}</div>;

  const renderGrid = (children: React.ReactNode) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>{children}</div>;

  const renderNavigationButton = (direction: 'left' | 'right', onClick: () => void, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'absolute',
        [direction === 'left' ? 'left' : 'right']: '-30px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {direction === 'left' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
    </button>
  );

  const renderPartnerCard = (partner: PartnerInfo, index: number, onCardPress: (url: string) => void) => (
    <a
      key={index}
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
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
        {partner.imgUrl && <img alt={partner.name + ' logo'} src={partner.imgUrl} style={{ width: '30px', height: '30px', marginRight: '0.5rem', objectFit: 'contain' }} />}
        <span style={{ fontWeight: '600', fontSize: '0.875rem', paddingRight: '10px' }}>{partner.name}</span>
        <ExternalLink
          size={18}
          onClick={(e) => {
            e.preventDefault();
            onCardPress(partner.url);
          }}
        />
      </div>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, textAlign: 'left' }}>{partner.description}</p>
    </a>
  );

  return <SharedPartnersView network={network} renderContainer={renderContainer} renderGrid={renderGrid} renderNavigationButton={renderNavigationButton} renderPartnerCard={renderPartnerCard} />;
};

export default PartnersView;
