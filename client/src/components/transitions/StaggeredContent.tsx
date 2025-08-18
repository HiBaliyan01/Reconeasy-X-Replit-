import React from 'react';
import { motion } from 'framer-motion';

interface StaggeredContentProps {
  children: React.ReactNode;
  staggerDelay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const StaggeredContent: React.FC<StaggeredContentProps> = ({
  children,
  staggerDelay = 0.1,
  duration = 0.4,
  direction = 'up'
}) => {
  const getDirectionVariants = () => {
    switch (direction) {
      case 'up':
        return { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
      case 'down':
        return { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 } };
      case 'left':
        return { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 } };
      case 'right':
        return { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 } };
      default:
        return { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
    }
  };

  const variants = getDirectionVariants();

  const containerVariants = {
    animate: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1
      }
    }
  };

  const childVariants = {
    initial: variants.initial,
    animate: {
      ...variants.animate,
      transition: {
        duration,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  // Convert children to array and wrap each in motion.div
  const childArray = React.Children.toArray(children);

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="w-full"
    >
      {childArray.map((child, index) => (
        <motion.div
          key={index}
          variants={childVariants}
          className="w-full"
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

export default StaggeredContent;