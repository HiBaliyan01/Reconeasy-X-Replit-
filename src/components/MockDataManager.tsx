import React, { useState } from 'react';
import { Database, RefreshCw, CheckCircle, AlertCircle, TrendingUp, BarChart3 } from 'lucide-react';

export default function MockDataManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState(new Date().toLocaleString());

  const handleLoadMockData = async () => {
    setIsLoading(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsLoading(false);
    setLastSync(new Date().toLocaleString());
  };

  const mockDataSources = [
    {
      name: 'Amazon India Transactions',
      status: 'active',
      records: 1247,
      cost: '₹13,315',
      description: 'SP-API integration for order and return data'
    },
    {
      name: 'Flipkart Marketplace',
      status: 'pending',
      records: 892,
      cost: '₹25,000',
      description: 'Seller API for transaction reconciliation'
    },
    {
      name: 'Myntra Fashion Returns',
      status: 'active',
      records: 634,
      cost: '₹25,000',
      description: 'Fashion-specific return analytics'
    },
    {
      name: 'Bank Statement UTRs',
      status: 'active',
      records: 2156,
      cost: 'Free',
      description: 'ICICI/HDFC bank integration for UTR matching'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold">Mock Data Management</h2>
        <p className="text-teal-100 mt-1">Simulate marketplace APIs to avoid ₹4,50,000 development costs during testing</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={handleLoadMockData}
          disabled={isLoading}
          className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          {isLoading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Database className="w-5 h-5" />
          )}
          <span>{isLoading ? 'Loading...' : 'Load Mock Data'}</span>
        </button>
        
        <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl">
          <TrendingUp className="w-5 h-5" />
          <span>Generate Forecast</span>
        </button>
        
        <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl">
          <BarChart3 className="w-5 h-5" />
          <span>Export Report</span>
        </button>
      </div>

      {/* Data Sources */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Mock Data Sources</h3>
          <div className="text-sm text-slate-600">
            Last sync: {lastSync}
          </div>
        </div>
        
        <div className="space-y-4">
          {mockDataSources.map((source, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center space-x-4">
                <div className={`w-3 h-3 rounded-full ${
                  source.status === 'active' ? 'bg-emerald-500' : 
                  source.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                }`}></div>
                <div>
                  <h4 className="font-medium text-slate-900">{source.name}</h4>
                  <p className="text-sm text-slate-600">{source.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-900">{source.records.toLocaleString()} records</div>
                <div className="text-sm text-slate-600">API Cost: {source.cost}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mock API Endpoints */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Available Mock Endpoints</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <code className="text-sm font-mono">POST /api/reconcile</code>
            </div>
            <span className="text-sm text-emerald-600">UTR reconciliation</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <code className="text-sm font-mono">POST /api/returns</code>
            </div>
            <span className="text-sm text-emerald-600">Return processing</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <code className="text-sm font-mono">GET /api/dashboard</code>
            </div>
            <span className="text-sm text-emerald-600">Dashboard metrics</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <code className="text-sm font-mono">GET /api/mock-data</code>
            </div>
            <span className="text-sm text-amber-600">Load sample data</span>
          </div>
        </div>
      </div>

      {/* Cost Savings */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Development Cost Savings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">₹4,50,000</div>
            <div className="text-sm text-slate-600">Saved on Real APIs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">6 months</div>
            <div className="text-sm text-slate-600">Development Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">100%</div>
            <div className="text-sm text-slate-600">Feature Coverage</div>
          </div>
        </div>
      </div>
    </div>
  );
}