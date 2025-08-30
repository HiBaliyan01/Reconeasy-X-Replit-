import React, { useState } from 'react';
import { 
  CheckSquare, Square, Download, FileText, Trash2, 
  Edit3, Send, AlertTriangle, X 
} from 'lucide-react';

interface BulkActionBarProps {
  selectedItems: string[];
  totalItems: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkAction: (action: string, items: string[]) => void;
  actions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<any>;
    variant: 'primary' | 'secondary' | 'danger';
    requiresConfirmation?: boolean;
  }>;
}

export default function BulkActionBar({ 
  selectedItems, 
  totalItems, 
  onSelectAll, 
  onDeselectAll, 
  onBulkAction,
  actions = []
}: BulkActionBarProps) {
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);

  const defaultActions = [
    {
      id: 'export',
      label: 'Export Selected',
      icon: Download,
      variant: 'secondary' as const
    },
    {
      id: 'mark_reconciled',
      label: 'Mark as Reconciled',
      icon: CheckSquare,
      variant: 'primary' as const
    },
    {
      id: 'file_claims',
      label: 'File Claims',
      icon: FileText,
      variant: 'primary' as const
    },
    {
      id: 'delete',
      label: 'Delete Selected',
      icon: Trash2,
      variant: 'danger' as const,
      requiresConfirmation: true
    }
  ];

  const allActions = actions.length > 0 ? actions : defaultActions;
  const isAllSelected = selectedItems.length === totalItems;
  const isPartiallySelected = selectedItems.length > 0 && selectedItems.length < totalItems;

  const handleAction = (actionId: string) => {
    const action = allActions.find(a => a.id === actionId);
    if (action?.requiresConfirmation) {
      setShowConfirmation(actionId);
    } else {
      onBulkAction(actionId, selectedItems);
    }
  };

  const confirmAction = () => {
    if (showConfirmation) {
      onBulkAction(showConfirmation, selectedItems);
      setShowConfirmation(null);
    }
  };

  if (selectedItems.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 min-w-96">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={isAllSelected ? onDeselectAll : onSelectAll}
                className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : isPartiallySelected ? (
                  <div className="w-4 h-4 bg-teal-500 rounded border-2 border-teal-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-sm"></div>
                  </div>
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>
                  {selectedItems.length} of {totalItems} selected
                </span>
              </button>
            </div>
            
            <button
              onClick={onDeselectAll}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto">
            {allActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    action.variant === 'primary' 
                      ? 'bg-teal-500 hover:bg-teal-600 text-white'
                      : action.variant === 'danger'
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Confirm Action
              </h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to perform this action on {selectedItems.length} selected items? 
              This action cannot be undone.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmation(null)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}