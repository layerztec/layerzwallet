import { NetworkContext } from '@shared/hooks/NetworkContext';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router';
import { WideButton } from './DesignSystem';

const SendBreez: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>Send</h2>
      <div style={{ marginBottom: 20 }}>
        <span style={{ background: '#FF9500', color: 'white', borderRadius: 20, padding: '8px 16px', fontWeight: 'bold' }}>{network?.toUpperCase()}</span>
      </div>
      <div style={{ marginBottom: 30, fontSize: 18 }}>Choose send method</div>
      <WideButton onClick={() => navigate('/send-lightning')} style={{ marginBottom: 20 }}>
        ⚡ Lightning
      </WideButton>
      <WideButton onClick={() => navigate('/send-liquid-breez')} style={{ background: '#3498db' }}>
        💧 Liquid
      </WideButton>
    </div>
  );
};

export default SendBreez;
