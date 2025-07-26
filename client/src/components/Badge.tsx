import React from 'react';

type BadgeProps = {
  label: string;
  variant?: 'neutral' | 'purple' | 'positive' | 'negative';
  className?: string;
};

const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', className = '' }) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'purple':
        return 'bg-purple-600 text-white';
      case 'positive':
        return 'bg-emerald-500 text-white';
      case 'negative':
        return 'bg-red-500 text-white';
      case 'neutral':
      default:
        return 'bg-slate-500 text-white dark:bg-slate-600 dark:text-slate-100';
    }
  };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getVariantClasses()} ${className}`}>
      {label}
    </span>
  );
};

export default Badge;