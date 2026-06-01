import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DEFAULT_TENANT_ID } from "../../config/tenant";

interface ClaimGroup {
  batch_id: string;
  group_key: string;
  bucket: string;
  zone: string | null;
  marketplace: string;
  resolution_status: string;
  workflow_status: string;
  batch_name: string;
  order_count: number;
  total_claimed: number;
  total_approved: number;
  total_rejected: number;
  total_recovered: number;
  created_at: string;
  display_id: string;
}

interface ClaimsSummary {
  total_claims: number;
  total_claimed: number;
  total_approved: number;
  total_recovered: number;
}

export default function ClaimsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ClaimGroup[]>([]);
  const [summary, setSummary] = useState<ClaimsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [marketplaceFilter, setMarketplaceFilter] = useState("ALL");

  useEffect(() => {
    const claimId = searchParams.get("claimId");
    if (!claimId) return;
    navigate(`/claims/detail?claimId=${encodeURIComponent(claimId)}`, { replace: true });
  }, [navigate, searchParams]);

  useEffect(() => {
    const fetchClaims = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/claims/grouped?tenant_id=${DEFAULT_TENANT_ID}&marketplace=`);
        const data = await res.json();
        setClaims(Array.isArray(data?.claims) ? data.claims : []);
        setSummary(data?.summary ?? null);
      } catch (error) {
        console.error("Failed to fetch claims:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchClaims();
  }, []);

  const getClaimTypeLabel = (bucket: string, zone: string | null) => {
    if (bucket === "LOGISTICS") {
      return zone ? `Logistics · ${zone.charAt(0).toUpperCase() + zone.slice(1)}` : "Logistics";
    }
    if (bucket === "COMMISSION") return "Commission";
    return bucket.charAt(0) + bucket.slice(1).toLowerCase();
  };

  const openClaim = (claim: ClaimGroup) => {
    const isStandaloneClaim =
      claim.bucket === "PAYMENT_NOT_RECEIVED" && !claim.batch_name && Number(claim.order_count) === 1;

    if (isStandaloneClaim) {
      navigate(`/claims/detail?claimId=${encodeURIComponent(claim.batch_id)}`);
      return;
    }

    navigate(
      `/claims/detail?claimId=${encodeURIComponent(claim.batch_id)}&group=${encodeURIComponent(claim.group_key)}`,
    );
  };

  const getResolutionBadge = (status: string) => {
    const styles: Record<string, string> = {
      APPROVED: "bg-emerald-100 text-emerald-700",
      REJECTED: "bg-red-100 text-red-700",
      PARTIAL: "bg-amber-100 text-amber-700",
      IN_REVIEW: "bg-slate-100 text-slate-600",
      RECOVERED: "bg-teal-100 text-teal-700",
    };
    const labels: Record<string, string> = {
      APPROVED: "Approved (Pending Recovery)",
      REJECTED: "Rejected",
      PARTIAL: "Partially Resolved",
      IN_REVIEW: "In Review",
      RECOVERED: "Recovered",
    };

    return {
      style: styles[status] ?? "bg-slate-100 text-slate-600",
      label: labels[status] ?? status,
    };
  };

  const getActionRequired = (claim: ClaimGroup) => {
    if (claim.workflow_status === "FOLLOW_UP") {
      return { label: "Needs Follow-up", color: "text-red-600 font-medium" };
    }
    if (claim.workflow_status === "SUBMITTED") {
      return { label: "Waiting on Marketplace", color: "text-amber-600" };
    }
    if (claim.workflow_status === "IN_REVIEW") {
      return { label: "Under Review", color: "text-blue-600" };
    }
    if (claim.workflow_status === "CLOSED") {
      return { label: "Closed", color: "text-muted-foreground" };
    }
    return { label: "Draft — Not Submitted", color: "text-muted-foreground" };
  };

  const getAge = (createdAt: string) => {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  const getRowUrgency = (createdAt: string, resolutionStatus: string) => {
    if (["RECOVERED", "APPROVED"].includes(resolutionStatus)) return "";
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 15) return "bg-red-50/50";
    if (days > 7) return "bg-orange-50/50";
    return "";
  };

  const filteredClaims = useMemo(
    () =>
      claims.filter((claim) => {
        if (statusFilter !== "ALL" && claim.resolution_status !== statusFilter) return false;
        if (marketplaceFilter !== "ALL" && claim.marketplace !== marketplaceFilter) return false;
        return true;
      }),
    [claims, marketplaceFilter, statusFilter],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <h1 className="text-page-title font-medium">Claims</h1>
          <p className="text-meta text-muted-foreground">
            Track and manage marketplace recovery claims
          </p>
        </div>

        {summary && (
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
              <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Total Claims</p>
              <p className="text-[28px] font-medium">{Number(summary.total_claims ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
              <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Total Claimed</p>
              <p className="text-[28px] font-medium">
                ₹{Number(summary.total_claimed ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
              <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Approved by Marketplace</p>
              <p className="text-[28px] font-medium text-emerald-600">
                ₹{Number(summary.total_approved ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
              <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Recovered</p>
              <p className="text-[28px] font-medium text-teal-600">
                ₹{Number(summary.total_recovered ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PARTIAL">Partially Resolved</option>
            <option value="REJECTED">Rejected</option>
            <option value="RECOVERED">Recovered</option>
          </select>
          <select
            value={marketplaceFilter}
            onChange={(e) => setMarketplaceFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="ALL">All Marketplaces</option>
            <option value="amazon">Amazon</option>
            <option value="flipkart">Flipkart</option>
            <option value="myntra">Myntra</option>
          </select>
        </div>

        <div className="rounded-xl border border-slate-200 bg-card">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-fixed min-w-[1200px] w-full text-body">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="w-[12%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Claim ID</th>
                  <th className="w-[10%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Marketplace</th>
                  <th className="w-[16%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Type</th>
                  <th className="w-[7%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Orders</th>
                  <th className="w-[10%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Claimed</th>
                  <th className="w-[10%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Approved</th>
                  <th className="w-[10%] px-4 py-3 text-right text-label font-medium uppercase tracking-wide">Recovered</th>
                  <th className="w-[10%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Status</th>
                  <th className="w-[12%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Action Required</th>
                  <th className="w-[8%] px-4 py-3 text-left text-label font-medium uppercase tracking-wide">Age</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      Loading claims...
                    </td>
                  </tr>
                ) : filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-3 text-3xl">🎉</div>
                        <p className="text-sm font-medium text-slate-700">No claims found</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Run reconciliation to detect discrepancies and create claims.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((claim) => {
                    const badge = getResolutionBadge(claim.resolution_status);
                    const action = getActionRequired(claim);
                    return (
                      <tr
                        key={`${claim.batch_id}-${claim.group_key}`}
                        onClick={() => openClaim(claim)}
                        className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/40 ${getRowUrgency(
                          claim.created_at,
                          claim.resolution_status,
                        )}`}
                      >
                        <td className="whitespace-nowrap px-4 py-[14px] font-mono text-body text-muted-foreground">
                          {claim.display_id}
                        </td>
                        <td className="px-4 py-[14px]">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700 whitespace-nowrap">
                            {claim.marketplace}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-[14px] text-body font-medium">
                          {getClaimTypeLabel(claim.bucket, claim.zone)}
                        </td>
                        <td className="px-4 py-[14px] text-right text-body text-muted-foreground">
                          {Number(claim.order_count ?? 0)}
                        </td>
                        <td className="px-4 py-[14px] text-right text-body font-semibold">
                          ₹{Number(claim.total_claimed ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-[14px] text-right text-body font-semibold text-emerald-600">
                          ₹{Number(claim.total_approved ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-[14px] text-right text-body font-semibold text-teal-600">
                          ₹{Number(claim.total_recovered ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-[14px]">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.style}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-[14px]">
                          <span className={`text-body ${action.color}`}>{action.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-[14px] text-body text-muted-foreground">
                          {getAge(claim.created_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && filteredClaims.length > 0 && (
            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Showing {filteredClaims.length} {filteredClaims.length === 1 ? "claim" : "claims"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
