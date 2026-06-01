import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DEFAULT_TENANT_ID } from "../../config/tenant";
import { useCurrentUser } from "../../contexts/CurrentUserContext";
import PrepareClaimModal from "./PrepareClaimModal";

type TabKey = "overview" | "orders" | "evidence" | "activity";
type OrderFilterKey = "ALL" | "APPROVED" | "REJECTED" | "PENDING";
type PipelineState = "DRAFT" | "PREPARED" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "RECOVERED";

type ClaimEvidenceSnapshot = {
  orderId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  discrepancyAmount?: number;
  notes?: string;
  source?: string;
  group_key?: string;
  actual?: number;
  expected?: number;
  discrepancy?: number;
};

type ClaimDetailData = {
  display_id: string;
  batch_id: string;
  group_key: string;
  order_id?: string | null;
  marketplace: string;
  bucket: string;
  zone: string | null;
  claim_status: string;
  total_claim_value: number;
  order_count: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  marketplace_ticket_id: string | null;
  created_by: string | null;
  batch_name: string;
  claim_ids: string[];
  recovered_at: string | null;
};

type ClaimSummary = {
  expected_total: number;
  actual_total: number;
  difference: number;
};

type ClaimOrder = {
  order_id: string;
  claim_id: string;
  sku: string;
  date: string;
  expected: number;
  actual: number;
  diff: number;
  resolution_status: "APPROVED" | "REJECTED" | "PENDING";
  recovered_at: string | null;
  evidence?: ClaimEvidenceSnapshot | null;
};

type ClaimComment = {
  id: string;
  author: string;
  body: string;
  created_at: string;
};

type PaymentAlertContext = {
  order_id: string;
  marketplace: string;
  delivery_date: string | null;
  effective_delivery_date: string | null;
  expected_payout_date: string | null;
  expected_payout_with_grace: string | null;
  days_overdue: number | null;
  t_plus_days: number | null;
  rate_card_id: string | null;
  rate_card_configured?: boolean;
};

type EvidenceField = {
  label: string;
  value: string;
  tone?: "default" | "danger";
  fullWidth?: boolean;
};

interface ClaimDetailsProps {
  batchId?: string;
  groupKey?: string;
  orderId?: string;
  embedded?: boolean;
  onClose?: () => void;
  onBack?: () => void;
}

const tabLabels: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "orders", label: "Orders" },
  { key: "evidence", label: "Evidence" },
  { key: "activity", label: "Activity" },
];

const orderFilters: OrderFilterKey[] = ["ALL", "APPROVED", "REJECTED", "PENDING"];
const RESET_MODAL_SECONDS = 10;

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (value: number | string | null | undefined) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const capitalize = (value?: string | null) => {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const getWorkflowBadgeClass = (status: string) => {
  switch (status) {
    case "FOLLOW_UP":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
    case "SUBMITTED":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300";
    case "IN_REVIEW":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300";
    case "CLOSED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
  }
};

const getClaimTypeLabel = (bucket: string, zone: string | null) => {
  switch (bucket) {
    case "PAYMENT_NOT_RECEIVED":
      return "Missing Payment";
    case "LOGISTICS":
      return zone ? `Logistics Overcharge · ${capitalize(zone)}` : "Logistics Overcharge";
    case "RETURN_LOGISTICS":
      return zone
        ? `Return Logistics Overcharge · ${capitalize(zone)}`
        : "Return Logistics Overcharge";
    case "COMMISSION":
      return "Commission Overcharge";
    case "PLATFORM_FEE":
      return "Platform Fee Overcharge";
    default:
      return capitalize(bucket.replace(/_/g, " "));
  }
};

const getSystemActivityNote = (notes?: string | null) => notes?.trim() || "Claim created";

const getNextAction = (
  claim: ClaimDetailData,
  orders: ClaimOrder[],
  pipelineState: PipelineState,
): string => {
  void orders;
  switch (pipelineState) {
    case "RECOVERED":
      return "This claim is fully recovered.";
    case "APPROVED":
      return "Marketplace approved this claim. Mark orders as recovered in the Orders tab once payment reflects in your settlement.";
    case "REJECTED":
      return "Marketplace rejected this claim. Use Re-prepare claim to submit again with additional evidence.";
    case "IN_REVIEW":
      return claim.claim_status === "FOLLOW_UP"
        ? "Follow-up needed. Contact the marketplace using your ticket ID."
        : "Waiting for marketplace to respond. Follow up if no response within 7 days.";
    case "SUBMITTED":
      return !claim.marketplace_ticket_id
        ? "Add your marketplace ticket ID once you receive it to track this claim."
        : "Claim submitted. Waiting for marketplace to respond.";
    default:
      return "Prepare this claim and submit to the marketplace.";
  }
};

const getWorkflowMessageTone = (pipelineState: PipelineState, claimStatus: string) => {
  if (claimStatus === "FOLLOW_UP") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
  }
  if (pipelineState === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300";
  }
  if (pipelineState === "APPROVED" || pipelineState === "RECOVERED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
  return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300";
};

const getResolutionBadge = (approvedCount: number, rejectedCount: number, pendingCount: number) => {
  if (approvedCount === 0 && rejectedCount === 0 && pendingCount > 0) {
    return {
      label: "Awaiting response",
      className:
        "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    };
  }
  if (approvedCount > 0 && pendingCount > 0 && rejectedCount === 0) {
    return {
      label: "Partially approved",
      className:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
    };
  }
  if (approvedCount > 0 && rejectedCount > 0) {
    return {
      label: "Partially resolved",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    };
  }
  if (approvedCount > 0 && pendingCount === 0 && rejectedCount === 0) {
    return {
      label: "Approved",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
    };
  }
  if (rejectedCount > 0 && approvedCount === 0 && pendingCount === 0) {
    return {
      label: "Rejected",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
    };
  }
  return {
    label: "Partially resolved",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  };
};

const getRecoveryBadge = (approvedCount: number, recoveredApprovedCount: number) => {
  if (approvedCount > 0 && recoveredApprovedCount === approvedCount) {
    return {
      label: "Recovered",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
    };
  }
  if (recoveredApprovedCount > 0) {
    return {
      label: "Partial recovery",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    };
  }
  return {
    label: "Pending",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  };
};

const getRecoveryStatusLabel = (approvedOrders: ClaimOrder[], recoveredOrders: ClaimOrder[]) =>
  approvedOrders.length > 0 && recoveredOrders.length === approvedOrders.length
    ? "Recovered"
    : recoveredOrders.length > 0
      ? "Partial recovery"
      : "Pending";

const getPipelineState = (claim: ClaimDetailData, orders: ClaimOrder[]): PipelineState => {
  const approvedOrders = orders.filter((order) => order.resolution_status === "APPROVED");
  const allResolved =
    orders.length > 0 &&
    orders.every(
      (order) => order.resolution_status === "APPROVED" || order.resolution_status === "REJECTED",
    );
  const allRejected =
    orders.length > 0 && orders.every((order) => order.resolution_status === "REJECTED");
  const allApprovedRecovered =
    approvedOrders.length > 0 && approvedOrders.every((order) => order.recovered_at !== null);

  if (allApprovedRecovered && approvedOrders.length > 0) return "RECOVERED";
  if (allResolved && !allRejected) return "APPROVED";
  if (allRejected) return "REJECTED";
  if (claim.claim_status === "IN_REVIEW" || claim.claim_status === "FOLLOW_UP") return "IN_REVIEW";
  if (claim.claim_status === "SUBMITTED" || claim.submitted_at) return "SUBMITTED";
  if (claim.submitted_at) return "PREPARED";
  return "DRAFT";
};

const getPipelineStepState = (pipelineState: PipelineState, index: number) => {
  const activeIndexByState: Partial<Record<PipelineState, number>> = {
    DRAFT: 0,
    PREPARED: 1,
    SUBMITTED: 2,
    IN_REVIEW: 3,
  };
  const completedThroughByState: Record<PipelineState, number> = {
    DRAFT: -1,
    PREPARED: 0,
    SUBMITTED: 1,
    IN_REVIEW: 2,
    APPROVED: 4,
    REJECTED: 3,
    RECOVERED: 5,
  };

  return {
    isActive: activeIndexByState[pipelineState] === index,
    isCompleted: index <= completedThroughByState[pipelineState],
  };
};

const getRowTone = (status: ClaimOrder["resolution_status"]) => {
  switch (status) {
    case "APPROVED":
      return {
        rowClass: "bg-emerald-50/50 dark:bg-emerald-950/10",
        barClass: "before:bg-emerald-500",
      };
    case "REJECTED":
      return {
        rowClass: "bg-red-50/40 dark:bg-red-950/10",
        barClass: "before:bg-red-500",
      };
    default:
      return {
        rowClass: "",
        barClass: "before:bg-amber-400",
      };
  }
};

const getResolutionPillClass = (status: ClaimOrder["resolution_status"]) => {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
  }
};

export function ClaimDetails({
  batchId: batchIdProp,
  groupKey: groupKeyProp,
  orderId: orderIdProp,
  embedded = false,
  onClose,
  onBack,
}: ClaimDetailsProps) {
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const claimId = batchIdProp ?? orderIdProp ?? searchParams.get("claimId") ?? "";
  const groupKey = groupKeyProp ?? decodeURIComponent(searchParams.get("group") ?? "");

  const [claim, setClaim] = useState<ClaimDetailData | null>(null);
  const [summary, setSummary] = useState<ClaimSummary | null>(null);
  const [orders, setOrders] = useState<ClaimOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [orderFilter, setOrderFilter] = useState<OrderFilterKey>("ALL");
  const [ticketId, setTicketId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isSavingClaimFields, setIsSavingClaimFields] = useState(false);
  const [comments, setComments] = useState<ClaimComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [loadingResolutionId, setLoadingResolutionId] = useState<string | null>(null);
  const [recoveringOrderId, setRecoveringOrderId] = useState<string | null>(null);
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [paymentAlertContext, setPaymentAlertContext] = useState<PaymentAlertContext | null>(null);
  const [resetCandidate, setResetCandidate] = useState<ClaimOrder | null>(null);
  const [resetCountdown, setResetCountdown] = useState(RESET_MODAL_SECONDS);

  const commentsClaimId = claim?.claim_ids?.[0] ?? "";

  useEffect(() => {
    if (!claimId) return;
    void fetchDetail();
  }, [claimId, groupKey]);

  useEffect(() => {
    if (!resetCandidate) return;
    if (resetCountdown <= 0) {
      setResetCandidate(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setResetCountdown((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resetCandidate, resetCountdown]);

  useEffect(() => {
    if (!commentsClaimId) {
      setComments([]);
      return;
    }

    const fetchComments = async () => {
      try {
        const res = await fetch(
          `/api/claims/${commentsClaimId}/comments?tenant_id=${DEFAULT_TENANT_ID}`,
        );
        const data = await res.json();
        setComments(Array.isArray(data?.comments) ? data.comments : []);
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      }
    };

    void fetchComments();
  }, [commentsClaimId]);

  useEffect(() => {
    const firstOrderId = orders[0]?.order_id;
    if (!claim || claim.bucket !== "PAYMENT_NOT_RECEIVED" || !claim.marketplace || !firstOrderId) {
      setPaymentAlertContext(null);
      return;
    }

    const fetchPaymentContext = async () => {
      try {
        const res = await fetch(
          `/api/claims/payment-alerts?tenant_id=${DEFAULT_TENANT_ID}&marketplace=${claim.marketplace}`,
        );
        if (!res.ok) throw new Error("Failed to fetch payment alert context");
        const data = await res.json();
        const match = Array.isArray(data?.alerts)
          ? data.alerts.find((row: PaymentAlertContext) => row.order_id === firstOrderId)
          : null;
        setPaymentAlertContext(match ?? null);
      } catch (error) {
        console.error("Failed to fetch payment alert context:", error);
        setPaymentAlertContext(null);
      }
    };

    void fetchPaymentContext();
  }, [claim, orders]);

  const fetchDetail = async () => {
    setIsLoading(true);
    try {
      const query = groupKey
        ? `/api/claims/detail?batch_id=${claimId}&group_key=${encodeURIComponent(groupKey)}&tenant_id=${DEFAULT_TENANT_ID}`
        : `/api/claims/detail?claim_id=${claimId}&tenant_id=${DEFAULT_TENANT_ID}`;
      const res = await fetch(query);
      const data = await res.json();
      setClaim(data.claim ?? null);
      setSummary(data.summary ?? null);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setTicketId(data.claim?.marketplace_ticket_id ?? "");
      setAssignedTo(data.claim?.created_by ?? "");
      setOrderErrors({});
    } catch (error) {
      console.error("Failed to fetch claim detail:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const persistClaimDetail = async (fields: Record<string, string | null | undefined>) => {
    setIsSavingClaimFields(true);
    try {
      const res = await fetch("/api/claims/detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          user_profile_id: currentUser?.id || null,
          user_name: currentUser?.full_name || null,
          ...(groupKey ? { batch_id: claimId, group_key: groupKey } : { claim_id: claimId }),
          ...fields,
        }),
      });
      if (!res.ok) throw new Error("Failed to update claim detail");
      setClaim((prev) =>
        prev
          ? {
              ...prev,
              ...(fields.claim_status !== undefined ? { claim_status: fields.claim_status ?? prev.claim_status } : {}),
              ...(fields.marketplace_ticket_id !== undefined
                ? { marketplace_ticket_id: fields.marketplace_ticket_id ?? null }
                : {}),
              ...(fields.created_by !== undefined ? { created_by: fields.created_by ?? null } : {}),
              updated_at: new Date().toISOString(),
            }
          : prev,
      );
    } catch (error) {
      console.error("Failed to update claim:", error);
    } finally {
      setIsSavingClaimFields(false);
    }
  };

  const handleDownloadEvidence = () => {
    if (!claim) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            claim,
            summary,
            orders,
            generated_at: new Date().toISOString(),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${claim.display_id}-evidence.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!claim) return;
    const header = [
      "Order ID",
      "SKU",
      "Date",
      "Expected",
      "Actual",
      "Difference",
      "Resolution",
      "Recovered At",
    ].join(",");
    const lines = orders.map((order) =>
      [
        order.order_id,
        order.sku,
        formatDate(order.date),
        order.expected,
        order.actual,
        order.diff,
        order.resolution_status,
        order.recovered_at ? formatDate(order.recovered_at) : "",
      ].join(","),
    );

    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${claim.display_id}-orders.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handlePostComment = async () => {
    if (!commentBody.trim() || isPostingComment || !commentsClaimId) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticComment: ClaimComment = {
      id: tempId,
      author: "User",
      body: commentBody.trim(),
      created_at: new Date().toISOString(),
    };

    setComments((prev) => [...prev, optimisticComment]);
    setCommentBody("");
    setCommentError(null);
    setIsPostingComment(true);

    try {
      const res = await fetch(`/api/claims/${commentsClaimId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          body: optimisticComment.body,
          author: "User",
        }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      const data = await res.json();
      setComments((prev) => prev.map((comment) => (comment.id === tempId ? data.comment : comment)));
    } catch (error) {
      console.error("Failed to post comment:", error);
      setComments((prev) => prev.filter((comment) => comment.id !== tempId));
      setCommentBody(optimisticComment.body);
      setCommentError("Failed to post comment. Please try again.");
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleOrderResolutionUpdate = async (
    claimRowId: string,
    resolutionStatus: ClaimOrder["resolution_status"],
  ) => {
    setLoadingResolutionId(claimRowId);
    setOrderErrors((prev) => ({ ...prev, [claimRowId]: "" }));
    try {
      const res = await fetch(`/api/claims/${claimRowId}/resolution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          user_profile_id: currentUser?.id || null,
          user_name: currentUser?.full_name || null,
          resolution_status: resolutionStatus,
        }),
      });
      if (!res.ok) throw new Error("Failed to update resolution");
      setOrders((prev) =>
        prev.map((order) =>
          order.claim_id === claimRowId ? { ...order, resolution_status: resolutionStatus } : order,
        ),
      );
      await fetchDetail();
    } catch (error) {
      console.error("Failed to update resolution:", error);
      setOrderErrors((prev) => ({
        ...prev,
        [claimRowId]: "Failed to update resolution. Please try again.",
      }));
    } finally {
      setLoadingResolutionId(null);
    }
  };

  const handleResetResolution = async (claimRowId: string) => {
    setLoadingResolutionId(claimRowId);
    setOrderErrors((prev) => ({ ...prev, [claimRowId]: "" }));
    try {
      const res = await fetch(`/api/claims/${claimRowId}/resolution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          user_profile_id: currentUser?.id || null,
          user_name: currentUser?.full_name || null,
          resolution_status: "PENDING",
        }),
      });
      if (!res.ok) throw new Error("Failed to reset resolution");
      await fetchDetail();
    } catch (error) {
      console.error("Failed to reset resolution:", error);
      setOrderErrors((prev) => ({
        ...prev,
        [claimRowId]: "Failed to reset resolution. Please try again.",
      }));
    } finally {
      setLoadingResolutionId(null);
    }
  };

  const openResetModal = (order: ClaimOrder) => {
    setResetCandidate(order);
    setResetCountdown(RESET_MODAL_SECONDS);
  };

  const handleConfirmReset = async () => {
    if (!resetCandidate) return;
    const claimRowId = resetCandidate.claim_id;
    setResetCandidate(null);
    await handleResetResolution(claimRowId);
  };

  const handleMarkOrderRecovered = async (claimRowId: string) => {
    const order = orders.find((item) => item.claim_id === claimRowId);
    if (!order || order.resolution_status !== "APPROVED") {
      console.error("Cannot mark recovered: order is not approved");
      return;
    }

    const recoveredAt = new Date().toISOString();
    setRecoveringOrderId(claimRowId);
    setOrderErrors((prev) => ({ ...prev, [claimRowId]: "" }));
    try {
      const res = await fetch(`/api/claims/${claimRowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          recovered_at: recoveredAt,
        }),
      });
      if (!res.ok) throw new Error("Failed to update recovery");
      setOrders((prev) =>
        prev.map((order) =>
          order.claim_id === claimRowId ? { ...order, recovered_at: recoveredAt } : order,
        ),
      );
      setClaim((prev) => (prev ? { ...prev, updated_at: recoveredAt } : prev));
    } catch (error) {
      console.error("Failed to mark order recovered:", error);
      setOrderErrors((prev) => ({
        ...prev,
        [claimRowId]: "Failed to update recovery. Please try again.",
      }));
    } finally {
      setRecoveringOrderId(null);
    }
  };

  const handleBack = () => {
    if (embedded) {
      onClose?.();
      return;
    }
    if (onBack) {
      onBack();
      return;
    }
    navigate("/claims");
  };

  const primaryOrder = orders[0];
  const primaryEvidence = primaryOrder?.evidence ?? null;
  const systemActivityText = getSystemActivityNote(primaryEvidence?.notes);

  const claimedAmount = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.diff ?? 0), 0),
    [orders],
  );
  const approvedAmount = useMemo(
    () =>
      orders
        .filter((order) => order.resolution_status === "APPROVED")
        .reduce((sum, order) => sum + Number(order.diff ?? 0), 0),
    [orders],
  );
  const rejectedAmount = useMemo(
    () =>
      orders
        .filter((order) => order.resolution_status === "REJECTED")
        .reduce((sum, order) => sum + Number(order.diff ?? 0), 0),
    [orders],
  );
  const recoveredAmount = useMemo(
    () =>
      orders
        .filter((order) => order.resolution_status === "APPROVED" && order.recovered_at)
        .reduce((sum, order) => sum + Number(order.diff ?? 0), 0),
    [orders],
  );

  const approvedOrders = orders.filter((order) => order.resolution_status === "APPROVED");
  const recoveredOrders = approvedOrders.filter((order) => order.recovered_at !== null);
  const recoveryStatusLabel = getRecoveryStatusLabel(approvedOrders, recoveredOrders);
  const approvedCount = orders.filter((order) => order.resolution_status === "APPROVED").length;
  const rejectedCount = orders.filter((order) => order.resolution_status === "REJECTED").length;
  const pendingCount = orders.filter((order) => order.resolution_status === "PENDING").length;
  const recoveredCount = recoveredOrders.length;
  const recoveredApprovedCount = recoveredOrders.length;
  const rejectedOrders = orders.filter((order) => order.resolution_status === "REJECTED");
  const anyOrderRejected = orders.some((order) => order.resolution_status === "REJECTED");
  const hasInconsistentClose =
    claim?.claim_status === "CLOSED" && orders.some((order) => order.resolution_status === "PENDING");
  const showPrepareClaim =
    !!claim &&
    (((claim.claim_status === "DRAFT" || claim.claim_status === "FOLLOW_UP") &&
      orders.every((order) => !order.recovered_at)) ||
      (claim.claim_status === "CLOSED" && anyOrderRejected));
  const prepareClaimLabel =
    claim?.claim_status === "CLOSED" && anyOrderRejected ? "Re-prepare claim" : "Prepare claim";

  const resolutionBadge = getResolutionBadge(approvedCount, rejectedCount, pendingCount);
  const recoveryBadge = getRecoveryBadge(approvedCount, recoveredApprovedCount);
  const pipelineState = claim ? getPipelineState(claim, orders) : "DRAFT";
  const nextAction = claim ? getNextAction(claim, orders, pipelineState) : "";
  const manualWorkflowStatuses = ["DRAFT", "SUBMITTED", "IN_REVIEW", "FOLLOW_UP"];

  const orderCountsByFilter: Record<OrderFilterKey, number> = {
    ALL: orders.length,
    APPROVED: approvedCount,
    REJECTED: rejectedCount,
    PENDING: pendingCount,
  };

  const visibleOrders = useMemo(() => {
    if (orderFilter === "ALL") return orders;
    return orders.filter((order) => order.resolution_status === orderFilter);
  }, [orderFilter, orders]);

  const displayBatchLabel = useMemo(() => {
    if (!claim) return "—";
    if (claim.batch_name?.trim()) return claim.batch_name.trim();
    if (claim.order_count > 1) return claim.batch_id;
    return "Standalone";
  }, [claim]);

  const rateCardHref = useMemo(() => {
    if (paymentAlertContext?.rate_card_id) {
      return `/rate-cards/add?editId=${encodeURIComponent(paymentAlertContext.rate_card_id)}`;
    }
    return "/rate-cards";
  }, [paymentAlertContext?.rate_card_id]);

  const overviewMetricRows = useMemo(() => {
    const expectedValue = Number(summary?.expected_total ?? primaryOrder?.expected ?? 0);
    const actualValue = Number(summary?.actual_total ?? primaryOrder?.actual ?? 0);
    const diffValue = Number(summary?.difference ?? claimedAmount ?? 0);

    if (claim?.bucket === "PAYMENT_NOT_RECEIVED") {
      return [
        { label: "Expected amount", value: formatCurrency(expectedValue) },
        { label: "Actual received", value: formatCurrency(actualValue), tone: "danger" as const },
        { label: "Amount not received", value: formatCurrency(diffValue), tone: "danger" as const },
      ];
    }

    return [
      { label: "Expected (rate card)", value: formatCurrency(expectedValue) },
      { label: "Actual (marketplace)", value: formatCurrency(actualValue), tone: "danger" as const },
      { label: "Overcharged", value: formatCurrency(diffValue), tone: "danger" as const },
    ];
  }, [claim?.bucket, claimedAmount, primaryOrder?.actual, primaryOrder?.expected, summary]);

  const evidenceFields = useMemo(() => {
    if (!claim || !primaryEvidence || Object.keys(primaryEvidence).length === 0) return [] as EvidenceField[];

    const expectedValue = primaryEvidence.expected ?? primaryEvidence.expectedAmount;
    const actualValue = primaryEvidence.actual ?? primaryEvidence.actualAmount;
    const discrepancyValue = primaryEvidence.discrepancy ?? primaryEvidence.discrepancyAmount;
    const orderReference = claim.order_id ?? primaryEvidence.orderId ?? (claim.order_count > 1 ? `${claim.order_count} orders` : null);

    const fields: EvidenceField[] = [
      { label: "Claim type", value: getClaimTypeLabel(claim.bucket, claim.zone) },
      { label: "Order ID", value: orderReference || `${claim.order_count} orders` },
    ];

    if (expectedValue != null) {
      fields.push({ label: "Expected amount", value: formatCurrency(expectedValue) });
    }
    if (actualValue != null) {
      fields.push({ label: "Actual charged", value: formatCurrency(actualValue), tone: "danger" });
    }
    if (discrepancyValue != null) {
      fields.push({
        label: "Overcharged",
        value: formatCurrency(Math.abs(Number(discrepancyValue))),
        tone: "danger",
      });
    }

    fields.push({
      label: "Settlement reference",
      value:
        primaryEvidence.source === "PAYMENT_ALERT"
          ? "Checked against available records"
          : primaryEvidence.source || "Captured from reconciliation snapshot",
    });
    fields.push({ label: "Marketplace", value: capitalize(claim.marketplace) });

    if (primaryEvidence.notes) {
      fields.push({ label: "Notes", value: primaryEvidence.notes, fullWidth: true });
    }

    return fields;
  }, [claim, primaryEvidence]);

  const prepareClaimData = useMemo(() => {
    if (!claim) return null;
    const isResubmission = claim.claim_status === "CLOSED" && rejectedOrders.length > 0;
    const modalOrders = isResubmission ? rejectedOrders : orders;
    const modalPrimaryOrder = modalOrders[0] ?? primaryOrder;
    const modalPrimaryEvidence = modalPrimaryOrder?.evidence ?? primaryEvidence;
    const modalExpectedTotal = modalOrders.reduce((sum, order) => sum + Number(order.expected ?? 0), 0);
    const modalActualTotal = modalOrders.reduce((sum, order) => sum + Number(order.actual ?? 0), 0);
    const modalDiffTotal = modalOrders.reduce((sum, order) => sum + Number(order.diff ?? 0), 0);

    return {
      id: claim.claim_ids[0] ?? "",
      display_id: claim.display_id,
      order_id: claim.order_id ?? modalPrimaryOrder?.order_id ?? claim.group_key ?? "—",
      marketplace: claim.marketplace,
      bucket: claim.bucket,
      claim_amount: isResubmission ? modalDiffTotal : claim.total_claim_value,
      evidence_snapshot: {
        orderId: modalPrimaryEvidence?.orderId ?? modalPrimaryOrder?.order_id ?? undefined,
        expectedAmount:
          modalPrimaryEvidence?.expectedAmount ??
          (isResubmission ? modalExpectedTotal : summary ? Number(summary.expected_total) : Number(modalPrimaryOrder?.expected ?? 0)),
        actualAmount:
          modalPrimaryEvidence?.actualAmount ??
          (isResubmission ? modalActualTotal : summary ? Number(summary.actual_total) : Number(modalPrimaryOrder?.actual ?? 0)),
        discrepancyAmount:
          modalPrimaryEvidence?.discrepancyAmount ??
          (isResubmission ? modalDiffTotal : summary ? Number(summary.difference) : Number(modalPrimaryOrder?.diff ?? 0)),
        notes: modalPrimaryEvidence?.notes,
        source: modalPrimaryEvidence?.source,
        group_key: modalPrimaryEvidence?.group_key ?? claim.group_key,
        actual: modalPrimaryEvidence?.actual,
        expected: modalPrimaryEvidence?.expected,
        discrepancy: modalPrimaryEvidence?.discrepancy,
      },
      days_overdue: paymentAlertContext?.days_overdue ?? null,
      expected_payout_date:
        paymentAlertContext?.expected_payout_date ??
        paymentAlertContext?.expected_payout_with_grace ??
        null,
      effective_delivery_date: paymentAlertContext?.effective_delivery_date ?? null,
      delivery_date: paymentAlertContext?.delivery_date ?? null,
      t_plus_days: paymentAlertContext?.t_plus_days ?? null,
      zone: claim.zone ?? null,
      sku: modalPrimaryOrder?.sku ?? null,
      batch_id: claim.batch_id,
      group_key: claim.group_key,
      is_resubmission: isResubmission,
      previous_claim_reference: isResubmission ? claim.display_id : undefined,
      rejected_order_ids: isResubmission ? rejectedOrders.map((order) => order.order_id) : undefined,
    };
  }, [claim, orders, paymentAlertContext, primaryEvidence, primaryOrder, summary]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading claim details...</div>;
  }

  if (!claim) {
    return <div className="p-6 text-sm text-muted-foreground">Claim not found.</div>;
  }

  return (
    <div className="w-full space-y-6 p-6">
      <header className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleBack}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ← {embedded ? "Close" : "Back to claims"}
            </button>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-mono text-page-title font-medium text-slate-900 dark:text-slate-50">
                  {claim.display_id}
                </h1>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getWorkflowBadgeClass(
                    claim.claim_status,
                  )}`}
                >
                  {claim.claim_status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-meta text-muted-foreground">
                {capitalize(claim.marketplace)} · {getClaimTypeLabel(claim.bucket, claim.zone)} · {claim.order_count}{" "}
                {claim.order_count === 1 ? "order" : "orders"} · Created {formatDate(claim.created_at)} · Batch {displayBatchLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {showPrepareClaim ? (
              <button
                type="button"
                onClick={() => setShowPrepareModal(true)}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
              >
                {prepareClaimLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadEvidence}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Download Evidence
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {["Draft", "Prepared", "Submitted", "In Review", "Approved", "Recovered"].map((label, index, array) => {
              const { isCompleted, isActive } = getPipelineStepState(pipelineState, index);
              const pillClass = isActive
                ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
                : isCompleted
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400";

              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex min-w-[128px] items-center gap-2 rounded-full border px-3 py-2 text-sm ${pillClass}`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                        isActive
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200"
                          : isCompleted
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {isCompleted ? "✓" : index + 1}
                    </span>
                    <span className={isActive ? "font-semibold" : "font-medium"}>{label}</span>
                  </div>
                  {index < array.length - 1 ? (
                    <div className="h-px w-4 bg-slate-200 dark:bg-slate-700" />
                  ) : null}
                </div>
              );
            })}
            {claim.claim_status === "FOLLOW_UP" ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                Needs follow-up
              </span>
            ) : null}
            {pipelineState === "REJECTED" ? (
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                Rejected
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Claimed",
            value: claimedAmount,
            className:
              claimedAmount > 0
                ? "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/20 dark:text-red-100"
                : "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            labelClass: claimedAmount > 0 ? "text-red-700 dark:text-red-300" : "text-slate-500",
          },
          {
            label: "Approved",
            value: approvedAmount,
            className:
              approvedAmount > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100"
                : "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            labelClass: approvedAmount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500",
          },
          {
            label: "Rejected",
            value: rejectedAmount,
            className:
              rejectedAmount > 0
                ? "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/20 dark:text-red-100"
                : "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            labelClass: rejectedAmount > 0 ? "text-red-700 dark:text-red-300" : "text-slate-500",
          },
          {
            label: "Recovered",
            value: recoveredAmount,
            className:
              recoveredAmount > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100"
                : "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            labelClass: recoveredAmount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className={`rounded-2xl border p-4 ${metric.className}`}
          >
            <p className={`text-label font-medium uppercase tracking-wide ${metric.labelClass}`}>
              {metric.label}
            </p>
            <p className="mt-2 text-[24px] font-medium">{formatCurrency(metric.value)}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-card">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {tabLabels.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-lg px-3 py-2 text-body font-medium transition-colors ${
                      active
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 sm:px-5 sm:py-4">
            {activeTab === "overview" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Claim Details
                  </h2>
                  <div className="space-y-3 text-sm">
                    {[
                      ["Marketplace", capitalize(claim.marketplace)],
                      ["Claim type", getClaimTypeLabel(claim.bucket, claim.zone)],
                      ["Batch", displayBatchLabel],
                      ["Order count", `${claim.order_count} ${claim.order_count === 1 ? "order" : "orders"}`],
                      ["Created", formatDate(claim.created_at)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-right font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Discrepancy Summary
                  </h2>
                  <div className="space-y-3 text-sm">
                    {overviewMetricRows.map((row) => (
                      <div key={row.label} className="flex items-start justify-between gap-4">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className={`text-right font-medium ${row.tone === "danger" ? "text-red-600" : "text-foreground"}`}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Rate card</span>
                      <button
                        type="button"
                        onClick={() => navigate(rateCardHref)}
                        className="text-sm font-medium text-teal-600 transition-colors hover:underline"
                      >
                        View →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "orders" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {orderFilters.map((filterKey) => {
                    const active = orderFilter === filterKey;
                    return (
                      <button
                        key={filterKey}
                        type="button"
                        onClick={() => setOrderFilter(filterKey)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {filterKey === "ALL" ? "All" : capitalize(filterKey)} ({orderCountsByFilter[filterKey]})
                      </button>
                    );
                  })}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="table-fixed min-w-[980px] w-full text-body">
                    <thead>
                      <tr className="border-b border-border bg-slate-50/80 text-muted-foreground dark:bg-slate-900/50">
                        <th className="w-[14%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Order ID</th>
                        <th className="w-[10%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">SKU</th>
                        <th className="w-[12%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Date</th>
                        <th className="w-[12%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Expected</th>
                        <th className="w-[12%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Actual</th>
                        <th className="w-[12%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Difference</th>
                        <th className="w-[14%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Resolution</th>
                        <th className="w-[14%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Recovered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No orders match this filter.
                          </td>
                        </tr>
                      ) : (
                        visibleOrders.map((order) => {
                          const rowTone = getRowTone(order.resolution_status);
                          const isRecovering = recoveringOrderId === order.claim_id;
                          const isResolving = loadingResolutionId === order.claim_id;
                          return (
                            <tr
                              key={order.claim_id}
                              className={`border-b border-border align-top text-slate-700 last:border-b-0 dark:text-slate-200 ${rowTone.rowClass}`}
                            >
                              <td
                                className={`relative px-4 py-[14px] font-mono text-body before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full ${rowTone.barClass}`}
                              >
                                {order.order_id}
                              </td>
                              <td className="px-4 py-[14px] text-body text-muted-foreground">{order.sku}</td>
                              <td className="px-4 py-[14px] text-body text-muted-foreground">{formatDate(order.date)}</td>
                              <td className="px-4 py-[14px] text-right text-body">{formatCurrency(order.expected)}</td>
                              <td className="px-4 py-[14px] text-right text-body">{formatCurrency(order.actual)}</td>
                              <td className="px-4 py-[14px] text-right text-body font-semibold text-red-600">
                                {formatCurrency(order.diff)}
                              </td>
                              <td className="px-4 py-[14px]">
                                {order.resolution_status === "PENDING" ? (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void handleOrderResolutionUpdate(order.claim_id, "APPROVED")}
                                        disabled={isResolving}
                                        className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                                      >
                                        {isResolving ? "Updating..." : "Approve"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleOrderResolutionUpdate(order.claim_id, "REJECTED")}
                                        disabled={isResolving}
                                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/20"
                                      >
                                        {isResolving ? "Updating..." : "Reject"}
                                      </button>
                                    </div>
                                    {orderErrors[order.claim_id] ? (
                                      <p className="text-xs text-red-600">{orderErrors[order.claim_id]}</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getResolutionPillClass(
                                        order.resolution_status,
                                      )}`}
                                    >
                                      {capitalize(order.resolution_status)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openResetModal(order)}
                                      disabled={isResolving}
                                      title="Reset to pending"
                                      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isResolving ? "Resetting..." : "Reset"}
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-[14px]">
                                {order.recovered_at ? (
                                  <span className="text-xs font-medium text-emerald-600">
                                    Recovered ✓ on {formatDate(order.recovered_at)}
                                  </span>
                                ) : order.resolution_status === "APPROVED" ? (
                                  <div className="space-y-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleMarkOrderRecovered(order.claim_id)}
                                      disabled={isRecovering}
                                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isRecovering ? "Updating..." : "Mark recovered"}
                                    </button>
                                    {orderErrors[order.claim_id] ? (
                                      <p className="text-xs text-red-600">{orderErrors[order.claim_id]}</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {activeTab === "evidence" ? (
              <div className="space-y-4">
                {!primaryEvidence || Object.keys(primaryEvidence).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No evidence recorded for this claim</p>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      {evidenceFields.map((field) => (
                        <div
                          key={field.label}
                          className={`rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/50 ${
                            field.fullWidth ? "md:col-span-2" : ""
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {field.label}
                          </p>
                          <p
                            className={`mt-2 whitespace-pre-wrap text-sm font-medium ${
                              field.tone === "danger" ? "text-red-600" : "text-foreground"
                            }`}
                          >
                            {field.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Evidence captured at claim creation · {formatDate(claim.created_at)}
                    </p>
                  </>
                )}
              </div>
            ) : null}

            {activeTab === "activity" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">System</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>Recon Engine</span>
                    <span>{formatDate(claim.created_at)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                    {systemActivityText}
                  </p>
                </div>

                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-950/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-foreground">{comment.author}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-card">
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !isPostingComment && commentBody.trim()) {
                        e.preventDefault();
                        void handlePostComment();
                      }
                    }}
                    rows={4}
                    placeholder="Add a comment..."
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                  {commentError ? <p className="mt-2 text-xs font-medium text-red-600">{commentError}</p> : null}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handlePostComment()}
                      disabled={isPostingComment || !commentBody.trim()}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {isPostingComment ? "Posting..." : "Post comment"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-card">
            <h2 className="text-sm font-semibold text-foreground">Workflow</h2>
            <div className={`mt-4 rounded-xl border p-4 ${getWorkflowMessageTone(pipelineState, claim.claim_status)}`}>
              <p className="text-xs font-semibold uppercase tracking-wide">Next action</p>
              <p className="mt-2 text-sm font-medium">{nextAction}</p>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getWorkflowBadgeClass(
                    claim.claim_status,
                  )}`}
                >
                  {claim.claim_status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Assigned to
                </label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  onBlur={() => void persistClaimDetail({ created_by: assignedTo })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-400"
                  placeholder="Enter name or email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ticket ID
                </label>
                <input
                  type="text"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  onBlur={() => void persistClaimDetail({ marketplace_ticket_id: ticketId })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-400"
                  placeholder="e.g. AMZ-2026-0001"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  void persistClaimDetail({
                    claim_status: claim.claim_status === "FOLLOW_UP" ? "IN_REVIEW" : "FOLLOW_UP",
                  })
                }
                disabled={isSavingClaimFields || claim.claim_status === "CLOSED"}
                className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  claim.claim_status === "FOLLOW_UP"
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {claim.claim_status === "FOLLOW_UP"
                  ? "Needs follow-up — click to clear"
                  : "Mark as needs follow-up"}
              </button>

              <details className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Advanced
                </summary>
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Override status
                  </label>
                  <select
                    value={manualWorkflowStatuses.includes(claim.claim_status) ? claim.claim_status : ""}
                    onChange={(e) => void persistClaimDetail({ claim_status: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-400"
                  >
                    {!manualWorkflowStatuses.includes(claim.claim_status) ? (
                      <option value="" disabled>
                        {claim.claim_status.replace(/_/g, " ")} (automatic)
                      </option>
                    ) : null}
                    {manualWorkflowStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </details>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-card">
            <h2 className="text-sm font-semibold text-foreground">Resolution</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Marketplace response</span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    hasInconsistentClose
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                      : resolutionBadge.className
                  }`}
                >
                  {hasInconsistentClose ? "Manually closed" : resolutionBadge.label}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Orders approved</span>
                <span className="font-medium text-foreground">{approvedCount} of {orders.length}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Orders rejected</span>
                <span className="font-medium text-foreground">{rejectedCount} of {orders.length}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Orders pending</span>
                <span className="font-medium text-foreground">{pendingCount} of {orders.length}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-card">
            <h2 className="text-sm font-semibold text-foreground">Recovery</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Recovery status</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${recoveryBadge.className}`}>
                  {recoveryStatusLabel}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Orders recovered</span>
                <span className="font-medium text-foreground">{recoveredCount} of {orders.length}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Recovered amount</span>
                <span className="font-medium text-foreground">{formatCurrency(recoveredAmount)}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Mark individual orders as recovered in the Orders tab once payment reflects in settlement.
            </p>
          </div>
        </aside>
      </div>

      {showPrepareModal && prepareClaimData ? (
        <PrepareClaimModal
          claim={prepareClaimData}
          onClose={() => setShowPrepareModal(false)}
          onSubmitted={() => {
            setShowPrepareModal(false);
            void fetchDetail();
          }}
        />
      ) : null}

      {resetCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Reset Resolution?</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>
                This will reset <span className="font-semibold text-slate-900 dark:text-slate-50">{resetCandidate.order_id}</span>{" "}
                back to Pending.
              </p>
              <p>Any approved or rejected status will be cleared.</p>
            </div>
            <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-300"
                style={{ width: `${(resetCountdown / RESET_MODAL_SECONDS) * 100}%` }}
              />
            </div>
            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Auto-cancelling in {resetCountdown}s
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResetCandidate(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmReset()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ClaimDetails;
