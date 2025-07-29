import React, { useState } from "react";
import { ArrowLeft, Download, FileText, Edit2, Upload, Activity } from 'lucide-react';

interface EnhancedClaimDetailsProps {
  orderId: string;
  onBack: () => void;
}

const mockActivityLog = [
  { timestamp: '2025-07-28 10:23', action: 'Status changed from Pending to Resolved', user: 'SupportTeam' },
  { timestamp: '2025-07-27 18:05', action: 'Comment added', user: 'Himanshu' },
  { timestamp: '2025-07-26 14:30', action: 'Claim automatically identified', user: 'ReconEasy Engine' },
];

const mockClaim = {
  id: 'CLM-123456',
  orderId: 'ORD-98765',
  value: 1500,
  status: 'Pending',
  priority: 'High',
  autoFlagged: true,
  marketplaceTicketId: 'AZ-2025-0011',
};

const EnhancedClaimDetails: React.FC<EnhancedClaimDetailsProps> = ({ orderId, onBack }) => {
  const [status, setStatus] = useState("Pending");
  const [comment, setComment] = useState("");
  const [marketplaceTicketId, setMarketplaceTicketId] = useState(mockClaim.marketplaceTicketId);
  const [isEditingTicketId, setIsEditingTicketId] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [comments, setComments] = useState([
    { by: "Recon Engine", text: "Claim identified due to short payment.", time: "2 days ago" },
  ]);

  const handleAddComment = () => {
    if (comment.trim()) {
      setComments([...comments, { by: "You", text: comment, time: "Just now" }]);
      setComment("");
      // Show success message
      console.log("✅ Comment posted");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleTicketIdSave = () => {
    setIsEditingTicketId(false);
    console.log("✅ Marketplace Ticket ID updated");
  };

  const getStatusColor = (value: string) => {
    switch (value) {
      case "Resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "Rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      case "Awaiting Marketplace":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300";
    }
  };

  const handleDownloadPDF = () => {
    // Trigger PDF generation and download
    window.print();
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Claims</span>
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Claim #{mockClaim.id}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Order ID: {orderId}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Priority and Auto-flagged badges */}
          <div className="flex space-x-2">
            {mockClaim.priority === 'High' && (
              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-full">
                High Priority
              </span>
            )}
            {mockClaim.autoFlagged && (
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 rounded-full">
                Auto Flagged
              </span>
            )}
          </div>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Summary</span>
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6 space-y-6">
          {/* Claim Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Marketplace</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">Amazon</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Claim Value</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">₹250</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Raised At</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">July 10, 2025</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Status</p>
              <select
                className={`rounded-lg px-3 py-2 text-sm font-medium border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${getStatusColor(status)}`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Pending">Pending</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
                <option value="Awaiting Marketplace">Awaiting Marketplace</option>
              </select>
            </div>
          </div>

          {/* Marketplace Ticket ID Section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Marketplace Ticket ID</h4>
            <div className="flex items-center space-x-2">
              {isEditingTicketId ? (
                <div className="flex items-center space-x-2">
                  <input
                    value={marketplaceTicketId}
                    onChange={(e) => setMarketplaceTicketId(e.target.value)}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    onClick={handleTicketIdSave}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-slate-900 dark:text-slate-100">{marketplaceTicketId}</span>
                  <button
                    onClick={() => setIsEditingTicketId(true)}
                    className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Reconciliation Summary */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Reconciliation Summary</h4>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex justify-between">
                  <span>Expected Amount:</span>
                  <span className="font-medium">₹500</span>
                </li>
                <li className="flex justify-between">
                  <span>Actual Settlement:</span>
                  <span className="font-medium">₹250</span>
                </li>
                <li className="flex justify-between">
                  <span>Issue:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">Short Payment</span>
                </li>
                <li className="flex justify-between">
                  <span>Suggested Reason:</span>
                  <span className="font-medium">Commission mismatch</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Upload Attachment</span>
          </h4>
          <div className="space-y-3">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300"
            />
            {uploadedFile && (
              <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                <FileText className="w-4 h-4" />
                <span>Uploaded: {uploadedFile.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Comments</h4>
          
          {/* Comments List */}
          <div className="space-y-4 mb-6">
            {comments.map((c, i) => (
              <div key={i} className="flex space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {c.by === 'You' ? 'Y' : c.by.charAt(0)}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.by}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{c.time}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{c.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Comment */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="space-y-3">
              <textarea
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Add internal comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                onClick={handleAddComment}
                disabled={!comment.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Activity Log</span>
          </h4>
          <div className="space-y-3">
            {mockActivityLog.map((log, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1 text-sm">
                  <p className="text-slate-700 dark:text-slate-300">{log.action}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {log.timestamp} by {log.user}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedClaimDetails;