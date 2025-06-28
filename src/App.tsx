import React, { useState, useMemo } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import EnhancedLayout from './components/EnhancedLayout';
import EnhancedDashboard from './components/EnhancedDashboard';
import TransactionTable from './components/TransactionTable';
import ReturnAnalytics from './components/ReturnAnalytics';
import ReturnReconciliation from './components/ReturnReconciliation';
import ForecastChart from './components/ForecastChart';
import FilterPanel from './components/FilterPanel';
import EnhancedChatBot from './components/EnhancedChatBot';
import TicketManagement from './components/TicketManagement';
import GSTSummary from './components/GSTSummary';
import { mockTransactions, mockReturns, mockForecastData } from './data/mockData';
import { DashboardMetrics, Transaction } from './types';
import { calculateReturnRate } from './utils/reconciliation';
import { calculateForecastAccuracy } from './utils/forecasting';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
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
    marketplaces: ['Amazon', 'Flipkart', 'Myntra'],
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
    // Enhanced transaction detail modal would open here
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

      case 'return-reconciliation':
        return <ReturnReconciliation />;
      
      case 'reconciliation':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Automated Reconciliation Engine</h2>
                  <p className="text-teal-100 mt-1">95% auto-match rate with intelligent exception handling</p>
                </div>
                <button
                  onClick={() => setShowFilters(true)}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                >
                  <span>Advanced Filters</span>
                </button>
              </div>
            </div>
            
            {/* Enhanced Reconciliation Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {mockTransactions.filter(t => t.status === 'reconciled').length}
                </div>
                <div className="text-emerald-700 dark:text-emerald-300 font-medium">Auto-Reconciled</div>
                <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">95% success rate</div>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {mockTransactions.filter(t => t.status === 'pending').length}
                </div>
                <div className="text-amber-700 dark:text-amber-300 font-medium">Pending Review</div>
                <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">Avg 2.3s processing</div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {mockTransactions.filter(t => t.status === 'discrepancy').length}
                </div>
                <div className="text-red-700 dark:text-red-300 font-medium">Exceptions</div>
                <div className="text-sm text-red-600 dark:text-red-400 mt-1">Smart resolution ready</div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">98.7%</div>
                <div className="text-blue-700 dark:text-blue-300 font-medium">Accuracy Rate</div>
                <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">AI confidence score</div>
              </div>
            </div>
            
            <TransactionTable 
              transactions={mockTransactions} 
              onViewDetails={handleViewTransactionDetails}
            />
          </div>
        );
      
      case 'forecast':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <h2 className="text-2xl font-bold">AI-Powered Forecasting</h2>
              <p className="text-teal-100 mt-1">Advanced ML models for predictive analytics</p>
            </div>
            <ForecastChart 
              forecastData={mockForecastData} 
              accuracy={forecastAccuracy}
            />
          </div>
        );

      case 'tickets':
        return <TicketManagement />;

      case 'automation':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <h2 className="text-2xl font-bold">Intelligent Automation</h2>
              <p className="text-teal-100 mt-1">Configure smart rules and automated workflows</p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Automation Rules</h3>
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-emerald-800 dark:text-emerald-200">Auto-match UTRs</h4>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">Automatically reconcile transactions with 95%+ confidence</p>
                    </div>
                    <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
                      <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-800 dark:text-blue-200">Smart exception handling</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Auto-resolve common discrepancies under ₹100</p>
                    </div>
                    <div className="w-12 h-6 bg-blue-500 rounded-full relative">
                      <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'settings':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
              <h2 className="text-2xl font-bold">System Configuration</h2>
              <p className="text-teal-100 mt-1">Advanced settings and integrations</p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">API Integrations</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Reconciliation Threshold</label>
                  <select className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <option>₹1 - Exact match required</option>
                    <option>₹5 - Allow small discrepancies</option>
                    <option>₹10 - Moderate tolerance</option>
                    <option>₹25 - High tolerance for bulk orders</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Auto-reconciliation Confidence</label>
                  <select className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <option>95% - High confidence only</option>
                    <option>90% - Balanced approach</option>
                    <option>85% - More aggressive matching</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return <EnhancedDashboard metrics={metrics} />;
    }
  };

  return (
    <ThemeProvider>
      <EnhancedLayout activeTab={activeTab} onTabChange={setActiveTab}>
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