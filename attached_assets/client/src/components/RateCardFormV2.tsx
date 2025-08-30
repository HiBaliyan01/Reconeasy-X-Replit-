import React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Plus, Trash2, Save, X, Info, ChevronDown } from "lucide-react";

/**
 * ReconEasy — Add/Edit Rate Card (v2)
 * Place at: client/src/components/RateCardFormV2.tsx
 * Assumes Tailwind is configured.
 */

const feeCodes = ["shipping","rto","packaging","fixed","collection","tech","storage"] as const;
const weekdays = [
  { label: "Mon", value: 1 },{ label: "Tue", value: 2 },{ label: "Wed", value: 3 },
  { label: "Thu", value: 4 },{ label: "Fri", value: 5 },{ label: "Sat", value: 6 },{ label: "Sun", value: 7 },
];
const commissionTypes = ["flat","tiered"] as const;
const settlementBases = ["t_plus","weekly","bi_weekly","monthly"] as const;

const SlabSchema = z.object({
  min_price: z.coerce.number().nonnegative().default(0),
  max_price: z.union([z.coerce.number().positive(), z.null()]).optional().transform(v => v===undefined?null:v),
  commission_percent: z.coerce.number().min(0).max(100),
});
const FeeRowSchema = z.object({
  fee_code: z.enum(feeCodes),
  fee_type: z.enum(["percent","amount"]).default("percent"),
  fee_value: z.coerce.number().min(0),
});

const FormSchema = z.object({
  id: z.string().optional(),
  mode: z.enum(["create","edit"]).default("create"),
  platform_id: z.string().min(1,"Select platform"),
  category_id: z.string().min(1,"Select category"),
  commission_type: z.enum(commissionTypes),
  commission_percent: z.coerce.number().min(0).max(100).optional(),
  slabs: z.array(SlabSchema).default([]),
  fees: z.array(FeeRowSchema).default([]),
  gst_percent: z.coerce.number().min(0).max(28).default(18),
  tcs_percent: z.coerce.number().min(0).max(5).default(1),
  settlement_basis: z.enum(settlementBases),
  t_plus_days: z.coerce.number().int().min(1).optional(),
  weekly_weekday: z.coerce.number().int().min(1).max(7).optional(),
  bi_weekly_weekday: z.coerce.number().int().min(1).max(7).optional(),
  bi_weekly_which: z.enum(["first","second"]).optional(),
  monthly_day: z.string().regex(/^(?:[1-9]|[12][0-9]|3[01]|eom)$/i,"1-31 or 'eom'").optional(),
  grace_days: z.coerce.number().int().min(0).default(0),
  effective_from: z.string().min(1,"Required"),
  effective_to: z.string().optional().nullable(),
  global_min_price: z.coerce.number().nonnegative().optional(),
  global_max_price: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
}).superRefine((d,ctx)=>{
  if(d.commission_type==="flat"){
    if(d.commission_percent===undefined || isNaN(d.commission_percent as any)){
      ctx.addIssue({code:z.ZodIssueCode.custom,message:"Commission % required for Flat"});
    }
  }else{
    if(!d.slabs.length) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Add at least one slab"});
    const s=[...d.slabs].sort((a,b)=>a.min_price-b.min_price);
    for(let i=0;i<s.length-1;i++){
      const cur=s[i], nxt=s[i+1], curMax=cur.max_price??Infinity;
      if(curMax>nxt.min_price){ ctx.addIssue({code:z.ZodIssueCode.custom,message:"Slabs overlap"}); break; }
    }
  }
  if(d.effective_to){
    const from=+new Date(d.effective_from), to=+new Date(d.effective_to);
    if(to<=from) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Effective To must be after From"});
  }
  switch(d.settlement_basis){
    case "t_plus": if(!d.t_plus_days) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Enter T+X days"}); break;
    case "weekly": if(!d.weekly_weekday) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Pick weekday"}); break;
    case "bi_weekly": if(!d.bi_weekly_weekday||!d.bi_weekly_which) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Pick weekday & first/second"}); break;
    case "monthly": if(!d.monthly_day) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Enter day or 'eom'"}); break;
  }
});

export type RateCardFormValues = z.infer<typeof FormSchema>;

const presets: Record<string, Partial<RateCardFormValues>> = {
  amazon: { settlement_basis:"t_plus", t_plus_days:7 },
  flipkart: { settlement_basis:"t_plus", t_plus_days:10 },
  myntra: { settlement_basis:"monthly", monthly_day:"7" },
  quick: { settlement_basis:"weekly", weekly_weekday:5 },
};

const defaultFees: RateCardFormValues["fees"] = feeCodes.map(c=>({fee_code:c, fee_type: c==="fixed"?"amount":"percent", fee_value:0}));

const Section: React.FC<{title:string;subtitle?:string;children:React.ReactNode}> = ({title,subtitle,children}) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
    <div className="mb-4">
      <h3 className="text-slate-900 text-lg font-semibold">{title}</h3>
      {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
    </div>
    {children}
  </div>
);
const Label: React.FC<{htmlFor?:string;children:React.ReactNode; hint?: string}> = ({htmlFor,children,hint}) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
    <span className="inline-flex items-center gap-1">{children} {hint && <Info className="w-3.5 h-3.5 text-slate-400" />}</span>
  </label>
);
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (p) => (
  <input {...p} className={`w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30 bg-white text-slate-900 placeholder-slate-400 ${p.className??""}`} />
);
const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (p) => (
  <div className="relative">
    <select {...p} className={`w-full appearance-none rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30 bg-white pr-10 text-slate-900 ${p.className??""}`}></select>
    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);
const ToggleGroup: React.FC<{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[]}> = ({value,onChange,options})=> (
  <div className="inline-flex bg-slate-100 rounded-xl p-1">
    {options.map(o=> (
      <button type="button" key={o.value} onClick={()=>onChange(o.value)} className={`px-3 py-1.5 rounded-lg text-sm ${value===o.value? "bg-white shadow text-teal-700":"text-slate-600"}`}>{o.label}</button>
    ))}
  </div>
);
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: "primary"|"secondary"|"ghost"|"danger"}> = ({variant="primary",className,children,...p})=>{
  const base="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition";
  const map={primary:"bg-teal-600 text-white hover:bg-teal-700",secondary:"bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",ghost:"bg-transparent text-slate-600 hover:bg-slate-100",danger:"bg-rose-600 text-white hover:bg-rose-700"} as Record<string,string>;
  return <button className={`${base} ${map[variant]} ${className??""}`} {...p}>{children}</button>;
};

export interface RateCardFormProps {
  mode?: "create"|"edit";
  initialData?: Partial<RateCardFormValues>;
  onSaved?: (id:string)=>void;
}

const RateCardFormV2: React.FC<RateCardFormProps> = ({mode="create", initialData, onSaved}) => {
  const { control, register, handleSubmit, watch, setValue, formState:{errors,isSubmitting} } =
    useForm<RateCardFormValues>({
      resolver: zodResolver(FormSchema),
      mode: "onBlur",
      defaultValues: {
        mode,
        platform_id: initialData?.platform_id ?? "",
        category_id: initialData?.category_id ?? "",
        commission_type: (initialData?.commission_type as any) ?? "flat",
        commission_percent: initialData?.commission_percent ?? 0,
        slabs: initialData?.slabs ?? [{min_price:0,max_price:null,commission_percent:0}],
        fees: initialData?.fees ?? defaultFees,
        gst_percent: initialData?.gst_percent ?? 18,
        tcs_percent: initialData?.tcs_percent ?? 1,
        settlement_basis: (initialData?.settlement_basis as any) ?? "t_plus",
        t_plus_days: initialData?.t_plus_days ?? 7,
        effective_from: initialData?.effective_from ?? new Date().toISOString().slice(0,10),
        effective_to: (initialData?.effective_to as any) ?? null,
        notes: initialData?.notes ?? "",
      }
    });

  const commissionType = watch("commission_type");
  const basis = watch("settlement_basis");

  const { fields: slabFields, append: slabAppend, remove: slabRemove } = useFieldArray({ control, name: "slabs" });
  const { fields: feeFields, append: feeAppend, remove: feeRemove } = useFieldArray({ control, name: "fees" });

  const applyPreset = (k: keyof typeof presets) => {
    const p = presets[k];
    Object.entries(p).forEach(([k,v])=> setValue(k as any, v as any, {shouldDirty:true, shouldValidate:true}));
  };

  const onSubmit = async (v: RateCardFormValues) => {
    const payload = {
      platform_id: v.platform_id, category_id: v.category_id, commission_type: v.commission_type,
      commission_percent: v.commission_type==="flat" ? v.commission_percent : null,
      slabs: v.commission_type==="tiered" ? v.slabs : [],
      fees: v.fees, gst_percent: v.gst_percent, tcs_percent: v.tcs_percent,
      settlement_basis: v.settlement_basis, t_plus_days: v.t_plus_days ?? null,
      weekly_weekday: v.weekly_weekday ?? null, bi_weekly_weekday: v.bi_weekly_weekday ?? null, bi_weekly_which: v.bi_weekly_which ?? null,
      monthly_day: v.monthly_day ?? null, grace_days: v.grace_days ?? 0,
      effective_from: v.effective_from, effective_to: v.effective_to || null,
      global_min_price: v.global_min_price ?? null, global_max_price: v.global_max_price ?? null, notes: v.notes ?? ""
    };
    try{
      const res = await axios[mode==="edit"?"put":"post"]("/api/rate-cards", payload);
      const id = res?.data?.id || v.id || "";
      onSaved?.(id);
      alert("Rate card saved");
    }catch(e:any){
      console.error(e); alert(e?.response?.data?.message || "Failed to save rate card");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-5xl mx-auto">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur py-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{mode==="edit"?"Edit":"Add"} Rate Card</h2>
            <p className="text-slate-500 text-sm">Fees, taxes, settlement terms & validity.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={()=> (history.back?.(), undefined)}><X className="w-4 h-4"/>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}><Save className="w-4 h-4"/>{isSubmitting?"Saving…":"Save"}</Button>
          </div>
        </div>
      </div>

      <Section title="Platform Information" subtitle="Marketplace, category & commission type.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Platform</Label>
            <Select defaultValue="" {...register("platform_id")}>
              <option value="" disabled>-- Select Platform --</option>
              <option value="amazon">Amazon</option>
              <option value="flipkart">Flipkart</option>
              <option value="myntra">Myntra</option>
              <option value="ajio">AJIO</option>
              <option value="quick">Quick Commerce (Blinkit/Zepto)</option>
            </Select>
            {errors.platform_id && <p className="text-rose-600 text-xs mt-1">{errors.platform_id.message}</p>}
          </div>
          <div>
            <Label>Category</Label>
            <Select defaultValue="" {...register("category_id")}>
              <option value="" disabled>-- Select Category --</option>
              <option value="apparel">Apparel</option>
              <option value="electronics">Electronics</option>
              <option value="beauty">Beauty</option>
              <option value="home">Home</option>
            </Select>
            {errors.category_id && <p className="text-rose-600 text-xs mt-1">{errors.category_id.message}</p>}
          </div>
          <div>
            <Label>Commission Type</Label>
            <Controller control={control} name="commission_type" render={({field})=> (
              <ToggleGroup value={field.value} onChange={(v)=>field.onChange(v as any)} options={[{value:"flat",label:"Flat %"}, {value:"tiered",label:"Tiered/Slab"}]} />
            )}/>
          </div>
        </div>
      </Section>

      <Section title="Fee Details" subtitle="Commission and marketplace deductions.">
        { (commissionType==="flat") ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Commission %</Label>
              <Input type="number" step="0.01" placeholder="0" {...register("commission_percent")} />
              {errors.commission_percent && <p className="text-rose-600 text-xs mt-1">{errors.commission_percent.message as string}</p>}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-800">Tiered Commission</h4>
              <Button type="button" variant="secondary" onClick={()=> slabAppend({min_price:0,max_price:null,commission_percent:0})}><Plus className="w-4 h-4"/>Add Slab</Button>
            </div>
            <div className="overflow-x-auto -mx-2">
              <table className="min-w-full text-sm border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-2">Min Price (₹)</th>
                    <th className="px-2">Max Price (₹ or blank)</th>
                    <th className="px-2">Commission %</th>
                    <th className="px-2"></th>
                  </tr>
                </thead>
                <tbody>
                {slabFields.map((row,idx)=> (
                  <tr key={row.id} className="bg-slate-50/60">
                    <td className="px-2 py-2"><Input type="number" step="0.01" {...register(`slabs.${idx}.min_price` as const)} /></td>
                    <td className="px-2 py-2"><Input type="number" step="0.01" placeholder="∞" {...register(`slabs.${idx}.max_price` as const)} /></td>
                    <td className="px-2 py-2"><Input type="number" step="0.01" {...register(`slabs.${idx}.commission_percent` as const)} /></td>
                    <td className="px-2 py-2 text-right"><Button type="button" variant="ghost" onClick={()=> slabRemove(idx)}><Trash2 className="w-4 h-4 text-slate-500"/></Button></td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
            {errors.slabs && <p className="text-rose-600 text-xs mt-2">{(errors.slabs as any)?.message ?? "Check slab ranges (no overlap)."}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {feeFields.map((f, i)=> (
            <div key={f.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="capitalize">{(f as any).fee_code}</Label>
                <Controller control={control} name={`fees.${i}.fee_type` as const} render={({field})=> (
                  <ToggleGroup value={field.value} onChange={(v)=>field.onChange(v as any)} options={[{value:"percent",label:"%"}, {value:"amount",label:"₹"}]} />
                )}/>
              </div>
              <Input type="number" step="0.01" placeholder="0" {...register(`fees.${i}.fee_value` as const)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Taxes">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><Label>GST %</Label><Input type="number" step="0.01" {...register("gst_percent")} /></div>
          <div><Label>TCS %</Label><Input type="number" step="0.01" {...register("tcs_percent")} /></div>
          <div><Label>Grace Days (SLA tolerance)</Label><Input type="number" step="1" {...register("grace_days")} /></div>
        </div>
      </Section>

      <Section title="Payment Terms & Settlement Frequency" subtitle="Use presets then adjust.">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-slate-600">Presets:</span>
          <Button type="button" variant="secondary" onClick={()=>applyPreset("amazon")}>Amazon (T+7)</Button>
          <Button type="button" variant="secondary" onClick={()=>applyPreset("flipkart")}>Flipkart (T+10)</Button>
          <Button type="button" variant="secondary" onClick={()=>applyPreset("myntra")}>Myntra (Monthly)</Button>
          <Button type="button" variant="secondary" onClick={()=>applyPreset("quick")}>Quick Commerce (Weekly)</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Settlement Basis</Label>
            <Select defaultValue={basis} {...register("settlement_basis")}>
              <option value="t_plus">T+X days</option>
              <option value="weekly">Weekly</option>
              <option value="bi_weekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>
          {basis==="t_plus" && <div><Label>T+X (days)</Label><Input type="number" step="1" placeholder="7" {...register("t_plus_days")} /></div>}
          {basis==="weekly" && (
            <div><Label>Weekday</Label>
              <Select defaultValue="" {...register("weekly_weekday")}>
                <option value="" disabled>-- select --</option>
                {weekdays.map(d=> <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </div>
          )}
          {basis==="bi_weekly" && (<>
            <div><Label>Weekday</Label>
              <Select defaultValue="" {...register("bi_weekly_weekday")}>
                <option value="" disabled>-- select --</option>
                {weekdays.map(d=> <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </div>
            <div><Label>Which</Label>
              <Select defaultValue="" {...register("bi_weekly_which")}>
                <option value="" disabled>-- select --</option>
                <option value="first">First</option>
                <option value="second">Second</option>
              </Select>
            </div>
          </>)}
          {basis==="monthly" && <div><Label>Day of Month (1–31 or eom)</Label><Input placeholder="e.g. 7 or eom" {...register("monthly_day")} /></div>}
        </div>
      </Section>

      <Section title="Validity & Price Bounds">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Effective From</Label><Input type="date" {...register("effective_from")} /></div>
          <div><Label>Effective To (optional)</Label><Input type="date" {...register("effective_to")} /></div>
        </div>
        <div className="mt-4"><Label>Notes</Label><textarea rows={3} className="w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30" {...register("notes")} /></div>
      </Section>

      <div className="flex items-center justify-end gap-2 mt-6">
        <Button type="button" variant="secondary" onClick={()=> (history.back?.(), undefined)}><X className="w-4 h-4" />Cancel</Button>
        <Button type="submit" disabled={isSubmitting}><Save className="w-4 h-4" />{isSubmitting?"Saving…":"Save"}</Button>
      </div>
    </form>
  );
};

export default RateCardFormV2;
