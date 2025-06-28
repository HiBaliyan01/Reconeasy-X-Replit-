import React, { useState, useMemo } from 'react';
import { 
  Shield, AlertTriangle, CheckCircle, Clock, User, Search, Filter,
  Calendar, Download, Eye, Activity, FileText, Database
} from 'lucide-react';
import { format } from 'date-fns';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  risk_flag: boolean;
  ip_address: string;
  user_agent: string;
  module: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failed' | 'warning';
}

interface EventAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  acknowledged: boolean;
  source: string;
}

const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'LOG001',
    timestamp: '2024-01-20T10:30:00Z',
    user: 'admin@reconeasy.com',
    action: 'ticket_create',
    details: 'Created payment discrepancy ticket TKT-2024-001 for Order ORD-2024-001',
    risk_flag: false,
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    module: 'Ticket Management',
    severity: 'low',
    status: 'success'
  },
  {
    id: 'LOG002',
    timestamp: '2024-01-20T11:15:00Z',
    user: 'manager@reconeasy.com',
    action: 'payment_reconcile',
    details: 'Manually reconciled payment UTR202401001 with discrepancy of ₹49',
    risk_flag: true,
    ip_address: '192.168.1.101',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    module: 'Payment Reconciliation',
    severity: 'medium',
    status: 'success'
  },
  {
    id: 'LOG003',
    timestamp: '2024-01-20T12:45:00Z',
    user: 'analyst@reconeasy.com',
    action: 'return_flag_fraud',
    details: 'Flagged return RET-2024-003 as fraudulent - wrong item received',
    risk_flag: true,
    ip_address: '192.168.1.102',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    module: 'Return Management',
    severity: 'high',
    status: 'success'
  },
  {
    id: 'LOG004',
    timestamp: '2024-01-20T14:20:00Z',
    user: 'system',
    action: 'auto_reconcile_failed',
    details: 'Failed to auto-reconcile 5 transactions due to API timeout',
    risk_flag: true,
    ip_address: 'system',
    user_agent: 'ReconEasy-System/1.0',
    module: 'Auto Reconciliation',
    severity: 'critical',
    status: 'failed'
  }
];

const mockEventAlerts: EventAlert[] = [
  {
    id: 'ALERT001',
    type: 'fraud_detection',
    message: 'Unusual pattern detected: 5 fraudulent returns from same pincode 400001',
    severity: 'high',
    created_at: '2024-01-20T09:30:00Z',
    acknowledged: false,
    source: 'AI Fraud Detection'
  },
  {
    id: 'ALERT002',
    type: 'payment_delay',
    message: 'Payment settlement delayed for Myntra - 15 transactions pending',
    severity: 'medium',
    created_at: '2024-01-20T10:45:00Z',
    acknowledged: true,
    source: 'Payment Monitor'
  },
  {
    id: 'ALERT003',
    type: 'api_failure',
    message: 'Amazon SP-API connection failed - auto-sync disabled',
    severity: 'critical',
    created_at: '2024-01-20T11:20:00Z',
    acknowledged: false,
    source: 'Integration Monitor'
  }
];

export default function AuditTrailDashboard() {
  const [auditLogs] = useState<AuditLogEntry[]>(mockAuditLogs);
  const [eventAlerts] = useState<EventAlert[]>(mockEventAlerts);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [dateRange, setDateRange] = useState('today');

  // Filter logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (searchTerm && !log.details.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !log.user.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !log.action.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
      if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
      return true;
    });
  }, [auditLogs, searchTerm, severityFilter, moduleFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalLogs = filteredLogs.length;
    const riskFlags = filteredLogs.filter(log => log.risk_flag).length;
    const failedActions = filteredLogs.filter(log => log.status === 'failed').length;
    const criticalEvents = filteredLogs.filter(log => log.severity === 'critical').length;
    
    return { totalLogs, riskFlags, failedActions, criticalEvents };
  }, [filteredLogs]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'low':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (severity) {
      case 'low':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'medium':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      case 'high':
        return `${baseClasses} bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400`;
      case 'critical':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'success':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'failed':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      case 'warning':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      default:
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    // In real implementation, this would call an API
    console.log('Acknowledging alert:', alertId);
  };

  if (selectedLog) {
    return (
      <div className="space-y-6">
        {/* Log Detail Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Audit Trail
              </button>
              <h2 className="text-2xl font-bold">Audit Log Details</h2>
              <p className="text-teal-100 mt-1">{selectedLog.id}</p>
            </div>
            <div className="flex items-center space-x-2">
              {getSeverityIcon(selectedLog.severity)}
              <span className={getSeverityBadge(selectedLog.severity)}>
                {selectedLog.severity}
              </span>
            </div>
          </div>
        </div>

        {/* Log Details */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">Log Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Timestamp</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedLog.timestamp), 'PPpp')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">User</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedLog.user}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Action</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedLog.action}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Module</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedLog.module}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">IP Address</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedLog.ip_address}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <div className="mt-1">
                  <span className={getStatusBadge(selectedLog.status)}>
                    {selectedLog.status}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Risk Flag</label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    selectedLog.risk_flag 
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  }`}>
                    {selectedLog.risk_flag ? 'High Risk' : 'Normal'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Severity</label>
                <div className="mt-1">
                  <span className={getSeverityBadge(selectedLog.severity)}>
                    {selectedLog.severity}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Details</label>
            <p className="text-slate-900 dark:text-slate-100 mt-2 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              {selectedLog.details}
            </p>
          </div>
          
          <div className="mt-6">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">User Agent</label>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm font-mono">
              {selectedLog.user_agent}
            </p>
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
            <h2 className="text-2xl font-bold">Audit Trail Dashboard</h2>
            <p className="text-teal-100 mt-1">Comprehensive system activity monitoring and security tracking</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Logs</span>
            </button>
            <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
              <Filter className="w-4 h-4" />
              <span>Advanced Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Logs</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalLogs}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Risk Flags</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.riskFlags}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Failed Actions</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.failedActions}</p>
            </div>
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Critical Events</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.criticalEvents}</p>
            </div>
            <Database className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Event Alerts */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Event Alerts & Notifications</h3>
        
        <div className="space-y-3">
          {eventAlerts.map((alert) => (
            <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
              alert.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/10' :
              alert.severity === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' :
              alert.severity === 'medium' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' :
              'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    {getSeverityIcon(alert.severity)}
                    <span className="font-medium text-slate-900 dark:text-slate-100">{alert.type.replace('_', ' ')}</span>
                    <span className={getSeverityBadge(alert.severity)}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">{alert.message}</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Source: {alert.source}</span>
                    <span>{format(new Date(alert.created_at), 'MMM dd, yyyy hh:mm a')}</span>
                  </div>
                </div>
                
                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="ml-4 px-3 py-1 bg-slate-500 text-white text-xs rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Audit Logs</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredLogs.length} of {auditLogs.length} logs
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
              />
            </div>
            
            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            
            {/* Module Filter */}
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Modules</option>
              <option value="Ticket Management">Ticket Management</option>
              <option value="Payment Reconciliation">Payment Reconciliation</option>
              <option value="Return Management">Return Management</option>
              <option value="Auto Reconciliation">Auto Reconciliation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                  log.risk_flag ? 'bg-red-50 dark:bg-red-900/10' : ''
                }`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-900 dark:text-slate-100">{log.user}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {log.module}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getSeverityIcon(log.severity)}
                      <span className={getSeverityBadge(log.severity)}>
                        {log.severity}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(log.status)}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      log.risk_flag 
                        ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    }`}>
                      {log.risk_flag ? 'High' : 'Normal'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedLog(log)}
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
    </div>
  );
}