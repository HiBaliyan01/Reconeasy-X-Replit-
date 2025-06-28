import React, { useState, useMemo } from 'react';
import { DashboardMetrics } from '../types';
import MetricsCard from './MetricsCard';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, BarElement, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertTriangle, BarChart3, 
  Filter, Download, Zap, Eye, Calendar, ArrowUpRight, ArrowDownRight,
  Target, Clock, CheckCircle, XCircle, Activity, Layers, IndianRupee
} from 'lucide-react';
import { mockSalesData } from '../data/mockData';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, ArcElement, Title, Tooltip, Legend);

interface EnhancedDashboardProps {
  metrics: DashboardMetrics;
}

export default function EnhancedDashboard({ metrics }: EnhancedDashboardProps) {
  const [activeChart, setActiveChart] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Enhanced chart data with dark mode support
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
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#f97316',
          pointBorderColor: 'white',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        }
      ]
    };
  }, [timeRange]);

  // Real-time reconciliation status
  const reconciliationData = {
    labels: ['Auto-Matched', 'Manual Review', 'Exceptions', 'Pending'],
    datasets: [{
      data: [75, 15, 5, 5],
      backgroundColor: [
        '#10b981',
        '#f59e0b',
        '#ef4444',
        '#6b7280'
      ],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  // Performance metrics
  const performanceData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Processing Speed (ms)',
        data: [120, 95, 110, 85, 90, 105, 88],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        borderRadius: 8,
      },
      {
        label: 'Accuracy (%)',
        data: [98.5, 99.1, 98.8, 99.3, 99.0, 98.9, 99.2],
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: '#10b981',
        borderWidth: 2,
        borderRadius: 8,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
          color: 'rgb(71, 85, 105)', // slate-600
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: '#0d9488',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            return context.dataset.label + ': ₹' + context.parsed.y.toLocaleString();
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(13, 148, 136, 0.1)',
        },
        ticks: {
          color: 'rgb(71, 85, 105)',
          callback: function(value: any) {
            return '₹' + value.toLocaleString();
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgb(71, 85, 105)',
        }
      },
    },
  };

  const renderChart = () => {
    switch (activeChart) {
      case 'overview':
        return <Line data={getChartData} options={chartOptions} />;
      case 'reconciliation':
        return <Doughnut data={reconciliationData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />;
      case 'performance':
        return <Bar data={performanceData} options={chartOptions} />;
      default:
        return <Line data={getChartData} options={chartOptions} />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Enhanced Header with Real-time Status */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center space-x-3">
              <Activity className="w-8 h-8" />
              <span>ReconEasy Solutions - Unified Dashboard</span>
            </h2>
            <p className="text-teal-100 mt-1">AI-powered payment reconciliation and return analytics for Indian e-commerce</p>
            <div className="flex items-center space-x-4 mt-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>Live Processing</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Last updated: 2 min ago</span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4" />
                <span>98.7% Accuracy</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Filter className="w-4 h-4" />
              <span>Advanced Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard
          title="Total Revenue"
          value={`₹${metrics.totalSales.toLocaleString()}`}
          change="+12.5% from last month"
          changeType="positive"
          icon={IndianRupee}
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
          title="Auto-Reconciled"
          value={`${Math.round(metrics.pendingReconciliations * 0.85)}`}
          change="95% automation rate"
          changeType="positive"
          icon={CheckCircle}
          color="emerald"
        />
        <MetricsCard
          title="Exceptions"
          value={metrics.totalDiscrepancies}
          change="2 new this week"
          changeType="negative"
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Real-time Processing Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Real-time Analytics</h3>
            <div className="flex items-center space-x-4">
              {/* Chart Type Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                {[
                  { id: 'overview', label: 'Overview', icon: TrendingUp },
                  { id: 'reconciliation', label: 'Reconciliation', icon: BarChart3 },
                  { id: 'performance', label: 'Performance', icon: Activity }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveChart(id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeChart === id
                        ? 'bg-teal-500 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Time Range Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
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
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
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

        {/* Live Activity Feed */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Live Activity</h3>
          <div className="space-y-4">
            {[
              { type: 'success', message: 'UTR202401234 auto-matched', time: '2 min ago', icon: CheckCircle, color: 'text-emerald-500' },
              { type: 'warning', message: 'Manual review required for ₹2,500', time: '5 min ago', icon: AlertTriangle, color: 'text-amber-500' },
              { type: 'info', message: 'Batch reconciliation completed', time: '8 min ago', icon: Layers, color: 'text-blue-500' },
              { type: 'success', message: 'Return processed: SKU-12345', time: '12 min ago', icon: RefreshCw, color: 'text-emerald-500' },
              { type: 'error', message: 'Exception flagged: Amount mismatch', time: '15 min ago', icon: XCircle, color: 'text-red-500' }
            ].map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <activity.icon className={`w-4 h-4 mt-0.5 ${activity.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100">{activity.message}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Intelligent Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Zap className="w-5 h-5" />
            <span>Auto-Reconcile All</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Target className="w-5 h-5" />
            <span>Smart Matching</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Eye className="w-5 h-5" />
            <span>Exception Review</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Download className="w-5 h-5" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* System Performance Indicators */}
      <div className="bg-gradient-to-r from-slate-50 to-teal-50 dark:from-slate-800 dark:to-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">System Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">2.3s</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">99.2%</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Uptime</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">1.2M</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Transactions/Day</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">95%</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Auto-Match Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}