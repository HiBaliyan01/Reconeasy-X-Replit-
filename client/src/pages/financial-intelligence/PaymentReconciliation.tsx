import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type DiscrepancyStatus = "MATCHED" | "OVERCHARGED" | "UNDERCHARGED";

type DiscrepancyRow = {
  orderId: string;
  sku: string;
  dispatchDate: string;
  expectedCommission: number;
  actualCommission: number;
  discrepancy: number;
  status: string;
  claimState?: string;
  runId: string;
};

type SummaryState = {
  ordersAnalyzed: number;
  leakageDetected: number;
  overchargedOrders: number;
  recoveryPotential: number;
};

type DrawerFeeLine = {
  type: string;
  expected: number | null;
  actual: number | null;
};

type DrawerOrderDetail = {
  orderId: string;
  sku: string | null;
  dispatchDate: string;
  marketplace: string;
  category: string | null;
  rateCard: string | null;
  status: DiscrepancyStatus;
  expectedCommission: number;
  actualCommission: number;
  discrepancy: number;
  expectedRate: number | null;
  actualRate: number | null;
  feeBreakdown: DrawerFeeLine[];
};

// Reference mock data kept for local fallback/testing.
// const mockRows: DiscrepancyRow[] = [
//   {
//     order_id: "ORDER001",
//     sku: "SKU001",
//     dispatch_date: "2026-03-01",
//     expected_commission: 120,
//     actual_commission: 120,
//     discrepancy: 0,
//     status: "MATCHED",
//     claim_state: "—",
//   },
// ];

export default function PaymentReconciliation() {
  const tenantId = "tenant-1";
  const marketplace = "amazon";
  const navigate = useNavigate();

  const [showAllOrders, setShowAllOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DiscrepancyRow | null>(null);
  const [rows, setRows] = useState<DiscrepancyRow[]>([]);
  const [kpis, setKpis] = useState<SummaryState>({
    ordersAnalyzed: 0,
    leakageDetected: 0,
    overchargedOrders: 0,
    recoveryPotential: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [orderDetail, setOrderDetail] = useState<DrawerOrderDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const mapApiRows = (apiRows: any[]): DiscrepancyRow[] =>
    apiRows.map((row) => ({
      orderId: row.orderId,
      sku: row.sku ?? "—",
      dispatchDate: row.dispatchDate,
      expectedCommission: Number(row.expectedCommission ?? 0),
      actualCommission: Number(row.actualCommission ?? 0),
      discrepancy: Number(row.discrepancy ?? 0),
      status: row.status,
      claimState: row.claimState ?? "—",
      runId: String(row.runId ?? ""),
    }));

  const refreshSummary = useCallback(async () => {
    const res = await fetch(
      `/api/reconciliation/summary?tenant_id=${tenantId}&marketplace=${marketplace}`,
    );

    if (!res.ok) {
      throw new Error("Failed to fetch summary");
    }

    const data = await res.json();
    setKpis({
      ordersAnalyzed: Number(data?.ordersAnalyzed ?? 0),
      leakageDetected: Number(data?.leakageDetected ?? 0),
      overchargedOrders: Number(data?.overchargedOrders ?? 0),
      recoveryPotential: Number(data?.recoveryPotential ?? 0),
    });

    // Approximation until summary includes authoritative last run timestamp.
    if (Number(data?.ordersAnalyzed ?? 0) > 0 && !lastRunAt) {
      setLastRunAt(new Date());
    }
  }, [lastRunAt, marketplace, tenantId]);

  const refreshOrders = useCallback(async (showAll: boolean) => {
    const statusFilter = showAll
      ? "&status=MATCHED,OVERCHARGED,UNDERCHARGED"
      : "&status=OVERCHARGED,UNDERCHARGED";
    const res = await fetch(
      `/api/reconciliation/orders?tenant_id=${tenantId}&marketplace=${marketplace}&limit=100${statusFilter}`,
    );

    if (!res.ok) {
      throw new Error("Failed to fetch orders");
    }

    const data = await res.json();
    const mappedRows = mapApiRows(data?.rows ?? []);

    setRows(mappedRows);
  }, [marketplace, tenantId]);

  const loadExistingClaims = useCallback(async () => {
    const res = await fetch(
      `/api/claims?tenant_id=${tenantId}&marketplace=${marketplace}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    const claimMap: Record<string, string> = {};
    const claimsList = Array.isArray(data?.claims)
      ? data.claims
      : Array.isArray(data?.rows)
        ? data.rows
        : [];

    claimsList.forEach((claim: { order_id: string; id: string }) => {
      claimMap[claim.order_id] = claim.id;
    });
    setClaims(claimMap);
  }, [marketplace, tenantId]);

  const runReconciliation = useCallback(async () => {
    try {
      setIsRunning(true);
      const response = await fetch("/api/reconciliation/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          marketplace,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to run reconciliation");
      }

      await response.json();
      setLastRunAt(new Date());

      setIsLoading(true);
      await refreshSummary();
      await refreshOrders(showAllOrders);
    } catch (error) {
      console.error(error);
    } finally {
      setIsRunning(false);
      setIsLoading(false);
    }
  }, [marketplace, refreshOrders, refreshSummary, showAllOrders, tenantId]);

  useEffect(() => {
    setIsLoading(true);

    Promise.all([refreshOrders(showAllOrders), refreshSummary(), loadExistingClaims()])
      .catch((error) => {
        console.error("Failed to fetch reconciliation data:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [loadExistingClaims, refreshOrders, refreshSummary]);

  useEffect(() => {
    setIsLoading(true);
    refreshOrders(showAllOrders)
      .catch((error) => {
      console.error("Failed to refresh orders for toggle change:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [showAllOrders, refreshOrders]);

  const filteredRows = useMemo(() => {
    return [...rows].sort(
      (a, b) =>
        new Date(a.dispatchDate).getTime() - new Date(b.dispatchDate).getTime(),
    );
  }, [rows]);

  useEffect(() => {
    if (!selectedOrder) {
      setOrderDetail(null);
      return;
    }

    const currentExists = filteredRows.some(
      (row) => row.orderId === selectedOrder.orderId,
    );

    if (!currentExists) {
      setSelectedOrder(null);
      setOrderDetail(null);
      return;
    }

    const latestSelected =
      filteredRows.find((row) => row.orderId === selectedOrder.orderId) ?? selectedOrder;
    if (latestSelected !== selectedOrder) {
      setSelectedOrder(latestSelected);
    }

    setIsDetailLoading(true);
    fetch(
      `/api/reconciliation/order/${latestSelected.orderId}?tenant_id=${tenantId}&marketplace=${marketplace}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setOrderDetail(null);
          return;
        }
        setOrderDetail(data as DrawerOrderDetail);
      })
      .catch((error) => {
        console.error("Failed to fetch order detail:", error);
        setOrderDetail(null);
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  }, [filteredRows, selectedOrder]);

  // Real API should use cursor pagination instead of OFFSET.
  const visibleRows = filteredRows.slice(0, 100);
  const currentIndex = visibleRows.findIndex(
    (r) => r.orderId === selectedOrder?.orderId,
  );

  const statusBadgeClass: Record<DiscrepancyStatus, string> = {
    MATCHED: "bg-slate-100 text-slate-700",
    OVERCHARGED: "bg-red-100 text-red-700",
    UNDERCHARGED: "bg-amber-100 text-amber-700",
  };
  const getStatusBadgeClass = (status: string) =>
    statusBadgeClass[status as DiscrepancyStatus] ?? "bg-slate-100 text-slate-700";

  const formatCurrency = (value: number) => `₹${Math.abs(value).toLocaleString()}`;
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const statusLabel = (value: string) =>
    value.charAt(0) + value.slice(1).toLowerCase();
  const getLastRunLabel = () => {
    if (!lastRunAt) return "Not yet run";
    const mins = Math.floor((Date.now() - lastRunAt.getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins === 1) return "Last run 1 min ago";
    return `Last run ${mins} mins ago`;
  };

  const handleCreateClaim = async () => {
    if (!selectedOrder) return;
    if (claims[selectedOrder.orderId]) {
      navigate(`/claims?claimId=${claims[selectedOrder.orderId]}`);
      return;
    }

    try {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          order_id: selectedOrder.orderId,
          bucket: "COMMISSION",
          reconciliation_run_id: selectedOrder.runId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create claim");
      }

      const data = await response.json();
      const claimId = data?.claim?.id;
      if (!claimId) {
        throw new Error("Claim ID missing in response");
      }

      setClaims((prev) => ({
        ...prev,
        [selectedOrder.orderId]: claimId,
      }));
    } catch (error) {
      console.error("Create claim error:", error);
    }
  };

  const getExplanation = (row: DiscrepancyRow): string => {
    if (row.status === "OVERCHARGED") {
      const diff = Math.abs(row.discrepancy);

      return `Amazon charged ₹${diff} more than expected. Commission deducted was ₹${row.actualCommission} against an expected ₹${row.expectedCommission} based on your rate card.`;
    }

    if (row.status === "UNDERCHARGED") {
      const diff = row.discrepancy;

      return `Amazon charged ₹${diff} less than the rate card amount. Expected ₹${row.expectedCommission}, actual deduction was ₹${row.actualCommission}.`;
    }

    return "Commission matches the rate card exactly. No discrepancy detected.";
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedOrder(null);

      if (!selectedOrder) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
            const next = visibleRows[currentIndex + 1];
            if (next) {
              setSelectedOrder(next);
              document
            .getElementById(`row-${next.orderId}`)
            ?.scrollIntoView({ block: "nearest" });
            }
          }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
            const prev = visibleRows[currentIndex - 1];
            if (prev) {
              setSelectedOrder(prev);
              document
            .getElementById(`row-${prev.orderId}`)
            ?.scrollIntoView({ block: "nearest" });
            }
          }
    };

    window.addEventListener("keydown", handleEsc);

    return () => window.removeEventListener("keydown", handleEsc);
  }, [currentIndex, selectedOrder, visibleRows]);

  const drawerExpected = orderDetail?.expectedCommission ?? selectedOrder?.expectedCommission ?? 0;
  const drawerActual = orderDetail?.actualCommission ?? selectedOrder?.actualCommission ?? 0;
  const drawerDiscrepancy = orderDetail?.discrepancy ?? selectedOrder?.discrepancy ?? 0;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Payment Reconciliation</h1>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {getLastRunLabel()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Track expected vs actual marketplace deductions and recover leakage.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline">Export CSV</Button>
          <Button variant="outline">Create Claim Batch</Button>
          <Button variant="default" disabled={isRunning} onClick={runReconciliation}>
            {isRunning ? "Running..." : "Run Reconciliation"}
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ₹{kpis.leakageDetected} leakage detected across {kpis.overchargedOrders}{" "}
        {kpis.overchargedOrders === 1 ? "order" : "orders"} in the latest reconciliation run.
      </div>

      <div className="mt-4 rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Reconciliation Overview
        </h2>

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-md bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Orders Analyzed</p>
            <p className="text-xl font-semibold mt-1">{kpis.ordersAnalyzed}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Orders included in latest reconciliation
            </p>
          </div>

          <div className="rounded-md bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Leakage Detected</p>
            <p className="text-xl font-semibold mt-1">₹{kpis.leakageDetected}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Leakage identified in latest run
            </p>
          </div>

          <div className="rounded-md bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Overcharged Orders</p>
            <p className="text-xl font-semibold mt-1">{kpis.overchargedOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Marketplace charged above expected fees
            </p>
          </div>

          <div className="rounded-md bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Recovery Potential</p>
            <p className="text-xl font-semibold mt-1">₹{kpis.recoveryPotential}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Amount recoverable via claims
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              Order Discrepancies
            </h2>
            <p className="text-sm text-muted-foreground">
              Orders where marketplace deductions differ from expected rate card values.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground select-none shrink-0">
            <span className="whitespace-nowrap">Show All Orders</span>
            <button
              type="button"
              role="switch"
              aria-checked={showAllOrders}
              onClick={() => setShowAllOrders((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full overflow-hidden transition-colors ${
                showAllOrders ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  showAllOrders ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[1100px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b">
                <th className="sticky left-0 z-10 w-10 bg-card px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  &nbsp;
                </th>
                <th className="sticky left-10 z-10 bg-card px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Order ID
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Dispatch Date
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Expected Commission
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Actual Commission
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Discrepancy
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Claim State
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="border-b">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3">
                        <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
                      </td>
                      <td className="sticky left-10 z-10 bg-card px-4 py-3">
                        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="ml-auto h-4 w-16 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="ml-auto h-4 w-16 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="ml-auto h-4 w-14 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-5 w-24 rounded-full bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                      </td>
                    </tr>
                  ))
                : visibleRows.map((row) => (
                    <tr
                      id={`row-${row.orderId}`}
                      key={row.orderId}
                      onClick={() => setSelectedOrder(row)}
                      className={`border-b transition-colors cursor-pointer hover:bg-muted/40 ${
                        selectedOrder?.orderId === row.orderId ? "bg-muted/60" : ""
                      }`}
                    >
                      <td className="sticky left-0 z-10 bg-card px-4 py-3">
                        <div
                          className={`w-1.5 h-8 rounded-sm ${
                            row.status === "OVERCHARGED"
                              ? "bg-red-500"
                              : row.status === "UNDERCHARGED"
                                ? "bg-amber-400"
                                : "bg-gray-200"
                          }`}
                        />
                      </td>
                      <td className="sticky left-10 z-10 bg-card px-4 py-3 text-sm font-medium text-foreground">
                        {row.orderId}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.sku ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(row.dispatchDate)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">
                        ₹{row.expectedCommission.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">
                        ₹{row.actualCommission.toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-sm font-medium ${
                          row.discrepancy < 0
                            ? "text-red-600"
                            : row.discrepancy > 0
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {row.discrepancy < 0
                          ? `-${formatCurrency(row.discrepancy)}`
                          : row.discrepancy > 0
                            ? `+${formatCurrency(row.discrepancy)}`
                            : "₹0"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {row.status === "OVERCHARGED" ? (
                          claims[row.orderId] ? (
                            <span className="text-xs text-emerald-600 font-medium">
                              Claim Raised
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not Raised</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">
          {showAllOrders
            ? `Showing ${visibleRows.length} of ${filteredRows.length} orders · Sorted by oldest first`
            : `Showing ${visibleRows.length} discrepancies · Sorted by oldest first`}
        </p>
      </div>

      {selectedOrder && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedOrder(null)}
          />

          <div className="fixed right-0 top-0 h-full w-[420px] bg-card border-l shadow-xl z-50">
            <div className="h-full overflow-y-auto flex flex-col">
              <div className="flex items-start justify-between border-b px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedOrder.orderId}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Order {currentIndex + 1} of {visibleRows.length}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedOrder.sku ?? "—"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="h-8 w-8 rounded-md border text-muted-foreground hover:bg-muted"
                  aria-label="Close order details"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 space-y-6 px-5 py-4">
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">
                    Reconciliation Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Marketplace</span>
                      <span className="font-medium text-foreground">{orderDetail?.marketplace ?? "amazon"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Dispatch Date</span>
                      <span className="font-medium text-foreground">
                        {formatDate(orderDetail?.dispatchDate ?? selectedOrder.dispatchDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium text-foreground">{orderDetail?.category ?? "Apparel"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Rate Card</span>
                      <span className="font-medium text-foreground">
                        {orderDetail?.rateCard ?? "Amazon Fashion Q1 2026"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(selectedOrder.status)}`}
                      >
                        {statusLabel(selectedOrder.status)}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">
                    Expected vs Actual — Commission
                  </h4>
                  <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Expected Commission</span>
                      <span className="font-medium text-foreground">
                        ₹{drawerExpected.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Actual Commission</span>
                      <span className="font-medium text-foreground">
                        ₹{drawerActual.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Discrepancy</span>
                      <span
                        className={`font-medium ${
                          drawerDiscrepancy < 0
                            ? "text-red-600"
                            : drawerDiscrepancy > 0
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {drawerDiscrepancy < 0
                          ? `-${formatCurrency(drawerDiscrepancy)}`
                          : drawerDiscrepancy > 0
                            ? `+${formatCurrency(drawerDiscrepancy)}`
                            : "₹0"}
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <p className="text-muted-foreground">
                        Expected Rate: <span className="font-medium text-foreground">{orderDetail?.expectedRate ?? 12}%</span>
                      </p>
                      <p className="text-muted-foreground">
                        Actual Rate: <span className="font-medium text-foreground">{orderDetail?.actualRate ?? 15}%</span>
                      </p>
                    </div>
                  </div>
                </section>

                <div className="rounded-md border bg-amber-50 border-amber-200 p-4">
                  <p className="text-sm font-medium text-amber-800">Explanation</p>

                  <p className="text-sm text-amber-700 mt-1">
                    {getExplanation(selectedOrder)}
                  </p>
                </div>

                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">
                    Fee Line Breakdown
                  </h4>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">
                            Fee Type
                          </th>
                          <th className="px-3 py-2 text-right text-xs uppercase text-muted-foreground">
                            Expected
                          </th>
                          <th className="px-3 py-2 text-right text-xs uppercase text-muted-foreground">
                            Actual
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {isDetailLoading && (
                          <tr className="border-t">
                            <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                              Loading fee lines...
                            </td>
                          </tr>
                        )}

                        {!isDetailLoading && (orderDetail?.feeBreakdown?.length ?? 0) === 0 && (
                          <tr className="border-t">
                            <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                              No fee lines available
                            </td>
                          </tr>
                        )}

                        {!isDetailLoading &&
                          (orderDetail?.feeBreakdown ?? []).map((line) => (
                            <tr className="border-t" key={line.type}>
                              <td className="px-3 py-2 text-foreground">{line.type}</td>
                              <td className="px-3 py-2 text-right text-foreground">
                                {line.expected == null ? "—" : `₹${line.expected.toLocaleString()}`}
                              </td>
                              <td className="px-3 py-2 text-right text-foreground">
                                {line.actual == null ? "—" : `₹${line.actual.toLocaleString()}`}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              {selectedOrder.status === "OVERCHARGED" && (
                <div className="border-t px-5 py-4">
                  <Button variant="default" onClick={handleCreateClaim}>
                    {claims[selectedOrder.orderId] ? "View Claim" : "Create Claim"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Future data source: latest_reconciliation_summary */}
      {/* Expected fields: order_id, sku, dispatch_date, expected_commission, actual_commission, commission_discrepancy, status */}
      {/* Future endpoint: GET /reconciliation/order/{order_id} */}
      {/* Expected response: order metadata, expected_commission, actual_commission, commission_discrepancy, fee_breakdown[] */}
      {/* Future endpoint: POST /claims */}
      {/* Payload: { order_id, reconciliation_run_id, discrepancy_amount, fee_type, evidence_snapshot } */}
      {/* Future explanation endpoint: GET /reconciliation/explanation/{order_id} */}
      {/* Future improvements: View Claim page, Edit claim draft, Submit claim to marketplace, Claim recovery tracking */}
    </div>
  );
}
