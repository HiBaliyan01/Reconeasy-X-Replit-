import { Claim } from './ClaimsPage';

export const mockClaims: Claim[] = [
  {
    id: 'CLM1234',
    orderId: 'ORD001236',
    marketplace: 'Amazon',
    issueType: 'Short Refund',
    status: 'Pending',
    createdAt: '2025-07-15',
    claimValue: 250,
    daysOpen: 14,
    priority: 'High',
    autoFlagged: true
  },
  {
    id: 'CLM1235',
    orderId: 'ORD001237',
    marketplace: 'Flipkart',
    issueType: 'Return Processing Issue',
    status: 'In Review',
    createdAt: '2025-07-20',
    claimValue: 150,
    daysOpen: 9,
    priority: 'Medium'
  },
  {
    id: 'CLM1236',
    orderId: 'ORD001238',
    marketplace: 'Myntra',
    issueType: 'Payment Settlement Delay',
    status: 'Resolved',
    createdAt: '2025-07-10',
    claimValue: 890,
    daysOpen: 19,
    priority: 'Low'
  },
  {
    id: 'CLM1237',
    orderId: 'ORD001239',
    marketplace: 'Amazon',
    issueType: 'Logistics Overcharge',
    status: 'Pending',
    createdAt: '2025-07-18',
    claimValue: 75,
    daysOpen: 11,
    priority: 'Medium',
    autoFlagged: true
  }
];

export const statusColors = {
  'Pending': 'claim-status-pending',
  'In Review': 'bg-blue-100 text-blue-800',
  'Resolved': 'claim-status-resolved',
  'Rejected': 'claim-status-rejected'
};

export const getStatusColor = (status: string): string => {
  return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
};

export const getAgingIndicator = (daysOpen: number): { color: string; tooltip: string } => {
  if (daysOpen >= 15) {
    return {
      color: 'claim-aging-15days',
      tooltip: 'Critical: Follow up immediately. Claim has been open for 15+ days.'
    };
  } else if (daysOpen >= 7) {
    return {
      color: 'claim-aging-7days',
      tooltip: 'Attention: Consider following up. Claim has been open for 7+ days.'
    };
  }
  return {
    color: '',
    tooltip: ''
  };
};

export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString()}`;
};

export const getMarketplaces = (claims: Claim[]): string[] => {
  return [...new Set(claims.map(claim => claim.marketplace))];
};

export const getStatuses = (claims: Claim[]): string[] => {
  return [...new Set(claims.map(claim => claim.status))];
};