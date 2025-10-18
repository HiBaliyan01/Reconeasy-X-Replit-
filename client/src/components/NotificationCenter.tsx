import React, { useState, useEffect } from 'react';
import { Bell, Settings, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { invokeSupabaseFunction } from '@/utils/supabaseFunctions';

interface ExpiryNotification {
  id: string;
  platform_id: string;
  category_id: string;
  effective_to: string;
  daysUntilExpiry: number;
  status: 'warning' | 'urgent' | 'expired';
  message: string;
}

interface NotificationConfig {
  warningDays: number;
  reminderDays: number;
  emailEnabled: boolean;
  webhookUrl?: string;
}

export default function NotificationCenter() {
  const [showPanel, setShowPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<NotificationConfig>({
    warningDays: 30,
    reminderDays: 7,
    emailEnabled: false,
    webhookUrl: ''
  });

  // Fetch current notifications
  const { data: notifications = [], isLoading, refetch } = useQuery<ExpiryNotification[]>({
    queryKey: ['/api/notifications/expiring'],
    queryFn: async () => {
      try {
        const response = await axios.get('/api/notifications/expiring', { validateStatus: () => true });
        const data = response.data;
        return Array.isArray(data) ? data : [];
      } catch (_) {
        return [];
      }
    },
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch notification config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const remoteConfig = await invokeSupabaseFunction<NotificationConfig>("notifications-config");
        if (remoteConfig && typeof remoteConfig === 'object') {
          setConfig((prev) => ({ ...prev, ...remoteConfig }));
        }
      } catch (error) {
        console.error("Failed to load notification config from Supabase:", error);
      }
    };
    fetchConfig();
  }, []);

  const updateConfig = async (newConfig: Partial<NotificationConfig>) => {
    try {
      await axios.put('/api/notifications/config', newConfig);
      setConfig(prev => ({ ...prev, ...newConfig }));
    } catch (error) {
      console.error('Error updating notification config:', error);
    }
  };

  const triggerManualCheck = async () => {
    try {
      await axios.post('/api/notifications/check');
      refetch();
    } catch (error) {
      console.error('Error triggering manual check:', error);
    }
  };

  const getNotificationColor = (status: string) => {
    switch (status) {
      case 'expired': return 'text-red-600 dark:text-red-400';
      case 'urgent': return 'text-orange-600 dark:text-orange-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'expired': return <X className="w-4 h-4 text-red-500" />;
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'warning': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const urgentCount = notifications.filter(n => n.status === 'urgent' || n.status === 'expired').length;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
      >
        <Bell className="w-6 h-6" />
        {urgentCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {urgentCount > 9 ? '9+' : urgentCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {showPanel && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50">
          <div className="p-4 border-b dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Rate Card Notifications
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={triggerManualCheck}
                  className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400"
                >
                  Check Now
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Notification Settings
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">
                    Warning Period (days)
                  </label>
                  <input
                    type="number"
                    value={config.warningDays}
                    onChange={(e) => updateConfig({ warningDays: parseInt(e.target.value) })}
                    className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                    min="1"
                    max="365"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">
                    Final Reminder (days)
                  </label>
                  <input
                    type="number"
                    value={config.reminderDays}
                    onChange={(e) => updateConfig({ reminderDays: parseInt(e.target.value) })}
                    className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                    min="1"
                    max="365"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">
                    Webhook URL (optional)
                  </label>
                  <input
                    type="url"
                    value={config.webhookUrl || ''}
                    onChange={(e) => updateConfig({ webhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/..."
                    className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                All rate cards are up to date!
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {notifications.map((notification) => (
                  <div key={notification.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <div className="flex items-start space-x-3">
                      {getStatusIcon(notification.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.platform_id} - {notification.category_id}
                          </p>
                          <span className={`text-xs font-medium ${getNotificationColor(notification.status)}`}>
                            {notification.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Expires: {notification.effective_to}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {notification.daysUntilExpiry < 0 
                            ? `Expired ${Math.abs(notification.daysUntilExpiry)} days ago`
                            : `${notification.daysUntilExpiry} days remaining`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-b-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Last checked: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
