import { ChevronLeft } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router';

import { Networks } from '@shared/types/networks';

import { getNetworkImageUrl } from '../../utils/network-assets';
import { ThemedText } from '../ThemedText';

interface ScreenSendHeaderProps {
  title: string;
  network: Networks;
  showBackButton?: boolean;
  onBackPress?: () => void;
  style?: React.CSSProperties;
  testID?: string;
}

/** Web port of mobile `navigation/ScreenSendHeader`. */
const ScreenSendHeader: React.FC<ScreenSendHeaderProps> = ({ title, network, showBackButton = true, onBackPress, style, testID }) => {
  const navigate = useNavigate();
  const networkImage = getNetworkImageUrl(network);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigate(-1);
    }
  };

  return (
    <div style={{ padding: '16px 16px 32px', ...style }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {showBackButton && (
          <button
            type="button"
            aria-label="Go back"
            data-testid="BackButton"
            onClick={handleBackPress}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            <ChevronLeft size={20} color="#fff" />
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {networkImage && (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              <img src={networkImage} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            </div>
          )}
          <ThemedText style={{ fontSize: 20, fontWeight: 400, color: 'rgba(255, 255, 255, 0.8)' }} data-testid={testID}>
            {title}
          </ThemedText>
        </div>
      </div>
    </div>
  );
};

export default ScreenSendHeader;
