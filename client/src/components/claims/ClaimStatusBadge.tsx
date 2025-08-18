import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getStatusColor } from './claimsHelpers';

interface ClaimStatusBadgeProps {
  status: string;
  onStatusChange: (newStatus: string) => void;
}

export const ClaimStatusBadge: React.FC<ClaimStatusBadgeProps> = ({
  status,
  onStatusChange
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const statuses = ['Pending', 'In Review', 'Resolved', 'Rejected'];

  const handleStatusSelect = (newStatus: string) => {
    if (newStatus !== status) {
      onStatusChange(newStatus);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="relative">
        <select
          value={status}
          onChange={(e) => handleStatusSelect(e.target.value)}
          onBlur={() => setIsEditing(false)}
          autoFocus
          className="text-xs px-2 py-1 rounded-full border border-input bg-background text-foreground focus:ring-2 focus:ring-subheader-claims focus:border-subheader-claims"
        >
          {statuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`claim-status-badge ${getStatusColor(status)} hover:opacity-80 transition-opacity flex items-center space-x-1`}
    >
      <span>{status}</span>
      <ChevronDown className="w-3 h-3" />
    </button>
  );
};