// Dropdown for update status and send reminder

import React, { useState } from 'react';
import { ChevronDown, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onUpdateStatus: (status: string) => void;
  onSendReminder: () => void;
  onClose: () => void;
  activeTab: 'Returns' | 'Payments';
}

const statusOptions = [
  'Pending',
  'Filed',
  'In Progress',
  'Awaiting Marketplace',
  'Resolved',
  'Rejected'
];

const BulkActions: React.FC<BulkActionsProps> = ({ 
  selectedCount, 
  onUpdateStatus, 
  onSendReminder, 
  onClose,
  activeTab 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);

  const buttonClass = activeTab === 'Returns' 
    ? 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-500' 
    : 'bg-red-500 hover:bg-red-600 focus:ring-red-500';

  const handleStatusUpdate = () => {
    if (selectedStatus) {
      onUpdateStatus(selectedStatus);
      setSelectedStatus('');
      setShowStatusUpdate(false);
      setIsOpen(false);
    }
  };

  const handleSendReminder = () => {
    onSendReminder();
    setIsOpen(false);
  };

  if (selectedCount === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonClass}`}
      >
        <span>Bulk Actions ({selectedCount})</span>
        <ChevronDown className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Bulk Actions ({selectedCount} selected)
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!showStatusUpdate ? (
                <div className="space-y-1">
                  <button
                    onClick={() => setShowStatusUpdate(true)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center space-x-2 text-slate-700 dark:text-slate-300"
                  >
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Update Status</span>
                  </button>
                  
                  <button
                    onClick={handleSendReminder}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center space-x-2 text-slate-700 dark:text-slate-300"
                  >
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span>Send Reminder</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Select New Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Choose status...</option>
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={handleStatusUpdate}
                      disabled={!selectedStatus}
                      className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded transition-colors"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => {
                        setShowStatusUpdate(false);
                        setSelectedStatus('');
                      }}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BulkActions;