import React, { useState, useMemo, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import "./styles/claimTheme.css";
import PageTransition from "./components/transitions/PageTransition";
import TabTransition from "./components/transitions/TabTransition";
import StaggeredContent from "./components/transitions/StaggeredContent";
import {
  Home,
  PieChart,
  Database,
  FileText,
  RefreshCw,
  CreditCard,
  Ticket,
  Settings,
  Package,
  Users,
  BarChart3,
  Activity,
} from "lucide-react";
import { ThemeProvider } from "./components/ThemeProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import EnhancedLayout from "./components/EnhancedLayout";
import EnhancedDashboard from "./components/EnhancedDashboard";
import AnalyticsPage from "./components/AnalyticsPage";
import AuditTrailDashboard from "./components/AuditTrailDashboard";
import PaymentReconciliation from "./components/PaymentReconciliation";
import SettlementPage from "./components/SettlementPage";
import UserManagement from "./components/UserManagement";
import TransactionTable from "./components/TransactionTable";
import ReturnAnalytics from "./components/ReturnAnalytics";
import ReturnReconciliation from "./components/ReturnReconciliation";
import EnhancedReturnsPage from "./components/EnhancedReturnsPage";
import EnhancedReturnsManagement from "./components/EnhancedReturnsManagement";
import ForecastChart from "./components/ForecastChart";
import EnhancedRateCardsManager from "./components/EnhancedRateCardsManager";
import ReconciliationCalculator from "./components/ReconciliationCalculator";
import FilterPanel from "./components/FilterPanel";
import EnhancedChatBot from "./components/EnhancedChatBot";
import ClaimManagement from "./components/ClaimManagement";
import ClaimsPage from "./components/claims/ClaimsPage";
import GSTSummary from "./components/GSTSummary";
import IntegrationsPage from "./components/IntegrationsPage";
import AutomationPage from "./components/AutomationPage";
import AIForecastingPage from "./components/AIForecastingPage";
import ProjectedIncomePage from "./components/ProjectedIncomePage";
import PerformanceInsightsDashboard from "./components/PerformanceInsightsDashboard";
import Settlements from "./pages/Settlements";
import ProjectedIncome from "./pages/ProjectedIncome";
import Integrations from "./pages/Integrations";
import OrdersUpload from "./components/OrdersUpload";
import ReturnsUpload from "./components/ReturnsUpload";
import RateCardV2Page from "./pages/RateCardV2Page";
import SystemHealthBanner from "./components/SystemHealthBanner";
import NotificationCenter from "./components/NotificationCenter";
import {
  mockTransactions,
  mockReturns,
  mockForecastData,
} from "./data/mockData";
import { DashboardMetrics, Transaction } from "./types";
import { calculateReturnRate } from "./utils/reconciliation";
import { fetchRateCards, RateCard } from "./utils/supabase";
import { calculateForecastAccuracy } from "./utils/forecasting";

// Define navigation items
const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    badge: null,
    description: "Overview & key metrics",
    shortLabel: "Home",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: PieChart,
    badge: "AI",
    description: "AI-powered insights",
    shortLabel: "Analytics",
  },
  {
    id: "performance",
    label: "Performance",
    icon: BarChart3,
    badge: "New",
    description: "Performance insights & gamification",
    shortLabel: "Performance",
  },

  {
    id: "returns",
    label: "Returns",
    icon: RefreshCw,
    badge: "45",
    description: "Return analytics",
    shortLabel: "Returns",
  },
  {
    id: "rate_cards",
    label: "Rate Cards",
    icon: CreditCard,
    badge: null,
    description: "Marketplace fee configuration",
    shortLabel: "Rates",
  },
  {
    id: "reconciliation",
    label: "Reconciliation",
    icon: Activity,
    badge: "15",
    description: "Payments, settlements & income tracking",
    shortLabel: "Recon",
  },
  {
    id: "claims",
    label: "Claims",
    icon: Ticket,
    badge: "8",
    description: "Marketplace dispute claims",
    shortLabel: "Claims",
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Settings,
    badge: null,
    description: "Marketplace connections",
    shortLabel: "Integrations",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    badge: null,
    description: "System configuration",
    shortLabel: "Config",
  },
];

// Wrapper component to handle URL synchronization
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine active tab from URL
  const getTabFromPath = (path: string) => {
    if (path.startsWith('/rate-cards')) return 'rate_cards';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/performance')) return 'performance';
    if (path.startsWith('/returns')) return 'returns';
    if (path.startsWith('/reconciliation')) return 'reconciliation';
    if (path.startsWith('/claims')) return 'claims';
    if (path.startsWith('/integrations')) return 'integrations';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath(location.pathname));
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<Record<string, string>>({
    dashboard: "overview",
    analytics: "overview",
    performance: "overview",
    returns: "overview",
    rate_cards: "overview",
    claims: "overview",
    reconciliation: "payments",
    settings: "integrations",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMarketplace, setSelectedMarketplace] = useState("All");
  const [filters, setFilters] = useState({
    dateRange: { start: "", end: "" },
    marketplace: "",
    status: "",
    amountRange: { min: "", max: "" },
    category: "",
  });

  const filterOptions = {
    marketplaces: ["Amazon", "Flipkart", "Myntra", "Ajio", "Nykaa"],
    statuses: ["reconciled", "pending", "discrepancy"],
    categories: [
      "size_issue",
      "quality_issue",
      "wrong_item",
      "damaged",
      "not_as_described",
    ],
  };

  useEffect(() => {
    let mounted = true;
    
    const loadRateCards = async () => {
      try {
        const data = await fetchRateCards();
        if (mounted) {
          setRateCards(data);
        }
      } catch (error) {
        console.error("Error loading rate cards:", error);
      }
    };

    loadRateCards();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Handle legacy reconciliation/claims URLs - redirect to main claims
  useEffect(() => {
    const handleLegacyClaimsRedirect = () => {
      const currentPath = window.location.pathname;
      if (currentPath.includes('reconciliation/claims') || (currentPath.includes('reconciliation') && currentPath.includes('claims'))) {
        // Redirect to standalone claims page
        setActiveTab("claims");
        // Update URL to reflect the change
        if (window.history?.replaceState) {
          window.history.replaceState(null, '', '/claims');
        }
      }
    };
    
    handleLegacyClaimsRedirect();
  }, []);

  // Calculate enhanced dashboard metrics
  const metrics = useMemo((): DashboardMetrics => {
    const filteredTransactions =
      selectedMarketplace === "All"
        ? mockTransactions
        : mockTransactions.filter((t) => t.marketplace === selectedMarketplace);

    const totalSales = filteredTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const totalReturns = mockReturns.length;
    const returnRate = calculateReturnRate(
      filteredTransactions.length,
      totalReturns,
    );
    const pendingReconciliations = filteredTransactions.filter(
      (t) => t.status === "pending",
    ).length;
    const totalDiscrepancies = filteredTransactions.filter(
      (t) => t.status === "discrepancy",
    ).length;
    const averageOrderValue = totalSales / filteredTransactions.length;

    return {
      totalSales,
      totalReturns,
      returnRate,
      pendingReconciliations,
      totalDiscrepancies,
      averageOrderValue: Math.round(averageOrderValue),
    };
  }, [selectedMarketplace]);

  const forecastAccuracy = calculateForecastAccuracy(mockForecastData);

  // Mock GST data
  const gstData = {
    gstin: "29ABCDE1234F1ZG",
    total_taxable:
      metrics.totalSales -
      mockReturns.reduce((sum, r) => sum + r.refundAmount, 0),
    total_gst:
      (metrics.totalSales -
        mockReturns.reduce((sum, r) => sum + r.refundAmount, 0)) *
      0.05,
  };

  const handleViewTransactionDetails = (transaction: Transaction) => {
    console.log("View transaction details:", transaction);
  };

  // Sync activeTab with URL changes
  useEffect(() => {
    const newTab = getTabFromPath(location.pathname);
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [location.pathname, activeTab]);

  const handleTabChange = (tab: string) => {
    // Map tab to URL and navigate
    const tabToUrl = {
      dashboard: '/',
      analytics: '/analytics',
      performance: '/performance',
      returns: '/returns',
      rate_cards: '/rate-cards',
      reconciliation: '/reconciliation',
      claims: '/claims',
      integrations: '/integrations',
      settings: '/settings'
    };

    // Redirect old routes to reconciliation
    if (tab === "settlements") {
      navigate('/reconciliation');
      setActiveSubTab((prev) => ({
        ...prev,
        reconciliation: "settlements",
      }));
      return;
    }

    if (tab === "transactions") {
      navigate('/reconciliation');
      setActiveSubTab((prev) => ({
        ...prev,
        reconciliation: "payments",
      }));
      return;
    }

    const url = tabToUrl[tab as keyof typeof tabToUrl] || '/';
    navigate(url);
    setActiveTab(tab);
    
    // If no sub-tab is selected for this tab, set the first one
    if (!activeSubTab[tab]) {
      setActiveSubTab((prev) => ({
        ...prev,
        [tab]: getDefaultSubTab(tab),
      }));
    }
  };

  const getDefaultSubTab = (tab: string) => {
    switch (tab) {
      case "analytics":
        return "overview";
      case "reconciliation":
        return "payments";
      case "settings":
        return "integrations";
      default:
        return "overview";
    }
  };

  const setSubTab = (subTab: string) => {
    setActiveSubTab((prev) => ({
      ...prev,
      [activeTab]: subTab,
    }));
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <StaggeredContent staggerDelay={0.1} direction="up">
              <EnhancedDashboard metrics={metrics} rateCards={rateCards} />
              <GSTSummary gstData={gstData} />
            </StaggeredContent>
          </PageTransition>
        );

      case "analytics":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Analytics Hub</h2>
                    <p className="text-teal-100 mt-1">
                      Advanced insights and AI-powered forecasting
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setSubTab("overview")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "overview"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setSubTab("forecasting")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "forecasting"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      AI Forecasting
                    </button>
                    <button
                      onClick={() => setSubTab("audit")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "audit"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Audit Trail
                    </button>
                  </div>
                </div>
              </div>

              <TabTransition activeKey={activeSubTab[activeTab]} direction="right">
                {activeSubTab[activeTab] === "overview" && <AnalyticsPage />}
                {activeSubTab[activeTab] === "forecasting" && <AIForecastingPage />}
                {activeSubTab[activeTab] === "audit" && <AuditTrailDashboard />}
              </TabTransition>
            </div>
          </PageTransition>
        );

      case "performance":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <PerformanceInsightsDashboard />
          </PageTransition>
        );

      case "rate_cards":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <RateCardV2Page />
          </PageTransition>
        );

      case "settings":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">System Settings</h2>
                    <p className="text-teal-100 mt-1">
                      Configure integrations, users, and automation
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setSubTab("integrations")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "integrations"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Integrations
                    </button>
                    <button
                      onClick={() => setSubTab("users")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "users"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      User Management
                    </button>
                    <button
                      onClick={() => setSubTab("automation")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "automation"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Automation
                    </button>
                  </div>
                </div>
              </div>

              <TabTransition activeKey={activeSubTab[activeTab]} direction="right">
                {activeSubTab[activeTab] === "integrations" && <IntegrationsPage />}
                {activeSubTab[activeTab] === "users" && <UserManagement />}
                {activeSubTab[activeTab] === "automation" && <AutomationPage />}
              </TabTransition>
            </div>
          </PageTransition>
        );

      case "returns":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">
                      Intelligent Return Analytics
                    </h2>
                    <p className="text-teal-100 mt-1">
                      ML-powered pattern analysis for e-commerce optimization
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFilters(true)}
                    className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
                  >
                    <span>Advanced Filters</span>
                  </button>
                </div>
              </div>
              <ReturnAnalytics returns={mockReturns} />
            </div>
          </PageTransition>
        );

      case "claims":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <ClaimsPage />
          </PageTransition>
        );

      case "reconciliation":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Reconciliation Hub</h2>
                    <p className="text-teal-100 mt-1">
                      Payments, settlements & income projections
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setSubTab("payments")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "payments"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Payments
                    </button>
                    <button
                      onClick={() => setSubTab("returns")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "returns"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Returns
                    </button>
                    <button
                      onClick={() => setSubTab("settlements")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "settlements"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Settlements
                    </button>
                    <button
                      onClick={() => setSubTab("orders")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "orders"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Orders
                    </button>
                    <button
                      onClick={() => setSubTab("projected-income")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSubTab[activeTab] === "projected-income"
                          ? "bg-white/30 text-white scale-105"
                          : "bg-white/10 text-teal-100 hover:bg-white/20 hover:scale-102"
                      }`}
                    >
                      Projected Income
                    </button>
                  </div>
                </div>
              </div>

              <TabTransition activeKey={activeSubTab[activeTab]} direction="right">
                {activeSubTab[activeTab] === "payments" && (
                  <PaymentReconciliation />
                )}
                {activeSubTab[activeTab] === "returns" && <ReturnsUpload />}
                {activeSubTab[activeTab] === "settlements" && <Settlements />}
                {activeSubTab[activeTab] === "orders" && <OrdersUpload />}
                {activeSubTab[activeTab] === "projected-income" && (
                  <ProjectedIncome />
                )}
              </TabTransition>
            </div>
          </PageTransition>
        );





      case "integrations":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <Integrations />
          </PageTransition>
        );

      default:
        return (
          <PageTransition pageKey="default" direction="slide-up">
            <StaggeredContent staggerDelay={0.1} direction="up">
              <EnhancedDashboard metrics={metrics} rateCards={rateCards} />
            </StaggeredContent>
          </PageTransition>
        );
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <EnhancedLayout
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        >
          {renderContent()}

          {/* Global Filter Panel */}
          <FilterPanel
            isOpen={showFilters}
            onClose={() => setShowFilters(false)}
            filters={filters}
            onFilterChange={setFilters}
            filterOptions={filterOptions}
          />
        </EnhancedLayout>

        {/* Notification Center */}
        <div className="fixed top-4 right-4 z-50">
          <NotificationCenter />
        </div>

        {/* Enhanced AI ChatBot */}
        <EnhancedChatBot />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main app routes */}
        <Route path="/" element={<AppContent />} />
        <Route path="/dashboard" element={<AppContent />} />
        <Route path="/analytics" element={<AppContent />} />
        <Route path="/performance" element={<AppContent />} />
        <Route path="/returns" element={<AppContent />} />
        <Route path="/reconciliation" element={<AppContent />} />
        <Route path="/claims" element={<AppContent />} />
        <Route path="/integrations" element={<AppContent />} />
        <Route path="/settings" element={<AppContent />} />

        {/* Canonical route for Rate Cards */}
        <Route path="/rate-cards" element={<AppContent />} />

        {/* Redirect all legacy paths to the canonical route */}
        <Route path="/rate-cards-v2/*" element={<Navigate to="/rate-cards" replace />} />
        <Route path="/rate-cards-old/*" element={<Navigate to="/rate-cards" replace />} />
        
        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


