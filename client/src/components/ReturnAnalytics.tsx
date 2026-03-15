import React, { useState, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, LineElement, PointElement } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Return } from '../types';
import { Filter, Search } from 'lucide-react';
import FilterPanel from './FilterPanel';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

interface ReturnAnalyticsProps {
  returns: Return[];
}

export default function ReturnAnalytics({ returns }: ReturnAnalyticsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    marketplace: '',
    status: '',
    amountRange: { min: '', max: '' },
    category: ''
  });

  const filterOptions = {
    marketplaces: ['Amazon', 'Flipkart', 'Myntra'],
    statuses: ['pending', 'processed', 'rejected'],
    categories: ['size_issue', 'quality_issue', 'wrong_item', 'damaged', 'not_as_described', 'other']
  };

  // Filter returns
  const filteredReturns = useMemo(() => {
    return returns.filter(returnItem => {
      // Search filter
      if (searchTerm && !returnItem.productName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !returnItem.sku.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !returnItem.reason.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.start && new Date(returnItem.date) < new Date(filters.dateRange.start)) {
        return false;
      }
      if (filters.dateRange.end && new Date(returnItem.date) > new Date(filters.dateRange.end)) {
        return false;
      }

      // Marketplace filter
      if (filters.marketplace && returnItem.marketplace !== filters.marketplace) {
        return false;
      }

      // Status filter
      if (filters.status && returnItem.status !== filters.status) {
        return false;
      }

      // Category filter
      if (filters.category && returnItem.reasonCategory !== filters.category) {
        return false;
      }

      // Amount range filter
      if (filters.amountRange.min && returnItem.refundAmount < parseFloat(filters.amountRange.min)) {
        return false;
      }
      if (filters.amountRange.max && returnItem.refundAmount > parseFloat(filters.amountRange.max)) {
        return false;
      }

      return true;
    });
  }, [returns, searchTerm, filters]);

  // Process return reasons data
  const reasonCounts = filteredReturns.reduce((acc, returnItem) => {
    acc[returnItem.reasonCategory] = (acc[returnItem.reasonCategory] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reasonLabels = Object.keys(reasonCounts).map(key => 
    key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  );

  const reasonData = {
    labels: reasonLabels,
    datasets: [
      {
        label: 'Return Count',
        data: Object.values(reasonCounts),
        backgroundColor: [
          'rgba(13, 148, 136, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)'
        ],
        borderColor: [
          'rgba(13, 148, 136, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(236, 72, 153, 1)'
        ],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }
    ]
  };

  // Process returns over time
  const returnsByDate = filteredReturns.reduce((acc, returnItem) => {
    const date = new Date(returnItem.date).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedDates = Object.keys(returnsByDate).sort();
  const timelineData = {
    labels: sortedDates.map(date => new Date(date).toLocaleDateString()),
    datasets: [
      {
        label: 'Daily Returns',
        data: sortedDates.map(date => returnsByDate[date]),
        borderColor: 'rgba(13, 148, 136, 1)',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgba(13, 148, 136, 1)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
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

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Return Analytics</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredReturns.length} of {returns.length} returns
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search returns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            
            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Return Reasons Chart */}
      <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Return Reasons Analysis</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Breakdown of return reasons to identify quality issues</p>
        </div>
        <div className="h-80">
          <Bar data={reasonData} options={chartOptions} />
        </div>
      </div>

      {/* Returns Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Returns Timeline</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Daily return trends to identify patterns</p>
        </div>
        <div className="h-80">
          <Line data={timelineData} options={chartOptions} />
        </div>
      </div>

      {/* SKU-level Analysis */}
      <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Top Returned SKUs</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Products with highest return rates</p>
        </div>
        
        <div className="space-y-4">
          {filteredReturns.slice(0, 5).map((returnItem, index) => (
            <div key={returnItem.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-4 transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
              <div className="flex-1">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">{returnItem.productName}</h4>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  SKU: {returnItem.sku} • {returnItem.reasonCategory.replace('_', ' ')}
                </div>
                {returnItem.variant && (
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {returnItem.variant.color} • {returnItem.variant.size}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">₹{returnItem.refundAmount.toLocaleString()}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">{returnItem.marketplace}</div>
              </div>
            </div>
          ))}
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
