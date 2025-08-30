import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { TrendingUp, TrendingDown, BarChart3, Filter } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MarketplaceData {
  marketplace: string;
  totalSales: number;
  totalReturns: number;
  returnRate: number;
  avgOrderValue: number;
  discrepancies: number;
  logo: string;
}

interface MarketplaceComparisonChartProps {
  data?: MarketplaceData[];
  timeRange?: '7d' | '30d' | '90d';
}

export default function MarketplaceComparisonChart({ 
  data,
  timeRange = '30d'
}: MarketplaceComparisonChartProps) {
  const [activeMetric, setActiveMetric] = useState<'sales' | 'returns' | 'returnRate' | 'aov'>('sales');
  const [showComparison, setShowComparison] = useState(true);

  const defaultData: MarketplaceData[] = [
    {
      marketplace: 'Amazon',
      totalSales: 2500000,
      totalReturns: 125000,
      returnRate: 18.5,
      avgOrderValue: 1850,
      discrepancies: 12,
      logo: '/logos/amazon.png'
    },
    {
      marketplace: 'Flipkart',
      totalSales: 1800000,
      totalReturns: 162000,
      returnRate: 22.8,
      avgOrderValue: 1650,
      discrepancies: 8,
      logo: '/logos/flipkart.png'
    },
    {
      marketplace: 'Myntra',
      totalSales: 1200000,
      totalReturns: 306000,
      returnRate: 25.5,
      avgOrderValue: 2100,
      discrepancies: 15,
      logo: '/logos/myntra.png'
    },
    {
      marketplace: 'Ajio',
      totalSales: 800000,
      totalReturns: 144000,
      returnRate: 18.0,
      avgOrderValue: 1950,
      discrepancies: 5,
      logo: '/logos/ajio.png'
    },
    {
      marketplace: 'Nykaa',
      totalSales: 600000,
      totalReturns: 84000,
      returnRate: 14.0,
      avgOrderValue: 1200,
      discrepancies: 3,
      logo: '/logos/nykaa.png'
    }
  ];

  const marketplaceData = data || defaultData;

  const getChartData = () => {
    const labels = marketplaceData.map(d => d.marketplace);
    
    const datasets = [];
    
    if (activeMetric === 'sales') {
      datasets.push({
        label: 'Total Sales (₹)',
        data: marketplaceData.map(d => d.totalSales),
        backgroundColor: 'rgba(13, 148, 136, 0.8)',
        borderColor: '#0d9488',
        borderWidth: 2,
        borderRadius: 8,
      });
    } else if (activeMetric === 'returns') {
      datasets.push({
        label: 'Total Returns (₹)',
        data: marketplaceData.map(d => d.totalReturns),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: '#ef4444',
        borderWidth: 2,
        borderRadius: 8,
      });
    } else if (activeMetric === 'returnRate') {
      datasets.push({
        label: 'Return Rate (%)',
        data: marketplaceData.map(d => d.returnRate),
        backgroundColor: 'rgba(245, 158, 11, 0.8)',
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderRadius: 8,
      });
    } else if (activeMetric === 'aov') {
      datasets.push({
        label: 'Average Order Value (₹)',
        data: marketplaceData.map(d => d.avgOrderValue),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: '#8b5cf6',
        borderWidth: 2,
        borderRadius: 8,
      });
    }

    return { labels, datasets };
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
            const value = context.parsed.y;
            if (activeMetric === 'returnRate') {
              return `${context.dataset.label}: ${value}%`;
            } else if (activeMetric === 'sales' || activeMetric === 'returns' || activeMetric === 'aov') {
              return `${context.dataset.label}: ₹${value.toLocaleString()}`;
            }
            return `${context.dataset.label}: ${value}`;
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
          callback: function(value: any) {
            if (activeMetric === 'returnRate') {
              return value + '%';
            } else if (activeMetric === 'sales' || activeMetric === 'returns' || activeMetric === 'aov') {
              return '₹' + value.toLocaleString();
            }
            return value;
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

  const metrics = [
    { id: 'sales', label: 'Total Sales', icon: TrendingUp, color: 'text-emerald-600' },
    { id: 'returns', label: 'Total Returns', icon: TrendingDown, color: 'text-red-600' },
    { id: 'returnRate', label: 'Return Rate', icon: BarChart3, color: 'text-amber-600' },
    { id: 'aov', label: 'Avg Order Value', icon: TrendingUp, color: 'text-purple-600' }
  ];

  const getBestPerformer = () => {
    switch (activeMetric) {
      case 'sales':
        return marketplaceData.reduce((max, current) => 
          current.totalSales > max.totalSales ? current : max
        );
      case 'returns':
        return marketplaceData.reduce((min, current) => 
          current.totalReturns < min.totalReturns ? current : min
        );
      case 'returnRate':
        return marketplaceData.reduce((min, current) => 
          current.returnRate < min.returnRate ? current : min
        );
      case 'aov':
        return marketplaceData.reduce((max, current) => 
          current.avgOrderValue > max.avgOrderValue ? current : max
        );
      default:
        return marketplaceData[0];
    }
  };

  const bestPerformer = getBestPerformer();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Marketplace Performance Comparison
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Compare key metrics across all integrated marketplaces
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            {metrics.map(metric => {
              const Icon = metric.icon;
              return (
                <button
                  key={metric.id}
                  onClick={() => setActiveMetric(metric.id as any)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeMetric === metric.id
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:block">{metric.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Best Performer Highlight */}
      <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Best Performer - {metrics.find(m => m.id === activeMetric)?.label}
            </h4>
            <p className="text-emerald-700 dark:text-emerald-300">
              <span className="font-semibold">{bestPerformer.marketplace}</span>
              {activeMetric === 'sales' && ` - ₹${bestPerformer.totalSales.toLocaleString()}`}
              {activeMetric === 'returns' && ` - ₹${bestPerformer.totalReturns.toLocaleString()}`}
              {activeMetric === 'returnRate' && ` - ${bestPerformer.returnRate}%`}
              {activeMetric === 'aov' && ` - ₹${bestPerformer.avgOrderValue.toLocaleString()}`}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 mb-6">
        <Bar data={getChartData()} options={chartOptions} />
      </div>

      {/* Detailed Comparison Table */}
      {showComparison && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Marketplace
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Sales
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Return Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Avg Order Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Discrepancies
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {marketplaceData.map((marketplace, index) => (
                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {marketplace.marketplace[0]}
                        </span>
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {marketplace.marketplace}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-slate-900 dark:text-slate-100">
                    ₹{marketplace.totalSales.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      marketplace.returnRate < 20 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : marketplace.returnRate < 25
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {marketplace.returnRate}%
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-slate-900 dark:text-slate-100">
                    ₹{marketplace.avgOrderValue.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      marketplace.discrepancies < 5
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : marketplace.discrepancies < 10
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {marketplace.discrepancies}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}