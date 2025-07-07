import React, { useState, useMemo } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import EnhancedLayout from './components/EnhancedLayout';
import EnhancedDashboard from './components/EnhancedDashboard';
import AnalyticsPage from './components/AnalyticsPage';
import AuditTrailDashboard from './components/AuditTrailDashboard';
import PaymentReconciliation from './components/PaymentReconciliation';
import SettlementPage from './components/SettlementPage';
import UserManagement from './components/UserManagement';
import TransactionTable from './components/TransactionTable';
import ReturnAnalytics from './components/ReturnAnalytics';
import ReturnReconciliation from './components/ReturnReconciliation';
import EnhancedReturnsPage from './components/EnhancedReturnsPage';
import RateCardsPage from './components/RateCardsPage';
import ForecastChart from './components/ForecastChart';
import FilterPanel from './components/FilterPanel';
import EnhancedChatBot from './components/EnhancedChatBot';
import TicketManagement from './components/TicketManagement';
import GSTSummary from './components/GSTSummary';
import IntegrationsPage from './components/IntegrationsPage';
import AutomationPage from './components/AutomationPage';
import AIForecastingPage from './components/AIForecastingPage';
import ProjectedIncomePage from './components/ProjectedIncomePage';
import { mockTransactions, mockReturns, mockForecastData } from './data/mockData';
import { DashboardMetrics, Transaction } from './types';
import { calculateReturnRate } from './utils/reconciliation';
import { calculateForecastAccuracy } from './utils/forecasting';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMarketplace, setSelectedMarketplace] = useState('All');
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    marketplace: '',
    status: '',
    amountRange: { min: '', max: '' },
    category: ''
  });

  const filterOptions = {
    marketplaces: ['Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa'],
    statuses: ['reconciled', 'pending', 'discrepancy'],
    categories: ['size_issue', 'quality_issue', 'wrong_item', 'damaged', 'not_as_described']
  };

  // Calculate enhanced dashboard metrics
  const metrics = useMemo((): DashboardMetrics => {
    const filteredTransactions = selectedMarketplace === 'All' 
      ? mockTransactions 
      : mockTransactions.filter(t => t.marketplace === selectedMarketplace);
    
    const totalSales = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalReturns = mockReturns.length;
    const returnRate = calculateReturnRate(filteredTransactions.length, totalReturns);
    const pendingReconciliations = filteredTransactions.filter(t => t.status === 'pending').length;
    const totalDiscrepancies = filteredTransactions.filter(t => t.status === 'discrepancy').length;
    const averageOrderValue = totalSales / filteredTransactions.length;

    return {
      totalSales,
      totalReturns,
      returnRate,
      pendingReconciliations,
      totalDiscrepancies,
      averageOrderValue: Math.round(averageOrderValue)
    };
  }, [selectedMarketplace]);

  const forecastAccuracy = calculateForecastAccuracy(mockForecastData);

  // Mock GST data
  const gstData = {
    gstin: '29ABCDE1234F1ZG',
    total_taxable: metrics.totalSales - (mockReturns.reduce((sum, r) => sum + r.refundAmount, 0)),
    total_gst: (metrics.totalSales - (mockReturns.reduce((sum, r) => sum + r.refundAmount, 0))) * 0.05
  };

  const handleViewTransactionDetails = (transaction: Transaction) => {
    console.log('View transaction details:', transaction);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <EnhancedDashboard metrics={metrics} />
            <GSTSummary gstData={gstData} />
          </div>
        );
      
      case 'analytics':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Analytics Hub</h2>
                  <p className="text-teal-100 mt-1">Advanced insights and AI-powered forecasting</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setActiveSubTab('overview')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'overview' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveSubTab('forecasting')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'forecasting' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    AI Forecasting
                  </button>
                  <button
                    onClick={() => setActiveSubTab('audit')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'audit' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Audit Trail
                  </button>
                </div>
              </div>
            </div>
            
            {activeSubTab === 'overview' && <AnalyticsPage />}
            {activeSubTab === 'forecasting' && <AIForecastingPage />}
            {activeSubTab === 'audit' && <AuditTrailDashboard />}
          </div>
        );

      case 'settlements':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Settlements Management</h2>
                  <p className="text-teal-100 mt-1">Unified payment and return settlement tracking</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setActiveSubTab('payments')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'payments' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Payments
                  </button>
                  <button
                    onClick={() => setActiveSubTab('returns')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'returns' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Returns
                  </button>
                  <button
                    onClick={() => setActiveSubTab('settlements')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'settlements' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Settlements
                  </button>
                  <button
                    onClick={() => setActiveSubTab('rate_cards')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'rate_cards' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Rate Cards
                  </button>
                  <button
                    onClick={() => setActiveSubTab('projected_income')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'projected_income' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Projected Income
                  </button>
                </div>
              </div>
            </div>
            
            {activeSubTab === 'payments' && <PaymentReconciliation />}
            {activeSubTab === 'returns' && <EnhancedReturnsPage />}
            {activeSubTab === 'settlements' && <SettlementPage />}
            {activeSubTab === 'rate_cards' && <RateCardsPage />}
            {activeSubTab === 'projected_income' && <ProjectedIncomePage />}
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">System Settings</h2>
                  <p className="text-teal-100 mt-1">Configure integrations, users, and automation</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setActiveSubTab('integrations')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'integrations' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Integrations
                  </button>
                  <button
                    onClick={() => setActiveSubTab('users')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'users' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    User Management
                  </button>
                  <button
                    onClick={() => setActiveSubTab('automation')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeSubTab === 'automation' 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    Automation
                  </button>
                </div>
              </div>
            </div>
            
            {activeSubTab === 'integrations' && <IntegrationsPage />}
            {activeSubTab === 'users' && <UserManagement />}
            {activeSubTab === 'automation' && <AutomationPage />}
          </div>
        );
      
      case 'transactions':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Smart Transaction Management</h2>
                  <p className="text-teal-100 mt-1">AI-powered UTR matching with real-time reconciliation</p>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={selectedMarketplace}
                    onChange={(e) => setSelectedMarketplace(e.target.value)}
                    className="px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50"
                  >
                    <option value="All" className="text-slate-900">All Marketplaces</option>
                    <option value="Amazon" className="text-slate-900">Amazon</option>
                    <option value="Flipkart" className="text-slate-900">Flipkart</option>
                    <option value="Myntra" className="text-slate-900">Myntra</option>
                  </select>
                  <button
                    onClick={() => setShowFilters(true)}
                    className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                  >
                    <span>Advanced Filters</span>
                  </button>
                </div>
              </div>
            </div>
            <TransactionTable 
              transactions={selectedMarketplace === 'All' ? mockTransactions : mockTransactions.filter(t => t.marketplace === selectedMarketplace)} 
              onViewDetails={handleViewTransactionDetails}
            />
          </div>
        );
      
      case 'returns':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Intelligent Return Analytics</h2>
                  <p className="text-teal-100 mt-1">ML-powered pattern analysis for e-commerce optimization</p>
                </div>
                <button
                  onClick={() => setShowFilters(true)}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                >
                  <span>Advanced Filters</span>
                </button>
              </div>
            </div>
            <ReturnAnalytics returns={mockReturns} />
          </div>
        );

      case 'tickets':
        return <TicketManagement />;

      default:
        return <EnhancedDashboard metrics={metrics} />;
    }
  };

  return (
    <ThemeProvider>
      <EnhancedLayout 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          setActiveSubTab('overview'); // Reset sub-tab when changing main tab
        }}
      >
        {renderContent()}
        
        {/* Global Filter Panel */}
        <FilterPanel
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onFilterChange={setFilters}
          filterOptions={filterOptions}
        />
      </EnhancedLayout>
      
      {/* Enhanced AI ChatBot */}
      <EnhancedChatBot />
    </ThemeProvider>
  );
}

export default App;