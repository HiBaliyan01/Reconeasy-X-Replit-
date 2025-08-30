import React from 'react';
import { CheckCircle, AlertTriangle, Info, Star, TrendingUp, Users } from 'lucide-react';
import Badge from './Badge';

const ReconEasyDesignShowcase: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="reconeasy-primary-gradient rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">ReconEasy Design System</h1>
        <p className="text-blue-100">Comprehensive UI components following ReconEasy brand guidelines</p>
      </div>

      {/* Color Palette */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Color Palette</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-lg mb-2" style={{ backgroundColor: 'var(--primary)' }}></div>
            <p className="text-sm font-medium">Primary</p>
            <p className="text-xs text-slate-500">#3B82F6</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-lg mb-2" style={{ backgroundColor: 'var(--secondary)' }}></div>
            <p className="text-sm font-medium">Secondary</p>
            <p className="text-xs text-slate-500">#F9EDEB</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-lg mb-2" style={{ backgroundColor: 'var(--purple)' }}></div>
            <p className="text-sm font-medium">Purple (AI)</p>
            <p className="text-xs text-slate-500">#7C3AED</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-lg mb-2" style={{ backgroundColor: 'var(--positive)' }}></div>
            <p className="text-sm font-medium">Positive</p>
            <p className="text-xs text-slate-500">#10B981</p>
          </div>
        </div>
      </div>

      {/* Badge Components */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Badge Components</h2>
        <div className="flex flex-wrap gap-3">
          <Badge label="Pending" variant="neutral" />
          <Badge label="AI Suggestion" variant="purple" />
          <Badge label="Completed" variant="positive" />
          <Badge label="Failed" variant="negative" />
          <Badge label="Processing" variant="neutral" />
        </div>
      </div>

      {/* Status Values */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Status Values</h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 positive-value" />
            <span className="positive-value text-lg font-medium">+₹1,50,000</span>
            <span className="text-slate-600 dark:text-slate-400">Revenue increase</span>
          </div>
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 negative-value" />
            <span className="negative-value text-lg font-medium">-₹25,000</span>
            <span className="text-slate-600 dark:text-slate-400">Outstanding disputes</span>
          </div>
          <div className="flex items-center space-x-3">
            <Info className="w-5 h-5 neutral-value" />
            <span className="neutral-value text-lg font-medium">₹75,000</span>
            <span className="text-slate-600 dark:text-slate-400">Pending settlements</span>
          </div>
        </div>
      </div>

      {/* Heatmap Example */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Heatmap Visualization</h2>
        <div className="heatmap rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Revenue Performance</h3>
              <p className="text-teal-100">Q4 2025 Analytics</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">₹45.2L</p>
              <p className="text-teal-100">Total Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gradient Examples */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Gradient Cards</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="reconeasy-primary-gradient rounded-lg p-4 text-white">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="font-semibold">Analytics</span>
            </div>
            <p className="text-blue-100">Primary gradient card</p>
          </div>
          <div className="reconeasy-secondary-gradient rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="w-5 h-5 text-slate-700" />
              <span className="font-semibold text-slate-700">Reports</span>
            </div>
            <p className="text-slate-600">Secondary gradient card</p>
          </div>
          <div className="reconeasy-purple-gradient rounded-lg p-4 text-white">
            <div className="flex items-center space-x-2 mb-2">
              <Star className="w-5 h-5" />
              <Badge label="AI Powered" variant="neutral" className="bg-white/20 text-white" />
            </div>
            <p className="text-purple-100">Purple gradient card</p>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Typography</h2>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Heading 1 - Main Title</h1>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">Heading 2 - Section Title</h2>
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">Heading 3 - Subsection</h3>
          <p className="text-base text-slate-600 dark:text-slate-400">
            Body text - This is the standard paragraph text used throughout the application. 
            It maintains good readability across light and dark themes.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Small text - Used for captions, metadata, and secondary information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReconEasyDesignShowcase;