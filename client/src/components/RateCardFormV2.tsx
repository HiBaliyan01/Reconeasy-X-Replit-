import React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Plus, Trash2, Save, X, Info, ChevronDown } from "lucide-react";

/** ====== Setup ====== */
const feeCodes = ["shipping","rto","packaging","fixed","collection","tech","storage"] as const;
const commissionTypes = ["flat","tiered"] as const;
const settlementBases = ["t_plus","weekly","bi_weekly","monthly"] as const;

const SlabSchema = z.object({
  min_price: z.coerce.number().nonnegative().default(0),
  max_price: z.union([z.coerce.number().positive(), z.null()]).optional().transform(v => v===undefined?null:v),
  commission_percent: z.coerce.number().min(0,">= 0").max(100,"<= 100"),
});
const FeeRowSchema = z.object({
  fee_code: z.enum(feeCodes),
  fee_type: z.enum(["percent","amount"]).default("percent"),
  fee_value: z.coerce.number().min(0,">= 0"),
});

const FormSchema = z.object({
  id: z.string().optional(),
  mode: z.enum(["create","edit"]).default("create"),
  platform_id: z.string().min(1,"Select platform"),
  category_id: z.string().min(1,"Select category"),
  commission_type: z.enum(commissionTypes),
  commission_percent: z.coerce.number().min(0,">= 0").max(100,"<= 100").optional(),
  slabs: z.array(SlabSchema).default([]),
  fees: z.array(FeeRowSchema).default([]),
  gst_percent: z.coerce.number().min(0).max(28).default(18),
  tcs_percent: z.coerce.number().min(0).max(5).default(1),
  settlement_basis: z.enum(settlementBases),
  t_plus_days: z.coerce.number().int().min(1).optional(),
  weekly_weekday: z.coerce.number().int().min(1).max(7).optional(),
  bi_weekly_weekday: z.coerce.number().int().min(1).max(7).optional(),
  bi_weekly_which: z.enum(["first","second"]).optional(),
  monthly_day: z.string().regex(/^(?:[1-9]|[12][0-9]|3[01]|eom)$/i,"1–31 or 'eom'").optional(),
  grace_days: z.coerce.number().int().min(0).default(0),
  effective_from: z.string().min(1,"Pick a start date"),
  effective_to: z.string().optional().nullable(),
  global_min_price: z.coerce.number().nonnegative().optional(),
  global_max_price: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
}).superRefine((d,ctx)=>{
  if(d.commission_type==="flat"){
    if(d.commission_percent===undefined || isNaN(d.commission_percent as any)){
      ctx.addIssue({ code: z.ZodIssueCode.custom, message:"Commission % required for Flat", path:["commission_percent"] });
    }
  }else{
    if(!d.slabs.length) ctx.addIssue({ code:z.ZodIssueCode.custom, message:"Add at least one slab", path:["slabs"] });
    const s=[...d.slabs].sort((a,b)=>a.min_price-b.min_price);
    for(let i=0;i<s.length-1;i++){
      const cur=s[i], nxt=s[i+1], curMax=cur.max_price??Infinity;
      if(curMax>nxt.min_price){
        ctx.addIssue({ code:z.ZodIssueCode.custom, message:"Slabs overlap", path:["slabs", i, "max_price"] });
        break;
      }
    }
  }
  if(d.effective_to){
    const from=+new Date(d.effective_from), to=+new Date(d.effective_to);
    if(to<=from) ctx.addIssue({ code:z.ZodIssueCode.custom, message:"End must be after start", path:["effective_to"] });
  }
  switch(d.settlement_basis){
    case "t_plus": if(!d.t_plus_days) ctx.addIssue({ code:z.ZodIssueCode.custom, message:"Enter T+X days", path:["t_plus_days"] }); break;
    case "weekly": if(!d.weekly_weekday) ctx.addIssue({ code:z.ZodIssueCode.custom, message:"Pick weekday", path:["weekly_weekday"] }); break;
    case "bi_weekly":
      if(!d.bi_weekly_weekday) ctx.addIssue({ code:z.ZodIssueCode.custom, message:"Pick weekday", path:["bi_weekly_weekday"] });
      if(!d.bi_weekly_which) ctx.addIssue({ code:z.ZodIssueCode.custom, message:"First/second?", path:["bi_weekly_which"] });
      break;
    case "monthly": if(!d.monthly_day) ctx.addIssue({ code:z.ZodIssueCode.custom, message:"Enter day or 'eom'", path:["monthly_day"] }); break;
  }
});

export type RateCardFormValues = z.infer<typeof FormSchema>;

const defaultFees: RateCardFormValues["fees"] = feeCodes.map(c=>({
  fee_code:c, fee_type: c==="fixed"?"amount":"percent", fee_value:0
}));

/** ====== UI bits ====== */
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
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((p, ref) => (
  <input ref={ref} {...p} className={`w-full rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30 bg-white text-slate-900 placeholder-slate-400 ${p.className??""}`} />
));
Input.displayName = 'Input';
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((p, ref) => (
  <div className="relative">
    <select ref={ref} {...p} className={`w-full appearance-none rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500/30 bg-white pr-10 text-slate-900 ${p.className??""}`}></select>
    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
));
Select.displayName = 'Select';
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: "primary"|"secondary"|"ghost"|"danger"}> = ({variant="primary",className,children,...p})=>{
  const base="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition";
  const map={primary:"bg-teal-600 text-white hover:bg-teal-700",secondary:"bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",ghost:"bg-transparent text-slate-600 hover:bg-slate-100",danger:"bg-rose-600 text-white hover:bg-rose-700"} as Record<string,string>;
  return <button className={`${base} ${map[variant]} ${className??""}`} {...p}>{children}</button>;
};

/** ====== Form ====== */
export interface RateCardFormProps {
  mode?: "create"|"edit";
  initialData?: Partial<RateCardFormValues>;
  onSaved?: (id:string)=>void;
}

const FIELD_LABELS: Record<string, string> = {
  platform_id: "Platform",
  category_id: "Category",
  commission_percent: "Commission %",
  slabs: "Tiered slabs",
  t_plus_days: "T+X days",
  weekly_weekday: "Weekly weekday",
  bi_weekly_weekday: "Bi-weekly weekday",
  bi_weekly_which: "Bi-weekly which",
  monthly_day: "Monthly day",
  effective_from: "Effective From",
  effective_to: "Effective To",
};

const anchors: Record<string, string> = {
  platform_id: "fld-platform",
  category_id: "fld-category",
  commission_percent: "fld-commission",
  slabs: "fld-slabs",
  t_plus_days: "fld-tplus",
  weekly_weekday: "fld-weekly",
  bi_weekly_weekday: "fld-biww",
  bi_weekly_which: "fld-biwwhich",
  monthly_day: "fld-monthly",
  effective_from: "fld-from",
  effective_to: "fld-to",
};

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

  // compact, clickable error summary
  const flatErrors = (errs:any, path:string[]=[]): Array<{path:string; msg:string}> => {
    let out:Array<{path:string;msg:string}> = [];
    Object.entries(errs||{}).forEach(([k,v]:[string, any])=>{
      const p=[...path,k];
      if(v?.message) out.push({path:p.join("."), msg:v.message});
      if(typeof v==="object") out = out.concat(flatErrors(v, p));
    });
    // de-dup by path
    const seen = new Set<string>();
    return out.filter(e => (seen.has(e.path) ? false : (seen.add(e.path), true)));
  };

  const errorList = flatErrors(errors);
  const goto = (name:string) => {
    const id = anchors[name] || anchors[name.split(".")[0]];
    if(!id) return;
    const el = document.getElementById(id);
    el?.scrollIntoView({behavior:"smooth", block:"center"});
    (el as HTMLElement | null)?.focus?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, ()=>{/* show summary only; per-field messages already visible */})} className="max-w-4xl mx-auto">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur py-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{mode==="edit"?"Edit":"Add"} Rate Card</h2>
            <p className="text-slate-500 text-sm">Fees, taxes, settlement terms & validity.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={()=> (history.back?.(), undefined)}><X className="w-4 h-4"/>Cancel</Button>
            <Button type="submit" disabled={false}><Save className="w-4 h-4"/>Save</Button>
          </div>
        </div>

        {errorList.length > 0 && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <div className="font-medium mb-1">Please fix the following:</div>
            <div className="flex flex-wrap gap-2">
              {errorList.map((e, i)=> {
                const k = e.path.split(".")[0];
                return (
                  <button key={i} type="button" onClick={()=>goto(k)} className="px-2 py-1 rounded-lg bg-white text-rose-700 border border-rose-200 hover:bg-rose-100">
                    {(FIELD_LABELS[k] ?? k)}: {e.msg}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Platform */}
      <Section title="Platform Information" subtitle="Marketplace, category & commission type.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div id={anchors.platform_id}>
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
          <div id={anchors.category_id}>
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
              <div className="inline-flex bg-slate-100 rounded-xl p-1">
                {["flat","tiered"].map(v=> (
                  <button type="button" key={v} onClick={()=>field.onChange(v)} className={`px-3 py-1.5 rounded-lg text-sm ${field.value===v? "bg-white shadow text-teal-700":"text-slate-600"}`}>{v==="flat"?"Flat %":"Tiered/Slab"}</button>
                ))}
              </div>
            )}/>
          </div>
        </div>
      </Section>

      {/* Fees */}
      <Section title="Fee Details" subtitle="Commission and marketplace deductions.">
        { (commissionType==="flat") ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div id={anchors.commission_percent}>
              <Label>Commission %</Label>
              <Input type="number" step="0.01" placeholder="0" {...register("commission_percent")} />
              {errors.commission_percent && <p className="text-rose-600 text-xs mt-1">{errors.commission_percent.message as string}</p>}
            </div>
          </div>
        ) : (
          <div id={anchors.slabs}>
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
          {/* Fee rows */}
          {feeCodes.map((code, i)=> (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Label>Fee</Label>
                  <Controller
                    control={control}
                    name={`fees.${i}.fee_code`}
                    defaultValue={code as any}
                    render={({ field }) => (
                      <Select {...field}>
                        {feeCodes.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-3">
                  <Label>% / ₹</Label>
                  <Controller
                    control={control}
                    name={`fees.${i}.fee_type`}
                    defaultValue={code==="fixed" ? "amount":"percent" as any}
                    render={({ field }) => (
                      <Select {...field}>
                        <option value="percent">% of price</option>
                        <option value="amount">₹/unit</option>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-3">
                  <Label>Value</Label>
                  <Input type="number" step="0.01" {...register(`fees.${i}.fee_value` as const)} />
                </div>
                <div className="col-span-1 text-right">
                  <Button type="button" variant="ghost" onClick={()=>{
                    // reset this row
                    setValue(`fees.${i}.fee_value` as any, 0, {shouldDirty:true});
                  }}><Trash2 className="w-4 h-4 text-slate-500"/></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Taxes & Settlement */}
      <Section title="Taxes">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><Label>GST %</Label><Input type="number" step="0.01" {...register("gst_percent")} /></div>
          <div><Label>TCS %</Label><Input type="number" step="0.01" {...register("tcs_percent")} /></div>
        </div>
      </Section>

      <Section title="Settlement Terms" subtitle="Choose a basis & supply required detail.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Basis</Label>
            <Controller control={control} name="settlement_basis" render={({field})=> (
              <Select {...field}>
                <option value="t_plus">T+X Days</option>
                <option value="weekly">Weekly</option>
                <option value="bi_weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            )}/>
          </div>

          {/* conditional fields with anchors so banner links can scroll */}
          {basis==="t_plus" && (
            <div id={anchors.t_plus_days}><Label>T+X days</Label><Input type="number" {...register("t_plus_days")}/></div>
          )}
          {basis==="weekly" && (
            <div id={anchors.weekly_weekday}><Label>Weekday (1=Mon ... 7=Sun)</Label><Input type="number" min={1} max={7} {...register("weekly_weekday")}/></div>
          )}
          {basis==="bi_weekly" && (
            <>
              <div id={anchors.bi_weekly_weekday}><Label>Weekday</Label><Input type="number" min={1} max={7} {...register("bi_weekly_weekday")}/></div>
              <div id={anchors.bi_weekly_which}><Label>Which</Label>
                <Select {...register("bi_weekly_which" as const)}>
                  <option value="">--</option>
                  <option value="first">First</option>
                  <option value="second">Second</option>
                </Select>
              </div>
            </>
          )}
          {basis==="monthly" && (
            <div id={anchors.monthly_day}><Label>Day (1–31 or eom)</Label><Input placeholder="e.g. 7 or eom" {...register("monthly_day")}/></div>
          )}
        </div>
      </Section>

      {/* Validity */}
      <Section title="Validity Period">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div id={anchors.effective_from}><Label>Effective From</Label><Input type="date" {...register("effective_from")} /></div>
          <div id={anchors.effective_to}><Label>Effective To (optional)</Label><Input type="date" {...register("effective_to")} /></div>
        </div>
      </Section>
    </form>
  );
};

export default RateCardFormV2;
