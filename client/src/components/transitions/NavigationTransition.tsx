import React from 'react';
import { motion } from 'framer-motion';

interface NavigationTransitionProps {
  children: React.ReactNode;
  isActive: boolean;
  direction?: 'scale' | 'slide' | 'fade';
  duration?: number;
  className?: string;
}

const NavigationTransition: React.FC<NavigationTransitionProps> = ({
  children,
  isActive,
  direction = 'scale',
  duration = 0.2,
  className = ''
}) => {
  const getVariants = () => {
    switch (direction) {
      case 'scale':
        return {
          inactive: { scale: 1, opacity: 0.7 },
          active: { scale: 1.05, opacity: 1 }
        };
      case 'slide':
        return {
          inactive: { x: 0, opacity: 0.8 },
          active: { x: 2, opacity: 1 }
        };
      case 'fade':
        return {
          inactive: { opacity: 0.6 },
          active: { opacity: 1 }
        };
      default:
        return {
          inactive: { scale: 1, opacity: 0.7 },
          active: { scale: 1.05, opacity: 1 }
        };
    }
  };

  const variants = getVariants();

  return (
    <motion.div
      variants={variants}
      initial="inactive"
      animate={isActive ? "active" : "inactive"}
      transition={{
        duration,
        ease: [0.25, 0.46, 0.45, 0.94],
        scale: { type: "spring", stiffness: 300, damping: 30 }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default NavigationTransition;