import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from "./components/Layout";
import { ThemeProvider } from "./components/ThemeProvider";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Reconciliation from "./pages/Reconciliation";
import Returns from "./pages/Returns";
import Transactions from "./pages/Transactions";
import AIInsights from "./pages/AIInsights";
import Settings from "./pages/Settings";

// Import existing components for functional pages
import EnhancedRateCardsManager from './components/EnhancedRateCardsManager';
import SettlementPage from './components/SettlementPage';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="reconciliation" element={<Reconciliation />} />
              <Route path="rate-cards" element={<EnhancedRateCardsManager />} />
              <Route path="settlements" element={<SettlementPage />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="returns" element={<Returns />} />
              <Route path="ai-insights" element={<AIInsights />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  );
}