```
README.md
# ReconEasy Design System Starter Kit

This package includes your core theme setup and reusable components:

## Included

### 🎨 CSS Theme Variables
- Primary (Action): #3B82F6
- Secondary (Background): #F9EDEB
- Negative/Positive: #EF4444 / #10B981
- Tertiary (Neutral): #6B7280
- Purple (AI/Assistant): #7C3AED
- Dark Mode Support: #1A202C / #E2E8F0

### 🏷️ Badge Component
Reusable React component to show status chips:
- Neutral (e.g., "Pending") – Adapts text color for light/dark mode
- Purple (e.g., "AI Suggestion")

## Setup
1. Import `theme.css` into your layout (or Tailwind layer).
2. Set up Vite in Replit for React compilation: Run `npm create vite@latest` (select React), then `npm install`, and `npm run dev`.
3. Use `<Badge label="Awaiting UTR" />` or `<Badge label="AI Suggestion" variant="purple" />`.

## Notes
- Heatmap gradient uses teal range: #E0F2F1 → #00796B
- Extend with `user_theme` support via CSS variables switching in Q4 2025

theme.css
:root {
  --primary: #3B82F6;
  --secondary: #F9EDEB;
  --negative: #EF4444;
  --positive: #10B981;
  --tertiary: #6B7280;
  --dark-bg: #1A202C;
  --dark-text: #E2E8F0;
  --purple: #7C3AED;
}

.sidebar {
  background-color: var(--secondary);
}
.negative-value {
  color: var(--negative);
}
.positive-value {
  color: var(--positive);
}
.neutral-value {
  color: var(--tertiary);
}
.dark-mode {
  background-color: var(--dark-bg);
  color: var(--dark-text);
}
.heatmap {
  background: linear-gradient(to right, #E0F2F1, #00796B);
}
.badge-neutral {
  background-color: var(--tertiary);
  color: var(--dark-bg); /* Dark text in light mode */
}
.dark .badge-neutral { color: var(--dark-text); } /* White text in dark mode */
.badge-purple {
  background-color: var(--purple);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
}

Badge.tsx
import React from 'react';

type BadgeProps = {
  label: string;
  variant?: 'neutral' | 'purple';
};

const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const baseClass = variant === 'purple' ? 'badge-purple' : 'badge-neutral';

  return (
    <span className={baseClass}>
      {label}
    </span>
  );
};

export default Badge;

index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReconEasy</title>
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.development.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="theme.css">
  <style>
    .sidebar-collapsed { width: 4rem; }
    .sidebar-expanded { width: 16rem; }
    .transition-all { transition: all 0.3s; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState } = React;

    const Badge = ({ label, variant = 'neutral' }) => {
      const baseClass = variant === 'purple' ? 'badge-purple' : 'badge-neutral';
      return <span className={baseClass}>{label}</span>;
    };

    const Sidebar = ({ isCollapsed, toggleSidebar, activeTab }) => (
      <div className={`fixed h-screen sidebar transition-all ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
        <button onClick={toggleSidebar} className="p-2 text-white bg-[var(--primary)]">☰</button>
        <nav className="mt-4">
          <a href="#dashboard" className={`block p-2 hover:bg-[var(--primary)]/20 ${activeTab === 'dashboard' ? 'bg-[var(--primary)]/30' : ''}`}>📊 Dashboard</a>
          <a href="#reconciliation" className={`block p-2 hover:bg-[var(--primary)]/20 ${activeTab === 'reconciliation' ? 'bg-[var(--primary)]/30' : ''}`}>🔄 Reconciliation</a>
          <a href="#ai-insights" className={`block p-2 hover:bg-[var(--primary)]/20 ${activeTab === 'ai-insights' ? 'bg-[var(--primary)]/30' : ''}`}>📈 AI Insights (Beta)</a>
          <a href="#rate-cards" className={`block p-2 hover:bg-[var(--primary)]/20 ${activeTab === 'rate-cards' ? 'bg-[var(--primary)]/30' : ''}`}>💼 Rate Cards</a>
          <a href="#tickets" className={`block p-2 hover:bg-[var(--primary)]/20 ${activeTab === 'tickets' ? 'bg-[var(--primary)]/30' : ''}`}>🎫 Tickets</a>
          <a href="#settings" className={`block p-2 hover:bg-[var(--primary)]/20 ${activeTab === 'settings' ? 'bg-[var(--primary)]/30' : ''}`}>⚙️ Settings</a>
        </nav>
        <div className="absolute bottom-0 w-full system-health bg-[var(--secondary)] text-center">
          🛠 System Health: OK | Last Sync: 07/26 | 95% Accuracy
        </div>
      </div>
    );

    const Router = ({ activeTab }) => {
      const content = {
        'dashboard': <div className="p-4 ml-16">Dashboard Placeholder</div>,
        'reconciliation': <div className="p-4 ml-16">
          <h3 className="text-[var(--primary)]">🔄 Reconciliation</h3>
          <div>💸 Payments Placeholder <Badge label="Awaiting UTR" /></div>
          <div>📦 Returns Placeholder <span className="negative-value">(-₹500)</span></div>
          <div className="positive-value">🔍 Transactions Placeholder (+₹200)</div>
        </div>,
        'ai-insights': <div className="p-4 ml-16"><Badge label="AI Suggestion" variant="purple" /> 📈 AI Insights (Beta) Placeholder</div>,
        'rate-cards': <div className="p-4 ml-16">💼 Rate Cards Placeholder</div>,
        'tickets': <div className="p-4 ml-16">🎫 Tickets Placeholder</div>,
        'settings': <div className="p-4 ml-16">⚙️ Settings Placeholder</div>
      };
      return content[activeTab] || <div className="p-4 ml-16">Select a tab</div>;
    };

    const App = () => {
      const [isCollapsed, setIsCollapsed] = useState(false);
      const [activeTab, setActiveTab] = useState('dashboard');
      const [darkMode, setDarkMode] = useState(false);

      const toggleSidebar = () => setIsCollapsed(!isCollapsed);
      const toggleDarkMode = () => setDarkMode(!darkMode);
      const handleHashChange = () => setActiveTab(window.location.hash.slice(1) || 'dashboard');

      window.addEventListener('hashchange', handleHashChange);
      handleHashChange();

      return (
        <div className={darkMode ? 'dark-mode' : ''}>
          <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} activeTab={activeTab} />
          <main className={`p-4 transition-all ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
            <button onClick={toggleDarkMode} className="bg-[var(--primary)] text-white p-2 mb-4">Toggle Dark Mode</button>
            <Router activeTab={activeTab} />
          </main>
        </div>
      );
    };

    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
</body>
</html>
```