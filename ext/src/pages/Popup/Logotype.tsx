import React from 'react';
import { getCurrentTheme, LayerzColors, textStyles } from './theme';

// Import your logo image or use an SVG component
import LogoIcon from '../../assets/img/logo-icon.svg';

type LogotypeProps = {
  size?: 'small' | 'medium' | 'large';
  variant?: 'horizontal' | 'stacked' | 'icon';
  includeTagline?: boolean;
  className?: string;
};

/**
 * Layerz Wallet Logotype component for the browser extension
 * Consistently displays the logo with various size options
 */
export const Logotype: React.FC<LogotypeProps> = ({ size = 'medium', variant = 'horizontal', includeTagline = false, className }) => {
  const theme = getCurrentTheme();

  // Set dimensions based on size
  let logoHeight;
  let fontSize;
  let taglineSize;

  switch (size) {
    case 'small':
      logoHeight = 24;
      fontSize = 18;
      taglineSize = 10;
      break;
    case 'large':
      logoHeight = 48;
      fontSize = 32;
      taglineSize = 14;
      break;
    default: // medium
      logoHeight = 32;
      fontSize = 24;
      taglineSize = 12;
  }

  // For the icon-only variant
  if (variant === 'icon') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={LogoIcon}
          alt="Layerz Wallet"
          style={{
            width: logoHeight,
            height: logoHeight,
          }}
        />
      </div>
    );
  }

  // For horizontal layout
  if (variant === 'horizontal') {
    return (
      <div className={className}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <img
            src={LogoIcon}
            alt="Layerz Wallet"
            style={{
              width: logoHeight,
              height: logoHeight,
            }}
          />
          <div style={{ marginLeft: '8px' }}>
            <h1
              style={{
                color: LayerzColors[theme].text,
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                margin: 0,
              }}
            >
              Layerz
            </h1>

            {includeTagline && (
              <p
                style={{
                  color: LayerzColors[theme].textSecondary,
                  fontSize: `${taglineSize}px`,
                  margin: '2px 0 0 0',
                  ...textStyles.caption,
                }}
              >
                Explore Bitcoin Layer 2
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // For stacked layout
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={LogoIcon}
        alt="Layerz Wallet"
        style={{
          width: 'auto',
          height: logoHeight * 1.5,
          marginBottom: '8px',
        }}
      />
      <h1
        style={{
          color: LayerzColors[theme].text,
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          margin: 0,
        }}
      >
        Layerz
      </h1>

      {includeTagline && (
        <p
          style={{
            color: LayerzColors[theme].textSecondary,
            fontSize: `${taglineSize}px`,
            margin: '2px 0 0 0',
            ...textStyles.caption,
          }}
        >
          Explore Bitcoin Layer 2
        </p>
      )}
    </div>
  );
};
