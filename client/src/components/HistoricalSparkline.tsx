import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface SparklineData {
  date: string;
  value: number;
}

interface HistoricalSparklineProps {
  data: SparklineData[];
  title: string;
  currentValue: number;
  previousValue: number;
  format?: 'currency' | 'number' | 'percentage';
  color?: 'emerald' | 'red' | 'blue' | 'amber';
  className?: string;
}

export default function HistoricalSparkline({ 
  data, 
  title, 
  currentValue, 
  previousValue, 
  format = 'currency',
  color = 'emerald',
  className = ''
}: HistoricalSparklineProps) {
  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return `₹${value.toLocaleString()}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  const change = currentValue - previousValue;
  const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;
  const isPositive = change >= 0;

  // Generate SVG path for sparkline
  const generatePath = () => {
    if (data.length < 2) return '';
    
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;
    
    const width = 120;
    const height = 40;
    
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d.value - minValue) / range) * height;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      value: 'text-emerald-900 dark:text-emerald-100',
      stroke: '#10b981'
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      value: 'text-red-900 dark:text-red-100',
      stroke: '#ef4444'
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      value: 'text-blue-900 dark:text-blue-100',
      stroke: '#3b82f6'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      value: 'text-amber-900 dark:text-amber-100',
      stroke: '#f59e0b'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className={`p-4 rounded-xl border ${colors.bg} ${colors.border} ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-medium ${colors.text}`}>{title}</h4>
        <div className="flex items-center space-x-1">
          {isPositive ? (
            <TrendingUp className={`w-4 h-4 text-emerald-500`} />
          ) : (
            <TrendingDown className={`w-4 h-4 text-red-500`} />
          )}
          <span className={`text-xs font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
          </span>
        </div>
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-2xl font-bold ${colors.value}`}>
            {formatValue(currentValue)}
          </div>
          <div className={`text-xs ${colors.text} mt-1`}>
            vs {formatValue(previousValue)} last period
          </div>
        </div>
        
        <div className="ml-4">
          <svg width="120" height="40" className="overflow-visible">
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={colors.stroke} stopOpacity="0.3" />
                <stop offset="100%" stopColor={colors.stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Fill area */}
            <path
              d={`${generatePath()} L 120,40 L 0,40 Z`}
              fill={`url(#gradient-${color})`}
            />
            
            {/* Line */}
            <path
              d={generatePath()}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Data points */}
            {data.map((d, i) => {
              const maxValue = Math.max(...data.map(d => d.value));
              const minValue = Math.min(...data.map(d => d.value));
              const range = maxValue - minValue || 1;
              const x = (i / (data.length - 1)) * 120;
              const y = 40 - ((d.value - minValue) / range) * 40;
              
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="2"
                  fill={colors.stroke}
                  className="opacity-60 hover:opacity-100 transition-opacity"
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}