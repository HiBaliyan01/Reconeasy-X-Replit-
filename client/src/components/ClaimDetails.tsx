import React from 'react';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, User, Calendar, DollarSign } from 'lucide-react';
import Badge from './Badge';

interface ClaimDetailsProps {
  orderId?: string;
  onBack?: () => void;
}

const ClaimDetails: React.FC<ClaimDetailsProps> = ({ orderId = 'ORD12345', onBack }) => {
  const claim = {
    id: 'CLM-ORD12345',
    orderId: orderId,
    issue: 'Short Payment',
    amount: 250,
    status: 'Awaiting Marketplace',
    marketplace: 'Amazon',
    lastUpdated: 'July 26, 2025',
    created: 'July 24, 2025',
    priority: 'high',
    assignedTo: 'Recon Team',
    resolutionTime: '48 hours',
    comments: [
      { role: 'system', name: 'ReconEasy', time: 'Jul 26, 2:00 PM', text: 'Claim raised with Amazon.' },
      { role: 'user', name: 'Seller', time: 'Jul 27, 11:00 AM', text: 'No update yet, following up.' },
    ]
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Awaiting Marketplace':
        return <Badge label="⏳ Awaiting Marketplace" variant="purple" />;
      case 'Resolved':
        return <Badge label="🟢 Resolved" variant="positive" />;
      case 'Rejected':
        return <Badge label="❌ Rejected" variant="negative" />;
      default:
        return <Badge label={status} variant="neutral" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge label="High Priority" variant="negative" />;
      case 'medium':
        return <Badge label="Medium Priority" variant="purple" />;
      case 'low':
        return <Badge label="Low Priority" variant="neutral" />;
      default:
        return <Badge label={priority} variant="neutral" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Claims</span>
        </button>
      </div>

      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-700 dark:to-cyan-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Claim Details</h1>
            <p className="text-teal-100">Order ID: {claim.orderId}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">₹{claim.amount.toLocaleString()}</p>
            <p className="text-teal-100 text-sm">Claim Amount</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Details */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Issue Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Issue Type</p>
                <p className="text-lg font-medium text-slate-900 dark:text-slate-100">{claim.issue}</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Order ID</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{claim.orderId}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Amount</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">₹{claim.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Marketplace</p>
                  <Badge label={claim.marketplace} variant="neutral" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Status</p>
                  {getStatusBadge(claim.status)}
                </div>
              </div>
            </div>
          </div>

          {/* Comments & Updates */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Comments & Updates</h3>
            <div className="space-y-4">
              {claim.comments.map((comment, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/20 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{comment.name}</span>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{comment.time}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{comment.text}</p>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="mt-6 space-y-3">
              <textarea
                placeholder="Add a comment or update..."
                className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows={3}
              />
              <button className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                Add Comment
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Status & Details</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Status</p>
                {getStatusBadge(claim.status)}
              </div>

              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Priority</p>
                {getPriorityBadge(claim.priority)}
              </div>

              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Assigned To</p>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-teal-100 dark:bg-teal-900/20 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="text-slate-900 dark:text-slate-100">{claim.assignedTo}</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Created</p>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-900 dark:text-slate-100">{claim.created}</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Last Updated</p>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-900 dark:text-slate-100">{claim.lastUpdated}</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Expected Resolution</p>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-slate-900 dark:text-slate-100">{claim.resolutionTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Actions</h3>
            <div className="space-y-3">
              <button className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Mark as Resolved</span>
              </button>
              <button className="w-full border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Send Reminder</span>
              </button>
              <button className="w-full border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-colors">
                Export Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimDetails;