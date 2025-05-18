import React from 'react';
import { Button } from './Button';
import CrossPlatformButton from '../../../shared/components/CrossPlatformButton';
import SimpleButton from '../../../shared/components/SimpleButton';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  padding: '20px',
  backgroundColor: '#ffffff',
  flex: 1,
  maxWidth: '800px',
  margin: '0 auto',
};

const sectionHeadingStyle: React.CSSProperties = {
  fontWeight: 'bold',
  fontSize: '18px',
  marginBottom: '10px',
  marginTop: '20px',
};

const headingStyle: React.CSSProperties = {
  fontWeight: 'bold',
  fontSize: '24px',
  marginBottom: '15px',
};

const separatorStyle: React.CSSProperties = {
  height: '1px',
  backgroundColor: '#e0e0e0',
  width: '100%',
  marginBottom: '20px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: '10px',
  marginBottom: '15px',
};

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  marginBottom: '15px',
};

/**
 * Example component demonstrating the usage of the Button component
 * in the Chrome extension environment.
 * Layout matched with mobile/app/button-demo.tsx for consistency
 */
export const ButtonExample: React.FC = () => {
  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>Button Demo</h1>
      <div style={separatorStyle} />
      
      <h3 style={sectionHeadingStyle}>Standard Buttons</h3>
      <div style={rowStyle}>
        <Button variant="primary" onPress={() => console.log('Primary pressed')}>
          Primary
        </Button>
        <Button variant="secondary" onPress={() => console.log('Secondary pressed')}>
          Secondary
        </Button>
        <Button variant="danger" onPress={() => console.log('Danger pressed')}>
          Danger
        </Button>
        <Button variant="outline" onPress={() => console.log('Outline pressed')}>
          Outline
        </Button>
      </div>

      <h3 style={sectionHeadingStyle}>Button Sizes</h3>
      <div style={columnStyle}>
        <Button variant="primary" size="small" onPress={() => console.log('Small pressed')}>
          Small
        </Button>
        <Button variant="primary" size="medium" onPress={() => console.log('Medium pressed')}>
          Medium
        </Button>
        <Button variant="primary" size="large" onPress={() => console.log('Large pressed')}>
          Large
        </Button>
      </div>

      <h3 style={sectionHeadingStyle}>Button States</h3>
      <div style={columnStyle}>
        <Button variant="primary" disabled onPress={() => console.log('Disabled pressed')}>
          Disabled
        </Button>
        <Button variant="primary" isLoading onPress={() => console.log('Loading pressed')}>
          Loading
        </Button>
        <Button variant="primary" fullWidth onPress={() => console.log('Full width pressed')}>
          Full Width Button
        </Button>
      </div>
      
      <h3 style={sectionHeadingStyle}>Cross-Platform Buttons</h3>
      <div style={rowStyle}>
        <CrossPlatformButton variant="primary" onPress={() => console.log('CP Primary pressed')}>
          Primary
        </CrossPlatformButton>
        <CrossPlatformButton variant="secondary" onPress={() => console.log('CP Secondary pressed')}>
          Secondary
        </CrossPlatformButton>
        <CrossPlatformButton variant="danger" onPress={() => console.log('CP Danger pressed')}>
          Danger
        </CrossPlatformButton>
        <CrossPlatformButton variant="outline" onPress={() => console.log('CP Outline pressed')}>
          Outline
        </CrossPlatformButton>
      </div>
      
      <h3 style={sectionHeadingStyle}>SimpleButton Implementation</h3>
      <div style={{
        padding: '15px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        marginBottom: '20px',
      }}>
        <p style={{ marginBottom: '15px' }}>
          SimpleButton is our recommended implementation as it avoids token resolution issues.
        </p>
        <div style={columnStyle}>
          <SimpleButton 
            variant="primary" 
            onPress={() => console.log('SimpleButton pressed')}
          >
            SimpleButton Primary
          </SimpleButton>
        </div>
      </div>
    </div>
  );
};

export default ButtonExample;
