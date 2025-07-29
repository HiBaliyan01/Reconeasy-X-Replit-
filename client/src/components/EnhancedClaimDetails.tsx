import React, { useState } from "react";
import { ArrowLeft, Download, FileText } from 'lucide-react';

interface EnhancedClaimDetailsProps {
  orderId: string;
  onBack: () => void;
}

const EnhancedClaimDetails: React.FC<EnhancedClaimDetailsProps> = ({ orderId, onBack }) => {
  const [status, setStatus] = useState("Pending");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([
    { by: "Recon Engine", text: "Claim identified due to short payment.", time: "2 days ago" },
  ]);

  const handleAddComment = () => {
    if (comment.trim()) {
      setComments([...comments, { by: "You", text: comment, time: "Just now" }]);
      setComment("");
    }
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
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Claim Detail</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Order ID: {orderId}</p>
          </div>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Download className="w-4 h-4" />
          <span>Download PDF Summary</span>
        </button>
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
                <li className="flex justify-between">
                  <span>Marketplace Ticket ID:</span>
                  <span className="font-medium font-mono">MP-AMZ-2025-0583</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Comments & Activity</h4>
          
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
            <div className="flex space-x-3">
              <div className="flex-1">
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={handleAddComment}
                  disabled={!comment.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedClaimDetails;