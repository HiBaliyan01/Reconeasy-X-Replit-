import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

// Layout
import Layout from './pages/Layout';

// Import existing components
import EnhancedDashboard from './components/EnhancedDashboard';
import AnalyticsPage from './components/AnalyticsPage';
import AuditTrailDashboard from './components/AuditTrailDashboard';
import PaymentReconciliation from './components/PaymentReconciliation';
import SettlementPage from './components/SettlementPage';
import UserManagement from './components/UserManagement';
import TransactionTable from './components/TransactionTable';
import EnhancedReturnsManagement from './components/EnhancedReturnsManagement';
import EnhancedRateCardsManager from './components/EnhancedRateCardsManager';
import ReconciliationCalculator from './components/ReconciliationCalculator';
import TicketManagement from './components/TicketManagement';
import GSTSummary from './components/GSTSummary';
import IntegrationsPage from './components/IntegrationsPage';
import AutomationPage from './components/AutomationPage';
import AIForecastingPage from './components/AIForecastingPage';
import ProjectedIncomePage from './components/ProjectedIncomePage';
import { AiInsights } from './components/AiInsights';

// Simple page components for new routes
const SettingsPage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">Settings</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Account Settings</h3>
        <p className="text-slate-600 dark:text-slate-400">Manage your account preferences</p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Notifications</h3>
        <p className="text-slate-600 dark:text-slate-400">Configure alert preferences</p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Integrations</h3>
        <p className="text-slate-600 dark:text-slate-400">Manage platform connections</p>
      </div>
    </div>
  </div>
);

const SupportPage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">Support</h1>
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
      <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Need Help?</h3>
      <p className="text-slate-600 dark:text-slate-400 mb-4">Contact our support team for assistance.</p>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Contact Support
      </button>
    </div>
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Dashboard */}
              <Route index element={<EnhancedDashboard />} />
              
              {/* AI Insights */}
              <Route path="ai-insights" element={
                <div className="p-8">
                  <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">AI Insights</h1>
                  <AiInsights insights={[
                    { id: '1', text: 'Revenue trend is showing a 15% increase this quarter', type: 'positive' },
                    { id: '2', text: 'Settlement delays increased by 5% last week', type: 'warning' },
                    { id: '3', text: 'Rate card optimization could save ₹25,000 monthly', type: 'positive' },
                    { id: '4', text: 'New reconciliation patterns detected', type: 'info' }
                  ]} />
                </div>
              } />
              
              {/* Reconciliation Routes */}
              <Route path="reconciliation">
                <Route index element={
                  <div className="p-8">
                    <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">Reconciliation</h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">Choose a reconciliation module:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
                        <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Payments</h3>
                        <p className="text-slate-600 dark:text-slate-400">Settlement reconciliation and payment tracking</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
                        <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Returns</h3>
                        <p className="text-slate-600 dark:text-slate-400">Return analysis and reconciliation</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
                        <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Transactions</h3>
                        <p className="text-slate-600 dark:text-slate-400">Transaction monitoring and matching</p>
                      </div>
                    </div>
                  </div>
                } />
                <Route path="payments" element={<SettlementPage />} />
                <Route path="returns" element={<EnhancedReturnsManagement />} />
                <Route path="transactions" element={<TransactionTable />} />
              </Route>
              
              {/* Rate Cards */}
              <Route path="rate-cards" element={<EnhancedRateCardsManager />} />
              
              {/* Tickets */}
              <Route path="tickets" element={<TicketManagement />} />
              
              {/* Settings */}
              <Route path="settings" element={<SettingsPage />} />
              
              {/* Support */}
              <Route path="support" element={<SupportPage />} />
              
              {/* Additional existing routes for other components */}
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="payment-reconciliation" element={<PaymentReconciliation />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="gst-summary" element={<GSTSummary />} />
              <Route path="calculator" element={<ReconciliationCalculator />} />
              <Route path="ai-forecast" element={<AIForecastingPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="automation" element={<AutomationPage />} />
              <Route path="audit" element={<AuditTrailDashboard />} />
              <Route path="projected-income" element={<ProjectedIncomePage />} />
            </Route>
          </Routes>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}