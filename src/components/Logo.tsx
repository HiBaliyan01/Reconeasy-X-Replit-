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
      {/* Rupee symbol with checkmark integration */}
      <svg 
        viewBox="0 0 120 120" 
        className={`${sizeClasses[size]} w-auto`}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        
        {/* Outer ring */}
        <circle cx="60" cy="60" r="55" fill="url(#logoGradient)" opacity="0.1" />
        <circle cx="60" cy="60" r="55" stroke="url(#logoGradient)" strokeWidth="2" fill="none" />
        
        {/* Stylized Rupee symbol */}
        <path 
          d="M25 35 L70 35 M25 50 L65 50 M35 35 L35 85 C35 85 45 75 60 75 C75 75 85 85 85 85 L70 95 L45 70"
          stroke="url(#logoGradient)" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Integrated checkmark */}
        <path 
          d="M70 45 L80 55 L95 35"
          stroke="url(#checkGradient)" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Connecting elements suggesting reconciliation */}
        <circle cx="40" cy="40" r="2" fill="url(#logoGradient)" />
        <circle cx="75" cy="50" r="2" fill="url(#checkGradient)" />
        <path 
          d="M40 40 Q57 35 75 50" 
          stroke="url(#logoGradient)" 
          strokeWidth="1" 
          strokeDasharray="2,2" 
          fill="none" 
          opacity="0.6"
        />
      </svg>
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