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
  assignedTo: 'Amit Kumar',
  createdDate: 'July 10, 2025',
  lastActivity: 'July 29, 2025',
  resolutionTime: '3 days 4 hrs'
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
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg border border-border transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Claims</span>
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Claim #{mockClaim.id}</h2>
            <p className="text-sm text-muted-foreground">Order ID: {orderId}</p>
            <div className="flex space-x-2 mt-2">
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
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex space-x-2"></div>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center space-x-2 px-4 py-2 bg-subheader-claims hover:bg-subheader-claims/90 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-subheader-claims focus:ring-offset-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Summary</span>
          </button>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="bg-card rounded-xl shadow-sm border border-border">
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Marketplace</p>
              <p className="font-medium text-foreground">Amazon</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Claim Value</p>
              <p className="font-medium text-foreground">₹250</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Raised At</p>
              <p className="font-medium text-foreground">July 10, 2025</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <select
                className={`rounded-lg px-3 py-2 text-sm font-medium border border-border focus:ring-2 focus:ring-subheader-claims focus:border-subheader-claims transition-colors ${getStatusColor(status)}`}
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
        </div>
      </div>

      {/* Marketplace Ticket ID */}
      <div className="bg-card rounded-xl shadow-sm border border-border">
        <div className="p-6">
          <h4 className="text-sm text-muted-foreground mb-2 font-semibold">Marketplace Ticket ID</h4>
          <div className="flex items-center space-x-2">
            {isEditingTicketId ? (
              <div className="flex items-center space-x-2">
                <input
                  value={marketplaceTicketId}
                  onChange={(e) => setMarketplaceTicketId(e.target.value)}
                  onBlur={handleTicketIdSave}
                  className="px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-subheader-claims focus:border-subheader-claims"
                  autoFocus
                />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="font-medium text-foreground">{marketplaceTicketId}</span>
                <button
                  onClick={() => setIsEditingTicketId(true)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reconciliation Summary */}
      <div className="bg-card rounded-xl shadow-sm border border-border">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-foreground mb-4">Reconciliation Summary</h4>
          <div className="space-y-2 text-sm text-foreground">
            <p>Expected Amount: <span className="font-medium">₹500</span></p>
            <p>Actual Settlement: <span className="font-medium">₹250</span></p>
            <p>Issue: <span className="font-medium text-red-600 dark:text-red-400">Short Payment</span></p>
            <p>Suggested Reason: <span className="font-medium">Commission mismatch</span></p>
          </div>
        </div>
      </div>

      {/* Claim Metadata */}
      <div className="bg-card rounded-xl shadow-sm border border-border">
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Assigned To</p>
              <p className="font-medium text-foreground">{mockClaim.assignedTo}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Created Date</p>
              <p className="font-medium text-foreground">{mockClaim.createdDate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Activity</p>
              <p className="font-medium text-foreground">{mockClaim.lastActivity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Resolution Time</p>
              <p className="font-medium text-foreground">{mockClaim.resolutionTime}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Attachment */}
      <div className="bg-card rounded-xl shadow-sm border border-border">
        <div className="p-6">
          <h4 className="text-sm text-muted-foreground mb-2 font-semibold">Upload Attachment</h4>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            onChange={handleFileUpload}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-subheader-claims/10 file:text-subheader-claims hover:file:bg-subheader-claims/20"
          />
          {uploadedFile && (
            <p className="text-sm text-muted-foreground mt-2">Uploaded: {uploadedFile.name}</p>
          )}
        </div>
      </div>

      {/* Add Comment */}
      <div className="bg-card rounded-xl shadow-sm border border-border">
        <div className="p-6">
          <h4 className="text-sm text-muted-foreground mb-2 font-semibold">Add Comment</h4>
          <textarea
            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-subheader-claims focus:border-subheader-claims resize-none mb-3"
            rows={3}
            placeholder="Write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button
            onClick={handleAddComment}
            disabled={!comment.trim()}
            className="px-4 py-2 bg-subheader-claims hover:bg-subheader-claims/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-subheader-claims focus:ring-offset-2"
          >
            Post Comment
          </button>
          
          {/* Previous Comments */}
          {comments.length > 0 && (
            <div className="mt-6 space-y-3">
              <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">Previous Comments</h5>
              {comments.map((c, i) => (
                <div key={i} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.by}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{c.time}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h4 className="text-sm text-slate-500 dark:text-slate-400 mb-2 font-semibold">Activity Log</h4>
          <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
            <li>→ Amit changed status to Pending (2 hours ago)</li>
            <li>→ Auto-flagged due to mismatch (1 day ago)</li>
            {mockActivityLog.map((log, index) => (
              <li key={index}>→ {log.action} ({log.timestamp})</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EnhancedClaimDetails;