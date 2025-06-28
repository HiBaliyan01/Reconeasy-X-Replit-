import React, { useState } from 'react';
import { 
  BarChart3, TrendingUp, RefreshCw, AlertTriangle, Home, FileText, 
  Settings, Search, Bell, User, Moon, Sun, Menu, X, Filter,
  Zap, Shield, Database, Activity, Ticket, Package, Users,
  CreditCard, PieChart
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, badge: null },
    { id: 'analytics', label: 'Analytics', icon: PieChart, badge: 'AI' },
    { id: 'transactions', label: 'Transactions', icon: FileText, badge: '1.2k' },
    { id: 'payments', label: 'Payment Reconciliation', icon: CreditCard, badge: '8' },
    { id: 'settlements', label: 'Settlements', icon: Database, badge: '3' },
    { id: 'returns', label: 'Returns', icon: RefreshCw, badge: '45' },
    { id: 'return-reconciliation', label: 'Return Reconciliation', icon: Package, badge: '12' },
    { id: 'reconciliation', label: 'UTR Reconciliation', icon: BarChart3, badge: '8' },
    { id: 'forecast', label: 'AI Forecast', icon: TrendingUp, badge: null },
    { id: 'automation', label: 'Automation', icon: Zap, badge: 'New' },
    { id: 'tickets', label: 'Tickets', icon: Ticket, badge: '8' },
    { id: 'audit', label: 'Audit Trail', icon: Shield, badge: null },
    { id: 'users', label: 'User Management', icon: Users, badge: null },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Enhanced Header */}
      <header className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Mobile Menu */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              
              <Logo size="md" variant="full" />
              
              <div className="hidden lg:flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>Real-time Sync Active</span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search transactions, UTRs, or SKUs..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-400 dark:focus:border-teal-400 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-colors"
                />
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-3">
              {/* Quick Actions */}
              <div className="hidden lg:flex items-center space-x-2">
                <button className="flex items-center space-x-2 px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors text-sm font-medium">
                  <Zap className="w-4 h-4" />
                  <span>Auto Reconcile</span>
                </button>
                <button className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <Filter className="w-5 h-5" />
                </button>
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {/* User Menu */}
              <button className="flex items-center space-x-2 p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <User className="w-5 h-5" />
                <span className="hidden sm:block text-sm font-medium">Admin</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Enhanced Sidebar */}
          <aside className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-64 flex-shrink-0`}>
            <nav className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sticky top-24">
              <div className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTab === item.id
                          ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg transform scale-105'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-teal-50 dark:hover:bg-slate-700 hover:scale-105'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          activeTab === item.id
                            ? 'bg-white/20 text-white'
                            : item.badge === 'New' || item.badge === 'AI'
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* System Status */}
              <div className="mt-6 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center space-x-2 mb-2">
                  <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">System Status</span>
                </div>
                <div className="space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <div className="flex justify-between">
                    <span>API Health</span>
                    <span className="text-emerald-600 dark:text-emerald-400">●</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Sync</span>
                    <span>2 min ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Accuracy</span>
                    <span>98.7%</span>
                  </div>
                </div>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>

      {/* Enhanced ChatBot */}
      <ChatBot />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}