import React from 'react';
import { createRoot } from 'react-dom/client';

import Popup from './Popup';
import { ThemeProvider } from '../../hooks/ThemeContext';
import './index.css';

const container = document.getElementById('app-container');
const root = createRoot(container);
root.render(
  <ThemeProvider>
    <Popup />
  </ThemeProvider>
);
