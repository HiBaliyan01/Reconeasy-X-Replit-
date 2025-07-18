import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle, Info, X, Bell, BellOff,
  TrendingUp, TrendingDown, DollarSign, Package, Clock
} from 'lucide-react';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionable: boolean;
  metadata?: {
    amount?: number;
    orderId?: string;
    marketplace?: string;
    threshold?: number;
  };
}

interface AlertsNotificationCenterProps {
  thresholds?: {
    discrepancyAmount: number;
    returnRate: number;
    overduePayments: number;
  };
}

export default function AlertsNotificationCenter({ 
  thresholds = {
    discrepancyAmount: 10000,
    returnRate: 25,
    overduePayments: 5
  }
}: AlertsNotificationCenterProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  // Mock alert generation based on thresholds
  useEffect(() => {
    const generateAlerts = () => {
      const mockAlerts: Alert[] = [
        {
          id: '1',
          type: 'critical',
          title: 'High Discrepancy Alert',
          message: `Payment discrepancy of ₹${(15000).toLocaleString()} detected for order ORD-2024-001`,
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          read: false,
          actionable: true,
          metadata: {
            amount: 15000,
            orderId: 'ORD-2024-001',
            marketplace: 'Amazon',
            threshold: thresholds.discrepancyAmount
          }
        },
        {
          id: '2',
          type: 'warning',
          title: 'Return Rate Threshold Exceeded',
          message: `Myntra return rate at 28% - above threshold of ${thresholds.returnRate}%`,
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          read: false,
          actionable: true,
          metadata: {
            marketplace: 'Myntra',
            threshold: thresholds.returnRate
          }
        },
        {
          id: '3',
          type: 'warning',
          title: 'Overdue Payments',
          message: `${7} payments are overdue (threshold: ${thresholds.overduePayments})`,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          read: true,
          actionable: true,
          metadata: {
            threshold: thresholds.overduePayments
          }
        },
        {
          id: '4',
          type: 'info',
          title: 'Monthly Report Ready',
          message: 'Your monthly reconciliation report is ready for download',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          read: true,
          actionable: false
        },
        {
          id: '5',
          type: 'success',
          title: 'Auto-Reconciliation Complete',
          message: 'Successfully auto-reconciled 1,247 transactions with 98.5% accuracy',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          read: true,
          actionable: false
        }
      ];
      
      setAlerts(mockAlerts);
    };

    generateAlerts();
    
    // Simulate real-time alerts
    const interval = setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance every 30 seconds
        const newAlert: Alert = {
          id: Date.now().toString(),
          type: Math.random() > 0.7 ? 'critical' : 'warning',
          title: 'New Discrepancy Detected',
          message: `Payment discrepancy of ₹${Math.floor(Math.random() * 20000 + 5000).toLocaleString()} detected`,
          timestamp: new Date().toISOString(),
          read: false,
          actionable: true,
          metadata: {
            amount: Math.floor(Math.random() * 20000 + 5000),
            orderId: `ORD-${Date.now()}`,
            marketplace: ['Amazon', 'Flipkart', 'Myntra'][Math.floor(Math.random() * 3)]
          }
        };
        
        setAlerts(prev => [newAlert, ...prev]);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [thresholds]);

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    }
  };

  const getAlertBgColor = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'success':
        return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unread') return !alert.read;
    if (filter === 'critical') return alert.type === 'critical';
    return true;
  });

  const unreadCount = alerts.filter(alert => !alert.read).length;
  const criticalCount = alerts.filter(alert => alert.type === 'critical' && !alert.read).length;

  const markAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="relative">
      {/* Alert Bell Icon */}
      <button
        onClick={() => setShowAlerts(!showAlerts)}
        className="relative p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
      >
        {unreadCount > 0 ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
            criticalCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
          }`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Alerts Panel */}
      {showAlerts && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Alerts & Notifications
              </h3>
              <button
                onClick={() => setShowAlerts(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              {[
                { id: 'all', label: 'All', count: alerts.length },
                { id: 'unread', label: 'Unread', count: unreadCount },
                { id: 'critical', label: 'Critical', count: criticalCount }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    filter === tab.id
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label} {tab.count > 0 && `(${tab.count})`}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No alerts to show</p>
              </div>
            ) : (
              filteredAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 border-b border-slate-200 dark:border-slate-700 last:border-b-0 ${
                    !alert.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  } hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getAlertIcon(alert.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                            {alert.title}
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {alert.message}
                          </p>
                          
                          {/* Metadata */}
                          {alert.metadata && (
                            <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 mb-2">
                              {alert.metadata.marketplace && (
                                <span className="flex items-center space-x-1">
                                  <Package className="w-3 h-3" />
                                  <span>{alert.metadata.marketplace}</span>
                                </span>
                              )}
                              {alert.metadata.orderId && (
                                <span>Order: {alert.metadata.orderId}</span>
                              )}
                              {alert.metadata.amount && (
                                <span className="flex items-center space-x-1">
                                  <DollarSign className="w-3 h-3" />
                                  <span>₹{alert.metadata.amount.toLocaleString()}</span>
                                </span>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {formatTimestamp(alert.timestamp)}
                            </span>
                            
                            <div className="flex items-center space-x-2">
                              {!alert.read && (
                                <button
                                  onClick={() => markAsRead(alert.id)}
                                  className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200"
                                >
                                  Mark as read
                                </button>
                              )}
                              <button
                                onClick={() => dismissAlert(alert.id)}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {filteredAlerts.length > 0 && (
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <button
                onClick={() => setAlerts(prev => prev.map(alert => ({ ...alert, read: true })))}
                className="w-full text-sm text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 font-medium"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overlay */}
      {showAlerts && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowAlerts(false)}
        />
      )}
    </div>
  );
}