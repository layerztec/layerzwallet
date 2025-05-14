import React from 'react';
import { Link } from 'react-router';

const TestPage: React.FC = () => {
  return (
    <div>
      <h1>Test Page</h1>
      <p>Onboarded!</p>
      <Link to="/diagnostics">Diagnostics</Link>
    </div>
  );
};

export default TestPage;
