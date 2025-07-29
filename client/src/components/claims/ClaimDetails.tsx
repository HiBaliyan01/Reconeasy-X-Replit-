import React, { useState } from 'react';
import { ArrowLeft, Download, Edit2, Upload, Activity, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
// Using console.log for notifications until toast system is set up

interface ClaimDetailsProps {
  orderId: string;
  onBack: () => void;
}

// Mock users data (in a real app, this would come from API or context)
const mockUsers = [
  { id: 1, name: 'Amit Kumar' },
  { id: 2, name: 'Priya Sharma' },
  { id: 3, name: 'Rahul Singh' },
  { id: 4, name: 'Sneha Patel' },
  { id: 5, name: 'Vikram Gupta' }
];

const mockClaim = {
  id: 'CLM-123456',
  orderId: 'ORD-98765',
  value: 1500,
  status: 'Pending',
  priority: 'High',
  autoFlagged: true,
  marketplace_ticket_id: 'AZ-2025-0011',
  assigned_to: 'Amit Kumar',
  raised_at: '2025-07-10T10:30:00Z',
  last_updated: '2025-07-29T15:45:00Z',
  resolutionTime: '3 days 4 hrs'
};

const calculateAgeInDays = (dateString: string): number => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const ClaimDetails: React.FC<ClaimDetailsProps> = ({ orderId, onBack }) => {
  const [status, setStatus] = useState(mockClaim.status);
  const [comment, setComment] = useState('');
  const [ticketId, setTicketId] = useState(mockClaim.marketplace_ticket_id || '');
  const [assignedTo, setAssignedTo] = useState(mockClaim.assigned_to || '');
  const [attachments, setAttachments] = useState<FileList | null>(null);
  const [comments, setComments] = useState([
    { by: "Recon Engine", text: "Claim identified due to short payment.", time: "2 days ago" },
  ]);

  const handleCommentPost = () => {
    if (!comment.trim()) return;
    
    setComments([...comments, { by: "You", text: comment, time: "Just now" }]);
    setComment('');
    
    console.log("✅ Comment posted successfully: Your comment has been added to the claim.");
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value);
  };

  const handleTicketIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTicketId(e.target.value);
  };

  const handleAssignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAssignedTo(e.target.value);
  };

  const handleSaveChanges = () => {
    console.log("✅ Changes saved successfully: All updates have been saved to the claim.");
  };

  const handleDownloadPDF = () => {
    console.log('Downloading PDF summary...');
  };

  const ageInDays = calculateAgeInDays(mockClaim.raised_at);
  const isAged = ageInDays > 15;
  const reminderColor = isAged ? 'text-red-600' : ageInDays > 7 ? 'text-orange-500' : 'text-gray-400';

  return (
    <div className="p-6 max-w-6xl mx-auto bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="claim-detail-card">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={onBack}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Claims</span>
              </Button>
              <div>
                <h2 className="text-2xl font-bold text-primary">Claim #{orderId}</h2>
                <p className="text-sm text-muted-foreground mt-1">Marketplace Reconciliation Issue</p>
                <div className="flex space-x-2 mt-2">
                  {mockClaim.priority === 'High' && (
                    <span className="claim-priority-high text-xs px-2 py-1 rounded-full">
                      High Priority
                    </span>
                  )}
                  {mockClaim.autoFlagged && (
                    <span className="claim-auto-flagged text-xs px-2 py-1 rounded-full">
                      Auto Flagged
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={handleDownloadPDF} className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </Button>
          </div>

          {/* Editable Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select 
                id="status"
                value={status} 
                onChange={handleStatusChange} 
                className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="assigned">Assigned To</Label>
              <select 
                id="assigned"
                value={assignedTo} 
                onChange={handleAssignChange} 
                className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <option value="">-- Select User --</option>
                {mockUsers.map(user => (
                  <option key={user.id} value={user.name}>{user.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ticket">Marketplace Ticket ID</Label>
              <Input 
                id="ticket"
                value={ticketId} 
                onChange={handleTicketIdChange}
                placeholder="Enter ticket ID"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Raised At</Label>
              <div className="text-sm text-muted-foreground">{formatDate(mockClaim.raised_at)}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Last Activity</Label>
              <div className="text-sm text-muted-foreground">{formatDate(mockClaim.last_updated)}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Resolution Time</Label>
              <div className="text-sm text-muted-foreground">
                {status === 'Resolved' ? `${ageInDays} days` : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Reminder */}
      <div className="claim-detail-card">
        <div className="p-6">
          <Label>Smart Reminder</Label>
          <p className={`mt-2 text-sm font-medium ${reminderColor}`}>
            {isAged ? 
              '⚠️ Consider following up with marketplace (15+ days)' : 
              ageInDays > 7 ? 
                '🟡 Follow-up recommended (7+ days)' : 
                '✅ No immediate action required'
            }
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Claim age: {ageInDays} days
          </p>
        </div>
      </div>

      {/* Reconciliation Summary */}
      <div className="claim-detail-card">
        <div className="p-6">
          <Label>Reconciliation Summary</Label>
          <div className="mt-4 space-y-2 text-sm">
            <p>Expected Amount: <span className="font-medium">₹500</span></p>
            <p>Actual Settlement: <span className="font-medium">₹250</span></p>
            <p>Issue: <span className="font-medium text-red-600">Short Payment</span></p>
            <p>Suggested Reason: <span className="font-medium">Commission mismatch</span></p>
          </div>
        </div>
      </div>

      {/* Upload Attachments */}
      <div className="claim-detail-card">
        <div className="p-6">
          <Label htmlFor="attachments">Upload Attachments</Label>
          <Input 
            id="attachments"
            type="file" 
            multiple 
            onChange={(e) => setAttachments(e.target.files)}
            className="mt-2"
            accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
          />
          {attachments && attachments.length > 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              {Array.from(attachments).map((file, index) => (
                <div key={index}>📎 {file.name}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="claim-detail-card">
        <div className="p-6">
          <Label>Activity Log</Label>
          <div className="mt-4 space-y-2 text-sm">
            <div>→ Amit changed status to Pending (2 hours ago)</div>
            <div>→ Auto-flagged due to mismatch (1 day ago)</div>
            <div>→ Claim automatically identified (2 days ago)</div>
          </div>
        </div>
      </div>

      {/* Add Comment */}
      <div className="claim-detail-card">
        <div className="p-6">
          <Label htmlFor="comment">Add Comment</Label>
          <Textarea 
            id="comment"
            value={comment} 
            onChange={(e) => setComment(e.target.value)} 
            rows={3}
            placeholder="Write a comment..."
            className="mt-2"
          />
          <Button 
            onClick={handleCommentPost}
            disabled={!comment.trim()}
            className="mt-3"
          >
            Post Comment
          </Button>
          
          {/* Previous Comments */}
          {comments.length > 0 && (
            <div className="mt-6 space-y-3">
              <Label>Previous Comments</Label>
              {comments.map((c, i) => (
                <div key={i} className="bg-muted rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.by}</span>
                    <span className="text-xs text-muted-foreground">{c.time}</span>
                  </div>
                  <p className="text-sm">{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="claim-detail-card">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleSaveChanges}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};