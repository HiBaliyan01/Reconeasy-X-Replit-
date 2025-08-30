import React, { useState } from 'react';
import { ChevronDown, MessageSquare, RefreshCw } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onStatusUpdate: (status: string, comment?: string) => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onStatusUpdate
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'status' | 'reminder' | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [comment, setComment] = useState('');

  const handleActionSelect = (action: 'status' | 'reminder') => {
    setSelectedAction(action);
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (selectedAction === 'status' && newStatus) {
      onStatusUpdate(newStatus, comment);
    } else if (selectedAction === 'reminder') {
      // Handle reminder logic
      console.log(`Sending reminder for ${selectedCount} claims`);
    }
    
    setShowModal(false);
    setSelectedAction(null);
    setNewStatus('');
    setComment('');
  };

  return (
    <>
      <div className="relative">
        <div className="flex space-x-2">
          <button
            onClick={() => handleActionSelect('status')}
            className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Update Status</span>
          </button>
          
          <button
            onClick={() => handleActionSelect('reminder')}
            className="flex items-center space-x-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Send Reminder</span>
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="claim-bulk-modal p-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedAction === 'status' ? 'Update Status' : 'Send Reminder'}
            </h3>
            
            {selectedAction === 'status' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select status...</option>
                    <option value="Pending">Pending</option>
                    <option value="In Review">In Review</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comment (Optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment about this status change..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {selectedAction === 'reminder' && (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Send follow-up reminders for {selectedCount} selected claim(s)?
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reminder Message (Optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a custom reminder message..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedAction === 'status' && !newStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {selectedAction === 'status' ? 'Update Status' : 'Send Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};