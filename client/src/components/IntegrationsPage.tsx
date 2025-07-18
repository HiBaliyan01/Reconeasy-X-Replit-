import React, { useState, useMemo } from 'react';
import { 
  Link, CheckCircle, AlertCircle, Clock, Settings, 
  Zap, Shield, Database, RefreshCw, Plus, Trash2
} from 'lucide-react';

interface Integration {
  id: string;
  platform: string;
  platform_type: 'marketplace' | 'website_storefront' | 'wms' | 'accounting';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  last_sync: string | null;
  api_key?: string;
  logo: string;
  description: string;
  features: string[];
}

const mockIntegrations: Integration[] = [
  // Marketplaces
  {
    id: 'INT001',
    platform: 'Amazon',
    platform_type: 'marketplace',
    status: 'connected',
    last_sync: '2024-01-20T10:30:00Z',
    logo: '/logos/amazon.png',
    description: 'Amazon India SP-API integration for orders and returns',
    features: ['Order Management', 'Return Processing', 'Settlement Tracking']
  },
  {
    id: 'INT002',
    platform: 'Flipkart',
    platform_type: 'marketplace',
    status: 'connected',
    last_sync: '2024-01-20T10:25:00Z',
    logo: '/logos/flipkart.png',
    description: 'Flipkart Seller API for comprehensive e-commerce management',
    features: ['Inventory Sync', 'Order Processing', 'Return Management']
  },
  {
    id: 'INT003',
    platform: 'Myntra',
    platform_type: 'marketplace',
    status: 'connected',
    last_sync: '2024-01-20T10:20:00Z',
    logo: '/logos/myntra.png',
    description: 'Myntra fashion marketplace integration',
    features: ['Fashion Analytics', 'Return Insights', 'Trend Analysis']
  },
  {
    id: 'INT004',
    platform: 'Ajio',
    platform_type: 'marketplace',
    status: 'disconnected',
    last_sync: null,
    logo: '/logos/ajio.png',
    description: 'Ajio marketplace integration for fashion retail',
    features: ['Order Sync', 'Return Processing', 'Analytics']
  },
  {
    id: 'INT005',
    platform: 'Nykaa',
    platform_type: 'marketplace',
    status: 'disconnected',
    last_sync: null,
    logo: '/logos/nykaa.png',
    description: 'Nykaa beauty and fashion marketplace',
    features: ['Beauty Analytics', 'Order Management', 'Customer Insights']
  },
  // Website Storefronts
  {
    id: 'INT006',
    platform: 'Shopify',
    platform_type: 'website_storefront',
    status: 'disconnected',
    last_sync: null,
    logo: '/logos/shopify.png',
    description: 'Shopify e-commerce platform integration',
    features: ['Store Management', 'Order Processing', 'Inventory Sync']
  },
  {
    id: 'INT007',
    platform: 'WooCommerce',
    platform_type: 'website_storefront',
    status: 'disconnected',
    last_sync: null,
    logo: '/logos/woocommerce.png',
    description: 'WooCommerce WordPress e-commerce integration',
    features: ['WordPress Integration', 'Order Management', 'Analytics']
  },
  {
    id: 'INT008',
    platform: 'Magento',
    platform_type: 'website_storefront',
    status: 'disconnected',
    last_sync: null,
    logo: '/logos/magento.png',
    description: 'Magento enterprise e-commerce platform',
    features: ['Enterprise Features', 'Advanced Analytics', 'Multi-store']
  },
  // WMS (Only one connected)
  {
    id: 'INT009',
    platform: 'Increff',
    platform_type: 'wms',
    status: 'connected',
    last_sync: '2024-01-20T10:35:00Z',
    logo: '/logos/increff.png',
    description: 'Increff WMS for warehouse management and return processing',
    features: ['Warehouse Management', 'Return Processing', 'Inventory Tracking']
  },
  {
    id: 'INT010',
    platform: 'EasyEcom',
    platform_type: 'wms',
    status: 'disconnected',
    last_sync: null,
    logo: '/logos/easyecom.png',
    description: 'EasyEcom inventory and warehouse management',
    features: ['Multi-channel Inventory', 'Order Fulfillment', 'Analytics']
  },
  {
    id: 'INT011',
    platform: 'Unicommerce',
    platform_type: 'wms',
    status: 'disconnected',
    last_sync: null,
    logo: '/logos/unicommerce.png',
    description: 'Unicommerce e-commerce management platform',
    features: ['Order Management', 'Inventory Control', 'Multi-channel Sync']
  }
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Filter integrations by type
  const filteredIntegrations = useMemo(() => {
    if (selectedType === 'all') return integrations;
    return integrations.filter(integration => integration.platform_type === selectedType);
  }, [integrations, selectedType]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const connected = integrations.filter(i => i.status === 'connected').length;
    const total = integrations.length;
    const wmsConnected = integrations.filter(i => i.platform_type === 'wms' && i.status === 'connected').length;
    const marketplacesConnected = integrations.filter(i => i.platform_type === 'marketplace' && i.status === 'connected').length;
    
    return { connected, total, wmsConnected, marketplacesConnected };
  }, [integrations]);

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'disconnected':
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: Integration['status']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'connected':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'disconnected':
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
      case 'error':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      case 'syncing':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
    }
  };

  const getTypeIcon = (type: Integration['platform_type']) => {
    switch (type) {
      case 'marketplace':
        return <Database className="w-5 h-5 text-orange-500" />;
      case 'website_storefront':
        return <Link className="w-5 h-5 text-purple-500" />;
      case 'wms':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'accounting':
        return <Settings className="w-5 h-5 text-emerald-500" />;
    }
  };

  const handleConnect = (integration: Integration) => {
    // For WMS, disconnect others first
    if (integration.platform_type === 'wms') {
      setIntegrations(prev => prev.map(i => 
        i.platform_type === 'wms' && i.id !== integration.id 
          ? { ...i, status: 'disconnected' as const, last_sync: null }
          : i
      ));
    }
    
    setIntegrations(prev => prev.map(i => 
      i.id === integration.id 
        ? { ...i, status: 'connected' as const, last_sync: new Date().toISOString() }
        : i
    ));
  };

  const handleDisconnect = (integration: Integration) => {
    setIntegrations(prev => prev.map(i => 
      i.id === integration.id 
        ? { ...i, status: 'disconnected' as const, last_sync: null }
        : i
    ));
  };

  const handleSync = (integration: Integration) => {
    setIntegrations(prev => prev.map(i => 
      i.id === integration.id 
        ? { ...i, status: 'syncing' as const }
        : i
    ));
    
    // Simulate sync completion
    setTimeout(() => {
      setIntegrations(prev => prev.map(i => 
        i.id === integration.id 
          ? { ...i, status: 'connected' as const, last_sync: new Date().toISOString() }
          : i
      ));
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Platform Integrations</h2>
            <p className="text-teal-100 mt-1">Connect with marketplaces, website storefronts, WMS, and accounting systems</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm text-teal-100">Connected Platforms</div>
              <div className="text-2xl font-bold">{metrics.connected}/{metrics.total}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Integrations</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.total}</p>
            </div>
            <Link className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Connected</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.connected}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Marketplaces</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.marketplacesConnected}</p>
            </div>
            <Database className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">WMS Active</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.wmsConnected}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Only one WMS allowed</p>
            </div>
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            {[
              { id: 'all', label: 'All Platforms' },
              { id: 'marketplace', label: 'Marketplaces' },
              { id: 'website_storefront', label: 'Website Storefronts' },
              { id: 'wms', label: 'WMS Systems' }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedType(id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedType === id
                    ? 'bg-teal-500 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {filteredIntegrations.length} platforms
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => (
          <div key={integration.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <img 
                    src={integration.logo} 
                    alt={`${integration.platform} logo`}
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden w-8 h-8 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                    {integration.platform[0]}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{integration.platform}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    {getTypeIcon(integration.platform_type)}
                    <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                      {integration.platform_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(integration.status)}
                <span className={getStatusBadge(integration.status)}>
                  {integration.status}
                </span>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {integration.description}
            </p>
            
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Features</h4>
              <div className="flex flex-wrap gap-1">
                {integration.features.map((feature, index) => (
                  <span key={index} className="px-2 py-1 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-full text-xs">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            
            {integration.last_sync && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Last sync: {new Date(integration.last_sync).toLocaleString()}
              </p>
            )}
            
            <div className="flex space-x-2">
              {integration.status === 'connected' ? (
                <>
                  <button
                    onClick={() => handleSync(integration)}
                    disabled={integration.status === 'syncing'}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${integration.status === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={() => handleDisconnect(integration)}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleConnect(integration)}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Connect</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Integration Status Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Integration Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">99.2%</div>
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Uptime</div>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">2 min</div>
            <div className="text-sm text-blue-700 dark:text-blue-300">Last Sync</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">1.2M</div>
            <div className="text-sm text-purple-700 dark:text-purple-300">Records Synced</div>
          </div>
          <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">0</div>
            <div className="text-sm text-amber-700 dark:text-amber-300">Sync Errors</div>
          </div>
        </div>
      </div>
    </div>
  );
}