import React, { useEffect, useRef, useState } from 'react';
import { 
  BarChart3, TrendingUp, RefreshCw, AlertTriangle, Home, FileText, 
  Settings, Search, Bell, User, Moon, Sun, Menu, X, Filter,
  Zap, Shield, Database, Activity, Ticket, Package, Users,
  CreditCard, PieChart, Link, ChevronDown, HelpCircle, ChevronLeft,
  ChevronRight, Eye, EyeOff
} from 'lucide-react';
import Logo from './Logo';
import { useTheme } from './ThemeProvider';
import NavigationTransition from './transitions/NavigationTransition';
import { DEFAULT_TENANT_ID } from '../config/tenant';
import { useCurrentUser } from '../contexts/CurrentUserContext';

const formatRevenue = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${Math.round(n)}`;
};

interface NavigationChild {
  id: string;
  label: string;
  path: string;
  description?: string;
}

interface EnhancedLayoutProps {
  children: React.ReactNode;
  navItems: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<any>;
    badge?: string | null;
    description: string;
    shortLabel: string;
    children?: NavigationChild[];
  }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNavigate?: (path: string) => void;
  currentPath: string;
}

export default function EnhancedLayout({ children, navItems, activeTab, onTabChange, onNavigate, currentPath }: EnhancedLayoutProps) {
  const SIDEBAR_WIDTH_STORAGE_KEY = 'reconeasy_sidebar_width';
  const SIDEBAR_EXPANDED_WIDTH_STORAGE_KEY = 'reconeasy_sidebar_expanded_width';
  const DEFAULT_SIDEBAR_WIDTH = 240;
  const MIN_SIDEBAR_WIDTH = 180;
  const MAX_SIDEBAR_WIDTH = 320;
  const COLLAPSE_THRESHOLD = 180;
  const COLLAPSED_SIDEBAR_WIDTH = 64;

  const clampSidebarWidth = (width: number) =>
    Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);

  const getInitialSidebarState = () => {
    if (typeof window === 'undefined') {
      return {
        collapsed: false,
        currentWidth: DEFAULT_SIDEBAR_WIDTH,
        expandedWidth: DEFAULT_SIDEBAR_WIDTH,
      };
    }

    const savedCurrentWidth = Number.parseInt(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) ?? '',
      10,
    );
    const savedExpandedWidth = Number.parseInt(
      window.localStorage.getItem(SIDEBAR_EXPANDED_WIDTH_STORAGE_KEY) ?? '',
      10,
    );

    const expandedWidth = Number.isFinite(savedExpandedWidth)
      ? clampSidebarWidth(savedExpandedWidth)
      : Number.isFinite(savedCurrentWidth) && savedCurrentWidth >= COLLAPSE_THRESHOLD
        ? clampSidebarWidth(savedCurrentWidth)
        : DEFAULT_SIDEBAR_WIDTH;

    const collapsed =
      Number.isFinite(savedCurrentWidth) && savedCurrentWidth < COLLAPSE_THRESHOLD;

    return {
      collapsed,
      currentWidth: collapsed ? COLLAPSED_SIDEBAR_WIDTH : expandedWidth,
      expandedWidth,
    };
  };

  const initialSidebarState = getInitialSidebarState();
  const { theme, toggleTheme } = useTheme();
  const formatSettlementDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };
  const currentUser = useCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarState.collapsed);
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarState.currentWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [notifications] = useState(0);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userRole] = useState('admin'); // admin, manager, analyst, viewer
  const [showRunModal, setShowRunModal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runMarketplace, setRunMarketplace] = useState('amazon');
  const [availableSettlements, setAvailableSettlements] = useState<any[]>([]);
  const [selectedSettlement, setSelectedSettlement] = useState('');
  const [runResult, setRunResult] = useState<{
    status: 'success' | 'failed';
    message?: string;
    summary?: {
      matched: number;
      overcharged: number;
      missing: number;
    };
  } | null>(null);
  const [recentSummary, setRecentSummary] = useState<{
    revenue: number;
    matchedPct: number | null;
  } | null>(null);
  const [searchResults, setSearchResults] = useState<{
    orders: Array<{
      order_id: string;
      sku: string | null;
      marketplace: string | null;
      selling_price: number | null;
      operational_status: string | null;
    }>;
    claims: Array<{
      batch_id: string | null;
      marketplace: string | null;
      order_id: string | null;
      claim_status: string | null;
      claim_amount: number | null;
    }>;
    returns: Array<{
      return_id: string;
      order_id: string | null;
      marketplace: string | null;
      sku: string | null;
      refund_amount: number | null;
      return_status: string | null;
    }>;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  const expandedSidebarWidthRef = useRef(initialSidebarState.expandedWidth);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const mockNotifications: Array<{
    id: number;
    type: 'alert' | 'info' | 'success';
    message: string;
    time: string;
    read: boolean;
  }> = [];

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleSearchInput = (value: string) => {
    setGlobalSearch(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (value.trim().length < 2) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?tenant_id=${DEFAULT_TENANT_ID}&q=${encodeURIComponent(value.trim())}`,
        );
        const data = await res.json();
        setSearchResults(data);
        setSearchOpen(true);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults(null);
        setSearchOpen(false);
      }
    }, 300);
  };

  const handleSearchResultSelect = (tab: string) => {
    onTabChange(tab);
    setSearchOpen(false);
    setSearchResults(null);
    setGlobalSearch('');
  };

  const handleNotificationToggle = () => {
    setShowUserMenu(false);
    setShowNotifications((prev) => !prev);
  };

  const handleUserMenuToggle = () => {
    setShowNotifications(false);
    setShowUserMenu((prev) => !prev);
  };

  const handleRunReconciliation = async () => {
    setIsRunning(true);
    setRunResult(null);

    try {
      const res = await fetch('/api/reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          marketplace: runMarketplace,
          settlement_id: selectedSettlement || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setRunResult({
          status: 'success',
          message: `Reconciliation complete — Run #${data.run_number}`,
          summary: data.summary,
        });
      } else {
        setRunResult({ status: 'failed', message: data.error });
      }
    } catch (_) {
      setRunResult({ status: 'failed', message: 'Network error' });
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (!showRunModal) {
      setAvailableSettlements([]);
      setSelectedSettlement('');
      return;
    }

    let isCancelled = false;

    const fetchAvailableSettlements = async () => {
      try {
        const res = await fetch(`/api/settlements/files?tenant_id=${DEFAULT_TENANT_ID}`);
        const data = await res.json();
        if (isCancelled) return;

        const files = data.files || data || [];
        setAvailableSettlements(files);

        const matchingFiles = files.filter(
          (file: any) => file.marketplace === runMarketplace.toLowerCase(),
        );
        const latest = matchingFiles[0];
        setSelectedSettlement(latest?.settlement_id || '');
      } catch (_) {
        if (isCancelled) return;
        setAvailableSettlements([]);
        setSelectedSettlement('');
      }
    };

    void fetchAvailableSettlements();

    return () => {
      isCancelled = true;
    };
  }, [showRunModal, runMarketplace]);

  const quickActions = [
    { label: 'Run Reconciliation', icon: Zap, action: () => { setRunResult(null); setSelectedSettlement(''); setShowRunModal(true); }, role: ['admin', 'manager'] },
    { label: 'View Analytics', icon: BarChart3, action: () => onTabChange('analytics'), role: ['admin', 'manager', 'analyst'] },
    { label: 'Help Center', icon: HelpCircle, action: () => setShowOnboarding(true), role: ['admin', 'manager', 'analyst', 'viewer'] }
  ];

  const marketplaceSettlements = availableSettlements.filter(
    (file) => file.marketplace === runMarketplace.toLowerCase(),
  );

  const filteredQuickActions = quickActions.filter(action => action.role.includes(userRole));

  const persistSidebarState = (currentWidth: number, expandedWidth: number) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, currentWidth.toString());
    window.localStorage.setItem(
      SIDEBAR_EXPANDED_WIDTH_STORAGE_KEY,
      expandedWidth.toString(),
    );
  };

  const collapseSidebar = () => {
    setSidebarCollapsed(true);
    setSidebarWidth(COLLAPSED_SIDEBAR_WIDTH);
  };

  const expandSidebar = (width = expandedSidebarWidthRef.current) => {
    const clampedWidth = clampSidebarWidth(width);
    expandedSidebarWidthRef.current = clampedWidth;
    setSidebarCollapsed(false);
    setSidebarWidth(clampedWidth);
  };

  const toggleSidebarCollapsed = () => {
    if (sidebarCollapsedRef.current) {
      expandSidebar();
      persistSidebarState(
        expandedSidebarWidthRef.current,
        expandedSidebarWidthRef.current,
      );
    } else {
      collapseSidebar();
      persistSidebarState(
        COLLAPSED_SIDEBAR_WIDTH,
        expandedSidebarWidthRef.current,
      );
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleLogout = async () => {
    try {
      // Best-effort revoke: remove Supabase session tokens from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      // Also remove any app session cache
      localStorage.removeItem('userSession');
    } catch (_) {
      // ignore
    }
    // Redirect to login page
    window.location.href = '/auth.html';
  };

  // Keyboard shortcuts
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch(`/api/dashboard?tenant_id=${DEFAULT_TENANT_ID}&days=7`);
        const data = await res.json();
        const revenue = data?.kpis?.total_revenue || 0;
        const health = data?.reconciliation_health;
        const total = parseInt(health?.total || 0, 10);
        const matched = parseInt(health?.matched || 0, 10);
        const matchedPct =
          data?.last_reconciliation && total > 0
            ? Math.round((matched / total) * 100)
            : null;

        setRecentSummary({ revenue, matchedPct });
      } catch {
        setRecentSummary(null);
      }
    };

    void fetchSummary();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebarCollapsed();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    sidebarCollapsedRef.current = sidebarCollapsed;
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handleMouseMove = (e: MouseEvent) => {
      const sidebarEl = document.getElementById('app-sidebar');
      if (!sidebarEl) return;

      const containerLeft =
        sidebarEl.parentElement?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - containerLeft;

      if (newWidth < COLLAPSE_THRESHOLD) {
        collapseSidebar();
        return;
      }

      const clampedWidth = clampSidebarWidth(newWidth);
      expandedSidebarWidthRef.current = clampedWidth;
      setSidebarCollapsed(false);
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      persistSidebarState(
        sidebarCollapsedRef.current
          ? COLLAPSED_SIDEBAR_WIDTH
          : sidebarWidthRef.current,
        expandedSidebarWidthRef.current,
      );
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      <header className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50 overflow-visible">
        <div className="w-full px-4 lg:px-6">
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
                  onClick={toggleSidebarCollapsed}
                  className="hidden lg:block p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                >
                  {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
              </OnboardingTooltip>
              
              <div
                onClick={() => onTabChange('dashboard')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTabChange('dashboard');
                  }
                }}
              >
                <Logo size="md" variant="full" />
              </div>
            </div>

            {/* Enhanced Search Bar */}
            <div ref={searchContainerRef} className="hidden md:flex flex-1 max-w-xl mx-4">
              <OnboardingTooltip content="Global search - press Cmd+K to focus" position="bottom">
                <form onSubmit={handleGlobalSearch} className="relative w-full group">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-teal-500 transition-colors" />
                  <input
                    id="global-search"
                    type="text"
                    placeholder="Search orders, returns, tickets, SKUs..."
                    value={globalSearch}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => {
                      if (searchResults && globalSearch.trim().length >= 2) {
                        setSearchOpen(true);
                      }
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-slate-100/80 dark:bg-slate-700/80 border border-slate-200/50 dark:border-slate-600/50 rounded-2xl focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 dark:focus:ring-teal-400/50 dark:focus:border-teal-400 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-all duration-200 backdrop-blur-sm"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <kbd className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 rounded">⌘K</kbd>
                  </div>
                  {searchOpen && searchResults && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                      {searchResults.orders.length > 0 && (
                        <div>
                          <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                            Orders
                          </div>
                          {searchResults.orders.map((order) => (
                            <button
                              key={order.order_id}
                              onClick={() => {
                                sessionStorage.setItem('search_highlight_order', order.order_id);
                                handleSearchResultSelect('payment_reconciliation_v2');
                              }}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                  {order.order_id}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {order.marketplace} · {order.sku}
                                </div>
                              </div>
                              <div className="text-xs text-slate-400 dark:text-slate-500">
                                {order.selling_price !== null && order.selling_price !== undefined
                                  ? `₹${order.selling_price}`
                                  : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.claims.length > 0 && (
                        <div>
                          <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                            Claims
                          </div>
                          {searchResults.claims.map((claim) => (
                            <button
                              key={claim.batch_id ?? `${claim.order_id}-${claim.marketplace}`}
                              onClick={() => {
                                if (claim.batch_id) {
                                  sessionStorage.setItem('search_highlight_claim', claim.batch_id);
                                }
                                handleSearchResultSelect('claims');
                              }}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                  {claim.batch_id ?? claim.order_id}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {claim.marketplace} · {claim.order_id}
                                </div>
                              </div>
                              <div className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                                {claim.claim_status}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.returns.length > 0 && (
                        <div>
                          <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                            Returns
                          </div>
                          {searchResults.returns.map((ret) => (
                            <button
                              key={ret.return_id}
                              onClick={() => {
                                sessionStorage.setItem('search_highlight_return', ret.return_id);
                                handleSearchResultSelect('returns');
                              }}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                  {ret.return_id}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {ret.marketplace} · {ret.order_id}
                                </div>
                              </div>
                              <div className="text-xs text-slate-400 dark:text-slate-500">
                                {ret.refund_amount !== null && ret.refund_amount !== undefined
                                  ? `₹${ret.refund_amount}`
                                  : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.orders.length === 0 &&
                        searchResults.claims.length === 0 &&
                        searchResults.returns.length === 0 && (
                          <div className="px-4 py-6 text-center text-sm text-slate-400">
                            No results found for "{globalSearch}"
                          </div>
                        )}
                    </div>
                  )}
                </form>
              </OnboardingTooltip>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-2">
              {/* Quick Actions */}
              <div className="hidden lg:flex items-center space-x-2">
                {filteredQuickActions
                  .filter((action) => action.label === 'Run Reconciliation')
                  .map((action, index) => (
                  <OnboardingTooltip key={index} content={`Quick action: ${action.label}`} position="bottom">
                    <button
                      onClick={action.action}
                      className="flex h-9 items-center space-x-2 px-3 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-body font-medium"
                    >
                      <action.icon style={{ width: 'var(--re-icon-nav)', height: 'var(--re-icon-nav)' }} />
                      <span>{action.label}</span>
                    </button>
                  </OnboardingTooltip>
                ))}
              </div>

              {/* Notifications */}
              <div className="relative">
                <OnboardingTooltip content="View notifications and alerts" position="bottom">
                  <button 
                    onClick={handleNotificationToggle}
                    className="relative p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                  >
                    <Bell style={{ width: 'var(--re-icon-nav)', height: 'var(--re-icon-nav)' }} />
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
                    {mockNotifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        No new notifications
                      </div>
                    ) : (
                      mockNotifications.map((notification) => (
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
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Theme Toggle */}
              <OnboardingTooltip content="Toggle dark/light theme" position="bottom">
                <button
                  onClick={toggleTheme}
                  className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                >
                  {theme === 'light'
                    ? <Moon style={{ width: 'var(--re-icon-nav)', height: 'var(--re-icon-nav)' }} />
                    : <Sun style={{ width: 'var(--re-icon-nav)', height: 'var(--re-icon-nav)' }} />}
                </button>
              </OnboardingTooltip>

              {/* User Menu */}
              <div className="relative">
                <OnboardingTooltip content="User menu and settings" position="bottom">
                  <button
                    onClick={handleUserMenuToggle}
                    className="flex items-center space-x-2 p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {currentUser?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <span className="hidden text-body font-medium sm:block">
                      {currentUser?.full_name?.split(' ')[0] || 'Admin'}
                    </span>
                    <ChevronDown style={{ width: 'var(--re-icon-nav)', height: 'var(--re-icon-nav)' }} />
                  </button>
                </OnboardingTooltip>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {currentUser?.full_name || 'Admin User'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {currentUser?.email || ''}
                      </p>
                      <p className="text-xs text-teal-600 dark:text-teal-400 capitalize">
                        {currentUser?.role || 'admin'} Role
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onTabChange('settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Settings
                    </button>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full px-4 lg:px-6 py-8">
        <div className="flex">
          {/* Enhanced Responsive Sidebar */}
          <aside
            id="app-sidebar"
            style={{ width: sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth }}
            className={`${sidebarOpen ? 'block' : 'hidden'} lg:block flex-shrink-0 ${
              isResizing ? '' : 'transition-[width] duration-150 ease-out'
            }`}
          >
            <nav className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 sticky top-24">
              {/* Quick Stats */}
              {!sidebarCollapsed && (
                <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-xl border border-teal-100 dark:border-teal-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                      Recent Summary
                    </span>
                    <span className="text-[10px] text-teal-500 dark:text-teal-400">
                      Last 7 days
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div>
                      <div className="text-sm font-semibold text-teal-900 dark:text-teal-100">
                        {recentSummary?.revenue ? formatRevenue(recentSummary.revenue) : '—'}
                      </div>
                      <div className="text-[10px] text-teal-600 dark:text-teal-400">Revenue</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-teal-900 dark:text-teal-100">
                        {recentSummary?.matchedPct !== null && recentSummary?.matchedPct !== undefined
                          ? `${recentSummary.matchedPct}%`
                          : '—'}
                      </div>
                      <div className="text-[10px] text-teal-600 dark:text-teal-400">Matched</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Items */}
              <div className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const childPathsActive = item.children?.some((child) => currentPath.startsWith(child.path)) ?? false;
                  
                  return (
                    <NavigationTransition
                      key={item.id}
                      isActive={isActive}
                      direction="scale"
                      duration={0.2}
                    >
                      <button
                        onClick={() => {
                          onTabChange(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`w-full group relative overflow-hidden rounded-xl transition-all duration-300 ${
                          isActive
                            ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg ml-[-6px]'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
                        }`}
                        title={sidebarCollapsed ? `${item.label} - ${item.description}` : item.description}
                      >
                        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'justify-between gap-3 px-3 py-2.5'}`}>
                          <div className={`flex items-center ${sidebarCollapsed ? '' : 'min-w-0 flex-1 space-x-3'}`}>
                            <div className={`p-3 rounded-lg transition-colors ${
                              isActive 
                                ? 'bg-white/20' 
                                : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30'
                            }`}>
                              <Icon style={{ width: 'var(--re-icon-nav)', height: 'var(--re-icon-nav)' }} />
                            </div>
                            {!sidebarCollapsed && (
                              <div className="min-w-0 text-left">
                                <div className="text-nav font-medium">{item.label}</div>
                                <div className={`text-nav-desc ${
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
                            <span className={`flex-shrink-0 px-2 py-1 text-xs rounded-full font-medium ${
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
                        
                        {/* Active indicator removed; active tile extends to the edge via negative margin */}
                      </button>

                      {!sidebarCollapsed && item.children?.length && (isActive || childPathsActive) && (
                        <div className="mt-2 space-y-1 pl-14">
                          {item.children.map((child) => {
                            const childIsActive = currentPath.startsWith(child.path);
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  if (onNavigate) {
                                    onNavigate(child.path);
                                  } else {
                                    onTabChange(item.id);
                                  }
                                  setSidebarOpen(false);
                                }}
                                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ${
                                  childIsActive
                                    ? 'bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/40'
                                }`}
                              >
                                <div className="font-medium">{child.label}</div>
                                {child.description && (
                                  <div
                                    className={`text-xs ${
                                      childIsActive
                                        ? 'text-teal-700 dark:text-teal-200'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {child.description}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </NavigationTransition>
                  );
                })}
              </div>

              {/* System Status */}
              {!sidebarCollapsed && (
                <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50">
                  <div className="flex items-center space-x-2 mb-3">
                    <Shield style={{ width: 'var(--re-icon-action)', height: 'var(--re-icon-action)' }} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-nav font-medium text-emerald-800 dark:text-emerald-200">System Health</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-nav-desc text-emerald-700 dark:text-emerald-300">API Status</span>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-body font-medium text-emerald-600 dark:text-emerald-400">Online</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-nav-desc text-emerald-700 dark:text-emerald-300">Last Sync</span>
                      <span className="text-body text-emerald-600 dark:text-emerald-400">2 min ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-nav-desc text-emerald-700 dark:text-emerald-300">Accuracy</span>
                      <span className="text-body font-medium text-emerald-600 dark:text-emerald-400">98.7%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              {!sidebarCollapsed && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {filteredQuickActions
                      .filter((action) => action.label !== 'Run Reconciliation')
                      .map((action, index) => (
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

          <div
            onMouseDown={startResizing}
            className={`group relative hidden w-1 flex-shrink-0 cursor-col-resize items-center justify-center self-stretch lg:flex ${
              isResizing ? 'bg-teal-500/10' : ''
            }`}
            style={{ marginLeft: 8, marginRight: 8 }}
            title="Resize sidebar"
            aria-hidden="true"
          >
            <div
              className={`h-full w-px transition-colors duration-150 ${
                isResizing
                  ? 'bg-teal-500'
                  : 'bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
              }`}
            />
            <div
              className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 flex-col gap-1 transition-opacity duration-150 ${
                isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`sidebar-grip-${index}`}
                  className={`h-1 w-1 rounded-full ${
                    isResizing ? 'bg-teal-500' : 'bg-slate-400 dark:bg-slate-500'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0 overflow-hidden">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
      {showRunModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Run Reconciliation?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              ReconEasy will process uploaded settlement and order data using your active rate cards and reconciliation settings. This may update reconciliation statuses for matching orders.
            </p>

            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block uppercase tracking-wide">
                Marketplace
              </label>
              <select
                value={runMarketplace}
                onChange={(e) => setRunMarketplace(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
              >
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="myntra">Myntra</option>
              </select>
            </div>

            {marketplaceSettlements.length > 0 && (
              <div className="mb-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block uppercase tracking-wide">
                  Settlement File
                </label>
                <select
                  value={selectedSettlement}
                  onChange={(e) => setSelectedSettlement(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600"
                >
                  <option value="">Select settlement…</option>
                  {marketplaceSettlements.map((file) => (
                    <option key={`${file.id}-${file.settlement_id}`} value={file.settlement_id}>
                      {file.settlement_id} · {file.row_count || 0} rows · {formatSettlementDate(file.created_at)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {marketplaceSettlements.length === 0 && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                No settlement file found for {runMarketplace}. Upload a settlement file first.
              </div>
            )}

            {runResult && (
              runResult.status === 'success' ? (
                <div className="rounded-lg bg-teal-50 border border-teal-100 px-4 py-3 text-sm mb-4">
                  <div className="font-semibold text-teal-800 mb-2">
                    ✓ {runResult.message}
                  </div>
                  {runResult.summary && (
                    <div className="grid grid-cols-3 gap-2 text-[12.5px] text-teal-700">
                      <div>{runResult.summary.matched} matched</div>
                      <div>{runResult.summary.overcharged} overcharged</div>
                      <div>{runResult.summary.missing} missing</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg p-3 mb-4 text-sm bg-red-50 text-red-800 border border-red-200">
                  ✗ {runResult.message || 'Reconciliation failed. Please try again.'}
                </div>
              )
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowRunModal(false); setRunResult(null); setSelectedSettlement(''); }}
                className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRunReconciliation}
                disabled={isRunning || (marketplaceSettlements.length > 0 && !selectedSettlement) || marketplaceSettlements.length === 0}
                className="h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {isRunning ? 'Running...' : runResult?.status === 'success' ? 'Run Again' : 'Run Reconciliation'}
              </button>
            </div>
          </div>
        </div>
      )}

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
