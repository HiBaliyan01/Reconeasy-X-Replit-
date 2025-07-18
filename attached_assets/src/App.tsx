
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import EnhancedLayout from "./components/EnhancedLayout";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Payments from "./pages/Payments";
import Returns from "./pages/Returns";
import RateCards from "./pages/RateCards";
import Transactions from "./pages/Transactions";
import Tickets from "./pages/Tickets";
import AIInsights from "./pages/AIInsights";
import Settings from "./pages/Settings";
import Support from "./pages/Support";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EnhancedLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reconciliation/payments" element={<Payments />} />
          <Route path="reconciliation/returns" element={<Returns />} />
          <Route path="rate-cards" element={<RateCards />} />
          <Route path="tickets/all" element={<Tickets />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="ai-insights" element={<AIInsights />} />
          <Route path="settings" element={<Settings />} />
          <Route path="support" element={<Support />} />
        </Route>
      </Routes>
    </Router>
  );
}
