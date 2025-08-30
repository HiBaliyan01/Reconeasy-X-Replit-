import React from 'react';

type BadgeProps = {
  label: string;
  variant?: 'neutral' | 'purple';
};

const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const baseClass = variant === 'purple' ? 'badge-purple' : 'badge-neutral';

  return (
    <span className={baseClass}>
      {label}
    </span>
  );
};

export default Badge;