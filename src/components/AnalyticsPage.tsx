import React, { useState, useMemo } from 'react';
import { 
  BarChart3, TrendingUp, MapPin, AlertTriangle, Filter, Download,
  IndianRupee, Package, RefreshCw, Eye, Calendar, Search
} from 'lucide-react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface AnalyticsData {
  skuPerformance: Array<{
    sku: string;
    units_sold: number;
    total_revenue: number;
    returns: number;
    return_amount: number;
    profitability: number;
    performance: 'High' | 'Medium' | 'Low';
  }>;
  marketplaceTrends: Array<{
    marketplace: string;
    total_sales: number;
    return_rate: number;
    avg_return_amount: number;
    fraud_rate: number;
  }>;
  returnMap: Array<{
    state: string;
    pincode: string;
    returns: number;
    fraudulent: number;
    amount: number;
    lat: number;
    lng: number;
  }>;
  totalClaimed: number;
  paymentSummary: {
    reconciled_amount: number;
    discrepancy_amount: number;
    pending_amount: number;
  };
  returnSummary: {
    total_returns: number;
    fraudulent_returns: number;
    undelivered_returns: number;
    sla_violations: number;
  };
}

const mockAnalyticsData: AnalyticsData = {
  skuPerformance: [
    {
      sku: 'KURTA-XL-RED',
      units_sold: 150,
      total_revenue: 225000,
      returns: 45,
      return_amount: 67500,
      profitability: 157500,
      performance: 'High'
    },
    {
      sku: 'JEANS-L-BLACK',
      units_sold: 120,
      total_revenue: 300000,
      returns: 60,
      return_amount: 150000,
      profitability: 150000,
      performance: 'Medium'
    },
    {
      sku: 'DRESS-M-BLUE',
      units_sold: 80,
      total_revenue: 152000,
      returns: 40,
      return_amount: 76000,
      profitability: 76000,
      performance: 'Low'
    }
  ],
  marketplaceTrends: [
    {
      marketplace: 'Myntra',
      total_sales: 450000,
      return_rate: 25.5,
      avg_return_amount: 1800,
      fraud_rate: 2.1
    },
    {
      marketplace: 'Amazon',
      total_sales: 380000,
      return_rate: 18.2,
      avg_return_amount: 1650,
      fraud_rate: 1.8
    },
    {
      marketplace: 'Flipkart',
      total_sales: 320000,
      return_rate: 22.8,
      avg_return_amount: 1750,
      fraud_rate: 2.5
    }
  ],
  returnMap: [
    { state: 'Maharashtra', pincode: '400001', returns: 45, fraudulent: 3, amount: 85000, lat: 19.0760, lng: 72.8777 },
    { state: 'Karnataka', pincode: '560001', returns: 32, fraudulent: 2, amount: 62000, lat: 12.9716, lng: 77.5946 },
    { state: 'Delhi', pincode: '110001', returns: 28, fraudulent: 4, amount: 58000, lat: 28.6139, lng: 77.2090 },
    { state: 'Tamil Nadu', pincode: '600001', returns: 25, fraudulent: 1, amount: 48000, lat: 13.0827, lng: 80.2707 }
  ],
  totalClaimed: 285000,
  paymentSummary: {
    reconciled_amount: 1250000,
    discrepancy_amount: 45000,
    pending_amount: 125000
  },
  returnSummary: {
    total_returns: 130,
    fraudulent_returns: 10,
    undelivered_returns: 8,
    sla_violations: 5
  }
};

export default function AnalyticsPage() {
  const [analyticsData] = useState<AnalyticsData>(mockAnalyticsData);
  const [selectedMarketplace, setSelectedMarketplace] = useState('All');
  const [timeRange, setTimeRange] = useState('30d');
  const [activeView, setActiveView] = useState('overview');

  const marketplaceLogos = {
    Myntra: '/logos/myntra.png',
    Amazon: '/logos/amazon.png',
    Flipkart: '/logos/flipkart.png',
    All: null
  };

  // Chart data
  const skuPerformanceChart = {
    labels: analyticsData.skuPerformance.map(item => item.sku),
    datasets: [
      {
        label: 'Revenue (₹)',
        data: analyticsData.skuPerformance.map(item => item.total_revenue),
        backgroundColor: 'rgba(13, 148, 136, 0.8)',
        borderColor: '#0d9488',
        borderWidth: 2
      },
      {
        label: 'Return Loss (₹)',
        data: analyticsData.skuPerformance.map(item => item.return_amount),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: '#ef4444',
        borderWidth: 2
      }
    ]
  };

  const marketplaceTrendsChart = {
    labels: analyticsData.marketplaceTrends.map(item => item.marketplace),
    datasets: [
      {
        label: 'Return Rate (%)',
        data: analyticsData.marketplaceTrends.map(item => item.return_rate),
        backgroundColor: ['#f97316', '#3b82f6', '#ec4899'],
        borderWidth: 2
      }
    ]
  };

  const returnReasonChart = {
    labels: ['Size Issues', 'Quality Problems', 'Wrong Item', 'Damaged', 'Not as Described'],
    datasets: [{
      data: [35, 25, 15, 15, 10],
      backgroundColor: [
        '#0d9488',
        '#06b6d4',
        '#8b5cf6',
        '#f59e0b',
        '#ef4444'
      ],
      borderWidth: 2
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: '#0d9488',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            if (context.dataset.label?.includes('₹')) {
              return context.dataset.label + ': ₹' + context.parsed.y.toLocaleString();
            }
            return context.dataset.label + ': ' + context.parsed.y;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return typeof value === 'number' && value > 1000 ? '₹' + value.toLocaleString() : value;
          }
        }
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">AI-Powered Analytics Dashboard</h2>
            <p className="text-teal-100 mt-1">Advanced insights for Indian e-commerce fashion brands</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Marketplace Filter */}
            <div className="flex items-center space-x-2 bg-white/20 rounded-lg p-2">
              {Object.entries(marketplaceLogos).map(([marketplace, logo]) => (
                <button
                  key={marketplace}
                  onClick={() => setSelectedMarketplace(marketplace)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    selectedMarketplace === marketplace 
                      ? 'bg-white/30 text-white' 
                      : 'text-teal-100 hover:bg-white/20'
                  }`}
                >
                  {logo && <img src={logo} alt={marketplace} className="w-4 h-4" />}
                  <span className="text-sm">{marketplace}</span>
                </button>
              ))}
            </div>
            
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white text-sm"
            >
              <option value="7d" className="text-slate-900">Last 7 Days</option>
              <option value="30d" className="text-slate-900">Last 30 Days</option>
              <option value="90d" className="text-slate-900">Last 90 Days</option>
            </select>
            
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Money Claimed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{analyticsData.totalClaimed.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+12% from last month</p>
            </div>
            <IndianRupee className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Payment Discrepancies</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{analyticsData.paymentSummary.discrepancy_amount.toLocaleString()}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">3 new this week</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Return Issues</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analyticsData.returnSummary.fraudulent_returns + analyticsData.returnSummary.undelivered_returns}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Fraud + Undelivered</p>
            </div>
            <Package className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Reconciliation Rate</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">94.2%</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+2.1% improvement</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* India Return & Fraud Map */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Return & Fraud Origins Map</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Geographic distribution of returns and fraudulent activities</p>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-400">India</span>
          </div>
        </div>
        
        <div className="h-96 rounded-lg overflow-hidden">
          <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {analyticsData.returnMap.map((location, index) => (
              <Marker key={index} position={[location.lat, location.lng]}>
                <Popup>
                  <div className="p-2">
                    <h4 className="font-semibold">{location.state}</h4>
                    <p className="text-sm">Pincode: {location.pincode}</p>
                    <p className="text-sm">Returns: {location.returns}</p>
                    <p className="text-sm">Fraudulent: {location.fraudulent}</p>
                    <p className="text-sm">Amount: ₹{location.amount.toLocaleString()}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SKU Performance */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">SKU Performance Analysis</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Revenue vs Return Loss by Product</p>
          </div>
          <div className="h-80">
            <Bar data={skuPerformanceChart} options={chartOptions} />
          </div>
        </div>

        {/* Marketplace Trends */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Marketplace Return Rates</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Platform-wise return performance</p>
          </div>
          <div className="h-80">
            <Bar data={marketplaceTrendsChart} options={chartOptions} />
          </div>
        </div>

        {/* Return Reasons */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Return Reason Analysis</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Why customers return products</p>
          </div>
          <div className="h-80">
            <Doughnut data={returnReasonChart} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Payment vs Return Summary */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Payment & Return Summary</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Reconciliation overview</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Reconciled Payments</span>
              <span className="text-lg font-bold text-emerald-900 dark:text-emerald-100">₹{analyticsData.paymentSummary.reconciled_amount.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <span className="text-sm font-medium text-red-700 dark:text-red-300">Payment Discrepancies</span>
              <span className="text-lg font-bold text-red-900 dark:text-red-100">₹{analyticsData.paymentSummary.discrepancy_amount.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Pending Payments</span>
              <span className="text-lg font-bold text-amber-900 dark:text-amber-100">₹{analyticsData.paymentSummary.pending_amount.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Returns</span>
              <span className="text-lg font-bold text-blue-900 dark:text-blue-100">{analyticsData.returnSummary.total_returns}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SKU Performance Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Detailed SKU Analytics</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Profitability, revenue, units sold, returns, and losses</p>
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export SKU Data</span>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Units Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Returns</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Return Loss</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Profitability</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Performance</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {analyticsData.skuPerformance.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {item.units_sold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                    ₹{item.total_revenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {item.returns}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                    ₹{item.return_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    ₹{item.profitability.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      item.performance === 'High' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                      item.performance === 'Medium' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                      'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {item.performance}
                    </span>
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