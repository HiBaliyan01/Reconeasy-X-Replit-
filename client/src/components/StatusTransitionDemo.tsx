import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Settings } from 'lucide-react';
import RateCardStatusIndicator, { EnhancedStatusBadge } from './RateCardStatusIndicator';
import { useStatusTransitions } from './StatusTransitionManager';

interface DemoCard {
  id: string;
  platform: string;
  category: string;
  status: 'active' | 'expired' | 'upcoming';
  previousStatus?: 'active' | 'expired' | 'upcoming';
}

export default function StatusTransitionDemo() {
  const [demoCards, setDemoCards] = useState<DemoCard[]>([
    { id: '1', platform: 'Amazon', category: 'Electronics', status: 'active' },
    { id: '2', platform: 'Flipkart', category: 'Fashion', status: 'expired' },
    { id: '3', platform: 'Myntra', category: 'Apparel', status: 'upcoming' }
  ]);
  
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const { addStatusChange } = useStatusTransitions();

  const statusCycle: ('active' | 'expired' | 'upcoming')[] = ['active', 'expired', 'upcoming'];

  const cycleStatus = (cardId: string) => {
    setDemoCards(prev => prev.map(card => {
      if (card.id === cardId) {
        const currentIndex = statusCycle.indexOf(card.status);
        const nextIndex = (currentIndex + 1) % statusCycle.length;
        const newStatus = statusCycle[nextIndex];
        
        // Add notification for status change
        addStatusChange({
          type: 'success',
          title: 'Status Transition Demo',
          message: `${card.platform} - ${card.category} changed from ${card.status} to ${newStatus}`,
          duration: 3000
        });
        
        return {
          ...card,
          previousStatus: card.status,
          status: newStatus
        };
      }
      return card;
    }));
  };

  const cycleAllStatuses = () => {
    demoCards.forEach((card, index) => {
      setTimeout(() => cycleStatus(card.id), index * 500);
    });
  };

  const resetDemo = () => {
    setDemoCards([
      { id: '1', platform: 'Amazon', category: 'Electronics', status: 'active' },
      { id: '2', platform: 'Flipkart', category: 'Fashion', status: 'expired' },
      { id: '3', platform: 'Myntra', category: 'Apparel', status: 'upcoming' }
    ]);
    
    addStatusChange({
      type: 'info',
      title: 'Demo Reset',
      message: 'All rate card statuses have been reset to their initial values',
      duration: 2000
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Animated Status Transition Demo
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Click on status badges or use controls to see animated transitions
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={animationsEnabled}
              onChange={(e) => setAnimationsEnabled(e.target.checked)}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <Settings className="w-4 h-4" />
            Animations
          </label>
          
          <button
            onClick={cycleAllStatuses}
            className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm transition-colors"
            data-testid="demo-cycle-all"
          >
            <Play className="w-4 h-4" />
            Cycle All
          </button>
          
          <button
            onClick={resetDemo}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            data-testid="demo-reset"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Demo Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {demoCards.map((card) => (
          <motion.div
            key={card.id}
            layout
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => cycleStatus(card.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-testid={`demo-card-${card.id}`}
          >
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {card.platform}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {card.category}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Status:
                </span>
                <EnhancedStatusBadge
                  status={card.status}
                  previousStatus={card.previousStatus}
                  animate={animationsEnabled}
                  size="sm"
                  showTransitionHistory={true}
                  effectiveDate="2024-01-01"
                  expiryDate="2024-12-31"
                />
              </div>
              
              <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Click to cycle status
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Status Legend */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Status Types:
        </h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <RateCardStatusIndicator status="active" animate={false} size="sm" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Active - Currently in use
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RateCardStatusIndicator status="expired" animate={false} size="sm" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Expired - No longer valid
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RateCardStatusIndicator status="upcoming" animate={false} size="sm" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Upcoming - Scheduled to activate
            </span>
          </div>
        </div>
      </div>

      {/* Animation Features */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Animation Features:
        </h4>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Smooth status badge transitions with spring animations</li>
          <li>• Sparkle effects during status changes</li>
          <li>• Pulsing animations for active status indicators</li>
          <li>• Toast notifications for status change tracking</li>
          <li>• Hover effects and interactive feedback</li>
          <li>• Color-coded status indicators with gradient overlays</li>
        </ul>
      </div>
    </div>
  );
}