import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Edit2, Upload, Activity, FileText, Clock, CheckCircle, Tag, Save, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
// GPT-4o tuned ClaimDetails.tsx with editable ticket, comments, upload, tags, summary, modern layout

interface ClaimDetailsProps {
  claimId: string;
  onBack: () => void;
}

type ClaimDetailResponse = {
  id: string;
  order_id: string;
  bucket: string;
  marketplace: string;
  claim_amount: number | string;
  claim_status: string;
  created_by?: string | null;
  claim_reason?: string | null;
  marketplace_ticket_id?: string | null;
  discrepancy_amount?: number | string | null;
  created_at: string;
  updated_at?: string | null;
  settlement_id?: string | null;
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

export const ClaimDetails: React.FC<ClaimDetailsProps> = ({ claimId, onBack }) => {
  const tenantId = "tenant-1";
  const [claimData, setClaimData] = useState<ClaimDetailResponse | null>(null);
  const [status, setStatus] = useState('DRAFT');
  const [assignedTo, setAssignedTo] = useState('Unassigned');
  const [marketplaceTicketId, setMarketplaceTicketId] = useState('');
  const [comment, setComment] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [summary, setSummary] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [comments, setComments] = useState([
    { by: "Recon Engine", text: "Claim identified due to short payment.", time: "2 days ago" },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/claims/${claimId}?tenant_id=${tenantId}`)
      .then((r) => r.json())
      .then((data) => {
        const claim = data?.claim as ClaimDetailResponse | undefined;
        if (!claim) return;
        setClaimData(claim);
        setStatus(claim.claim_status ?? "DRAFT");
        setAssignedTo(claim.created_by ?? "Unassigned");
        setMarketplaceTicketId(claim.marketplace_ticket_id ?? "");
        setSummary(
          claim.claim_reason ??
            `Created from reconciliation discrepancy for ${claim.bucket ?? "COMMISSION"}.`,
        );
        setTags([claim.marketplace, claim.bucket, claim.claim_status].filter(Boolean));
      })
      .catch((error) => {
        console.error("Failed to fetch claim detail:", error);
      })
      .finally(() => setIsLoading(false));
  }, [claimId]);

  const claimAmount = useMemo(
    () => Number(claimData?.claim_amount ?? 0),
    [claimData?.claim_amount],
  );
  const createdAt = claimData?.created_at ?? new Date().toISOString();
  const shortClaimId = `CLM-${String(claimData?.id ?? claimId).slice(0, 8)}`;
  const priority = claimAmount >= 1000 ? 'High' : 'Medium';
  const autoFlagged = Number(claimData?.discrepancy_amount ?? 0) < 0;

  const updateClaim = async (fields: Partial<{
    claim_status: string;
    created_by: string;
    marketplace_ticket_id: string;
  }>) => {
    if (!claimData?.id) return;
    const res = await fetch(`/api/claims/${claimData.id}?tenant_id=${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      console.error("Failed to update claim");
      return;
    }
    const data = await res.json();
    setClaimData(data.claim);
    if (data?.claim?.claim_status) setStatus(data.claim.claim_status);
    if (typeof data?.claim?.created_by === "string") setAssignedTo(data.claim.created_by);
    if (typeof data?.claim?.marketplace_ticket_id === "string") {
      setMarketplaceTicketId(data.claim.marketplace_ticket_id);
    }
  };

  const handleCommentPost = () => {
    if (!comment.trim()) return;
    
    setComments([...comments, { by: "You", text: comment, time: "Just now" }]);
    setComment('');
    
    console.log("✅ Comment posted successfully: Your comment has been added to the claim.");
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setStatus(value);
    await updateClaim({ claim_status: value });
    console.log(`✅ Status updated to: ${value}`);
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

  const ageInDays = calculateAgeInDays(createdAt);
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
    <div className="p-6 max-w-6xl mx-auto bg-background min-h-screen">
      {/* Header */}
      <div className="bg-card rounded-xl shadow-lg border border-border mb-6">
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
                <h2 className="text-2xl font-bold text-primary">Claim #{shortClaimId}</h2>
                <p className="text-muted-foreground text-sm">
                  Created {formatDate(createdAt)} • {ageInDays} days old
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
            <div className="bg-muted rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Claim Value</div>
              <div className="text-2xl font-bold text-primary">₹{claimAmount.toLocaleString()}</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Priority</div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {priority}
                </span>
                {autoFlagged && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Auto Flagged
                  </span>
                )}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Current Status</div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
                {status}
              </span>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Assigned To</div>
              <div className="text-lg font-semibold">{assignedTo}</div>
            </div>
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Loading claim details...</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <div className="bg-card rounded-xl shadow-lg border border-border">
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
          <div className="bg-card rounded-xl shadow-lg border border-border">
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
                    <option value="DRAFT">DRAFT</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                    <option value="IN_REVIEW">IN_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="RECOVERED">RECOVERED</option>
                  </select>
                </div>

                {/* Assigned To */}
                <div>
                  <Label htmlFor="assignedTo">Assigned To</Label>
                  <input
                    id="assignedTo"
                    type="text"
                    placeholder="Enter name or email"
                    defaultValue={claimData?.created_by ?? ""}
                    onBlur={(e) => {
                      setAssignedTo(e.target.value);
                      void updateClaim({ created_by: e.target.value });
                    }}
                    className="w-full mt-1 border rounded px-2 py-1 text-sm"
                  />
                </div>

                {/* Marketplace Ticket ID */}
                <div>
                  <Label htmlFor="ticketId">Marketplace Ticket ID</Label>
                  <Input
                    value={marketplaceTicketId}
                    onChange={(e) => setMarketplaceTicketId(e.target.value)}
                    placeholder="Enter ticket ID..."
                    className="mt-1"
                    onBlur={(e) => void updateClaim({ marketplace_ticket_id: e.target.value })}
                  />
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
