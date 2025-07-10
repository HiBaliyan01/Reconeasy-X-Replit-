import React, { useState, useMemo } from 'react';
import { DashboardMetrics } from '../types';
import MetricsCard from './MetricsCard';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, BarElement, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertTriangle, BarChart3, 
  Filter, Download, Zap, Eye, Calendar, ArrowUpRight, ArrowDownRight,
  Target, Clock, CheckCircle, XCircle, Activity, Layers, IndianRupee,
  Sparkles, Users, Package, CreditCard
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
          color: 'rgb(71, 85, 105)',
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
    <div className="p-8 space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 dark:from-teal-700 dark:via-emerald-700 dark:to-cyan-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Sparkles className="w-8 h-8 text-yellow-300" />
                <h1 className="text-3xl font-bold">Welcome back, Admin!</h1>
              </div>
              <p className="text-teal-100 text-lg mb-4">Here's what's happening with your business today</p>
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-teal-100">All systems operational</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-teal-200" />
                  <span className="text-teal-100">Last updated: 2 min ago</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-teal-200" />
                  <span className="text-teal-100">98.7% Accuracy</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex items-center space-x-4">
              <div className="text-right">
                <div className="text-3xl font-bold">₹8.7L</div>
                <div className="text-teal-200">Today's Revenue</div>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">₹{metrics.totalSales.toLocaleString()}</p>
              <div className="flex items-center space-x-1 mt-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">+12.5%</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">vs last month</span>
              </div>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <IndianRupee className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Active Orders</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">1,247</p>
              <div className="flex items-center space-x-1 mt-2">
                <ArrowUpRight className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">+8.2%</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">this week</span>
              </div>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Package className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Return Rate</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{metrics.returnRate.toFixed(1)}%</p>
              <div className="flex items-center space-x-1 mt-2">
                <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">-2.1%</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">improvement</span>
              </div>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <RefreshCw className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Auto-Reconciled</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{Math.round(metrics.pendingReconciliations * 0.85)}</p>
              <div className="flex items-center space-x-1 mt-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">95% rate</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">automation</span>
              </div>
            </div>
            <div className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Performance Analytics</h3>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Real-time business insights</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Chart Type Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                {[
                  { id: 'overview', label: 'Overview', icon: TrendingUp },
                  { id: 'reconciliation', label: 'Reconciliation', icon: BarChart3 },
                  { id: 'performance', label: 'Performance', icon: Activity }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveChart(id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeChart === id
                        ? 'bg-teal-500 text-white shadow-lg'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Time Range Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                {[
                  { id: '7d', label: '7D' },
                  { id: '30d', label: '30D' },
                  { id: '90d', label: '90D' }
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setTimeRange(id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      timeRange === id
                        ? 'bg-teal-500 text-white shadow-lg'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-600'
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Live Activity</h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600 dark:text-slate-400">Real-time</span>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { type: 'success', message: 'UTR202401234 auto-matched', time: '2 min ago', icon: CheckCircle, color: 'text-emerald-500' },
              { type: 'warning', message: 'Manual review required for ₹2,500', time: '5 min ago', icon: AlertTriangle, color: 'text-amber-500' },
              { type: 'info', message: 'Batch reconciliation completed', time: '8 min ago', icon: Layers, color: 'text-blue-500' },
              { type: 'success', message: 'Return processed: SKU-12345', time: '12 min ago', icon: RefreshCw, color: 'text-emerald-500' },
              { type: 'error', message: 'Exception flagged: Amount mismatch', time: '15 min ago', icon: XCircle, color: 'text-red-500' }
            ].map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <activity.icon className={`w-5 h-5 mt-0.5 ${activity.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">{activity.message}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Quick Actions</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Streamline your workflow with one-click actions</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="group flex items-center justify-center space-x-3 p-6 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-2xl hover:from-teal-600 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Zap className="w-6 h-6 group-hover:animate-pulse" />
            <span className="font-semibold">Auto-Reconcile All</span>
          </button>
          <button className="group flex items-center justify-center space-x-3 p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Target className="w-6 h-6 group-hover:animate-pulse" />
            <span className="font-semibold">Smart Matching</span>
          </button>
          <button className="group flex items-center justify-center space-x-3 p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Eye className="w-6 h-6 group-hover:animate-pulse" />
            <span className="font-semibold">Exception Review</span>
          </button>
          <button className="group flex items-center justify-center space-x-3 p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Download className="w-6 h-6 group-hover:animate-pulse" />
            <span className="font-semibold">Generate Report</span>
          </button>
        </div>
      </div>

      {/* System Performance Indicators */}
      <div className="bg-gradient-to-r from-slate-50 to-teal-50 dark:from-slate-800 dark:to-teal-900/20 rounded-2xl border border-teal-200 dark:border-teal-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">System Performance</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Real-time system health and performance metrics</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All systems operational</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-white/60 dark:bg-slate-700/60 rounded-xl backdrop-blur-sm">
            <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">2.3s</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Avg Response Time</div>
          </div>
          <div className="text-center p-4 bg-white/60 dark:bg-slate-700/60 rounded-xl backdrop-blur-sm">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">99.2%</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Uptime</div>
          </div>
          <div className="text-center p-4 bg-white/60 dark:bg-slate-700/60 rounded-xl backdrop-blur-sm">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">1.2M</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Transactions/Day</div>
          </div>
          <div className="text-center p-4 bg-white/60 dark:bg-slate-700/60 rounded-xl backdrop-blur-sm">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">95%</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Auto-Match Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}