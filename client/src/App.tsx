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
import Dashboard from "./components/Dashboard";
import AnalyticsPage from "./components/AnalyticsPage";
import AuditTrailDashboard from "./components/AuditTrailDashboard";
import ReconciliationSettings from "./components/ReconciliationSettings";
import SettlementPage from "./components/SettlementPage";
import UserManagement from "./components/UserManagement";
import TransactionTable from "./components/TransactionTable";
import ForecastChart from "./components/ForecastChart";
import ReconciliationCalculator from "./components/ReconciliationCalculator";
import FilterPanel from "./components/FilterPanel";
import EnhancedChatBot from "./components/EnhancedChatBot";
import ClaimsPage from "./components/claims/ClaimsPage";
import ClaimDetails from "./components/claims/ClaimDetails";

import IntegrationsPage from "./components/IntegrationsPage";
import AutomationPage from "./components/AutomationPage";
import AuditLogTab from "./components/AuditLogTab";
import AIForecastingPage from "./components/AIForecastingPage";
import ProjectedIncomePage from "./components/ProjectedIncomePage";
import PerformanceInsightsDashboard from "./components/PerformanceInsightsDashboard";
import Settlements from "./pages/Settlements";
import ProjectedIncome from "./pages/ProjectedIncome";
import Integrations from "./pages/Integrations";
import ReconciliationV2 from "./pages/ReconciliationV2";
import PaymentReconciliationV2 from "./pages/financial-intelligence/PaymentReconciliation";
import Returns from "./pages/Returns";
import OrdersUpload from "./components/OrdersUpload";
import RateCardV2Page from "./pages/RateCardV2Page";
import AddRateCardWizard from "./pages/RateCards/AddRateCardWizard";
import SystemHealthBanner from "./components/SystemHealthBanner";
import { DEFAULT_TENANT_ID } from "./config/tenant";
import { CurrentUserProvider } from "./contexts/CurrentUserContext";

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
    id: "data_hub",
    label: "Data Hub",
    icon: Database,
    description: "Upload & manage marketplace data",
    shortLabel: "Data",
  },
  {
    id: "reconciliation",
    label: "Payment Reconciliation",
    icon: Activity,
    badge: null,
    description: "Track overcharges & missing payouts",
    shortLabel: "Pay Recon",
  },
  {
    id: "returns",
    label: "Returns",
    icon: RefreshCw,
    badge: null,
    description: "Return analytics",
    shortLabel: "Returns",
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
    id: "rate_cards",
    label: "Rate Cards",
    icon: CreditCard,
    badge: null,
    description: "Marketplace fee configuration",
    shortLabel: "Rates",
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
    id: "reconciliation_v2",
    label: "Financial Intelligence",
    icon: Activity,
    badge: null,
    description: "AI insights & recovery optimization",
    shortLabel: "Fin Intel",
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
  const validSettingsTabs = [
    "integrations",
    "users",
    "reconciliation",
    "automation",
    "audit-log",
  ] as const;
  const normalizeSettingsTab = (tab?: string) => (tab === "audit_log" ? "audit-log" : tab || "");
  const getInitialSettingsTab = () => {
    if (typeof window === "undefined") return "integrations";
    const hash = window.location.hash.replace("#settings-", "");
    return validSettingsTabs.includes(hash as (typeof validSettingsTabs)[number])
      ? hash
      : "integrations";
  };
  const settingsTabLabels: Record<string, string> = {
    integrations: "Platform Integrations",
    users: "Users & Permissions",
    reconciliation: "Reconciliation",
    automation: "Automation",
    "audit-log": "Audit Log",
    audit_log: "Audit Log",
  };
  const settingsTabSubtitles: Record<string, string> = {
    integrations:
      "Explore upcoming marketplace, storefront, and warehouse integrations",
    users:
      "Manage who can access ReconEasy, what they can do, and how their activity is audited.",
    reconciliation:
      "Configure reconciliation behavior, default rules, and processing preferences.",
    automation:
      "Set up automated reconciliation rules, alerts, and workflows.",
    "audit-log":
      "Full activity trail across all team members and modules.",
    audit_log:
      "Full activity trail across all team members and modules.",
  };
  
  // Determine active tab from URL
  const getTabFromPath = (path: string) => {
    if (path.startsWith('/rate-cards')) return 'rate_cards';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/performance')) return 'performance';
    if (path.startsWith('/returns')) return 'returns';
    if (path.startsWith('/financial-intelligence')) return 'reconciliation_v2';
    if (path.startsWith('/data-hub')) return 'data_hub';
    if (path.startsWith('/reconciliation-v2')) return 'reconciliation';
    if (path.startsWith('/reconciliation')) return 'reconciliation';
    if (path.startsWith('/claims')) return 'claims';
    if (path.startsWith('/integrations')) return 'integrations';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath(location.pathname));
  const [returnsCount, setReturnsCount] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState<Record<string, string>>({
    dashboard: "overview",
    analytics: "overview",
    performance: "overview",
    returns: "overview",
    rate_cards: "overview",
    claims: "overview",
    data_hub: "settlements",
    reconciliation: "overview",
    reconciliation_v2: "overview",
    settings: getInitialSettingsTab(),
  });
  const [showFilters, setShowFilters] = useState(false);
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

    const loadReturnsCount = async () => {
      try {
        const response = await fetch(`/api/returns/count?tenant_id=${DEFAULT_TENANT_ID}`);
        const data = await response.json();
        if (mounted) {
          setReturnsCount(Number(data.count || 0));
        }
      } catch (error) {
        console.error("Error loading returns count:", error);
      }
    };

    void loadReturnsCount();

    return () => {
      mounted = false;
    };
  }, []);

  const navItemsWithCounts = useMemo(
    () =>
      navItems.map((item) =>
        item.id === "returns"
          ? { ...item, badge: returnsCount > 0 ? String(returnsCount) : null }
          : item,
      ),
    [returnsCount],
  );

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

  // Sync rate card sub-navigation state with the URL
  useEffect(() => {
    if (!location.pathname.startsWith("/rate-cards")) return;
    setActiveSubTab((prev) => (prev.rate_cards === "overview" ? prev : { ...prev, rate_cards: "overview" }));
    if (location.pathname.startsWith("/rate-cards/") && location.pathname !== "/rate-cards") {
      navigate("/rate-cards", { replace: true });
    }
  }, [location.pathname, navigate]);

  // Sync activeTab with URL changes
  useEffect(() => {
    const newTab = getTabFromPath(location.pathname);
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [location.pathname, activeTab]);

  useEffect(() => {
    if (location.pathname !== "/data-hub") return;

    const requestedSubTab = new URLSearchParams(location.search).get("subtab");
    const allowedSubTabs = new Set([
      "returns",
      "settlements",
      "orders",
      "projected-income",
    ]);

    if (!requestedSubTab || !allowedSubTabs.has(requestedSubTab)) return;

    setActiveSubTab((prev) =>
      prev.data_hub === requestedSubTab
        ? prev
        : { ...prev, data_hub: requestedSubTab },
    );
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (location.pathname !== "/settings") return;

    const syncFromHash = () => {
      const tab = getInitialSettingsTab();
      setActiveSubTab((prev) =>
        normalizeSettingsTab(prev.settings) === tab ? prev : { ...prev, settings: tab },
      );
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [location.pathname]);

  const handleTabChange = (tab: string) => {
    // Map tab to URL and navigate
    const tabToUrl = {
      dashboard: '/',
      analytics: '/analytics',
      performance: '/performance',
      returns: '/returns',
      rate_cards: '/rate-cards',
      data_hub: '/data-hub',
      reconciliation: '/reconciliation',
      reconciliation_v2: '/financial-intelligence',
      claims: '/claims',
      integrations: '/integrations',
      settings: '/settings'
    };

    // Redirect old routes to reconciliation
    if (tab === "settlements") {
      navigate('/data-hub');
      setActiveSubTab((prev) => ({
        ...prev,
        data_hub: "settlements",
      }));
      return;
    }

    if (tab === "transactions") {
      navigate('/data-hub');
      setActiveSubTab((prev) => ({
        ...prev,
        data_hub: "settlements",
      }));
      return;
    }

    let url = tabToUrl[tab as keyof typeof tabToUrl] || '/';
    if (tab === "settings") {
      const currentSettingsTab = normalizeSettingsTab(activeSubTab.settings) || getInitialSettingsTab();
      const currentHash = typeof window !== "undefined" && window.location.hash.startsWith("#settings-")
        ? window.location.hash
        : `#settings-${currentSettingsTab}`;
      url = `/settings${currentHash}`;
    }
    navigate(url);
    setActiveTab(tab);

    if (tab === "rate_cards") {
      setActiveSubTab((prev) => ({
        ...prev,
        rate_cards: "overview",
      }));
    }

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
      case "data_hub":
        return "settlements";
      case "reconciliation":
        return "overview";
      case "settings":
        return getInitialSettingsTab();
      default:
        return "overview";
    }
  };

  const setSubTab = (subTab: string) => {
    if (activeTab === "settings") {
      const normalizedSubTab = normalizeSettingsTab(subTab);
      setActiveSubTab((prev) => ({
        ...prev,
        settings: normalizedSubTab,
      }));
      if (typeof window !== "undefined") {
        window.location.hash = `settings-${normalizedSubTab}`;
      }
      return;
    }

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
              <Dashboard tenantId={DEFAULT_TENANT_ID} onTabChange={handleTabChange} />
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
        const activeSettingsTab = normalizeSettingsTab(activeSubTab[activeTab]) || "integrations";
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <div className="space-y-8 px-6 lg:px-8">
              <div className="space-y-4 border-b border-slate-200 pb-5">
                <p className="text-[12.5px] text-slate-500">
                  Settings <span className="mx-1 text-slate-300">/</span>{" "}
                  {settingsTabLabels[activeSettingsTab] || "Settings"}
                </p>
                <div className="flex flex-wrap items-center gap-8">
                  {[
                    { id: "integrations", label: "Integrations" },
                    { id: "users", label: "Users" },
                    { id: "reconciliation", label: "Reconciliation" },
                    { id: "automation", label: "Automation" },
                    { id: "audit-log", label: "Audit Log" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSubTab(tab.id)}
                      className={`border-b-2 px-0 pb-3 text-[18px] font-medium transition-colors ${
                        activeSettingsTab === tab.id
                          ? "border-teal-600 text-teal-700"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <TabTransition activeKey={activeSubTab[activeTab]} direction="right">
                {activeSubTab[activeTab] === "integrations" && <IntegrationsPage />}
                {activeSubTab[activeTab] === "users" && <UserManagement />}
                {activeSubTab[activeTab] === "reconciliation" && (
                  <div className="space-y-8">
                    <div className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 p-6">
                      <h1 className="text-xl font-semibold text-white">
                        Reconciliation Preferences
                      </h1>
                      <p className="mt-1 text-sm text-teal-100">
                        Configure reconciliation behavior, default rules, and processing preferences.
                      </p>
                    </div>
                    <ReconciliationSettings tenantId={DEFAULT_TENANT_ID} />
                  </div>
                )}
                {activeSubTab[activeTab] === "automation" && (
                  <div className="space-y-8">
                    <div className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 p-6">
                      <h1 className="text-xl font-semibold text-white">Automation</h1>
                      <p className="mt-1 text-sm text-teal-100">
                        Set up automated reconciliation rules, alerts, and workflows.
                      </p>
                    </div>
                    <AutomationPage />
                  </div>
                )}
                {activeSettingsTab === "audit-log" && (
                  <div className="space-y-8">
                    <div className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 p-6">
                      <h1 className="text-xl font-semibold text-white">Audit Log</h1>
                      <p className="mt-1 text-sm text-teal-100">
                        Full activity trail across all team members and modules.
                      </p>
                    </div>
                    <AuditLogTab tenantId={DEFAULT_TENANT_ID} />
                  </div>
                )}
              </TabTransition>
            </div>
          </PageTransition>
        );

      case "returns":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <Returns tenantId={DEFAULT_TENANT_ID} />
          </PageTransition>
        );

      case "claims":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            {location.pathname === "/claims/detail" ? <ClaimDetails /> : <ClaimsPage />}
          </PageTransition>
        );

      case "data_hub":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Data Hub</h2>
                    <p className="text-teal-100 mt-1">
                      Upload and manage orders, settlements, returns, and marketplace source data.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
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
                {activeSubTab[activeTab] === "returns" && <Returns tenantId={DEFAULT_TENANT_ID} />}
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

      case "reconciliation_v2":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <ReconciliationV2 />
          </PageTransition>
        );

      case "reconciliation":
        return (
          <PageTransition pageKey={activeTab} direction="slide-up">
            <PaymentReconciliationV2 />
          </PageTransition>
        );

      default:
        return (
          <PageTransition pageKey="default" direction="slide-up">
            <StaggeredContent staggerDelay={0.1} direction="up">
              <Dashboard tenantId={DEFAULT_TENANT_ID} onTabChange={handleTabChange} />
            </StaggeredContent>
          </PageTransition>
        );
    }
  };

  return (
    <EnhancedLayout
      navItems={navItemsWithCounts}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      currentPath={location.pathname}
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrentUserProvider>
          <BrowserRouter>
            <Routes>
              {/* Main app routes */}
              <Route path="/" element={<AppContent />} />
              <Route path="/dashboard" element={<AppContent />} />
              <Route path="/analytics" element={<AppContent />} />
              <Route path="/performance" element={<AppContent />} />
              <Route path="/returns" element={<AppContent />} />
              <Route path="/data-hub" element={<AppContent />} />
              <Route path="/reconciliation" element={<AppContent />} />
              <Route path="/reconciliation-v2" element={<Navigate to="/reconciliation" replace />} />
              <Route path="/financial-intelligence" element={<AppContent />} />
              <Route path="/claims" element={<AppContent />} />
              <Route path="/claims/detail" element={<AppContent />} />
              <Route path="/integrations" element={<AppContent />} />
              <Route path="/settings" element={<AppContent />} />

              {/* Canonical route for Rate Cards */}
              <Route path="/rate-cards/add" element={<AddRateCardWizard />} />
              <Route path="/rate-cards/*" element={<AppContent />} />

              {/* Redirect all legacy paths to the canonical route */}
              <Route path="/rate-cards-v2/*" element={<Navigate to="/rate-cards" replace />} />
              <Route path="/rate-cards-old/*" element={<Navigate to="/rate-cards" replace />} />
              
              {/* Catch all - redirect to dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Enhanced AI ChatBot */}
            <EnhancedChatBot />
          </BrowserRouter>
        </CurrentUserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
