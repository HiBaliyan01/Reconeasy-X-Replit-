import React from "react";
import { ArrowLeft, Download } from "lucide-react";

interface RateCardHeaderProps {
  onBack: () => void;
  onExport?: () => void;
  title?: string;
}

export function RateCardHeader({ onBack, onExport, title = "Rate Card Management" }: RateCardHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-teal-100 hover:text-white text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-2 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Rate Cards</span>
          </button>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-teal-100 mt-1">Manage marketplace commission rates and fees</p>
        </div>
        
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        )}
      </div>
    </div>
  );
}