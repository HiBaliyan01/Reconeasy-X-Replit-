import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, Info } from 'lucide-react';

interface StatusChange {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
}

interface StatusTransitionManagerProps {
  changes: StatusChange[];
  onClearChange?: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const iconMap = {
  success: Check,
  warning: AlertTriangle,
  info: Info
};

const colorMap = {
  success: {
    bg: 'bg-green-500',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: 'text-green-600'
  },
  warning: {
    bg: 'bg-yellow-500',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: 'text-yellow-600'
  },
  info: {
    bg: 'bg-blue-500',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-600'
  }
};

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4'
};

export default function StatusTransitionManager({
  changes,
  onClearChange,
  position = 'top-right'
}: StatusTransitionManagerProps) {
  const [visibleChanges, setVisibleChanges] = useState<StatusChange[]>([]);

  useEffect(() => {
    setVisibleChanges(changes);

    // Auto-clear changes after their duration
    changes.forEach(change => {
      if (change.duration) {
        setTimeout(() => {
          setVisibleChanges(prev => prev.filter(c => c.id !== change.id));
          onClearChange?.(change.id);
        }, change.duration);
      }
    });
  }, [changes, onClearChange]);

  const handleDismiss = (id: string) => {
    setVisibleChanges(prev => prev.filter(c => c.id !== id));
    onClearChange?.(id);
  };

  return (
    <div className={`fixed z-50 max-w-sm space-y-2 ${positionClasses[position]}`}>
      <AnimatePresence>
        {visibleChanges.map((change, index) => {
          const Icon = iconMap[change.type];
          const colors = colorMap[change.type];
          
          return (
            <motion.div
              key={change.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: index * 0.1
              }}
              className={`
                relative bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-4
                ${colors.border} dark:border-gray-700
                cursor-pointer hover:shadow-xl transition-shadow duration-200
              `}
              onClick={() => handleDismiss(change.id)}
              data-testid={`status-notification-${change.type}`}
            >
              {/* Progress bar for timed notifications */}
              {change.duration && (
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: change.duration / 1000, ease: "linear" }}
                  className={`absolute top-0 left-0 h-1 ${colors.bg} rounded-t-lg`}
                />
              )}

              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 p-1.5 rounded-full bg-gray-50 dark:bg-gray-700`}>
                  <Icon className={`w-4 h-4 ${colors.icon}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm ${colors.text} dark:text-white`}>
                    {change.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {change.message}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {change.timestamp.toLocaleTimeString()}
                  </p>
                </div>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(change.id);
                  }}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Animated border glow */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`absolute inset-0 rounded-lg border-2 ${colors.border} pointer-events-none`}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// Hook for managing status transitions
export function useStatusTransitions() {
  const [changes, setChanges] = useState<StatusChange[]>([]);

  const addStatusChange = (change: Omit<StatusChange, 'id' | 'timestamp'>) => {
    const newChange: StatusChange = {
      ...change,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      duration: change.duration || 5000 // Default 5 seconds
    };

    setChanges(prev => [...prev, newChange]);
  };

  const clearChange = (id: string) => {
    setChanges(prev => prev.filter(change => change.id !== id));
  };

  const clearAllChanges = () => {
    setChanges([]);
  };

  return {
    changes,
    addStatusChange,
    clearChange,
    clearAllChanges
  };
}