import { useMemo, useState } from "react";
import { DEFAULT_TENANT_ID } from "../../config/tenant";

interface PrepareClaimModalProps {
  claim: {
    id: string;
    display_id: string;
    order_id: string;
    marketplace: string;
    bucket: string;
    claim_amount: number;
    evidence_snapshot: {
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
    days_overdue?: number | null;
    expected_payout_date?: string | null;
    effective_delivery_date?: string | null;
    delivery_date?: string | null;
    t_plus_days?: number | null;
    zone?: string | null;
    sku?: string | null;
    batch_id?: string;
    group_key?: string;
    is_resubmission?: boolean;
    previous_claim_reference?: string;
    rejected_order_ids?: string[];
  };
  onClose: () => void;
  onSubmitted: () => void;
}

const getBucketLabel = (bucket: string) => {
  switch (bucket) {
    case "PAYMENT_NOT_RECEIVED":
      return "Missing payment";
    case "LOGISTICS":
      return "Logistics overcharge";
    case "COMMISSION":
      return "Commission overcharge";
    case "PLATFORM_FEE":
      return "Platform fee overcharge";
    default:
      return "Fee overcharge";
  }
};

const formatCurrency = (value: number | null | undefined) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN")}`;

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const StepBadge = ({
  label,
  number,
  state,
}: {
  label: string;
  number: number;
  state: "active" | "done" | "inactive";
}) => {
  const circleClass =
    state === "active"
      ? "border-teal-500 bg-teal-50 text-teal-700"
      : state === "done"
        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-400";
  const labelClass =
    state === "active"
      ? "text-teal-700"
      : state === "done"
        ? "text-emerald-700"
        : "text-slate-500";

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${circleClass}`}
      >
        {state === "done" ? "✓" : number}
      </div>
      <span className={`text-sm font-medium ${labelClass}`}>{label}</span>
    </div>
  );
};

const EvidenceRow = ({ label, value, tone = "default" }: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 py-2 last:border-b-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span
      className={`text-right text-sm font-medium ${
        tone === "danger" ? "text-red-600" : "text-slate-900"
      }`}
    >
      {value}
    </span>
  </div>
);

export default function PrepareClaimModal({
  claim,
  onClose,
  onSubmitted,
}: PrepareClaimModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const bucketLabel = getBucketLabel(claim.bucket);
  const discrepancyAmount = useMemo(() => {
    const raw =
      claim.evidence_snapshot.discrepancyAmount ??
      claim.evidence_snapshot.discrepancy ??
      claim.claim_amount;
    return Math.abs(Number(raw ?? 0));
  }, [claim.claim_amount, claim.evidence_snapshot.discrepancy, claim.evidence_snapshot.discrepancyAmount]);

  const expectedFee = useMemo(
    () =>
      Number(
        claim.evidence_snapshot.expectedAmount ??
          claim.evidence_snapshot.expected ??
          0,
      ),
    [claim.evidence_snapshot.expected, claim.evidence_snapshot.expectedAmount],
  );

  const actualFee = useMemo(
    () =>
      Number(
        claim.evidence_snapshot.actualAmount ??
          claim.evidence_snapshot.actual ??
          0,
      ),
    [claim.evidence_snapshot.actual, claim.evidence_snapshot.actualAmount],
  );

  const impactLabel =
    claim.bucket === "PAYMENT_NOT_RECEIVED"
      ? "Claim amount at risk"
      : "Overcharged amount";
  const impactValue =
    claim.bucket === "PAYMENT_NOT_RECEIVED"
      ? formatCurrency(claim.claim_amount)
      : formatCurrency(discrepancyAmount);
  const resubmissionContext = claim.is_resubmission
    ? `Previous claim reference: ${claim.previous_claim_reference ?? claim.display_id}
Submission note: This is a re-submission after rejection.
`
    : "";
  const rejectedOrdersValue =
    claim.rejected_order_ids && claim.rejected_order_ids.length > 0
      ? claim.rejected_order_ids.join(", ")
      : claim.order_id;
  const rejectedOrdersLabel =
    claim.rejected_order_ids && claim.rejected_order_ids.length === 1
      ? "Rejected order"
      : "Rejected orders";

  const disputeText = useMemo(() => {
    if (claim.bucket === "PAYMENT_NOT_RECEIVED") {
      return `Subject: Payment not received — Order ${claim.order_id}

Order ID:         ${claim.order_id}
Marketplace:      ${claim.marketplace}
${claim.is_resubmission ? `${resubmissionContext}${rejectedOrdersLabel}:  ${rejectedOrdersValue}
` : ""}

Expected payment: ${formatDate(claim.expected_payout_date)} (${claim.t_plus_days ?? "—"} days after delivery)
Status:           No payment received
Days overdue:     ${claim.days_overdue ?? "—"} days

Requesting investigation into missing settlement
payment for the above order. No payment row found
in settlement records after expected payout date.${
        claim.is_resubmission ? "\nThis is a re-submission after the previous claim was rejected." : ""
      }`;
    }

    return `Subject: ${bucketLabel} dispute — Order ${claim.order_id}

Order ID:         ${claim.order_id}
Claim type:       ${bucketLabel}
Zone:             ${claim.zone ?? "—"}
${claim.is_resubmission ? `${resubmissionContext}${rejectedOrdersLabel}:  ${rejectedOrdersValue}
` : ""}

Expected fee:     ${formatCurrency(expectedFee)} (rate card)
Charged fee:      ${formatCurrency(actualFee)} (settlement file)
Overcharged:      ${formatCurrency(discrepancyAmount)}

Requesting credit for overcharged fee
as per signed rate card agreement.${
        claim.is_resubmission ? "\nThis is a re-submission after the previous claim was rejected." : ""
      }`;
  }, [
    actualFee,
    bucketLabel,
    claim.bucket,
    claim.days_overdue,
    claim.expected_payout_date,
    claim.marketplace,
    claim.order_id,
    claim.is_resubmission,
    claim.previous_claim_reference,
    claim.rejected_order_ids,
    claim.t_plus_days,
    claim.zone,
    discrepancyAmount,
    expectedFee,
    rejectedOrdersLabel,
    rejectedOrdersValue,
    resubmissionContext,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(disputeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy claim text:", error);
      window.alert("Failed to copy claim text. Please copy it manually.");
    }
  };

  const handleMarkSubmitted = async () => {
    if (isSubmitting || isSubmitted) return;
    setIsSubmitting(true);

    try {
      const body = {
        tenant_id: DEFAULT_TENANT_ID,
        claim_status: "SUBMITTED",
        submitted_at: new Date().toISOString(),
        ...(claim.group_key
          ? { batch_id: claim.batch_id, group_key: claim.group_key }
          : { claim_id: claim.id }),
      };

      const res = await fetch("/api/claims/detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to update claim");

      setIsSubmitted(true);
      onSubmitted();
    } catch (error) {
      console.error("Failed to mark as submitted:", error);
      window.alert("Failed to update claim. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deliveryValue = claim.delivery_date
    ? formatDate(claim.delivery_date)
    : `${formatDate(claim.effective_delivery_date)} (est.)`;

  const warningText =
    claim.bucket === "PAYMENT_NOT_RECEIVED"
      ? "Delivery date is estimated from dispatch date. Verify before submitting this claim."
      : "Verify your rate card agreement and settlement file before submitting this claim.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-card shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {bucketLabel}
              </span>
              <span className="font-mono text-sm text-slate-500">{claim.display_id}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <StepBadge label="Review evidence" number={1} state={step === 1 ? "active" : "done"} />
              <StepBadge
                label="Copy & submit"
                number={2}
                state={step === 2 ? (isSubmitted ? "done" : "active") : "inactive"}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
            aria-label="Close prepare claim modal"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              {impactLabel}
            </p>
            <p className="mt-1 text-lg font-medium text-amber-950">{impactValue}</p>
          </div>

          {step === 1 && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2">
                {claim.bucket === "PAYMENT_NOT_RECEIVED" ? (
                  <>
                    <EvidenceRow
                      label={claim.is_resubmission ? rejectedOrdersLabel : "Order ID"}
                      value={rejectedOrdersValue}
                    />
                    {claim.is_resubmission ? (
                      <EvidenceRow
                        label="Previous claim reference"
                        value={claim.previous_claim_reference ?? claim.display_id}
                      />
                    ) : null}
                    <EvidenceRow label="Marketplace" value={claim.marketplace} />
                    <EvidenceRow label="Delivery date" value={deliveryValue} />
                    <EvidenceRow
                      label="Expected payout"
                      value={`${formatDate(claim.expected_payout_date)} (T+${claim.t_plus_days ?? "—"})`}
                    />
                    <EvidenceRow
                      label="Settlement checked"
                      value="Checked against available records"
                    />
                    <EvidenceRow label="Payment found" value="None" tone="danger" />
                    <EvidenceRow
                      label="Days overdue"
                      value={`${claim.days_overdue ?? "—"} days`}
                      tone="danger"
                    />
                  </>
                ) : (
                  <>
                    <EvidenceRow
                      label={claim.is_resubmission ? rejectedOrdersLabel : "Order ID"}
                      value={rejectedOrdersValue}
                    />
                    {claim.is_resubmission ? (
                      <EvidenceRow
                        label="Previous claim reference"
                        value={claim.previous_claim_reference ?? claim.display_id}
                      />
                    ) : null}
                    <EvidenceRow label="Claim type" value={bucketLabel} />
                    {claim.zone ? <EvidenceRow label="Zone" value={claim.zone} /> : null}
                    <EvidenceRow
                      label="Expected fee"
                      value={`${formatCurrency(expectedFee)} (rate card)`}
                    />
                    <EvidenceRow
                      label="Charged fee"
                      value={`${formatCurrency(actualFee)} (settlement file)`}
                      tone="danger"
                    />
                    <EvidenceRow
                      label="Overcharged"
                      value={formatCurrency(discrepancyAmount)}
                      tone="danger"
                    />
                  </>
                )}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
                {warningText}
              </div>
            </>
          )}

          {step === 2 && !isSubmitted && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Claim text</h3>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/90">
                <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-4 font-mono text-xs leading-6 text-slate-800">
                  {disputeText}
                </pre>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-600">
                Copy the text above and raise a support case in Amazon Seller Central. Once
                submitted, click below to record this claim as submitted.
              </div>
            </>
          )}

          {isSubmitted && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/70 px-6 py-10 text-center">
              <div className="mb-3 text-2xl text-emerald-600">✓</div>
              <p className="text-lg font-semibold text-emerald-800">Claim marked as submitted</p>
              <p className="mt-3 text-sm text-slate-600">
                Claim ID: <span className="font-mono text-slate-900">{claim.display_id}</span>
              </p>
              <p className="mt-2 text-sm text-slate-600">
                You can track the status of this claim in the Claims tab.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          {isSubmitted ? (
            <>
              <div />
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Close
              </button>
            </>
          ) : step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Continue to claim text →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkSubmitted}
                disabled={isSubmitting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Mark as submitted"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
