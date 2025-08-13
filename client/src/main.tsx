import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SimpleApp from './SimpleApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SimpleApp />
  </StrictMode>
);
