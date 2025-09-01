import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, XCircle, Calendar, TrendingUp } from 'lucide-react';

interface RateCardStatusIndicatorProps {
  status: 'active' | 'expired' | 'upcoming';
  previousStatus?: 'active' | 'expired' | 'upcoming';
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onTransitionComplete?: () => void;
}

const statusConfig = {
  active: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    darkColor: 'dark:text-green-400',
    darkBgColor: 'dark:bg-green-900/20',
    label: 'Active',
    gradient: 'from-green-400 to-emerald-500',
    pulseColor: 'bg-green-400'
  },
  expired: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    darkColor: 'dark:text-red-400',
    darkBgColor: 'dark:bg-red-900/20',
    label: 'Expired',
    gradient: 'from-red-400 to-rose-500',
    pulseColor: 'bg-red-400'
  },
  upcoming: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    darkColor: 'dark:text-blue-400',
    darkBgColor: 'dark:bg-blue-900/20',
    label: 'Upcoming',
    gradient: 'from-blue-400 to-indigo-500',
    pulseColor: 'bg-blue-400'
  }
};

const sizeConfig = {
  sm: {
    iconSize: 'w-3 h-3',
    padding: 'px-2 py-1',
    textSize: 'text-xs',
    badgeSize: 'text-xs'
  },
  md: {
    iconSize: 'w-4 h-4',
    padding: 'px-3 py-1.5',
    textSize: 'text-sm',
    badgeSize: 'text-sm'
  },
  lg: {
    iconSize: 'w-5 h-5',
    padding: 'px-4 py-2',
    textSize: 'text-base',
    badgeSize: 'text-base'
  }
};

export default function RateCardStatusIndicator({
  status,
  previousStatus,
  animate = true,
  size = 'md',
  showLabel = true,
  onTransitionComplete
}: RateCardStatusIndicatorProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  const config = statusConfig[currentStatus];
  const sizeSettings = sizeConfig[size];
  const IconComponent = config.icon;

  useEffect(() => {
    if (previousStatus && previousStatus !== status && animate) {
      setIsTransitioning(true);
      
      // Delay status change to show transition effect
      const timer = setTimeout(() => {
        setCurrentStatus(status);
        setIsTransitioning(false);
        onTransitionComplete?.();
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setCurrentStatus(status);
    }
  }, [status, previousStatus, animate, onTransitionComplete]);

  const badgeVariants = {
    initial: { 
      scale: 0.8, 
      opacity: 0,
      rotateX: -90
    },
    enter: { 
      scale: 1, 
      opacity: 1,
      rotateX: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 20,
        duration: 0.4
      }
    },
    exit: { 
      scale: 0.8, 
      opacity: 0,
      rotateX: 90,
      transition: {
        duration: 0.2
      }
    },
    hover: {
      scale: 1.05,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10
      }
    }
  };

  const iconVariants = {
    initial: { rotate: -180, scale: 0 },
    enter: { 
      rotate: 0, 
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 15,
        delay: 0.1
      }
    },
    pulse: {
      scale: [1, 1.2, 1],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        repeatType: "reverse" as const
      }
    }
  };

  const pulseVariants = {
    pulse: {
      scale: [1, 1.5, 1],
      opacity: [0.7, 0, 0.7],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStatus}
          variants={badgeVariants}
          initial="initial"
          animate="enter"
          exit="exit"
          whileHover="hover"
          className={`
            relative inline-flex items-center gap-1.5 rounded-full font-medium
            ${sizeSettings.padding} ${sizeSettings.textSize}
            ${config.color} ${config.bgColor} 
            ${config.darkColor} ${config.darkBgColor}
            transition-all duration-200 cursor-default
            overflow-hidden
          `}
          data-testid={`status-indicator-${currentStatus}`}
        >
          {/* Background gradient overlay */}
          <div 
            className={`
              absolute inset-0 opacity-10 bg-gradient-to-r ${config.gradient}
              transition-opacity duration-300
            `}
          />
          
          {/* Pulse animation for active status */}
          {currentStatus === 'active' && animate && (
            <motion.div
              variants={pulseVariants}
              animate="pulse"
              className={`
                absolute inset-0 rounded-full ${config.pulseColor} opacity-20
              `}
            />
          )}

          {/* Icon with animation */}
          <motion.div
            variants={iconVariants}
            initial="initial"
            animate={isTransitioning ? "pulse" : "enter"}
            className="relative z-10"
          >
            <IconComponent className={sizeSettings.iconSize} />
          </motion.div>

          {/* Label */}
          {showLabel && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="relative z-10 font-medium"
            >
              {config.label}
            </motion.span>
          )}

          {/* Transition loading indicator */}
          {isTransitioning && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 h-0.5 bg-current opacity-50"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Transition sparkle effect */}
      {isTransitioning && animate && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                scale: 0, 
                rotate: 0,
                x: 0,
                y: 0,
                opacity: 1
              }}
              animate={{ 
                scale: [0, 1, 0], 
                rotate: 360,
                x: [0, (i - 1) * 20, (i - 1) * 40],
                y: [0, -10 - i * 5, -20 - i * 10],
                opacity: [1, 1, 0]
              }}
              transition={{ 
                duration: 0.8,
                delay: i * 0.1,
                ease: "easeOut"
              }}
              className={`
                absolute top-1/2 left-1/2 w-1 h-1 rounded-full
                ${config.pulseColor} transform -translate-x-1/2 -translate-y-1/2
              `}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Enhanced status badge with additional features
export function EnhancedStatusBadge({
  status,
  previousStatus,
  showTransitionHistory = false,
  effectiveDate,
  expiryDate,
  ...props
}: RateCardStatusIndicatorProps & {
  showTransitionHistory?: boolean;
  effectiveDate?: string;
  expiryDate?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusMessage = () => {
    switch (status) {
      case 'active':
        return expiryDate 
          ? `Active until ${new Date(expiryDate).toLocaleDateString()}`
          : 'Currently active';
      case 'expired':
        return expiryDate 
          ? `Expired on ${new Date(expiryDate).toLocaleDateString()}`
          : 'Rate card expired';
      case 'upcoming':
        return effectiveDate 
          ? `Effective from ${new Date(effectiveDate).toLocaleDateString()}`
          : 'Scheduled to activate';
      default:
        return '';
    }
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <RateCardStatusIndicator
        status={status}
        previousStatus={previousStatus}
        {...props}
      />
      
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="
              absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
              bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900
              px-3 py-2 rounded-lg text-sm whitespace-nowrap
              shadow-lg border border-gray-200 dark:border-gray-700
              z-50
            "
          >
            {getStatusMessage()}
            
            {/* Transition history */}
            {showTransitionHistory && previousStatus && previousStatus !== status && (
              <div className="text-xs opacity-75 mt-1">
                Changed from {statusConfig[previousStatus].label}
              </div>
            )}
            
            {/* Tooltip arrow */}
            <div className="
              absolute top-full left-1/2 transform -translate-x-1/2
              border-4 border-transparent border-t-gray-900 dark:border-t-gray-100
            " />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}