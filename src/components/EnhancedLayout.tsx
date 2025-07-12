import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, RefreshCw, AlertTriangle, Home, FileText, 
  Settings, Search, Bell, User, Moon, Sun, Menu, X, Filter,
  Zap, Shield, Database, Activity, Ticket, Package, Users,
  CreditCard, PieChart, Link, ChevronDown, HelpCircle, ChevronLeft,
  ChevronRight, Download, Printer, Info, Eye, EyeOff
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications] = useState(3);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userRole] = useState('admin'); // admin, manager, analyst, viewer

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: Home, 
      badge: null,
      description: 'Overview & key metrics',
      shortLabel: 'Home'
    },
    { 
      id: 'analytics', 
      label: 'Analytics', 
      icon: PieChart, 
      badge: 'AI',
      description: 'AI-powered insights',
      shortLabel: 'Analytics'
    },
    { 
      id: 'settlements', 
      label: 'Settlements', 
      icon: Database, 
      badge: '15',
      description: 'Payment settlements',
      shortLabel: 'Settle'
    },
    { 
      id: 'transactions', 
      label: 'Transactions', 
      icon: FileText, 
      badge: '1.2k',
      description: 'UTR reconciliation',
      shortLabel: 'Trans'
    },
    { 
      id: 'returns', 
      label: 'Returns', 
      icon: RefreshCw, 
      badge: '45',
      description: 'Return analytics',
      shortLabel: 'Returns'
    },
    { 
      id: 'tickets', 
      label: 'Support', 
      icon: Ticket, 
      badge: '8',
      description: 'Ticket management',
      shortLabel: 'Support'
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Settings, 
      badge: null,
      description: 'System configuration',
      shortLabel: 'Config'
    }
  ];

  const mockNotifications = [
    { id: 1, type: 'alert', message: 'High discrepancy detected: ₹15,000', time: '2 min ago', read: false },
    { id: 2, type: 'info', message: 'Monthly report ready for download', time: '1 hour ago', read: false },
    { id: 3, type: 'success', message: 'Auto-reconciliation completed', time: '3 hours ago', read: true }
  ];

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      console.log('Global search:', globalSearch);
    }
  };

  const quickActions = [
    { label: 'Auto Reconcile', icon: Zap, action: () => console.log('Auto reconcile'), role: ['admin', 'manager'] },
    { label: 'Generate Report', icon: FileText, action: () => console.log('Generate report'), role: ['admin', 'manager', 'analyst'] },
    { label: 'View Analytics', icon: BarChart3, action: () => onTabChange('analytics'), role: ['admin', 'manager', 'analyst'] },
    { label: 'Help Center', icon: HelpCircle, action: () => setShowOnboarding(true), role: ['admin', 'manager', 'analyst', 'viewer'] }
  ];

  const filteredQuickActions = quickActions.filter(action => action.role.includes(userRole));

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarCollapsed]);

  const OnboardingTooltip = ({ children, content, position = 'bottom' }: { 
    children: React.ReactNode; 
    content: string; 
    position?: 'top' | 'bottom' | 'left' | 'right' 
  }) => {
    const [show, setShow] = useState(false);
    
    if (!showOnboarding) return <>{children}</>;
    
    return (
      <div className="relative inline-block">
        <div 
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          {children}
        </div>
        {show && (
          <div className={`absolute z-50 px-3 py-2 text-sm bg-slate-900 text-white rounded-lg shadow-lg whitespace-nowrap ${
            position === 'bottom' ? 'top-full mt-2 left-1/2 transform -translate-x-1/2' :
            position === 'top' ? 'bottom-full mb-2 left-1/2 transform -translate-x-1/2' :
            position === 'right' ? 'left-full ml-2 top-1/2 transform -translate-y-1/2' :
            'right-full mr-2 top-1/2 transform -translate-y-1/2'
          }`}>
            {content}
            <div className={`absolute w-2 h-2 bg-slate-900 transform rotate-45 ${
              position === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2' :
              position === 'top' ? '-bottom-1 left-1/2 -translate-x-1/2' :
              position === 'right' ? '-left-1 top-1/2 -translate-y-1/2' :
              '-right-1 top-1/2 -translate-y-1/2'
            }`} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-all duration-300">
      {/* Enhanced Header */}
      <header className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Mobile Menu */}
            <div className="flex items-center space-x-4">
              <OnboardingTooltip content="Toggle mobile menu" position="bottom">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                >
                  {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </OnboardingTooltip>
              
              <OnboardingTooltip content="Collapse/expand sidebar (Cmd+B)" position="bottom">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:block p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                >
                  {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
              </OnboardingTooltip>
              
              <Logo size="md" variant="full" />
              
              <div className="hidden lg:flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Live Sync Active</span>
              </div>
            </div>

            {/* Enhanced Search Bar */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8">
              <OnboardingTooltip content="Global search - press Cmd+K to focus" position="bottom">
                <form onSubmit={handleGlobalSearch} className="relative w-full group">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-teal-500 transition-colors" />
                  <input
                    id="global-search"
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
              </OnboardingTooltip>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-2">
              {/* Quick Actions */}
              <div className="hidden xl:flex items-center space-x-2">
                {filteredQuickActions.slice(0, 2).map((action, index) => (
                  <OnboardingTooltip key={index} content={`Quick action: ${action.label}`} position="bottom">
                    <button
                      onClick={action.action}
                      className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm font-medium"
                    >
                      <action.icon className="w-4 h-4" />
                      <span>{action.label}</span>
                    </button>
                  </OnboardingTooltip>
                ))}
              </div>

              {/* Export Actions */}
              <div className="hidden lg:flex items-center space-x-1">
                <OnboardingTooltip content="Download current view as CSV" position="bottom">
                  <button className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200">
                    <Download className="w-5 h-5" />
                  </button>
                </OnboardingTooltip>
                <OnboardingTooltip content="Print current view" position="bottom">
                  <button className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200">
                    <Printer className="w-5 h-5" />
                  </button>
                </OnboardingTooltip>
              </div>

              {/* Notifications */}
              <div className="relative">
                <OnboardingTooltip content="View notifications and alerts" position="bottom">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                  >
                    <Bell className="w-5 h-5" />
                    {notifications > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                        {notifications}
                      </span>
                    )}
                  </button>
                </OnboardingTooltip>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 max-h-96 overflow-y-auto">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                      <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Notifications</h3>
                    </div>
                    {mockNotifications.map((notification) => (
                      <div key={notification.id} className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                        <div className="flex items-start space-x-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            notification.type === 'alert' ? 'bg-red-500' :
                            notification.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <p className="text-sm text-slate-900 dark:text-slate-100">{notification.message}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{notification.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Help Toggle */}
              <OnboardingTooltip content="Toggle help tooltips" position="bottom">
                <button
                  onClick={() => setShowOnboarding(!showOnboarding)}
                  className={`p-2.5 rounded-xl transition-all duration-200 ${
                    showOnboarding 
                      ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' 
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Info className="w-5 h-5" />
                </button>
              </OnboardingTooltip>

              {/* Theme Toggle */}
              <OnboardingTooltip content="Toggle dark/light theme" position="bottom">
                <button
                  onClick={toggleTheme}
                  className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                >
                  {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
              </OnboardingTooltip>

              {/* User Menu */}
              <div className="relative">
                <OnboardingTooltip content="User menu and settings" position="bottom">
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
                </OnboardingTooltip>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Admin User</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">admin@reconeasy.com</p>
                      <p className="text-xs text-teal-600 dark:text-teal-400 capitalize">{userRole} Role</p>
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
          {/* Enhanced Responsive Sidebar */}
          <aside className={`${sidebarOpen ? 'block' : 'hidden'} lg:block flex-shrink-0 transition-all duration-300 ${
            sidebarCollapsed ? 'w-20' : 'w-72'
          }`}>
            <nav className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 sticky top-24">
              {/* Quick Stats */}
              {!sidebarCollapsed && (
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
              )}

              {/* Navigation Items */}
              <div className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <OnboardingTooltip 
                      key={item.id} 
                      content={sidebarCollapsed ? `${item.label} - ${item.description}` : item.description}
                      position="right"
                    >
                      <button
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
                        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'justify-between p-4'}`}>
                          <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                            <div className={`p-2 rounded-lg transition-colors ${
                              isActive 
                                ? 'bg-white/20' 
                                : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30'
                            }`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            {!sidebarCollapsed && (
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
                            )}
                          </div>
                          {!sidebarCollapsed && item.badge && (
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
                    </OnboardingTooltip>
                  );
                })}
              </div>

              {/* System Status */}
              {!sidebarCollapsed && (
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
              )}

              {/* Quick Actions */}
              {!sidebarCollapsed && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {filteredQuickActions.slice(2).map((action, index) => (
                      <OnboardingTooltip key={index} content={action.label} position="top">
                        <button
                          onClick={action.action}
                          className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 group"
                        >
                          <action.icon className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 mb-1" />
                          <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 text-center">
                            {action.label}
                          </span>
                        </button>
                      </OnboardingTooltip>
                    ))}
                  </div>
                </div>
              )}
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

      {/* Overlays */}
      {(showUserMenu || showNotifications) && (
        <div 
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowUserMenu(false);
            setShowNotifications(false);
          }}
        />
      )}
    </div>
  );
}