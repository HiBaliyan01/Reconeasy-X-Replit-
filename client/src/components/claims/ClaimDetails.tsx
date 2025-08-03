import React, { useState } from 'react';
import { ArrowLeft, Download, Edit2, Upload, Activity, FileText, Clock, CheckCircle, Tag, Save, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
// GPT-4o tuned ClaimDetails.tsx with editable ticket, comments, upload, tags, summary, modern layout

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
  resolutionTime: '3 days 4 hrs',
  tags: ['High Priority', 'Payment Issue', 'Amazon'],
  summary: 'Customer reported missing refund for returned item. Expected amount: ₹1,500. Marketplace ticket created.',
  attachments: []
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
  const [assignedTo, setAssignedTo] = useState(mockClaim.assigned_to);
  const [marketplaceTicketId, setMarketplaceTicketId] = useState(mockClaim.marketplace_ticket_id);
  const [isEditingTicketId, setIsEditingTicketId] = useState(false);
  const [comment, setComment] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>(mockClaim.tags);
  const [newTag, setNewTag] = useState('');
  const [summary, setSummary] = useState(mockClaim.summary);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
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
    console.log(`✅ Status updated to: ${e.target.value}`);
  };

  const handleAssignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAssignedTo(e.target.value);
    console.log(`✅ Claim assigned to: ${e.target.value}`);
  };

  const handleTicketIdSave = () => {
    setIsEditingTicketId(false);
    console.log(`✅ Marketplace Ticket ID updated to: ${marketplaceTicketId}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      console.log(`✅ ${newFiles.length} file(s) uploaded successfully`);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      console.log(`✅ Tag added: ${newTag.trim()}`);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
    console.log(`✅ Tag removed: ${tagToRemove}`);
  };

  const handleSummaryUpdate = () => {
    setIsEditingSummary(false);
    console.log("✅ Summary updated successfully");
  };

  const handleDownloadPDF = () => {
    console.log('Downloading PDF summary...');
  };

  const ageInDays = calculateAgeInDays(mockClaim.raised_at);
  const isAged = ageInDays > 15;
  const reminderColor = isAged ? 'text-red-600' : ageInDays > 7 ? 'text-orange-500' : 'text-gray-400';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'In Review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'Awaiting Marketplace':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={onBack}
                className="flex items-center space-x-2 hover:bg-primary/10"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Claims</span>
              </Button>
              <div>
                <h2 className="text-2xl font-bold text-primary">Claim #{orderId}</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Created {formatDate(mockClaim.raised_at)} • {ageInDays} days old
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleDownloadPDF}
                className="flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export PDF</span>
              </Button>
              <div className={`flex items-center space-x-1 ${reminderColor}`}>
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {isAged ? 'Critical' : ageInDays > 7 ? 'Overdue' : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Claim Value</div>
              <div className="text-2xl font-bold text-primary">₹{mockClaim.value.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Priority</div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  mockClaim.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {mockClaim.priority}
                </span>
                {mockClaim.autoFlagged && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Auto Flagged
                  </span>
                )}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Current Status</div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
                {status}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Assigned To</div>
              <div className="text-lg font-semibold">{assignedTo}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-primary" />
                  Claim Summary
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingSummary(!isEditingSummary)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
              {isEditingSummary ? (
                <div className="space-y-3">
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="min-h-[100px]"
                    placeholder="Enter claim summary..."
                  />
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={handleSummaryUpdate}>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsEditingSummary(false)}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Tag className="w-5 h-5 mr-2 text-primary" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary border border-primary/20"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex space-x-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add new tag..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button onClick={handleAddTag} size="sm">
                  Add Tag
                </Button>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-primary" />
                Comments & Activity
              </h3>
              
              {/* Existing Comments */}
              <div className="space-y-4 mb-6">
                {comments.map((comment, index) => (
                  <div key={index} className="border-l-4 border-primary/20 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{comment.by}</span>
                      <span className="text-xs text-gray-500">{comment.time}</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">{comment.text}</p>
                  </div>
                ))}
              </div>

              {/* Add Comment */}
              <div className="space-y-3">
                <Label htmlFor="comment">Add Comment</Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Enter your comment..."
                  className="min-h-[80px]"
                />
                <Button onClick={handleCommentPost} disabled={!comment.trim()}>
                  Post Comment
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Editable Fields */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Claim Details</h3>
              
              <div className="space-y-4">
                {/* Status */}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={status}
                    onChange={handleStatusChange}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Review">In Review</option>
                    <option value="Awaiting Marketplace">Awaiting Marketplace</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Assigned To */}
                <div>
                  <Label htmlFor="assignedTo">Assigned To</Label>
                  <select
                    id="assignedTo"
                    value={assignedTo}
                    onChange={handleAssignChange}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {mockUsers.map(user => (
                      <option key={user.id} value={user.name}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Marketplace Ticket ID */}
                <div>
                  <Label htmlFor="ticketId">Marketplace Ticket ID</Label>
                  {isEditingTicketId ? (
                    <div className="flex space-x-2 mt-1">
                      <Input
                        value={marketplaceTicketId}
                        onChange={(e) => setMarketplaceTicketId(e.target.value)}
                        placeholder="Enter ticket ID..."
                      />
                      <Button size="sm" onClick={handleTicketIdSave}>
                        <Save className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="font-mono text-sm">{marketplaceTicketId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingTicketId(true)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* File Attachments */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-primary" />
                Attachments
              </h3>
              
              {/* Upload Area */}
              <div className="mb-4">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click to upload files or drag and drop
                    </p>
                  </div>
                </label>
              </div>

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Files ({uploadedFiles.length})</Label>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};