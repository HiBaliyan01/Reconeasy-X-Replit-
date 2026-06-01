import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, Save } from "lucide-react";
import { useCurrentUser } from "../contexts/CurrentUserContext";

type MissingPaymentRule = {
  t_plus_days: number;
  grace_days: number;
};

type MissingPaymentRules = Record<string, MissingPaymentRule>;

type LeakageSensitivity = {
  minimum_discrepancy_amount: number;
  ignore_rounding_differences: boolean;
  rounding_tolerance_amount: number;
};

type ConflictBehavior = "warn_only" | "require_approval";

type ReconciliationSettingsState = {
  missing_payment_rules: MissingPaymentRules;
  leakage_sensitivity: LeakageSensitivity;
  rate_card_conflict_behavior: ConflictBehavior;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ReconciliationSettingsProps = {
  tenantId: string;
};

const MARKETPLACES = [
  { key: "amazon", label: "Amazon" },
  { key: "flipkart", label: "Flipkart" },
  { key: "myntra", label: "Myntra" },
  { key: "meesho", label: "Meesho" },
  { key: "nykaa", label: "Nykaa" },
] as const;

const DEFAULT_SETTINGS: ReconciliationSettingsState = {
  missing_payment_rules: {
    amazon: { t_plus_days: 7, grace_days: 0 },
    flipkart: { t_plus_days: 7, grace_days: 2 },
    myntra: { t_plus_days: 15, grace_days: 2 },
    meesho: { t_plus_days: 7, grace_days: 0 },
    nykaa: { t_plus_days: 7, grace_days: 0 },
  },
  leakage_sensitivity: {
    minimum_discrepancy_amount: 10,
    ignore_rounding_differences: true,
    rounding_tolerance_amount: 1,
  },
  rate_card_conflict_behavior: "warn_only",
};

function normalizeSettings(value: any): ReconciliationSettingsState {
  return {
    missing_payment_rules: MARKETPLACES.reduce<MissingPaymentRules>((acc, marketplace) => {
      const current = value?.missing_payment_rules?.[marketplace.key];
      acc[marketplace.key] = {
        t_plus_days: Number(current?.t_plus_days ?? DEFAULT_SETTINGS.missing_payment_rules[marketplace.key].t_plus_days),
        grace_days: Number(current?.grace_days ?? DEFAULT_SETTINGS.missing_payment_rules[marketplace.key].grace_days),
      };
      return acc;
    }, {} as MissingPaymentRules),
    leakage_sensitivity: {
      minimum_discrepancy_amount: Number(
        value?.leakage_sensitivity?.minimum_discrepancy_amount ??
          DEFAULT_SETTINGS.leakage_sensitivity.minimum_discrepancy_amount,
      ),
      ignore_rounding_differences:
        typeof value?.leakage_sensitivity?.ignore_rounding_differences === "boolean"
          ? value.leakage_sensitivity.ignore_rounding_differences
          : DEFAULT_SETTINGS.leakage_sensitivity.ignore_rounding_differences,
      rounding_tolerance_amount: Number(
        value?.leakage_sensitivity?.rounding_tolerance_amount ??
          DEFAULT_SETTINGS.leakage_sensitivity.rounding_tolerance_amount,
      ),
    },
    rate_card_conflict_behavior:
      value?.rate_card_conflict_behavior === "require_approval" ? "require_approval" : "warn_only",
  };
}

function LoadingSection() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-slate-100" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function ReconciliationSettings({ tenantId }: ReconciliationSettingsProps) {
  const currentUser = useCurrentUser();
  const [settings, setSettings] = useState<ReconciliationSettingsState | null>(null);
  const [savedSettings, setSavedSettings] = useState<ReconciliationSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const saveStatusTimeoutRef = useRef<number | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2600);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!settings || !savedSettings) {
      setIsDirty(false);
      return;
    }
    setIsDirty(JSON.stringify(settings) !== JSON.stringify(savedSettings));
  }, [savedSettings, settings]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`/api/settings/reconciliation?tenant_id=${tenantId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch settings");
        }
        const data = await response.json();
        const normalized = normalizeSettings(data.settings);
        setSettings(normalized);
        setSavedSettings(normalized);
        setSaveStatus("idle");
      } catch (error) {
        console.error("Failed to load reconciliation settings:", error);
        showToast("error", "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, [tenantId]);

  const conflictBehavior = settings?.rate_card_conflict_behavior ?? "warn_only";

  const amountOptions = useMemo(
    () => [0, 1, 5, 10, 50, 100].map((value) => ({ value, label: `₹${value}` })),
    [],
  );

  const updateMissingPaymentRule = (
    marketplace: keyof MissingPaymentRules,
    field: keyof MissingPaymentRule,
    value: number,
  ) => {
    setSaveStatus("idle");
    setSettings((current) =>
      current
        ? {
            ...current,
            missing_payment_rules: {
              ...current.missing_payment_rules,
              [marketplace]: {
                ...current.missing_payment_rules[marketplace],
                [field]: value,
              },
            },
          }
        : current,
    );
  };

  const updateLeakageSensitivity = (field: keyof LeakageSensitivity, value: number | boolean) => {
    setSaveStatus("idle");
    setSettings((current) =>
      current
        ? {
            ...current,
            leakage_sensitivity: {
              ...current.leakage_sensitivity,
              [field]: value,
            },
          }
        : current,
    );
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaveStatus("saving");

    try {
      const response = await fetch("/api/settings/reconciliation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          user_profile_id: currentUser?.id || null,
          user_name: currentUser?.full_name || null,
          missing_payment_rules: settings.missing_payment_rules,
          leakage_sensitivity: settings.leakage_sensitivity,
          rate_card_conflict_behavior: settings.rate_card_conflict_behavior,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      const data = await response.json();
      const normalized = normalizeSettings(data.settings);
      setSettings(normalized);
      setSavedSettings(normalized);
      setSaveStatus("saved");
      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }
      saveStatusTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus("idle");
        saveStatusTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error("Failed to save reconciliation settings:", error);
      setSaveStatus("idle");
      showToast("error", "Failed to save settings");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSection />
        <LoadingSection />
        <LoadingSection />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Failed to load reconciliation settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-slate-900">Missing payment detection</h2>
        <p className="mt-2 text-[13px] text-slate-500">
          Configure fallback payout timing used when no active rate card is found for an order.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <Info className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              How payout timing is determined
            </span>
          </div>

          {[
            {
              number: "1",
              badgeClass: "bg-teal-50 text-teal-800",
              title: "Rate card T+ days",
              description:
                "If an active rate card exists for this order's marketplace and category, its T+ days is used.",
              stateClass: "border border-teal-200 bg-teal-50 text-teal-700",
              stateLabel: "Always takes priority",
            },
            {
              number: "2",
              badgeClass: "bg-blue-50 text-blue-800",
              title: "Marketplace defaults below",
              description:
                "Used when no active rate card is found, or when the rate card has no T+ days configured.",
              stateClass: "border border-blue-200 bg-blue-50 text-blue-700",
              stateLabel: "Fallback only",
            },
            {
              number: "3",
              badgeClass: "bg-red-50 text-red-700",
              title: "No value available — order skipped",
              description:
                "If neither exists, the order is not flagged. Configure a rate card or add a default below.",
              stateClass: "border border-red-200 bg-red-50 text-red-700",
              stateLabel: "Never guesses",
            },
          ].map((item, index) => (
            <div
              key={item.number}
              className={`flex items-start gap-3 px-4 py-3 ${index < 2 ? "border-b border-slate-100" : ""}`}
            >
              <div
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-semibold ${item.badgeClass}`}
              >
                {item.number}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
                <span
                  className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${item.stateClass}`}
                >
                  {item.stateLabel}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Marketplace
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              T+ Days (Default)
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Grace Days
            </span>
          </div>

          {MARKETPLACES.map((marketplace, index) => (
            <div
              key={marketplace.key}
              className={`grid grid-cols-[1.2fr_1fr_1fr] gap-4 px-4 py-3 ${
                index < MARKETPLACES.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <div className="flex items-center text-sm font-medium text-slate-800">
                {marketplace.label}
              </div>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.missing_payment_rules[marketplace.key].t_plus_days}
                onChange={(event) =>
                  updateMissingPaymentRule(
                    marketplace.key,
                    "t_plus_days",
                    Math.max(1, Math.min(60, Number(event.target.value) || 1)),
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
              />
              <input
                type="number"
                min={0}
                max={14}
                value={settings.missing_payment_rules[marketplace.key].grace_days}
                onChange={(event) =>
                  updateMissingPaymentRule(
                    marketplace.key,
                    "grace_days",
                    Math.max(0, Math.min(14, Number(event.target.value) || 0)),
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-slate-900">Leakage detection sensitivity</h2>
        <p className="mt-2 text-[13px] text-slate-500">
          Control which discrepancies get flagged. Reduce noise by ignoring small differences.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-800">Minimum amount to flag</label>
            <select
              value={settings.leakage_sensitivity.minimum_discrepancy_amount}
              onChange={(event) =>
                updateLeakageSensitivity("minimum_discrepancy_amount", Number(event.target.value))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
            >
              {amountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Discrepancies below this amount will not be shown.
            </p>
          </div>

          <div>
            <span className="text-sm font-medium text-slate-800">Ignore rounding differences</span>
            <button
              type="button"
              onClick={() =>
                updateLeakageSensitivity(
                  "ignore_rounding_differences",
                  !settings.leakage_sensitivity.ignore_rounding_differences,
                )
              }
              className={`mt-2 flex h-10 w-16 items-center rounded-full border px-1 transition ${
                settings.leakage_sensitivity.ignore_rounding_differences
                  ? "border-teal-500 bg-teal-500"
                  : "border-slate-200 bg-slate-200"
              }`}
            >
              <span
                className={`h-7 w-7 rounded-full bg-white shadow transition ${
                  settings.leakage_sensitivity.ignore_rounding_differences ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Automatically ignore discrepancies of ₹1 or less.
            </p>
          </div>
        </div>

        {settings.leakage_sensitivity.ignore_rounding_differences && (
          <div className="mt-6 max-w-sm">
            <label className="text-sm font-medium text-slate-800">Rounding tolerance</label>
            <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-200">
              <span className="inline-flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                ₹
              </span>
              <input
                type="number"
                min={0}
                max={10}
                value={settings.leakage_sensitivity.rounding_tolerance_amount}
                onChange={(event) =>
                  updateLeakageSensitivity(
                    "rounding_tolerance_amount",
                    Math.max(0, Number(event.target.value) || 0),
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-700 outline-none transition focus:ring-4 focus:ring-teal-50"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Amounts within this range are treated as matched.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-slate-900">Rate card conflict handling</h2>
        <p className="mt-2 text-[13px] text-slate-500">
          When multiple active rate cards exist for the same marketplace and category, ReconEasy uses the latest version.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-4">
            <input
              type="radio"
              name="rate-card-conflict"
              checked={conflictBehavior === "warn_only"}
              onChange={() =>
                {
                  setSaveStatus("idle");
                  setSettings((current) =>
                    current
                      ? { ...current, rate_card_conflict_behavior: "warn_only" }
                      : current,
                  );
                }
              }
              className="mt-1 h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-800">Warn only (default)</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Show a warning when conflicts are detected but continue reconciliation using the latest active rate card.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 opacity-70">
            <input
              type="radio"
              name="rate-card-conflict"
              checked={conflictBehavior === "require_approval"}
              disabled
              readOnly
              className="mt-1 h-4 w-4 border-slate-300 text-slate-400"
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-700">Require admin approval</p>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  Coming soon
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Pause reconciliation for affected orders until conflicts are resolved.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Current selection logic: Latest active rate card wins
          <br />
          (sorted by effective_from DESC, then created_at DESC)
        </div>
      </section>

      <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
        {isDirty ? <span className="text-sm text-slate-400">Unsaved changes</span> : null}
        {saveStatus === "saved" ? (
          <span className="text-sm font-medium text-teal-600">Saved ✓</span>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saveStatus === "saving"}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition ${
            isDirty
              ? "bg-teal-600 text-white hover:bg-teal-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          <Save className="h-4 w-4" />
          {saveStatus === "saving" ? "Saving..." : "Save settings"}
        </button>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
