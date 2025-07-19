
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import EnhancedLayout from "./components/EnhancedLayout";
import Dashboard from "./pages/Dashboard";
import Reconciliation from "./pages/Reconciliation";
import RateCards from "./pages/RateCards";
import Settlements from "./pages/Settlements";
import Transactions from "./pages/Transactions";
import Returns from "./pages/Returns";
import Analytics from "./pages/Analytics";
import AI from "./pages/AI";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EnhancedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="reconciliation" element={<Reconciliation />} />
          <Route path="rate-cards" element={<RateCards />} />
          <Route path="settlements" element={<Settlements />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="returns" element={<Returns />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="ai" element={<AI />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}
