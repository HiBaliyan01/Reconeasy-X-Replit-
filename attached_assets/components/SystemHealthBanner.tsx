import React from 'react';
import { Activity, CheckCircle, Clock } from 'lucide-react';
import Badge from './Badge';

interface SystemHealthBannerProps {
  className?: string;
}

const SystemHealthBanner: React.FC<SystemHealthBannerProps> = ({ className = '' }) => {
  const healthStatus = 'OK';
  const lastSync = new Date().toLocaleDateString('en-IN', { 
    month: '2-digit', 
    day: '2-digit' 
  });
  const accuracy = '95%';

  return (
    <div className={`bg-[var(--secondary)] dark:bg-slate-700 border-t border-slate-200 dark:border-slate-600 p-3 text-center text-sm ${className}`}>
      <div className="flex items-center justify-center space-x-4 text-slate-700 dark:text-slate-300">
        <div className="flex items-center space-x-1">
          <Activity className="w-4 h-4" />
          <span>System Health:</span>
          <Badge label={healthStatus} variant="positive" />
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>Last Sync: {lastSync}</span>
        </div>
        <div className="flex items-center space-x-1">
          <CheckCircle className="w-4 h-4" />
          <span>{accuracy} Accuracy</span>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthBanner;