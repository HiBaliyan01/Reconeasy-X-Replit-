import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'table' | 'chart' | 'text';
  rows?: number;
  className?: string;
}

export default function LoadingSkeleton({ type = 'card', rows = 3, className = '' }: LoadingSkeletonProps) {
  const baseClasses = 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded';

  if (type === 'card') {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-6 space-y-3">
            <div className={`${baseClasses} h-4 w-3/4`}></div>
            <div className={`${baseClasses} h-8 w-1/2`}></div>
            <div className={`${baseClasses} h-3 w-full`}></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 dark:bg-slate-700 p-4 flex space-x-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`${baseClasses} h-4 flex-1`}></div>
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-4 border-b border-slate-200 dark:border-slate-700 flex space-x-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className={`${baseClasses} h-4 flex-1`}></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl p-6 ${className}`}>
        <div className={`${baseClasses} h-6 w-1/3 mb-4`}></div>
        <div className={`${baseClasses} h-64 w-full`}></div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${baseClasses} h-4 w-full`}></div>
      ))}
    </div>
  );
}