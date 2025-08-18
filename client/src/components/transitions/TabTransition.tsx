import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TabTransitionProps {
  children: React.ReactNode;
  activeKey: string;
  direction?: 'left' | 'right' | 'up' | 'down';
  duration?: number;
  className?: string;
}

const TabTransition: React.FC<TabTransitionProps> = ({
  children,
  activeKey,
  direction = 'right',
  duration = 0.25,
  className = ''
}) => {
  const getMotionProps = () => {
    const baseTransition = {
      duration,
      ease: [0.23, 1, 0.32, 1], // Custom bezier for snappy feel
    };

    switch (direction) {
      case 'left':
        return {
          initial: { opacity: 0, x: -25 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: 25 },
          transition: baseTransition
        };
      case 'right':
        return {
          initial: { opacity: 0, x: 25 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -25 },
          transition: baseTransition
        };
      case 'up':
        return {
          initial: { opacity: 0, y: -15 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 15 },
          transition: baseTransition
        };
      case 'down':
        return {
          initial: { opacity: 0, y: 15 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -15 },
          transition: baseTransition
        };
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: baseTransition
        };
    }
  };

  const motionProps = getMotionProps();

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeKey}
          {...motionProps}
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TabTransition;