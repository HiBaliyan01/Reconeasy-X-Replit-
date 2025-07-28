// Helper functions for filtering, sorting, tooltips, etc.

export interface Claim {
  claimId: string;
  orderId: string;
  marketplace: string;
  issue: string;
  claimValue: number;
  status: string;
  age: number;
  lastUpdated: string;
  priority: 'low' | 'medium' | 'high';
  claimType: 'Returns' | 'Payments';
  description?: string;
  evidenceUrls?: string[];
}

export const mockClaims: Claim[] = [
  {
    claimId: 'CLM12345',
    orderId: 'ORD001234',
    marketplace: 'Amazon',
    issue: 'Short Payment',
    claimValue: 2500,
    status: 'Awaiting Marketplace',
    age: 12,
    lastUpdated: '2025-07-16',
    priority: 'high',
    claimType: 'Payments',
    description: 'Payment received is ₹250 less than expected amount.',
    evidenceUrls: ['https://example.com/invoice1.pdf']
  },
  {
    claimId: 'CLM12346',
    orderId: 'ORD001235',
    marketplace: 'Flipkart',
    issue: 'Missing Settlement',
    claimValue: 1850,
    status: 'In Progress',
    age: 5,
    lastUpdated: '2025-07-23',
    priority: 'medium',
    claimType: 'Payments'
  },
  {
    claimId: 'CLM12347',
    orderId: 'ORD001236',
    marketplace: 'Myntra',
    issue: 'Refund Discrepancy',
    claimValue: 750,
    status: 'Resolved',
    age: 18,
    lastUpdated: '2025-07-10',
    priority: 'low',
    claimType: 'Returns'
  },
  {
    claimId: 'CLM12348',
    orderId: 'ORD001237',
    marketplace: 'Amazon',
    issue: 'Late Settlement',
    claimValue: 3200,
    status: 'Awaiting Marketplace',
    age: 20,
    lastUpdated: '2025-07-08',
    priority: 'high',
    claimType: 'Payments'
  },
  {
    claimId: 'CLM12349',
    orderId: 'ORD001238',
    marketplace: 'Flipkart',
    issue: 'Return Processing Delay',
    claimValue: 890,
    status: 'Filed',
    age: 3,
    lastUpdated: '2025-07-25',
    priority: 'medium',
    claimType: 'Returns'
  },
  {
    claimId: 'CLM12350',
    orderId: 'ORD001239',
    marketplace: 'Myntra',
    issue: 'Incomplete Refund',
    claimValue: 150,
    status: 'Pending',
    age: 14,
    lastUpdated: '2025-07-15',
    priority: 'medium',
    claimType: 'Returns'
  }
];

export const filterClaims = (
  claims: Claim[],
  activeTab: 'Returns' | 'Payments',
  searchTerm: string,
  statusFilter: string,
  marketplaceFilter: string
): Claim[] => {
  return claims.filter(claim => {
    const matchesTab = claim.claimType === activeTab;
    const matchesSearch = 
      claim.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.claimId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    const matchesMarketplace = marketplaceFilter === 'all' || claim.marketplace === marketplaceFilter;
    
    return matchesTab && matchesSearch && matchesStatus && matchesMarketplace;
  });
};

export const sortClaims = (
  claims: Claim[],
  sortField: keyof Claim,
  sortDirection: 'asc' | 'desc'
): Claim[] => {
  return [...claims].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });
};

export const getAgeColorClass = (age: number, status: string): string => {
  if (status === 'Resolved' || status === 'Rejected') {
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
  
  if (age > 15) {
    return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  
  if (age > 7) {
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300';
  }
  
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
};

export const getReminderTooltip = (age: number, status: string): string => {
  if (status === 'Resolved' || status === 'Rejected') {
    return 'Claim completed';
  }
  
  if (age > 15) {
    return 'Critical: Send urgent reminder';
  }
  
  if (age > 7) {
    return 'Overdue: Consider sending reminder';
  }
  
  return 'Within normal timeframe';
};

export const getUniqueValues = (claims: Claim[], field: keyof Claim): string[] => {
  return Array.from(new Set(claims.map(claim => String(claim[field]))));
};

export const calculateStats = (claims: Claim[]) => {
  const totalValue = claims.reduce((sum, claim) => sum + claim.claimValue, 0);
  const criticalCount = claims.filter(claim => claim.age > 15 && claim.status !== 'Resolved' && claim.status !== 'Rejected').length;
  const activeCount = claims.filter(claim => claim.status !== 'Resolved' && claim.status !== 'Rejected').length;
  const resolvedCount = claims.filter(claim => claim.status === 'Resolved').length;
  
  return {
    totalValue,
    criticalCount,
    activeCount,
    resolvedCount,
    totalCount: claims.length
  };
};

export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString()}`;
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-IN');
};