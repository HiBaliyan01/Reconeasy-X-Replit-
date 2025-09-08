import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Import global styles
import './index.css';

// Simple auth gate: if no Supabase session is present, route to login page
try {
  const hasSupabaseSession = Object.keys(localStorage).some(
    (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
  );
  const path = window.location.pathname;
  // If not authenticated and not already on the auth page, redirect to login
  if (!hasSupabaseSession && path !== '/auth.html') {
    window.location.replace('/auth.html');
  }
} catch (_) {
  // ignore storage access issues
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
