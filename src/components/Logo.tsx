import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'symbol' | 'wordmark';
  className?: string;
}

export default function Logo({ size = 'md', variant = 'full', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
    xl: 'h-16'
  };

  const LogoSymbol = () => (
    <div className="relative flex items-center justify-center">
      {/* Use the uploaded logo image */}
      <img 
        src="/ChatGPT logo1 copy.png" 
        alt="ReconEasy Logo" 
        className={`${sizeClasses[size]} w-auto`}
      />
    </div>
  );

  const LogoWordmark = () => (
    <div className="flex items-center space-x-1">
      <span className="font-bold text-teal-600 dark:text-teal-400 tracking-tight">
        Recon<span className="text-orange-500">Easy</span>
      </span>
    </div>
  );

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {(variant === 'full' || variant === 'symbol') && <LogoSymbol />}
      {(variant === 'full' || variant === 'wordmark') && <LogoWordmark />}
    </div>
  );
}