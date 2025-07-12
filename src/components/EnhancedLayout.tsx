import React, { useState } from 'react';
import { 
  BarChart3, TrendingUp, RefreshCw, AlertTriangle, Home, FileText, 
  Settings, Search, Bell, User, Moon, Sun, Menu, X, Filter,
  Zap, Shield, Database, Activity, Ticket, Package, Users,
  CreditCard, PieChart, Link, ChevronDown, HelpCircle
} from 'lucide-react';
import Logo from './Logo';
import { useTheme } from './ThemeProvider';
import ChatBot from './ChatBot';

interface EnhancedLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function EnhancedLayout({ children, activeTab, onTabChange }: EnhancedLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications] = useState(3);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: Home, 
      badge: null,
      description: 'Overview & key metrics'
    },
    { 
      id: 'analytics', 
      label: 'Analytics', 
      icon: PieChart, 
      badge: 'AI',
      description: 'AI-powered insights'
    },
    { 
      id: 'settlements', 
      label: 'Settlements', 
      icon: Database, 
      badge: '15',
      description: 'Payment settlements'
    },
    { 
      id: 'transactions', 
      label: 'Transactions', 
      icon: FileText, 
      badge: '1.2k',
      description: 'UTR reconciliation'
    },
    { 
      id: 'returns', 
      label: 'Returns', 
      icon: RefreshCw, 
      badge: '45',
      description: 'Return analytics'
    },
    { 
      id: 'tickets', 
      label: 'Support', 
      icon: Ticket, 
      badge: '8',
      description: 'Ticket management'
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Settings, 
      badge: null,
      description: 'System configuration'
    }
  ];

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      console.log('Global search:', globalSearch);
    }
  };

  const quickActions = [
    { label: 'Auto Reconcile', icon: Zap, action: () => console.log('Auto reconcile') },
    { label: 'Generate Report', icon: FileText, action: () => console.log('Generate report') },
    { label: 'View Analytics', icon: BarChart3, action: () => onTabChange('analytics') },
    { label: 'Help Center', icon: HelpCircle, action: () => console.log('Help center') }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-all duration-300">
      {/* Enhanced Header */}
      <header className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Mobile Menu */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              
              <Logo size="md" variant="full" />
              
              <div className="hidden lg:flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Live Sync Active</span>
              </div>
            </div>

            {/* Enhanced Search Bar */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8">
              <form onSubmit={handleGlobalSearch} className="relative w-full group">
                <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-teal-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search orders, returns, tickets, SKUs..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-100/80 dark:bg-slate-700/80 border border-slate-200/50 dark:border-slate-600/50 rounded-2xl focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 dark:focus:ring-teal-400/50 dark:focus:border-teal-400 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-all duration-200 backdrop-blur-sm"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <kbd className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 rounded">⌘K</kbd>
                </div>
              </form>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-2">
              {/* Quick Actions */}
              <div className="hidden xl:flex items-center space-x-2">
                {quickActions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm font-medium"
                  >
                    <action.icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>

              {/* Notifications */}
              <div className="relative">
                <button className="relative p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200">
                  <Bell className="w-5 h-5" />
                  {notifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                      {notifications}
                    </span>
                  )}
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    A
                  </div>
                  <span className="hidden sm:block text-sm font-medium">Admin</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Admin User</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">admin@reconeasy.com</p>
                    </div>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                      Profile Settings
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Enhanced Sidebar */}
          <aside className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-72 flex-shrink-0`}>
            <nav className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 sticky top-24">
              {/* Quick Stats */}
              <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-xl border border-teal-200/50 dark:border-teal-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-teal-700 dark:text-teal-300">Today's Summary</span>
                  <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-bold text-teal-900 dark:text-teal-100">₹2.4L</div>
                    <div className="text-teal-600 dark:text-teal-400">Processed</div>
                  </div>
                  <div>
                    <div className="font-bold text-teal-900 dark:text-teal-100">95%</div>
                    <div className="text-teal-600 dark:text-teal-400">Auto-matched</div>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full group relative overflow-hidden rounded-xl transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg transform scale-105'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:scale-102'
                      }`}
                    >
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg transition-colors ${
                            isActive 
                              ? 'bg-white/20' 
                              : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-medium">{item.label}</div>
                            <div className={`text-xs ${
                              isActive 
                                ? 'text-white/80' 
                                : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              {item.description}
                            </div>
                          </div>
                        </div>
                        {item.badge && (
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : item.badge === 'New' || item.badge === 'AI'
                              ? 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 text-orange-600 dark:text-orange-400'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* System Status */}
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50">
                <div className="flex items-center space-x-2 mb-3">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">System Health</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-700 dark:text-emerald-300">API Status</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300">Last Sync</span>
                    <span className="text-emerald-600 dark:text-emerald-400">2 min ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300">Accuracy</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">98.7%</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.slice(2).map((action, index) => (
                    <button
                      key={index}
                      onClick={action.action}
                      className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 group"
                    >
                      <action.icon className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 mb-1" />
                      <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 text-center">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Enhanced ChatBot */}
      <ChatBot />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* User Menu Overlay */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-30"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  );
}