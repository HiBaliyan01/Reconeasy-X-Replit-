// Reusable status badge with color logic and smart reminders

import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText } from 'lucide-react';

interface ClaimStatusBadgeProps {
  status: string;
  age: number;
  showTooltip?: boolean;
}

const getStatusBadgeStyle = (status: string) => {
  const baseStyles = "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border";
  
  switch (status) {
    case 'Resolved':
      return `${baseStyles} bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700`;
    case 'Rejected':
      return `${baseStyles} bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700`;
    case 'In Progress':
      return `${baseStyles} bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700`;
    case 'Awaiting Marketplace':
      return `${baseStyles} bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700`;
    case 'Filed':
      return `${baseStyles} bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700`;
    case 'Pending':
      return `${baseStyles} bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700`;
    default:
      return `${baseStyles} bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600`;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Resolved': 
      return <CheckCircle className="w-3 h-3" />;
    case 'Rejected': 
      return <XCircle className="w-3 h-3" />;
    case 'In Progress': 
      return <Clock className="w-3 h-3" />;
    case 'Awaiting Marketplace': 
      return <AlertTriangle className="w-3 h-3" />;
    case 'Filed': 
      return <FileText className="w-3 h-3" />;
    case 'Pending':
      return <Clock className="w-3 h-3" />;
    default: 
      return <Clock className="w-3 h-3" />;
  }
};

const getTooltipText = (status: string, age: number): string => {
  if (status === 'Resolved' || status === 'Rejected') {
    return `Claim ${status.toLowerCase()} after ${age} days`;
  }
  
  if (age > 15) {
    return `Critical: ${age} days old - urgent action required`;
  }
  
  if (age > 7) {
    return `Overdue: ${age} days old - consider sending reminder`;
  }
  
  return `Active claim - ${age} days old`;
};

const ClaimStatusBadge: React.FC<ClaimStatusBadgeProps> = ({ status, age, showTooltip }) => {
  const tooltipText = getTooltipText(status, age);
  
  return (
    <div className="relative group">
      <span className={getStatusBadgeStyle(status)}>
        {getStatusIcon(status)}
        <span>{status}</span>
      </span>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
          {tooltipText}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
        </div>
      )}
    </div>
  );
};

export default ClaimStatusBadge;