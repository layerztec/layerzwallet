import React from 'react';
import { createRoot } from 'react-dom/client';

import Panel from './Panel';
import { ThemeProvider } from '../../hooks/ThemeContext';
import './index.css';

const container = document.getElementById('app-container');
const root = createRoot(container);
root.render(
  <ThemeProvider>
    <Panel />
  </ThemeProvider>
);
