import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import { Workbench } from './Workbench';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <Workbench />
    </React.StrictMode>,
  );
}
