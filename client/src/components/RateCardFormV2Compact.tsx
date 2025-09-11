import React, { useEffect, useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import {
  Plus, Trash2, Save, X, ChevronDown, ChevronUp, Info, GripVertical
} from "lucide-react";

/**
 * ReconEasy — Rate Card Form V2 (Compact)
 * - Accordions: Fees, Taxes, Additional Options (collapsed by default)
 * - Single Fee Table with add/remove + %/₹ toggle
 * - Sticky Save Bar when form is dirty
 * - Same schema/payload as before
 */

const FEE_CODES = [
  "shipping", "rto", "packaging", "fixed", "collection", "tech", "storage",
] as const;

const FIELD_LABELS: Record<string, string> = {
  platform_id: "Platform",
  category_id: "Category",
  commission_percent: "Commission %",
  slabs: "Tiered slabs",
  settlement_basis: "Settlement basis",
  t_plus_days: "T+X days",
  weekly_weekday: "Weekly weekday",
  bi_weekly_weekday: "Bi-weekly weekday",
  bi_weekly_which: "Bi-weekly which",
  monthly_day: "Monthly day",
  effective_from: "Effective From",
  effective_to: "Effective To",
};
const WEEKDAYS = [
  { label: "Mon", value: 1 }, { label: "Tue", value: 2 }, { label: "Wed", value: 3 },
  { label: "Thu", value: 4 }, { label: "Fri", value: 5 }, { label: "Sat", value: 6 }, { label: "Sun", value: 7 },
];
const COMM_TYPES = ["flat", "tiered"] as const;
const SETTLEMENTS = ["t_plus", "weekly", "bi_weekly", "monthly"] as const;

const SlabSchema = z.object({
  min_price: z.coerce.number().nonnegative().default(0),
  max_price: z.union([z.coerce.number().positive(), z.null()]).optional().transform(v => v ?? null),
  commission_percent: z.coerce.number().min(0).max(100),
});
const FeeRowSchema = z.object({
  fee_code: z.enum(FEE_CODES),
  fee_type: z.enum(["percent", "amount"]).default("percent"),
  fee_value: z.coerce.number().min(0),
});

const FormSchema = z.object({
  id: z.string().optional(),
  mode: z.enum(["create", "edit"]).default("create"),
  platform_id: z.string().min(1, "Select platform"),
  category_id: z.string().min(1, "Select category"),
  commission_type: z.enum(COMM_TYPES),
  commission_percent: z.coerce.number().min(0).max(100).optional(),
  slabs: z.array(SlabSchema).default([]),
  fees: z.array(FeeRowSchema).default([]),
  gst_percent: z.coerce.number().min(0).max(28).default(18),
  tcs_percent: z.coerce.number().min(0).max(5).default(1),
  settlement_basis: z.enum(SETTLEMENTS),
  t_plus_days: z.coerce.number().int().min(1).optional(),
  weekly_weekday: z.coerce.number().int().min(1).max(7).optional(),
  bi_weekly_weekday: z.coerce.number().int().min(1).max(7).optional(),
  bi_weekly_which: z.enum(["first", "second"]).optional(),
  monthly_day: z.string().regex(/^(?:[1-9]|[12][0-9]|3[01]|eom)$/i, "1–31 or 'eom'").optional(),
  grace_days: z.coerce.number().int().min(0).default(0),
  effective_from: z.string().min(1, "Required"),
  effective_to: z.string().optional().nullable(),
  global_min_price: z.coerce.number().nonnegative().optional(),
  global_max_price: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.commission_type === "flat") {
    if (d.commission_percent === undefined || isNaN(d.commission_percent as any)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Commission % required for Flat" });
    }
  } else {
    if (!d.slabs.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add at least one slab" });
    const s = [...d.slabs].sort((a, b) => a.min_price - b.min_price);
    for (let i = 0; i < s.length - 1; i++) {
      const cur = s[i], nxt = s[i + 1], curMax = cur.max_price ?? Infinity;
      if (curMax > nxt.min_price) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Slabs overlap" }); break;
      }
    }
  }
  if (d.effective_to) {
    const from = +new Date(d.effective_from), to = +new Date(d.effective_to);
    if (to <= from) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Effective To must be after From" });
  }
  switch (d.settlement_basis) {
    case "t_plus": if (!d.t_plus_days) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter T+X days" }); break;
    case "weekly": if (!d.weekly_weekday) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick weekday" }); break;
    case "bi_weekly": if (!d.bi_weekly_weekday || !d.bi_weekly_which) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick weekday & first/second" }); break;
    case "monthly": if (!d.monthly_day) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter day or 'eom'" }); break;
  }
});

export type RateCardFormValues = z.infer<typeof FormSchema>;

const presets: Record<string, Partial<RateCardFormValues>> = {
  amazon: { settlement_basis: "t_plus", t_plus_days: 7 },
  flipkart: { settlement_basis: "t_plus", t_plus_days: 10 },
  myntra: { settlement_basis: "monthly", monthly_day: "7" }, // second day can be handled by a second card or future feature
  quick: { settlement_basis: "weekly", weekly_weekday: 5 },
};

const defaultFees: RateCardFormValues["fees"] = [
  { fee_code: "shipping", fee_type: "percent", fee_value: 0 },
  { fee_code: "rto",       fee_type: "percent", fee_value: 0 },
  { fee_code: "packaging", fee_type: "percent", fee_value: 0 },
];

const Section = ({ title, subtitle, children }: any) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
    <div className="mb-4">
      <h3 className="text-slate-900 text-lg font-semibold">{title}</h3>
      {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Label = ({ children }: any) => (
  <label className="block text-sm font-medium text-slate-700">{children}</label>
);
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((p, ref) => (
  <input
    ref={ref}
    {...p}
    className={`w-full rounded-xl border-slate-200 bg-white/80 focus:border-teal-500 focus:ring-teal-500/30 shadow-sm text-slate-900 placeholder-slate-500 ${p.className ?? ""}`}
  />
 ));
Input.displayName = 'Input';
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((p, ref) => (
  <div className="relative">
    <select
      ref={ref}
      {...p}
      className={`w-full appearance-none rounded-xl border-slate-200 bg-white/80 focus:border-teal-500 focus:ring-teal-500/30 shadow-sm pr-10 text-slate-900 ${p.className ?? ""}`}
    />
    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
));
Select.displayName = 'Select';

function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode; }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-100 bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function ToggleGroup({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="inline-flex bg-slate-100 rounded-xl p-1">
      {options.map((o) => (
        <button key={o.value} type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-sm ${value === o.value ? "bg-white shadow text-teal-700" : "text-slate-600"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Button = ({ variant = "primary", className, ...p }: any) => {
  const base = "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition";
  const map: any = {
    primary: "bg-teal-600 text-white hover:bg-teal-700",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return <button className={`${base} ${map[variant]} ${className ?? ""}`} {...p} />;
};

/** FeeTable: one compact table with add/remove rows */
function FeeTable({
  control, register, name, value, onAdd, onRemove, usedCodes
}: any) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left">Fee</th>
            <th className="px-3 py-2 text-left">% / ₹</th>
            <th className="px-3 py-2 text-left">Value</th>
            <th className="px-3 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {value.map((row: any, i: number) => (
            <tr key={`${row.fee_code}-${i}`} className="border-t">
              <td className="px-3 py-2">
                <Controller
                  control={control}
                  name={`${name}.${i}.fee_code`}
                  render={({ field }) => {
                    const used = usedCodes.filter((u: string, idx: number) => idx !== i);
                    return (
                      <select
                        {...field}
                        className="w-full rounded-xl border-slate-200 bg-white/80 focus:border-teal-500 focus:ring-teal-500/30 shadow-sm"
                      >
                        {FEE_CODES.map((c) => (
                          <option key={c} value={c} disabled={used.includes(c)}>
                            {c}
                          </option>
                        ))}
                      </select>
                    );
                  }}
                />
              </td>
              <td className="px-3 py-2">
                <Controller control={control} name={`${name}.${i}.fee_type`}
                  render={({ field }) => (
                    <ToggleGroup value={field.value} onChange={(v) => field.onChange(v)}
                      options={[{ value: "percent", label: "%" }, { value: "amount", label: "₹" }]}
                    />
                  )}
                />
              </td>
              <td className="px-3 py-2">
                <Input type="number" step="0.01" placeholder="0" {...register(`${name}.${i}.fee_value`)} />
              </td>
              <td className="px-3 py-2 text-right">
                <Button type="button" variant="ghost" onClick={() => onRemove(i)}>
                  <Trash2 className="w-4 h-4 text-slate-500" /> Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add row */}
      <div className="mt-3">
        <FeeAdder used={usedCodes} onAdd={onAdd} />
      </div>
    </div>
  );
}

function FeeAdder({ used, onAdd }: { used: string[]; onAdd: (code: string) => void }) {
  const [code, setCode] = React.useState<string>("");
  const available = FEE_CODES.filter((c) => !used.includes(c));
  return (
    <div className="flex gap-2 items-center">
      <Select value={code} onChange={(e: any) => setCode(e.target.value)}>
        <option value="">+ Add fee</option>
        {available.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Button type="button" variant="secondary" onClick={() => code && (onAdd(code), setCode(""))}>Add</Button>
    </div>
  );
}

export interface RateCardFormProps {
  mode?: "create" | "edit";
  initialData?: Partial<RateCardFormValues>;
  onSaved?: (id: string) => void;
}

const RateCardFormV2: React.FC<RateCardFormProps> = ({ mode = "create", initialData, onSaved }) => {
  const [showErrorBanner, setShowErrorBanner] = React.useState(false);

  const {
    control, register, handleSubmit, watch, setValue, formState: { errors, isSubmitting, isDirty }
  } = useForm<RateCardFormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onBlur",
    defaultValues: {
      mode,
      platform_id: initialData?.platform_id ?? "",
      category_id: initialData?.category_id ?? "",
      commission_type: (initialData?.commission_type as any) ?? "flat",
      commission_percent: initialData?.commission_percent ?? 0,
      slabs: initialData?.slabs ?? [{ min_price: 0, max_price: null, commission_percent: 0 }],
      fees: initialData?.fees ?? defaultFees,
      gst_percent: initialData?.gst_percent ?? 18,
      tcs_percent: initialData?.tcs_percent ?? 1,
      settlement_basis: (initialData?.settlement_basis as any) ?? "t_plus",
      t_plus_days: initialData?.t_plus_days ?? 7,
      weekly_weekday: initialData?.weekly_weekday ?? undefined,
      bi_weekly_weekday: initialData?.bi_weekly_weekday ?? undefined,
      bi_weekly_which: initialData?.bi_weekly_which ?? undefined,
      monthly_day: initialData?.monthly_day ?? undefined,
      grace_days: initialData?.grace_days ?? 0,
      effective_from: initialData?.effective_from ?? new Date().toISOString().slice(0, 10),
      effective_to: (initialData?.effective_to as any) ?? null,
      global_min_price: initialData?.global_min_price ?? undefined,
      global_max_price: initialData?.global_max_price ?? undefined,
      notes: initialData?.notes ?? "",
    },
  });

  const commissionType = watch("commission_type");
  const basis = watch("settlement_basis");
  const fees = watch("fees") || [];
  const usedFeeCodes = useMemo(() => fees.map((f: any) => f.fee_code), [fees]);

  const { fields: slabFields, append: slabAppend, remove: slabRemove } = useFieldArray({ control, name: "slabs" });
  const { fields: feeFields, append: feeAppend, remove: feeRemove } = useFieldArray({ control, name: "fees" });

  const scrollToFirstError = () => {
    const first = Object.keys(errors)[0];
    if (!first) return;
    const el = document.querySelector(`[name="${first}"]`);
    (el as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const applyPreset = (k: keyof typeof presets) => {
    const p = presets[k];
    Object.entries(p).forEach(([k, v]) => setValue(k as any, v as any, { shouldDirty: true, shouldValidate: true }));
  };

  const onSubmit = async (v: RateCardFormValues) => {
    const payload = {
      platform_id: v.platform_id, category_id: v.category_id, commission_type: v.commission_type,
      commission_percent: v.commission_type === "flat" ? v.commission_percent : null,
      slabs: v.commission_type === "tiered" ? v.slabs : [],
      fees: v.fees, gst_percent: v.gst_percent, tcs_percent: v.tcs_percent,
      settlement_basis: v.settlement_basis, t_plus_days: v.t_plus_days ?? null,
      weekly_weekday: v.weekly_weekday ?? null, bi_weekly_weekday: v.bi_weekly_weekday ?? null, bi_weekly_which: v.bi_weekly_which ?? null,
      monthly_day: v.monthly_day ?? null, grace_days: v.grace_days,
      effective_from: v.effective_from, effective_to: v.effective_to || null,
      global_min_price: v.global_min_price ?? null, global_max_price: v.global_max_price ?? null,
      notes: v.notes || null,
      ...(mode === "edit" && { id: v.id })
    };

    try {
      const res = mode === "edit"
        ? await axios.put(`/api/rate-cards-v2/${v.id}`, payload)
        : await axios.post("/api/rate-cards-v2", payload);
      onSaved?.(res.data.id);
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(err.response?.data?.message || "Save failed");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 relative">
      <form
        onSubmit={handleSubmit(onSubmit, () => {
          setShowErrorBanner(true);
          scrollToFirstError();
        })}
        className="space-y-6"
      >

        {/* Error Banner */}
        {showErrorBanner && Object.keys(errors).length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
            <p className="font-semibold text-rose-700 mb-2">Please fix the following:</p>
            <ul className="list-disc ml-5 space-y-1">
              {Object.entries(errors).map(([k, v]) => (
                <li key={k} className="text-rose-700">
                  {(FIELD_LABELS[k] ?? k)}: {(v as any)?.message ?? "Required"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Header */}
        <Section title={mode === "edit" ? "Edit Rate Card" : "New Rate Card"} subtitle="Configure your marketplace rate card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Platform</Label>
              <Select defaultValue="" {...register("platform_id")} aria-invalid={!!errors.platform_id}>
                <option value="">Select Platform</option>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="myntra">Myntra</option>
                <option value="nykaa">Nykaa</option>
                <option value="ajio">AJIO</option>
              </Select>
              {errors.platform_id && <p className="text-rose-500 text-xs mt-1">{errors.platform_id.message}</p>}
            </div>
            <div>
              <Label>Category</Label>
              <Select defaultValue="" {...register("category_id")} aria-invalid={!!errors.category_id}>
                <option value="">Select Category</option>
                <option value="apparel">Apparel</option>
                <option value="footwear">Footwear</option>
                <option value="electronics">Electronics</option>
                <option value="home">Home & Kitchen</option>
                <option value="beauty">Beauty & Personal Care</option>
                <option value="books">Books</option>
                <option value="sports">Sports & Fitness</option>
              </Select>
              {errors.category_id && <p className="text-rose-500 text-xs mt-1">{errors.category_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-1">
                {Object.keys(presets).map(k => (
                  <Button key={k} type="button" variant="secondary" className="text-xs py-1 px-2" onClick={() => applyPreset(k as keyof typeof presets)}>
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Commission */}
        <Section title="Commission Structure">
          <div className="space-y-4">
            <div>
              <Label>Commission Type</Label>
              <Controller control={control} name="commission_type"
                render={({ field }) => (
                  <ToggleGroup value={field.value} onChange={(v) => field.onChange(v)}
                    options={[{ value: "flat", label: "Flat %" }, { value: "tiered", label: "Tiered" }]}
                  />
                )}
              />
            </div>

            {commissionType === "flat" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Commission %</Label>
                  <Controller
                    control={control}
                    name="commission_percent"
                    render={({ field }) => (
                      <Input type="number" step="0.01" min="0" max="100" placeholder="0"
                             value={field.value as any ?? ''}
                             onChange={(e:any)=>field.onChange(e.target.value)} />
                    )}
                  />
                  {errors.commission_percent && <p className="text-rose-500 text-xs mt-1">{errors.commission_percent.message}</p>}
                </div>
              </div>
            )}

            {commissionType === "tiered" && (
              <div>
                <Label>Commission Slabs</Label>
                <div className="space-y-2">
                  {slabFields.map((field, i) => (
                    <div key={field.id} className="grid grid-cols-4 gap-2 items-end">
                      <div>
                        <Input type="number" step="0.01" min="0" placeholder="Min ₹" {...register(`slabs.${i}.min_price`)} />
                      </div>
                      <div>
                        <Input type="number" step="0.01" min="0" placeholder="Max ₹ (blank = no limit)" {...register(`slabs.${i}.max_price`)} />
                      </div>
                      <div>
                        <Input type="number" step="0.01" min="0" max="100" placeholder="%" {...register(`slabs.${i}.commission_percent`)} />
                      </div>
                      <div>
                        <Button type="button" variant="ghost" onClick={() => slabRemove(i)}>
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="secondary" onClick={() => slabAppend({ min_price: 0, max_price: null, commission_percent: 0 })}>
                  <Plus className="w-4 h-4" /> Add Slab
                </Button>
                {errors.slabs && <p className="text-rose-500 text-xs mt-1">{errors.slabs.message as any}</p>}
              </div>
            )}
          </div>
        </Section>

        {/* Validity */}
        <Section title="Validity Period">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Effective From</Label>
              <Controller control={control} name="effective_from" render={({ field }) => (
                <Input type="date" value={field.value ?? ''} onChange={(e:any)=>field.onChange(e.target.value)} />
              )} />
              {errors.effective_from && <p className="text-rose-500 text-xs mt-1">{errors.effective_from.message}</p>}
            </div>
            <div>
              <Label>Effective To (Optional)</Label>
              <Controller control={control} name="effective_to" render={({ field }) => (
                <Input type="date" value={(field.value as any) ?? ''} onChange={(e:any)=>field.onChange(e.target.value)} />
              )} />
              {errors.effective_to && <p className="text-rose-500 text-xs mt-1">{errors.effective_to.message}</p>}
            </div>
          </div>
        </Section>

        {/* Accordions */}
        <div className="space-y-4">
          
          {/* Fees Accordion */}
          <Accordion title="Fees & Deductions" defaultOpen={false}>
            <FeeTable
              control={control}
              register={register}
              name="fees"
              value={fees}
              usedCodes={usedFeeCodes}
              onAdd={(code: string) => feeAppend({ fee_code: code, fee_type: "percent", fee_value: 0 })}
              onRemove={(i: number) => feeRemove(i)}
            />
          </Accordion>

          {/* Taxes Accordion */}
          <Accordion title="Taxes" defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>GST %</Label>
                <Controller control={control} name="gst_percent" render={({ field }) => (
                  <Input type="number" step="0.01" min="0" max="28" placeholder="18" value={field.value as any ?? ''} onChange={(e:any)=>field.onChange(e.target.value)} />
                )} />
                {errors.gst_percent && <p className="text-rose-500 text-xs mt-1">{errors.gst_percent.message}</p>}
              </div>
              <div>
                <Label>TCS %</Label>
                <Controller control={control} name="tcs_percent" render={({ field }) => (
                  <Input type="number" step="0.01" min="0" max="5" placeholder="1" value={field.value as any ?? ''} onChange={(e:any)=>field.onChange(e.target.value)} />
                )} />
                {errors.tcs_percent && <p className="text-rose-500 text-xs mt-1">{errors.tcs_percent.message}</p>}
              </div>
            </div>
          </Accordion>

          {/* Settlement Accordion */}
          <Accordion title="Settlement Terms" defaultOpen={false}>
            <div className="space-y-4">
              <div>
                <Label>Settlement Basis</Label>
                <Controller control={control} name="settlement_basis"
                  render={({ field }) => (
                    <ToggleGroup value={field.value} onChange={(v) => field.onChange(v)}
                      options={[
                        { value: "t_plus", label: "T+" },
                        { value: "weekly", label: "Weekly" },
                        { value: "bi_weekly", label: "Bi-weekly" },
                        { value: "monthly", label: "Monthly" }
                      ]}
                    />
                  )}
                />
              </div>

              {basis === "t_plus" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>T+ Days</Label>
                    <Controller control={control} name="t_plus_days" render={({ field }) => (
                      <Input type="number" min="1" placeholder="7" value={field.value as any ?? ''} onChange={(e:any)=>field.onChange(e.target.value)} />
                    )} />
                    {errors.t_plus_days && <p className="text-rose-500 text-xs mt-1">{errors.t_plus_days.message}</p>}
                  </div>
                  <div>
                    <Label>Grace Days</Label>
                    <Input type="number" min="0" placeholder="0" {...register("grace_days")} />
                  </div>
                </div>
              )}

              {basis === "weekly" && (
                <div>
                  <Label>Settlement Day</Label>
                  <Select {...register("weekly_weekday")}>
                    <option value="">Select Day</option>
                    {WEEKDAYS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </Select>
                  {errors.weekly_weekday && <p className="text-rose-500 text-xs mt-1">{errors.weekly_weekday.message}</p>}
                </div>
              )}

              {basis === "bi_weekly" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Settlement Day</Label>
                    <Select {...register("bi_weekly_weekday")}>
                      <option value="">Select Day</option>
                      {WEEKDAYS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                    </Select>
                    {errors.bi_weekly_weekday && <p className="text-rose-500 text-xs mt-1">{errors.bi_weekly_weekday.message}</p>}
                  </div>
                  <div>
                    <Label>Which Occurrence</Label>
                    <Select {...register("bi_weekly_which")}>
                      <option value="">Select</option>
                      <option value="first">First</option>
                      <option value="second">Second</option>
                    </Select>
                    {errors.bi_weekly_which && <p className="text-rose-500 text-xs mt-1">{errors.bi_weekly_which.message}</p>}
                  </div>
                </div>
              )}

              {basis === "monthly" && (
                <div>
                  <Label>Settlement Day (1-31 or 'eom')</Label>
                  <Input placeholder="e.g., 15 or eom" {...register("monthly_day")} />
                  {errors.monthly_day && <p className="text-rose-500 text-xs mt-1">{errors.monthly_day.message}</p>}
                </div>
              )}
            </div>
          </Accordion>

          {/* Additional Options */}
          <Accordion title="Additional Options" defaultOpen={false}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Global Min Price (₹)</Label>
                  <Controller control={control} name="global_min_price" render={({ field }) => (
                    <Input type="number" step="0.01" min="0" placeholder="Optional" value={field.value as any ?? ''} onChange={(e:any)=>field.onChange(e.target.value)} />
                  )} />
                </div>
                <div>
                  <Label>Global Max Price (₹)</Label>
                  <Controller control={control} name="global_max_price" render={({ field }) => (
                    <Input type="number" step="0.01" min="0" placeholder="Optional" value={field.value as any ?? ''} onChange={(e:any)=>field.onChange(e.target.value)} />
                  )} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <textarea
                  rows={3}
                  placeholder="Additional notes or terms..."
                  {...register("notes")}
                  className="w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30 bg-white text-slate-900 placeholder-slate-500"
                />
              </div>
            </div>
          </Accordion>

        </div>

      </form>

      {/* Sticky Save Bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Info className="w-4 h-4" />
              You have unsaved changes
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
                <X className="w-4 h-4" /> Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                onClick={handleSubmit(onSubmit)}
                data-testid="button-save-rate-card"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? "Saving..." : "Save Rate Card"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global errors */}
      {Object.keys(errors).length > 0 && (
        <div className="fixed top-4 right-4 bg-rose-50 border border-rose-200 rounded-xl p-4 max-w-md z-50">
          <h4 className="text-rose-800 font-medium mb-2">Please fix the following:</h4>
          <ul className="text-rose-700 text-sm space-y-1">
            {Object.entries(errors).map(([key, error]) => (
              <li key={key}>• {error?.message || `Error in ${key}`}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};

export default RateCardFormV2;
