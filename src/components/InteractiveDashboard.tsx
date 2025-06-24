import React, { useState, useMemo } from 'react';
import { DashboardMetrics } from '../types';
import MetricsCard from './MetricsCard';
import FilterPanel from './FilterPanel';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, BarElement, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertTriangle, BarChart3, Filter, Download, Zap, Eye, Calendar } from 'lucide-react';
import { mockSalesData } from '../data/mockData';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, ArcElement, Title, Tooltip, Legend);

interface InteractiveDashboardProps {
  metrics: DashboardMetrics;
}

export default function InteractiveDashboard({ metrics }: InteractiveDashboardProps) {
  const [activeChart, setActiveChart] = useState('sales');
  const [timeRange, setTimeRange] = useState('7d');
  const [showFilters, setShowFilters] = useState(false);
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

  // Interactive chart data based on time range
  const getChartData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data = mockSalesData.slice(-days);
    
    return {
      labels: data.map(item => new Date(item.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })),
      datasets: [
        {
          label: 'Sales (₹)',
          data: data.map(item => item.sales),
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13, 148, 136, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#0d9488',
          pointBorderColor: 'white',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
        {
          label: 'Returns (₹)',
          data: data.map(item => item.returns),
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#dc2626',
          pointBorderColor: 'white',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        }
      ]
    };
  }, [timeRange]);

  // Return reasons pie chart
  const returnReasonsData = {
    labels: ['Size Issues', 'Quality Issues', 'Wrong Item', 'Damaged', 'Not as Described'],
    datasets: [{
      data: [35, 25, 15, 15, 10],
      backgroundColor: [
        '#0d9488',
        '#06b6d4',
        '#8b5cf6',
        '#f59e0b',
        '#ef4444'
      ],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  // Marketplace performance data
  const marketplaceData = {
    labels: ['Amazon India', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa'],
    datasets: [
      {
        label: 'Sales Volume (₹)',
        data: [45, 30, 15, 7, 3],
        backgroundColor: 'rgba(13, 148, 136, 0.8)',
        borderColor: '#0d9488',
        borderWidth: 2,
        borderRadius: 8,
      },
      {
        label: 'Return Rate (%)',
        data: [12, 18, 25, 15, 8],
        backgroundColor: 'rgba(220, 38, 38, 0.8)',
        borderColor: '#dc2626',
        borderWidth: 2,
        borderRadius: 8,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: '#0d9488',
        borderWidth: 1,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(13, 148, 136, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return '₹' + value.toLocaleString();
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const renderChart = () => {
    switch (activeChart) {
      case 'sales':
        return <Line data={getChartData} options={chartOptions} />;
      case 'marketplace':
        return <Bar data={marketplaceData} options={chartOptions} />;
      case 'returns':
        return <Doughnut data={returnReasonsData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />;
      default:
        return <Line data={getChartData} options={chartOptions} />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Interactive Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <img src="/logo.png" alt="ReconEasy" className="w-8 h-8" />
              <span>ReconEasy Dashboard</span>
            </h2>
            <p className="text-teal-100 mt-1">AI-powered payment reconciliation and return analytics</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricsCard
          title="Total Sales"
          value={`₹${metrics.totalSales.toLocaleString()}`}
          change="+12.5% from last month"
          changeType="positive"
          icon={DollarSign}
          color="emerald"
        />
        <MetricsCard
          title="Return Rate"
          value={`${metrics.returnRate.toFixed(1)}%`}
          change="-2.1% from last month"
          changeType="positive"
          icon={RefreshCw}
          color="blue"
        />
        <MetricsCard
          title="UTR Reconciliations"
          value={metrics.pendingReconciliations}
          change="5 resolved today"
          changeType="positive"
          icon={BarChart3}
          color="amber"
        />
        <MetricsCard
          title="Total Returns"
          value={metrics.totalReturns}
          change="+8.3% from last month"
          changeType="negative"
          icon={TrendingDown}
          color="red"
        />
        <MetricsCard
          title="Payment Discrepancies"
          value={metrics.totalDiscrepancies}
          change="2 new this week"
          changeType="negative"
          icon={AlertTriangle}
          color="red"
        />
        <MetricsCard
          title="Avg Order Value"
          value={`₹${metrics.averageOrderValue.toLocaleString()}`}
          change="+₹150 from last month"
          changeType="positive"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Interactive Chart Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Interactive Analytics</h3>
          <div className="flex items-center space-x-4">
            {/* Chart Type Selector */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              {[
                { id: 'sales', label: 'Sales Trend', icon: TrendingUp },
                { id: 'marketplace', label: 'Marketplace', icon: BarChart3 },
                { id: 'returns', label: 'Return Reasons', icon: RefreshCw }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveChart(id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeChart === id
                      ? 'bg-teal-500 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Time Range Selector */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              {[
                { id: '7d', label: '7D' },
                { id: '30d', label: '30D' },
                { id: '90d', label: '90D' }
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTimeRange(id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    timeRange === id
                      ? 'bg-teal-500 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="h-80">
          {renderChart()}
        </div>
      </div>

      {/* Quick Actions with Enhanced Interactivity */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <RefreshCw className="w-5 h-5" />
            <span>Run UTR Reconciliation</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Zap className="w-5 h-5" />
            <span>Generate AI Forecast</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Eye className="w-5 h-5" />
            <span>View Analytics</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Download className="w-5 h-5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Real-time Updates */}
      <div className="bg-gradient-to-r from-slate-50 to-teal-50 rounded-xl border border-teal-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Real-time System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">Live</div>
            <div className="text-sm text-slate-600">Data Sync</div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full mx-auto mt-1 animate-pulse"></div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">98.5%</div>
            <div className="text-sm text-slate-600">Reconciliation Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">2.3s</div>
            <div className="text-sm text-slate-600">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">Mock Mode</div>
            <div className="text-sm text-slate-600">Development Phase</div>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFilterChange={setFilters}
        filterOptions={filterOptions}
      />
    </div>
  );
}