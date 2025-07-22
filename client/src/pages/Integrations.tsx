import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingBag, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Settings, 
  Zap,
  Clock,
  Download
} from 'lucide-react';

interface IntegrationStatus {
  connected: boolean;
  marketplace: string;
  userId: string;
  lastSync?: string;
}

export default function Integrations() {
  const [syncStatus, setSyncStatus] = useState<{ [key: string]: 'idle' | 'syncing' | 'success' | 'error' }>({});
  const queryClient = useQueryClient();

  // Fetch Myntra integration status
  const { data: myntraStatus, isLoading: myntraLoading } = useQuery<IntegrationStatus>({
    queryKey: ['/api/integrations/myntra/status'],
    queryFn: async () => {
      const response = await fetch('/api/integrations/myntra/status?userId=default-user');
      return response.json();
    }
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (marketplace: string) => {
      const response = await fetch(`/api/integrations/${marketplace}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'default-user' })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    }
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (marketplace: string) => {
      setSyncStatus(prev => ({ ...prev, [marketplace]: 'syncing' }));
      const response = await fetch(`/api/integrations/${marketplace}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'default-user' })
      });
      const result = await response.json();
      return result;
    },
    onSuccess: (data, marketplace) => {
      setSyncStatus(prev => ({ ...prev, [marketplace]: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['/api/settlements'] });
      setTimeout(() => {
        setSyncStatus(prev => ({ ...prev, [marketplace]: 'idle' }));
      }, 3000);
    },
    onError: (error, marketplace) => {
      setSyncStatus(prev => ({ ...prev, [marketplace]: 'error' }));
      setTimeout(() => {
        setSyncStatus(prev => ({ ...prev, [marketplace]: 'idle' }));
      }, 3000);
    }
  });

  const handleConnect = (marketplace: string) => {
    window.location.href = `/api/integrations/${marketplace}/connect?userId=default-user`;
  };

  const handleDisconnect = (marketplace: string) => {
    if (confirm(`Are you sure you want to disconnect ${marketplace}?`)) {
      disconnectMutation.mutate(marketplace);
    }
  };

  const handleSync = (marketplace: string) => {
    syncMutation.mutate(marketplace);
  };

  const getSyncButtonText = (marketplace: string) => {
    const status = syncStatus[marketplace] || 'idle';
    switch (status) {
      case 'syncing': return 'Syncing...';
      case 'success': return 'Synced!';
      case 'error': return 'Sync Failed';
      default: return 'Sync Data';
    }
  };

  const getSyncButtonIcon = (marketplace: string) => {
    const status = syncStatus[marketplace] || 'idle';
    switch (status) {
      case 'syncing': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'success': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Download className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Marketplace Integrations</h2>
            <p className="text-blue-100 mt-1">Connect your marketplace accounts for automated data sync</p>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Myntra Integration Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-pink-50 dark:bg-pink-900/20 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Myntra</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Fashion Marketplace</p>
                </div>
              </div>
              
              {myntraLoading ? (
                <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin"></div>
              ) : myntraStatus?.connected ? (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">Not Connected</span>
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Automatically sync settlement data, orders, and reconciliation reports from your Myntra seller account.
            </p>

            {myntraStatus?.connected ? (
              <div className="space-y-3">
                <button
                  onClick={() => handleSync('myntra')}
                  disabled={syncStatus['myntra'] === 'syncing'}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    syncStatus['myntra'] === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                      : syncStatus['myntra'] === 'error'
                      ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                      : syncStatus['myntra'] === 'syncing'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                      : 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800 dark:hover:bg-pink-900/30'
                  }`}
                >
                  {getSyncButtonIcon('myntra')}
                  <span>{getSyncButtonText('myntra')}</span>
                </button>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleConnect('myntra')}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  
                  <button
                    onClick={() => handleDisconnect('myntra')}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleConnect('myntra')}
                className="w-full flex items-center justify-center space-x-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Connect Myntra</span>
              </button>
            )}
          </div>
        </div>

        {/* Coming Soon Cards */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 opacity-60">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Amazon</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">E-commerce Platform</p>
                </div>
              </div>
              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Amazon Seller Central integration for automated settlement sync.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 opacity-60">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Flipkart</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">E-commerce Platform</p>
                </div>
              </div>
              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Flipkart Seller Hub integration for comprehensive data sync.
            </p>
          </div>
        </div>
      </div>

      {/* Integration Benefits */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Integration Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Download className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100">Automated Data Sync</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Automatically pull settlement data without manual CSV uploads
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100">Real-time Updates</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Get the latest settlement information as soon as it's available
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100">Enhanced Accuracy</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Reduce manual errors with direct API integration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}