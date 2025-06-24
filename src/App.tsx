import React, { useState, useMemo } from 'react';
import Layout from './components/Layout';
import InteractiveDashboard from './components/InteractiveDashboard';
import TransactionTable from './components/TransactionTable';
import ReturnAnalytics from './components/ReturnAnalytics';
import ForecastChart from './components/ForecastChart';
import FilterPanel from './components/FilterPanel';
import { mockTransactions, mockReturns, mockForecastData } from './data/mockData';
import { DashboardMetrics, Transaction } from './types';
import { calculateReturnRate } from './utils/reconciliation';
import { calculateForecastAccuracy } from './utils/forecasting';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showFilters, setShowFilters] = useState(false);
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

  // Calculate dashboard metrics
  const metrics = useMemo((): DashboardMetrics => {
    const totalSales = mockTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalReturns = mockReturns.length;
    const returnRate = calculateReturnRate(mockTransactions.length, totalReturns);
    const pendingReconciliations = mockTransactions.filter(t => t.status === 'pending').length;
    const totalDiscrepancies = mockTransactions.filter(t => t.status === 'discrepancy').length;
    const averageOrderValue = totalSales / mockTransactions.length;

    return {
      totalSales,
      totalReturns,
      returnRate,
      pendingReconciliations,
      totalDiscrepancies,
      averageOrderValue: Math.round(averageOrderValue)
    };
  }, []);

  const forecastAccuracy = calculateForecastAccuracy(mockForecastData);

  const handleViewTransactionDetails = (transaction: Transaction) => {
    console.log('View transaction details:', transaction);
    // In a real app, this would open a modal or navigate to a detail page
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <InteractiveDashboard metrics={metrics} />;
      
      case 'transactions':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Transaction Management</h2>
                  <p className="text-teal-100 mt-1">Monitor and reconcile payment transactions with UTR matching</p>
                </div>
                <button
                  onClick={() => setShowFilters(true)}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                >
                  <span>Advanced Filters</span>
                </button>
              </div>
            </div>
            <TransactionTable 
              transactions={mockTransactions} 
              onViewDetails={handleViewTransactionDetails}
            />
          </div>
        );
      
      case 'returns':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Return Analytics</h2>
                  <p className="text-teal-100 mt-1">AI-powered return pattern analysis for fashion e-commerce</p>
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
      
      case 'reconciliation':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Payment Reconciliation</h2>
                  <p className="text-teal-100 mt-1">UTR-based reconciliation with bank statements</p>
                </div>
                <button
                  onClick={() => setShowFilters(true)}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                >
                  <span>Advanced Filters</span>
                </button>
              </div>
            </div>
            
            {/* Reconciliation Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl font-bold text-emerald-600">
                  {mockTransactions.filter(t => t.status === 'reconciled').length}
                </div>
                <div className="text-emerald-700 font-medium">UTR Reconciled</div>
                <div className="text-sm text-emerald-600 mt-1">Transactions matched with bank statements</div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl font-bold text-amber-600">
                  {mockTransactions.filter(t => t.status === 'pending').length}
                </div>
                <div className="text-amber-700 font-medium">Pending UTR</div>
                <div className="text-sm text-amber-600 mt-1">Awaiting bank confirmation</div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-2xl font-bold text-red-600">
                  {mockTransactions.filter(t => t.status === 'discrepancy').length}
                </div>
                <div className="text-red-700 font-medium">Payment Discrepancies</div>
                <div className="text-sm text-red-600 mt-1">Amount mismatches requiring review</div>
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
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
              <h2 className="text-2xl font-bold">AI Return Forecasting</h2>
              <p className="text-teal-100 mt-1">ARIMA model predictions for inventory planning</p>
            </div>
            <ForecastChart 
              forecastData={mockForecastData} 
              accuracy={forecastAccuracy}
            />
            
            {/* Forecast Insights */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">AI-Powered Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-900">Fashion Return Patterns</span>
                  </div>
                  <p className="text-sm text-slate-600 ml-5">
                    Size-related returns peak during sale periods, especially for ethnic wear requiring size chart optimization.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-900">Marketplace Trends</span>
                  </div>
                  <p className="text-sm text-slate-600 ml-5">
                    Myntra shows 40% higher return rates for fashion items, while Amazon has better reconciliation accuracy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'settings':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
              <h2 className="text-2xl font-bold">ReconEasy Settings</h2>
              <p className="text-teal-100 mt-1">Configure API integrations and system preferences</p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Indian Marketplace API Configuration</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Amazon India SP-API Credentials</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Access Key ID"
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                    <input 
                      type="password" 
                      placeholder="Secret Access Key"
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">UTR Reconciliation Threshold</label>
                  <select className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                    <option>₹1 - Exact match required</option>
                    <option>₹5 - Allow small discrepancies</option>
                    <option>₹10 - Moderate tolerance</option>
                    <option>₹25 - High tolerance for bulk orders</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return <InteractiveDashboard metrics={metrics} />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
      
      {/* Global Filter Panel */}
      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFilterChange={setFilters}
        filterOptions={filterOptions}
      />
    </Layout>
  );
}

export default App;