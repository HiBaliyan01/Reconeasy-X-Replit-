import React, { useState, useMemo, useEffect } from 'react';
import { DashboardMetrics } from '../types';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, BarElement, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertTriangle, BarChart3, 
  Filter, Download, Zap, Eye, Calendar, ArrowUpRight, ArrowDownRight,
  Target, Clock, CheckCircle, XCircle, Layers, IndianRupee,
  Sparkles, Users, Package, CreditCard, FileUp, Plus, Bell
} from 'lucide-react';
import { mockSalesData } from '../data/mockData';
import ReconciliationCalculator from './ReconciliationCalculator';
import { AiInsights } from './AiInsights';
import { RateCard } from '../utils/supabase';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, ArcElement, Title, Tooltip, Legend);

interface EnhancedDashboardProps {
  metrics: DashboardMetrics;
  rateCards: RateCard[];
}

export default function EnhancedDashboard({ metrics, rateCards }: EnhancedDashboardProps) {
  const [activeChart, setActiveChart] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [discrepanciesData, setDiscrepanciesData] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<any[]>([]);

  useEffect(() => {
    // Simulate API call for dashboard data
    const fetchDashboardData = async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock sales data for last 30 days
      setSalesData(mockSalesData.slice(-30));
      
      // Mock discrepancies data
      setDiscrepanciesData([
        { id: 1, amount: 1500, marketplace: 'Amazon', date: '2024-07-10' },
        { id: 2, amount: 2200, marketplace: 'Flipkart', date: '2024-07-11' },
        { id: 3, amount: 800, marketplace: 'Myntra', date: '2024-07-12' }
      ]);
      
      // Mock AI insights
      setAiInsights([
        { 
          id: '1', 
          text: 'Return rate has decreased by 2.1% compared to last month, indicating improved product quality.',
          type: 'positive' 
        },
        { 
          id: '2', 
          text: 'Myntra has the highest return rate at 25.5%. Consider reviewing product listings for size accuracy.',
          type: 'warning' 
        },
        { 
          id: '3', 
          text: 'Payment discrepancies have increased by 15% this week. Verify marketplace settlement reports.',
          type: 'negative' 
        },
        { 
          id: '4', 
          text: 'Auto-reconciliation has saved approximately 24.5 hours of manual work this month.',
          type: 'info' 
        }
      ]);
    };
    
    fetchDashboardData();
  }, []);

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
    <div className="p-4 md:p-6 space-y-6 overflow-x-hidden">
      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 dark:from-teal-700 dark:via-emerald-700 dark:to-cyan-700 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-pattern opacity-10"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold flex items-center">
              <Sparkles className="w-8 h-8 text-yellow-300 mr-3" />
              ReconEasy Dashboard
            </h1>
            <p className="text-teal-100 text-lg mt-2 mb-4">Your complete payment & return reconciliation control center</p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center px-3 py-1.5 bg-white/20 rounded-full">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse mr-2"></div>
                <span>All systems operational</span>
              </div>
              <div className="flex items-center px-3 py-1.5 bg-white/20 rounded-full">
                <Clock className="w-4 h-4 mr-2" />
                <span>Last updated: 2 min ago</span>
              </div>
              <div className="flex items-center px-3 py-1.5 bg-white/20 rounded-full">
                <Target className="w-4 h-4 mr-2" />
                <span>98.7% Accuracy</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-right mb-2">
              <div className="text-4xl font-bold">₹8.7L</div>
              <div className="text-teal-200">Today's Revenue</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center bg-emerald-500/30 px-3 py-1 rounded-full">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                <span>+12.5% vs last month</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Revenue Trend Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 overflow-hidden mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Revenue Trends</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Sales vs Returns comparison</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Chart Type Selector */}
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                  {[
                    { id: 'overview', label: 'Overview', icon: TrendingUp },
                    { id: 'reconciliation', label: 'Reconciliation', icon: BarChart3 }
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
          
          {/* AI Insights */}
          <AiInsights insights={aiInsights} />
        </div>
        
        <div>
          <ReconciliationCalculator rateCards={rateCards} />
        </div>
      </div>

      {/* Hero Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Payouts */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <IndianRupee className="w-7 h-7 text-white" />
            </div>
            <div className="flex items-center space-x-1">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">+12.5%</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-400">Total Payouts</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">₹{metrics.totalSales.toLocaleString()}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Across all marketplaces</p>
        </div>
        
        {/* Discrepancies */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div className="flex items-center space-x-1">
              <ArrowUpRight className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">+3.2%</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-400">Discrepancies</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{metrics.totalDiscrepancies}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Requiring attention</p>
        </div>
        
        {/* Returns */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
              <RefreshCw className="w-7 h-7 text-white" />
            </div>
            <div className="flex items-center space-x-1">
              <ArrowDownRight className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">-2.1%</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-400">Return Rate</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{metrics.returnRate.toFixed(1)}%</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Improving trend</p>
        </div>
        
        {/* Net Loss */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <TrendingDown className="w-7 h-7 text-white" />
            </div>
            <div className="flex items-center space-x-1">
              <ArrowDownRight className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">-5.3%</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-400">Net Loss</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">₹{(metrics.totalSales * 0.05).toLocaleString()}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">From returns & discrepancies</p>
        </div>
      </div>
    </div>
  );
}