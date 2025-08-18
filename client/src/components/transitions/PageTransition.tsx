import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  pageKey: string;
  direction?: 'horizontal' | 'vertical' | 'fade' | 'slide-up' | 'slide-down';
  duration?: number;
}

const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  pageKey,
  direction = 'horizontal',
  duration = 0.3
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
  }, [pageKey]);

  const getTransitionVariants = () => {
    switch (direction) {
      case 'horizontal':
        return {
          initial: { opacity: 0, x: 20 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -20 }
        };
      case 'vertical':
        return {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -20 }
        };
      case 'slide-up':
        return {
          initial: { opacity: 0, y: 30, scale: 0.96 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -30, scale: 0.96 }
        };
      case 'slide-down':
        return {
          initial: { opacity: 0, y: -30, scale: 0.96 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 30, scale: 0.96 }
        };
      case 'fade':
      default:
        return {
          initial: { opacity: 0, scale: 0.98 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.98 }
        };
    }
  };

  const variants = getTransitionVariants();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={{
          duration,
          ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smooth feel
          layout: { duration: 0.2 }
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;