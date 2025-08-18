import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, Calendar, IndianRupee, Package, Clock, 
  Filter, Search, Download, Eye, BarChart3, AlertCircle
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import ProjectedIncomeHead from './subtabs/ProjectedIncomeHead';

interface ProjectedIncomeData {
  id: string;
  order_id: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra' | 'Ajio' | 'Nykaa';
  estimated_amount: number;
  commission_deduction: number;
  tds_deduction: number;
  net_projected_amount: number;
  expected_release_date: string;
  status: 'processing' | 'ready_for_settlement' | 'delayed' | 'on_hold';
  sku: string;
  product_name: string;
  order_date: string;
  settlement_cycle: number; // days
  confidence_score: number; // AI confidence in projection
  risk_factors: string[];
}

const mockProjectedIncomeData: ProjectedIncomeData[] = [
  {
    id: 'PROJ001',
    order_id: 'MYN-ORD-2024-001',
    marketplace: 'Myntra',
    estimated_amount: 2499,
    commission_deduction: 375,
    tds_deduction: 25,
    net_projected_amount: 2099,
    expected_release_date: '2024-01-25T00:00:00Z',
    status: 'processing',
    sku: 'KURTA-XL-BLUE',
    product_name: 'Designer Kurta - Blue XL',
    order_date: '2024-01-18T10:30:00Z',
    settlement_cycle: 7,
    confidence_score: 94.5,
    risk_factors: []
  },
  {
    id: 'PROJ002',
    order_id: 'AMZ-ORD-2024-002',
    marketplace: 'Amazon',
    estimated_amount: 1899,
    commission_deduction: 285,
    tds_deduction: 19,
    net_projected_amount: 1595,
    expected_release_date: '2024-01-26T00:00:00Z',
    status: 'ready_for_settlement',
    sku: 'DRESS-M-RED',
    product_name: 'Summer Dress - Red Medium',
    order_date: '2024-01-19T14:20:00Z',
    settlement_cycle: 7,
    confidence_score: 98.2,
    risk_factors: []
  },
  {
    id: 'PROJ003',
    order_id: 'FLP-ORD-2024-003',
    marketplace: 'Flipkart',
    estimated_amount: 3299,
    commission_deduction: 495,
    tds_deduction: 33,
    net_projected_amount: 2771,
    expected_release_date: '2024-01-28T00:00:00Z',
    status: 'delayed',
    sku: 'JEANS-L-BLACK',
    product_name: 'Premium Jeans - Black Large',
    order_date: '2024-01-16T09:15:00Z',
    settlement_cycle: 14,
    confidence_score: 76.8,
    risk_factors: ['Settlement delay history', 'High return rate for SKU']
  },
  {
    id: 'PROJ004',
    order_id: 'AJO-ORD-2024-004',
    marketplace: 'Ajio',
    estimated_amount: 1599,
    commission_deduction: 240,
    tds_deduction: 16,
    net_projected_amount: 1343,
    expected_release_date: '2024-01-27T00:00:00Z',
    status: 'on_hold',
    sku: 'TSHIRT-S-WHITE',
    product_name: 'Cotton T-Shirt - White Small',
    order_date: '2024-01-17T16:45:00Z',
    settlement_cycle: 10,
    confidence_score: 65.3,
    risk_factors: ['Quality complaint pending', 'Customer dispute']
  }
];

export default function ProjectedIncomePage() {
  const [projectedData] = useState<ProjectedIncomeData[]>(mockProjectedIncomeData);
  const [selectedOrder, setSelectedOrder] = useState<ProjectedIncomeData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState('7d');

  const marketplaceLogos = {
    Amazon: '/logos/amazon.png',
    Flipkart: '/logos/flipkart.png',
    Myntra: '/logos/myntra.png',
    Ajio: '/logos/ajio.png',
    Nykaa: '/logos/nykaa.png'
  };

  // Filter projected income data
  const filteredData = useMemo(() => {
    let filtered = projectedData;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Marketplace filter
    if (marketplaceFilter !== 'all') {
      filtered = filtered.filter(item => item.marketplace === marketplaceFilter);
    }

    // Time range filter
    if (timeRangeFilter !== 'all') {
      const now = new Date();
      const days = timeRangeFilter === '7d' ? 7 : timeRangeFilter === '30d' ? 30 : 90;
      const cutoffDate = addDays(now, days);
      
      filtered = filtered.filter(item => 
        new Date(item.expected_release_date) <= cutoffDate
      );
    }

    return filtered;
  }, [projectedData, searchTerm, statusFilter, marketplaceFilter, timeRangeFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalProjected = filteredData.reduce((sum, item) => sum + item.net_projected_amount, 0);
    const totalOrders = filteredData.length;
    const readyForSettlement = filteredData.filter(item => item.status === 'ready_for_settlement').length;
    const avgConfidence = filteredData.reduce((sum, item) => sum + item.confidence_score, 0) / filteredData.length || 0;
    const delayedOrders = filteredData.filter(item => item.status === 'delayed' || item.status === 'on_hold').length;
    
    return {
      totalProjected,
      totalOrders,
      readyForSettlement,
      avgConfidence,
      delayedOrders
    };
  }, [filteredData]);

  const getStatusIcon = (status: ProjectedIncomeData['status']) => {
    switch (status) {
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'ready_for_settlement':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'delayed':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'on_hold':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: ProjectedIncomeData['status']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'processing':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'ready_for_settlement':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'delayed':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      case 'on_hold':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
    }
  };

  const getMarketplaceBadge = (marketplace: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (marketplace) {
      case 'Amazon':
        return `${baseClasses} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      case 'Flipkart':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'Myntra':
        return `${baseClasses} bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400`;
      case 'Ajio':
        return `${baseClasses} bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400`;
      case 'Nykaa':
        return `${baseClasses} bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const getConfidenceBadge = (score: number) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    if (score >= 90) {
      return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
    } else if (score >= 75) {
      return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
    } else {
      return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
    }
  };

  const exportToCSV = () => {
    const csvData = filteredData.map(item => ({
      'Order ID': item.order_id,
      'Marketplace': item.marketplace,
      'Product': item.product_name,
      'SKU': item.sku,
      'Estimated Amount': `₹${item.estimated_amount}`,
      'Net Projected': `₹${item.net_projected_amount}`,
      'Expected Release': format(new Date(item.expected_release_date), 'yyyy-MM-dd'),
      'Status': item.status,
      'Confidence': `${item.confidence_score}%`
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projected_income_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (selectedOrder) {
    return (
      <div className="space-y-6">
        {/* Order Detail Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Projected Income
              </button>
              <h2 className="text-2xl font-bold">Order Projection Details</h2>
              <p className="text-teal-100 mt-1">{selectedOrder.order_id}</p>
            </div>
            <div className="flex items-center space-x-3">
              <img 
                src={marketplaceLogos[selectedOrder.marketplace]} 
                alt={selectedOrder.marketplace} 
                className="w-8 h-8"
              />
              <span className={getMarketplaceBadge(selectedOrder.marketplace)}>
                {selectedOrder.marketplace}
              </span>
            </div>
          </div>
        </div>

        {/* Order Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Financial Projection</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estimated Amount</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">₹{selectedOrder.estimated_amount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Commission Deduction</span>
                <span className="text-lg font-bold text-red-900 dark:text-red-100">-₹{selectedOrder.commission_deduction.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">TDS Deduction</span>
                <span className="text-lg font-bold text-amber-900 dark:text-amber-100">-₹{selectedOrder.tds_deduction.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border-2 border-emerald-200 dark:border-emerald-800">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Net Projected Amount</span>
                <span className="text-xl font-bold text-emerald-900 dark:text-emerald-100">₹{selectedOrder.net_projected_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Order Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Product</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedOrder.product_name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">SKU: {selectedOrder.sku}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Order Date</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedOrder.order_date), 'PPP')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expected Release Date</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedOrder.expected_release_date), 'PPP')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Settlement Cycle</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedOrder.settlement_cycle} days</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">AI Confidence Score</label>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={getConfidenceBadge(selectedOrder.confidence_score)}>
                    {selectedOrder.confidence_score.toFixed(1)}%
                  </span>
                </div>
              </div>

              {selectedOrder.risk_factors.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Risk Factors</label>
                  <div className="mt-2 space-y-1">
                    {selectedOrder.risk_factors.map((risk, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-amber-700 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectedIncomeHead />

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Projected</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{metrics.totalProjected.toLocaleString()}</p>
            </div>
            <IndianRupee className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Orders</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalOrders}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Ready for Settlement</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.readyForSettlement}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Confidence</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.avgConfidence.toFixed(1)}%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Delayed/On Hold</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.delayedOrders}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Projected Orders</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredData.length} of {projectedData.length} orders
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-subheader-projected-income focus:border-subheader-projected-income text-sm bg-card text-foreground placeholder-muted-foreground"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-subheader-projected-income focus:border-subheader-projected-income text-sm bg-card text-foreground"
            >
              <option value="all">All Statuses</option>
              <option value="processing">Processing</option>
              <option value="ready_for_settlement">Ready for Settlement</option>
              <option value="delayed">Delayed</option>
              <option value="on_hold">On Hold</option>
            </select>
            
            {/* Marketplace Filter */}
            <select
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-subheader-projected-income focus:border-subheader-projected-income text-sm bg-card text-foreground"
            >
              <option value="all">All Marketplaces</option>
              <option value="Amazon">Amazon</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Myntra">Myntra</option>
              <option value="Ajio">Ajio</option>
              <option value="Nykaa">Nykaa</option>
            </select>
            
            {/* Time Range Filter */}
            <select
              value={timeRangeFilter}
              onChange={(e) => setTimeRangeFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-subheader-projected-income focus:border-subheader-projected-income text-sm bg-card text-foreground"
            >
              <option value="all">All Time</option>
              <option value="7d">Next 7 Days</option>
              <option value="30d">Next 30 Days</option>
              <option value="90d">Next 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projected Income Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Order Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Marketplace
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Estimated Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Net Projected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Expected Release
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.order_id}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{item.product_name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">SKU: {item.sku}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <img 
                        src={marketplaceLogos[item.marketplace]} 
                        alt={item.marketplace} 
                        className="w-5 h-5"
                      />
                      <span className={getMarketplaceBadge(item.marketplace)}>
                        {item.marketplace}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">₹{item.estimated_amount.toLocaleString()}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">-₹{(item.commission_deduction + item.tds_deduction).toLocaleString()} deductions</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">₹{item.net_projected_amount.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 dark:text-slate-100">
                      {format(new Date(item.expected_release_date), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {item.settlement_cycle} day cycle
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(item.status)}
                      <span className={getStatusBadge(item.status)}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getConfidenceBadge(item.confidence_score)}>
                      {item.confidence_score.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedOrder(item)}
                      className="text-subheader-projected-income hover:text-subheader-projected-income/80 text-sm font-medium flex items-center space-x-1 hover:bg-subheader-projected-income/10 px-2 py-1 rounded transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}