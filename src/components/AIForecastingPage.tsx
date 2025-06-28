import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, BarChart3, Calendar, Target, Brain, 
  AlertTriangle, CheckCircle, Clock, Download
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { format, addDays } from 'date-fns';

interface ForecastData {
  return_rate: Array<{
    marketplace: string;
    dates: string[];
    values: number[];
    confidence: number;
  }>;
  revenue_loss: {
    dates: string[];
    values: number[];
    confidence: number;
  };
  resolution_time: {
    dates: string[];
    values: number[];
    confidence: number;
  };
  sku_return: Array<{
    sku: string;
    dates: string[];
    values: number[];
    confidence: number;
  }>;
}

const mockForecastData: ForecastData = {
  return_rate: [
    {
      marketplace: 'Myntra',
      dates: Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')),
      values: [25.2, 24.8, 26.1, 25.5, 24.9, 25.8, 26.3],
      confidence: 92.5
    },
    {
      marketplace: 'Amazon',
      dates: Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')),
      values: [18.5, 18.2, 19.1, 18.8, 18.6, 19.2, 19.5],
      confidence: 89.3
    },
    {
      marketplace: 'Flipkart',
      dates: Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')),
      values: [22.1, 21.8, 22.5, 22.3, 21.9, 22.7, 23.1],
      confidence: 87.8
    }
  ],
  revenue_loss: {
    dates: Array.from({ length: 30 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')),
    values: Array.from({ length: 30 }, () => Math.floor(Math.random() * 50000) + 20000),
    confidence: 85.2
  },
  resolution_time: {
    dates: Array.from({ length: 14 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')),
    values: [2.3, 2.1, 2.4, 2.2, 2.0, 2.3, 2.5, 2.1, 2.2, 2.4, 2.3, 2.1, 2.0, 2.2],
    confidence: 91.7
  },
  sku_return: [
    {
      sku: 'KURTA-XL-RED',
      dates: Array.from({ length: 30 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')),
      values: Array.from({ length: 30 }, () => Math.floor(Math.random() * 40) + 10),
      confidence: 88.4
    },
    {
      sku: 'JEANS-L-BLACK',
      dates: Array.from({ length: 30 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')),
      values: Array.from({ length: 30 }, () => Math.floor(Math.random() * 35) + 15),
      confidence: 86.9
    },
    {
      sku: 'DRESS-M-BLUE',
      dates: Array.from({ length: 30 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd')),
      values: Array.from({ length: 30 }, () => Math.floor(Math.random() * 30) + 20),
      confidence: 84.2
    }
  ]
};

export default function AIForecastingPage() {
  const [activeChart, setActiveChart] = useState('return_rate');
  const [selectedMarketplace, setSelectedMarketplace] = useState('all');
  const [forecastPeriod, setForecastPeriod] = useState('7d');

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
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(13, 148, 136, 0.1)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const returnRateChart = {
    labels: mockForecastData.return_rate[0]?.dates.map(date => format(new Date(date), 'MMM dd')),
    datasets: mockForecastData.return_rate
      .filter(data => selectedMarketplace === 'all' || data.marketplace === selectedMarketplace)
      .map((data, index) => ({
        label: `${data.marketplace} Return Rate (%)`,
        data: data.values,
        borderColor: ['#0d9488', '#f97316', '#3b82f6'][index % 3],
        backgroundColor: [`rgba(13, 148, 136, 0.1)`, `rgba(249, 115, 22, 0.1)`, `rgba(59, 130, 246, 0.1)`][index % 3],
        tension: 0.4,
        fill: true,
      }))
  };

  const revenueLossChart = {
    labels: mockForecastData.revenue_loss.dates.slice(0, forecastPeriod === '7d' ? 7 : forecastPeriod === '14d' ? 14 : 30).map(date => format(new Date(date), 'MMM dd')),
    datasets: [{
      label: 'Revenue Loss (₹)',
      data: mockForecastData.revenue_loss.values.slice(0, forecastPeriod === '7d' ? 7 : forecastPeriod === '14d' ? 14 : 30),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      tension: 0.4,
      fill: true,
    }]
  };

  const resolutionTimeChart = {
    labels: mockForecastData.resolution_time.dates.map(date => format(new Date(date), 'MMM dd')),
    datasets: [{
      label: 'Resolution Time (Days)',
      data: mockForecastData.resolution_time.values,
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      tension: 0.4,
      fill: true,
    }]
  };

  const skuReturnChart = {
    labels: mockForecastData.sku_return[0]?.dates.slice(0, 14).map(date => format(new Date(date), 'MMM dd')),
    datasets: mockForecastData.sku_return.map((data, index) => ({
      label: `${data.sku} Return Probability`,
      data: data.values.slice(0, 14),
      borderColor: ['#0d9488', '#f97316', '#3b82f6'][index % 3],
      backgroundColor: [`rgba(13, 148, 136, 0.1)`, `rgba(249, 115, 22, 0.1)`, `rgba(59, 130, 246, 0.1)`][index % 3],
      tension: 0.4,
      fill: false,
    }))
  };

  const renderChart = () => {
    switch (activeChart) {
      case 'return_rate':
        return <Line data={returnRateChart} options={chartOptions} />;
      case 'revenue_loss':
        return <Line data={revenueLossChart} options={chartOptions} />;
      case 'resolution_time':
        return <Line data={resolutionTimeChart} options={chartOptions} />;
      case 'sku_return':
        return <Line data={skuReturnChart} options={chartOptions} />;
      default:
        return <Line data={returnRateChart} options={chartOptions} />;
    }
  };

  const getConfidenceLevel = () => {
    switch (activeChart) {
      case 'return_rate':
        const avgConfidence = mockForecastData.return_rate.reduce((sum, data) => sum + data.confidence, 0) / mockForecastData.return_rate.length;
        return avgConfidence;
      case 'revenue_loss':
        return mockForecastData.revenue_loss.confidence;
      case 'resolution_time':
        return mockForecastData.resolution_time.confidence;
      case 'sku_return':
        const skuAvgConfidence = mockForecastData.sku_return.reduce((sum, data) => sum + data.confidence, 0) / mockForecastData.sku_return.length;
        return skuAvgConfidence;
      default:
        return 90;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center space-x-3">
              <Brain className="w-8 h-8" />
              <span>AI-Powered Forecasting</span>
            </h2>
            <p className="text-purple-100 mt-1">Advanced machine learning models for predictive analytics</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm text-purple-100">Model Accuracy</div>
              <div className="text-2xl font-bold">{getConfidenceLevel().toFixed(1)}%</div>
            </div>
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Forecasts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forecast Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Return Rate Forecast</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">24.8%</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">+2.1% next week</p>
            </div>
            <TrendingUp className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Revenue Loss</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹2.8L</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Next 30 days</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Resolution Time</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">2.2 days</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">-0.3 days improvement</p>
            </div>
            <Clock className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">High-Risk SKUs</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">12</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Require attention</p>
            </div>
            <Target className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Forecast Charts */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Predictive Analytics</h3>
          
          <div className="flex items-center space-x-4">
            {/* Chart Type Selector */}
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              {[
                { id: 'return_rate', label: 'Return Rate', icon: TrendingUp },
                { id: 'revenue_loss', label: 'Revenue Loss', icon: AlertTriangle },
                { id: 'resolution_time', label: 'Resolution Time', icon: Clock },
                { id: 'sku_return', label: 'SKU Returns', icon: Target }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveChart(id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeChart === id
                      ? 'bg-purple-500 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Marketplace Filter for Return Rate */}
            {activeChart === 'return_rate' && (
              <select
                value={selectedMarketplace}
                onChange={(e) => setSelectedMarketplace(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Marketplaces</option>
                <option value="Myntra">Myntra</option>
                <option value="Amazon">Amazon</option>
                <option value="Flipkart">Flipkart</option>
              </select>
            )}

            {/* Period Filter for Revenue Loss */}
            {activeChart === 'revenue_loss' && (
              <select
                value={forecastPeriod}
                onChange={(e) => setForecastPeriod(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="7d">7 Days</option>
                <option value="14d">14 Days</option>
                <option value="30d">30 Days</option>
              </select>
            )}
          </div>
        </div>
        
        <div className="h-80 mb-4">
          {renderChart()}
        </div>
        
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-4">
            <span>Model: ARIMA + Prophet</span>
            <span>Confidence: {getConfidenceLevel().toFixed(1)}%</span>
            <span>Last Updated: {format(new Date(), 'MMM dd, yyyy HH:mm')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span>Real-time Learning</span>
          </div>
        </div>
      </div>

      {/* Forecast Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Insights */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Key Insights</h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Return Rate Spike Expected</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Myntra returns likely to increase by 2.1% next week due to seasonal trends</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Target className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">SKU Risk Alert</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">KURTA-XL-RED showing 35% return probability - consider inventory adjustment</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Resolution Improvement</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Ticket resolution time improving by 0.3 days due to automation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">AI Recommendations</h3>
          <div className="space-y-4">
            <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Inventory Optimization</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Reduce KURTA-XL-RED stock by 25% to minimize return losses</p>
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full">High Impact</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Potential savings: ₹45,000</span>
              </div>
            </div>
            
            <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Quality Control</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Implement additional QC for size-related returns on Myntra</p>
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">Medium Impact</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Expected reduction: 15%</span>
              </div>
            </div>
            
            <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Process Automation</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Enable auto-resolution for discrepancies under ₹50</p>
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">Quick Win</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Time savings: 4.5 hours/week</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Performance */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Model Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">92.3%</div>
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Overall Accuracy</div>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">1.2M</div>
            <div className="text-sm text-blue-700 dark:text-blue-300">Training Records</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">15 min</div>
            <div className="text-sm text-purple-700 dark:text-purple-300">Update Frequency</div>
          </div>
          <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">7 days</div>
            <div className="text-sm text-amber-700 dark:text-amber-300">Forecast Horizon</div>
          </div>
        </div>
      </div>
    </div>
  );
}