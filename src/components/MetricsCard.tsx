import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface MetricsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  color: 'blue' | 'emerald' | 'amber' | 'red' | 'purple';
}

export default function MetricsCard({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', 
  icon: Icon, 
  color 
}: MetricsCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600'
  };

  const changeColorClasses = {
    positive: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
    negative: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    neutral: 'text-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-slate-300'
  };

  // Custom INR icon component
  const INRIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
      <path d="M13.66 7H16v2h-2.34c-.59 0-1.16.26-1.55.72L8 14.5V17h2.5l4.11-4.89c.39-.46.96-.72 1.55-.72H18v2h-1.84l-4.89 5.83c-.39.46-.96.72-1.55.72H7v-2h2.5l4.11-4.89c.39-.46.96-.72 1.55-.72H16V7h-2.34z"/>
      <path d="M7 7h9v2H7z"/>
      <path d="M7 4h6v2H7z"/>
    </svg>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
          {change && (
            <div className={clsx(
              'inline-flex items-center px-2 py-1 mt-2 rounded-full text-xs font-medium',
              changeColorClasses[changeType]
            )}>
              {change}
            </div>
          )}
        </div>
        <div className={clsx(
          'w-12 h-12 rounded-lg bg-gradient-to-r flex items-center justify-center',
          colorClasses[color]
        )}>
          {title.toLowerCase().includes('sales') || title.toLowerCase().includes('revenue') || title.toLowerCase().includes('order') ? 
            <INRIcon /> : <Icon className="w-6 h-6 text-white" />
          }
        </div>
      </div>
    </div>
  );
}