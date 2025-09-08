import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Import global styles
import './index.css';

// Simple auth gate: if no Supabase session is present, route to login page
try {
  const hasSupabaseSession = Object.keys(localStorage).some((k) =>
    k.startsWith('sb-') && (k.includes('-auth-token') || k.includes('-session'))
  );
  const path = window.location.pathname;
  // Avoid redirect if already on auth page or another static HTML page
  const isStaticHtml = path.endsWith('.html');
  if (!hasSupabaseSession && !isStaticHtml) {
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
