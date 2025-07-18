import React, { useState, useMemo } from 'react';
import { 
  Ticket, MessageSquare, AlertTriangle, CheckCircle, Clock, 
  Filter, Search, Plus, ExternalLink, User, Calendar,
  TrendingUp, BarChart3, FileText, Send, Eye, Edit3
} from 'lucide-react';
import { format } from 'date-fns';
import FilterPanel from './FilterPanel';

interface TicketData {
  id: string;
  ticketId: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra';
  ticketType: 'payment_discrepancy' | 'return_issue' | 'order_issue' | 'refund_delay' | 'quality_complaint' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'pending_response' | 'resolved' | 'closed';
  subject: string;
  description: string;
  orderId?: string;
  utr?: string;
  amount?: number;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolutionTime?: number; // in hours
  customerEmail?: string;
  tags: string[];
  attachments?: string[];
  comments: Array<{
    id: string;
    author: string;
    message: string;
    timestamp: string;
    type: 'internal' | 'customer' | 'marketplace';
  }>;
}

const mockTickets: TicketData[] = [
  {
    id: 'TKT001',
    ticketId: 'AMZ-TKT-2024-001',
    marketplace: 'Amazon',
    ticketType: 'payment_discrepancy',
    priority: 'high',
    status: 'open',
    subject: 'Payment discrepancy for Order ORD-2024-001',
    description: 'Expected ₹1,299 but received ₹1,250. Discrepancy of ₹49.',
    orderId: 'ORD-2024-001',
    utr: 'UTR202401001',
    amount: 49,
    assignedTo: 'Rahul Sharma',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T14:20:00Z',
    customerEmail: 'customer1@email.com',
    tags: ['payment', 'discrepancy', 'urgent'],
    comments: [
      {
        id: 'C001',
        author: 'System',
        message: 'Ticket auto-generated due to payment discrepancy detection.',
        timestamp: '2024-01-15T10:30:00Z',
        type: 'internal'
      },
      {
        id: 'C002',
        author: 'Rahul Sharma',
        message: 'Investigating the payment gateway logs for this transaction.',
        timestamp: '2024-01-15T11:15:00Z',
        type: 'internal'
      }
    ]
  },
  {
    id: 'TKT002',
    ticketId: 'FLP-TKT-2024-002',
    marketplace: 'Flipkart',
    ticketType: 'return_issue',
    priority: 'medium',
    status: 'in_progress',
    subject: 'Return processing delay for SKU JEANS-BK-L',
    description: 'Customer return approved but refund not processed after 7 days.',
    orderId: 'ORD-2024-002',
    amount: 2499,
    assignedTo: 'Priya Patel',
    createdAt: '2024-01-16T09:45:00Z',
    updatedAt: '2024-01-17T16:30:00Z',
    customerEmail: 'customer2@email.com',
    tags: ['return', 'refund', 'delay'],
    comments: [
      {
        id: 'C003',
        author: 'Customer',
        message: 'When will my refund be processed? It has been a week.',
        timestamp: '2024-01-16T09:45:00Z',
        type: 'customer'
      },
      {
        id: 'C004',
        author: 'Priya Patel',
        message: 'Escalated to Flipkart support team. Tracking ID: FLP-REF-12345',
        timestamp: '2024-01-17T10:20:00Z',
        type: 'internal'
      }
    ]
  },
  {
    id: 'TKT003',
    ticketId: 'MYN-TKT-2024-003',
    marketplace: 'Myntra',
    ticketType: 'quality_complaint',
    priority: 'low',
    status: 'resolved',
    subject: 'Quality issue with Summer Dress - Red',
    description: 'Customer reported poor stitching quality. Return approved.',
    orderId: 'ORD-2024-003',
    amount: 1899,
    assignedTo: 'Amit Kumar',
    createdAt: '2024-01-14T14:20:00Z',
    updatedAt: '2024-01-18T11:45:00Z',
    resolutionTime: 96,
    customerEmail: 'customer3@email.com',
    tags: ['quality', 'return', 'resolved'],
    comments: [
      {
        id: 'C005',
        author: 'Customer',
        message: 'The dress has loose threads and poor stitching.',
        timestamp: '2024-01-14T14:20:00Z',
        type: 'customer'
      },
      {
        id: 'C006',
        author: 'Myntra Support',
        message: 'Return approved. Refund will be processed in 3-5 business days.',
        timestamp: '2024-01-15T09:30:00Z',
        type: 'marketplace'
      },
      {
        id: 'C007',
        author: 'Amit Kumar',
        message: 'Refund processed successfully. Ticket resolved.',
        timestamp: '2024-01-18T11:45:00Z',
        type: 'internal'
      }
    ]
  }
];

export default function TicketManagement() {
  const [tickets] = useState<TicketData[]>(mockTickets);
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    marketplace: '',
    status: '',
    priority: '',
    ticketType: '',
    assignedTo: ''
  });

  const filterOptions = {
    marketplaces: ['Amazon', 'Flipkart', 'Myntra'],
    statuses: ['open', 'in_progress', 'pending_response', 'resolved', 'closed'],
    priorities: ['low', 'medium', 'high', 'critical'],
    ticketTypes: ['payment_discrepancy', 'return_issue', 'order_issue', 'refund_delay', 'quality_complaint', 'other'],
    assignees: ['Rahul Sharma', 'Priya Patel', 'Amit Kumar', 'Sneha Reddy']
  };

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Search filter
      if (searchTerm && !ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !ticket.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !ticket.orderId?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.start && new Date(ticket.createdAt) < new Date(filters.dateRange.start)) {
        return false;
      }
      if (filters.dateRange.end && new Date(ticket.createdAt) > new Date(filters.dateRange.end)) {
        return false;
      }

      // Other filters
      if (filters.marketplace && ticket.marketplace !== filters.marketplace) return false;
      if (filters.status && ticket.status !== filters.status) return false;
      if (filters.priority && ticket.priority !== filters.priority) return false;
      if (filters.ticketType && ticket.ticketType !== filters.ticketType) return false;
      if (filters.assignedTo && ticket.assignedTo !== filters.assignedTo) return false;

      return true;
    });
  }, [tickets, searchTerm, filters]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalTickets = filteredTickets.length;
    const openTickets = filteredTickets.filter(t => t.status === 'open').length;
    const resolvedTickets = filteredTickets.filter(t => t.status === 'resolved').length;
    const avgResolutionTime = filteredTickets
      .filter(t => t.resolutionTime)
      .reduce((sum, t) => sum + (t.resolutionTime || 0), 0) / 
      filteredTickets.filter(t => t.resolutionTime).length || 0;

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      avgResolutionTime: Math.round(avgResolutionTime)
    };
  }, [filteredTickets]);

  const getStatusIcon = (status: TicketData['status']) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'pending_response':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'closed':
        return <CheckCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: TicketData['status']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'open':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      case 'in_progress':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      case 'pending_response':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'resolved':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'closed':
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const getPriorityBadge = (priority: TicketData['priority']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (priority) {
      case 'low':
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
      case 'medium':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'high':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      case 'critical':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
    }
  };

  const getMarketplaceBadge = (marketplace: TicketData['marketplace']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (marketplace) {
      case 'Amazon':
        return `${baseClasses} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      case 'Flipkart':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'Myntra':
        return `${baseClasses} bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400`;
    }
  };

  if (selectedTicket) {
    return (
      <div className="space-y-6">
        {/* Ticket Detail Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Tickets
              </button>
              <h2 className="text-2xl font-bold">Ticket Details</h2>
              <p className="text-teal-100 mt-1">{selectedTicket.ticketId}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>
              <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
                <ExternalLink className="w-4 h-4" />
                <span>Marketplace</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Details */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Ticket Information</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{selectedTicket.subject}</h4>
                  <p className="text-slate-600 dark:text-slate-400 mt-2">{selectedTicket.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Order ID</label>
                    <p className="text-slate-900 dark:text-slate-100">{selectedTicket.orderId || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">UTR</label>
                    <p className="text-slate-900 dark:text-slate-100">{selectedTicket.utr || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount</label>
                    <p className="text-slate-900 dark:text-slate-100">
                      {selectedTicket.amount ? `₹${selectedTicket.amount.toLocaleString()}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Customer Email</label>
                    <p className="text-slate-900 dark:text-slate-100">{selectedTicket.customerEmail || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedTicket.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-full text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Comments & Updates</h3>
              
              <div className="space-y-4 mb-6">
                {selectedTicket.comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{comment.author}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          comment.type === 'internal' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                          comment.type === 'customer' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                          'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                        }`}>
                          {comment.type}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {format(new Date(comment.timestamp), 'MMM dd, yyyy hh:mm a')}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">{comment.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Comment */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex space-x-3">
                  <textarea
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 resize-none"
                    rows={3}
                  />
                  <button className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Priority */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Status & Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusIcon(selectedTicket.status)}
                    <span className={getStatusBadge(selectedTicket.status)}>
                      {selectedTicket.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Priority</label>
                  <div className="mt-1">
                    <span className={getPriorityBadge(selectedTicket.priority)}>
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Marketplace</label>
                  <div className="mt-1">
                    <span className={getMarketplaceBadge(selectedTicket.marketplace)}>
                      {selectedTicket.marketplace}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assigned To</label>
                  <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedTicket.assignedTo || 'Unassigned'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Created</label>
                  <p className="text-slate-900 dark:text-slate-100 mt-1">
                    {format(new Date(selectedTicket.createdAt), 'MMM dd, yyyy hh:mm a')}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Last Updated</label>
                  <p className="text-slate-900 dark:text-slate-100 mt-1">
                    {format(new Date(selectedTicket.updatedAt), 'MMM dd, yyyy hh:mm a')}
                  </p>
                </div>

                {selectedTicket.resolutionTime && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Resolution Time</label>
                    <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedTicket.resolutionTime} hours</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                  <CheckCircle className="w-4 h-4" />
                  <span>Mark as Resolved</span>
                </button>
                
                <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                  <Clock className="w-4 h-4" />
                  <span>Set In Progress</span>
                </button>
                
                <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                  <span>Request Response</span>
                </button>
                
                <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors">
                  <User className="w-4 h-4" />
                  <span>Reassign</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Ticket Management</h2>
            <p className="text-teal-100 mt-1">SaaS-powered support ticket system with marketplace integration</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateTicket(true)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Ticket</span>
            </button>
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Tickets</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalTickets}</p>
            </div>
            <Ticket className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Open Tickets</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.openTickets}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Resolved</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.resolvedTickets}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Resolution</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.avgResolutionTime}h</p>
            </div>
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Support Tickets</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredTickets.length} of {tickets.length} tickets
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Ticket
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Marketplace
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{ticket.ticketId}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{ticket.ticketType.replace('_', ' ')}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{ticket.subject}</div>
                    {ticket.orderId && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">Order: {ticket.orderId}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getMarketplaceBadge(ticket.marketplace)}>
                      {ticket.marketplace}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getPriorityBadge(ticket.priority)}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(ticket.status)}
                      <span className={getStatusBadge(ticket.status)}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 dark:text-slate-100">{ticket.assignedTo || 'Unassigned'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 dark:text-slate-100">
                      {format(new Date(ticket.createdAt), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {format(new Date(ticket.createdAt), 'hh:mm a')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedTicket(ticket)}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 text-sm font-medium flex items-center space-x-1 hover:bg-teal-50 dark:hover:bg-teal-900/20 px-2 py-1 rounded transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFilterChange={setFilters}
        filterOptions={{
          ...filterOptions,
          categories: filterOptions.ticketTypes
        }}
      />
    </div>
  );
}