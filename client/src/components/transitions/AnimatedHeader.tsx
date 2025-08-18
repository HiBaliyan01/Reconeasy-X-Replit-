import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  delay?: number;
}

const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  title,
  subtitle,
  children,
  delay = 0
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: delay
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.98
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <motion.h1
        variants={itemVariants}
        className="text-3xl font-bold text-foreground"
      >
        {title}
      </motion.h1>
      
      {subtitle && (
        <motion.p
          variants={itemVariants}
          className="text-lg text-muted-foreground"
        >
          {subtitle}
        </motion.p>
      )}
      
      {children && (
        <motion.div
          variants={itemVariants}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
};

export default AnimatedHeader;