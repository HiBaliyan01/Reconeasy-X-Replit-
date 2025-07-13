import React from 'react';
import { Sparkles, CheckCircle, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface Insight {
  id: string;
  text: string;
  type: 'positive' | 'negative' | 'warning' | 'info';
}

interface AiInsightsProps {
  insights: Insight[];
}

export function AiInsights({ insights }: AiInsightsProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-emerald-500 mt-1 mr-2" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-red-500 mt-1 mr-2" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 mt-1 mr-2" />;
      default:
        return <CheckCircle className="w-4 h-4 text-teal-500 mt-1 mr-2" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6">
      <h3 className="text-xl font-bold mb-4 flex items-center">
        <Sparkles className="w-5 h-5 text-yellow-400 mr-2" />
        AI Key Insights
      </h3>
      <ul className="space-y-3">
        {insights.map(i => (
          <li key={i.id} className="flex items-start">
            {getIcon(i.type)}
            <span className="text-sm text-slate-700 dark:text-slate-300">{i.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}