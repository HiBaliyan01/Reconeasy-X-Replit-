import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EnhancedLayout from "./components/EnhancedLayout";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Payments from "./pages/Payments";
import Returns from "./pages/Returns";
import Tickets from "./pages/Tickets";
import Transactions from "./pages/Transactions";
import AIInsights from "./pages/AIInsights";
import Settings from "./pages/Settings";
import Support from "./pages/Support";

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
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<EnhancedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reconciliation/payments" element={<Payments />} />
            <Route path="reconciliation/returns" element={<Returns />} />
            <Route path="rate-cards" element={<EnhancedRateCardsManager />} />
            <Route path="settlements" element={<SettlementPage />} />
            <Route path="tickets/all" element={<Tickets />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="ai-insights" element={<AIInsights />} />
            <Route path="settings" element={<Settings />} />
            <Route path="support" element={<Support />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}