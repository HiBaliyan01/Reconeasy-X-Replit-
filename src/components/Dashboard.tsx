import React from 'react';
import { DashboardMetrics } from '../types';
import MetricsCard from './MetricsCard';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertTriangle, BarChart3, Database, Zap } from 'lucide-react';
import { mockSalesData } from '../data/mockData';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, Title, Tooltip, Legend);

interface DashboardProps {
  metrics: DashboardMetrics;
}

export default function Dashboard({ metrics }: DashboardProps) {
  // Sales trend chart data with ReconEasy styling
  const salesChartData = {
    labels: mockSalesData.slice(-7).map(item => new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Sales (₹)',
        data: mockSalesData.slice(-7).map(item => item.sales),
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#0d9488',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
      },
      {
        label: 'Returns (₹)',
        data: mockSalesData.slice(-7).map(item => item.returns),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#dc2626',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
      }
    ]
  };

  // Marketplace distribution with Indian marketplace focus
  const marketplaceData = {
    labels: ['Amazon India', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa'],
    datasets: [
      {
        label: 'Sales Volume (₹)',
        data: [45, 30, 15, 7, 3],
        backgroundColor: [
          'rgba(255, 159, 64, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 205, 86, 0.8)'
        ],
        borderColor: [
          'rgba(255, 159, 64, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 205, 86, 1)'
        ],
        borderWidth: 2,
        borderRadius: 8,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">ReconEasy Dashboard</h2>
            <p className="text-teal-100 mt-1">AI-powered payment reconciliation and return analytics for fashion e-commerce</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-teal-100">Mock Mode Active</div>
            <div className="text-xs text-teal-200">Real marketplace APIs: ₹4,50,000</div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
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
          title="Pending UTR Reconciliations"
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales & Returns Trend */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Sales & Returns Trend</h3>
            <p className="text-sm text-slate-600 mt-1">Last 7 days performance with ARIMA forecasting</p>
          </div>
          <div className="h-64">
            <Line data={salesChartData} options={chartOptions} />
          </div>
        </div>

        {/* Marketplace Distribution */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Indian Marketplace Distribution</h3>
            <p className="text-sm text-slate-600 mt-1">Sales volume by platform (Fashion Focus)</p>
          </div>
          <div className="h-64">
            <Bar data={marketplaceData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* ReconEasy Features */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">ReconEasy AI Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <RefreshCw className="w-5 h-5" />
            <span>UTR Reconciliation</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Zap className="w-5 h-5" />
            <span>ARIMA Forecast</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Database className="w-5 h-5" />
            <span>SKU Analytics</span>
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-gradient-to-r from-slate-50 to-teal-50 rounded-xl border border-teal-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">System Status & Budget</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">₹49,00,000</div>
            <div className="text-sm text-slate-600">Total Budget</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">₹6,50,000</div>
            <div className="text-sm text-slate-600">AWS Deployment</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">₹4,50,000</div>
            <div className="text-sm text-slate-600">Real API Integration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">Local Dev</div>
            <div className="text-sm text-slate-600">Current Mode</div>
          </div>
        </div>
      </div>
    </div>
  );
}