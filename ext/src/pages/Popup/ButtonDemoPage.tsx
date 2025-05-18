import React from 'react';
import ButtonExample from '../../components/ButtonExample';

const containerStyle: React.CSSProperties = {
  padding: '16px',
  flex: 1,
  backgroundColor: '#f8f8f8',
  minHeight: '100vh',
};

const headingStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  marginBottom: '16px',
  textAlign: 'center',
};

const ButtonDemoPage: React.FC = () => {
  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>
        Button Component Demo
      </h1>
      <ButtonExample />
    </div>
  );
};

export default ButtonDemoPage;
