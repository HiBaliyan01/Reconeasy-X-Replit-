import React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Save, X, Info, ChevronDown } from "lucide-react";

/**
 * ReconEasy — Add/Edit Rate Card (v2)
 * Advanced rate card management with tiered commission slabs and settlement options
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
  <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-6">
    <div className="mb-4">
      <h3 className="text-foreground text-lg font-semibold">{title}</h3>
      {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Label: React.FC<{htmlFor?:string;children:React.ReactNode; hint?: string}> = ({htmlFor,children,hint}) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
    <span className="inline-flex items-center gap-1">{children} {hint && <Info className="w-3.5 h-3.5 text-muted-foreground" />}</span>
  </label>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (p) => (
  <input {...p} className={`w-full rounded-lg border-input focus:border-primary focus:ring-primary/30 bg-background text-foreground placeholder-muted-foreground ${p.className??""}`} />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (p) => (
  <div className="relative">
    <select {...p} className={`w-full appearance-none rounded-lg border-input focus:border-primary focus:ring-primary/30 bg-background pr-10 text-foreground ${p.className??""}`}>
      {p.children}
    </select>
    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

const ToggleGroup: React.FC<{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[]}> = ({value,onChange,options})=> (
  <div className="inline-flex bg-muted rounded-lg p-1">
    {options.map(o=> (
      <button type="button" key={o.value} onClick={()=>onChange(o.value)} className={`px-3 py-1.5 rounded-md text-sm transition-colors ${value===o.value? "bg-background shadow text-primary":"text-muted-foreground hover:text-foreground"}`}>{o.label}</button>
    ))}
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: "primary"|"secondary"|"ghost"|"danger", size?: string}> = ({variant="primary",className,size,children,...p})=>{
  const base="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors";
  const variants={
    primary:"bg-primary text-primary-foreground hover:bg-primary/90",
    secondary:"bg-secondary border border-border text-secondary-foreground hover:bg-secondary/80",
    ghost:"bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    danger:"bg-destructive text-destructive-foreground hover:bg-destructive/90"
  };
  return <button className={`${base} ${variants[variant]} ${className??""}`} {...p}>{children}</button>;
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
      monthly_day: v.monthly_day ?? null, grace_days: v.grace_days,
      effective_from: v.effective_from, effective_to: v.effective_to || null,
      global_min_price: v.global_min_price ?? null, global_max_price: v.global_max_price ?? null,
      notes: v.notes || null,
      ...(mode==="edit" && {id: v.id})
    };

    try {
      const method = mode==="create" ? "POST" : "PUT";
      const response = await fetch("/api/rate-cards-v2", {
        method,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });

      if(!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to save rate card");
      }

      const result = await response.json();
      alert(`Rate card ${mode==="create"?"created":"updated"} successfully!`);
      onSaved?.(result.id);
    } catch(e) {
      alert(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{mode==="create"?"Create":"Edit"} Rate Card</h1>
            <p className="text-muted-foreground">Advanced rate card configuration with tiered pricing</p>
          </div>
          <div className="flex gap-2">
            {Object.keys(presets).map(k=> (
              <Button key={k} type="button" variant="ghost" onClick={()=>applyPreset(k as keyof typeof presets)} className="text-xs">
                {k}
              </Button>
            ))}
          </div>
        </div>

        {/* Basic Information */}
        <Section title="Basic Information" subtitle="Platform and category details">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="platform_id">Platform</Label>
              <Select {...register("platform_id")}>
                <option value="">Select platform</option>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="myntra">Myntra</option>
                <option value="ajio">Ajio</option>
                <option value="nykaa">Nykaa</option>
              </Select>
              {errors.platform_id && <p className="text-destructive text-sm mt-1">{errors.platform_id.message}</p>}
            </div>
            <div>
              <Label htmlFor="category_id">Category</Label>
              <Select {...register("category_id")}>
                <option value="">Select category</option>
                <option value="fashion">Fashion</option>
                <option value="electronics">Electronics</option>
                <option value="beauty">Beauty</option>
                <option value="home">Home & Kitchen</option>
                <option value="books">Books</option>
              </Select>
              {errors.category_id && <p className="text-destructive text-sm mt-1">{errors.category_id.message}</p>}
            </div>
          </div>
        </Section>

        {/* Commission Structure */}
        <Section title="Commission Structure" subtitle="Configure how commissions are calculated">
          <div className="space-y-4">
            <div>
              <Label>Commission Type</Label>
              <Controller
                control={control}
                name="commission_type"
                render={({field})=> (
                  <ToggleGroup
                    value={field.value}
                    onChange={field.onChange}
                    options={[{value:"flat",label:"Flat Rate"},{value:"tiered",label:"Tiered Slabs"}]}
                  />
                )}
              />
            </div>

            {commissionType==="flat" && (
              <div className="w-48">
                <Label htmlFor="commission_percent">Commission Percentage</Label>
                <Input {...register("commission_percent")} type="number" step="0.01" min="0" max="100" placeholder="5.5" />
                {errors.commission_percent && <p className="text-destructive text-sm mt-1">{errors.commission_percent.message}</p>}
              </div>
            )}

            {commissionType==="tiered" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label>Commission Slabs</Label>
                  <Button type="button" onClick={()=>slabAppend({min_price:0,max_price:null,commission_percent:0})} variant="secondary" size="sm">
                    <Plus className="w-4 h-4" /> Add Slab
                  </Button>
                </div>
                <div className="space-y-2">
                  {slabFields.map((field,i)=> (
                    <div key={field.id} className="flex gap-2 items-center p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <Input {...register(`slabs.${i}.min_price`)} type="number" step="0.01" placeholder="Min Price" />
                      </div>
                      <span className="text-muted-foreground">to</span>
                      <div className="flex-1">
                        <Input {...register(`slabs.${i}.max_price`)} type="number" step="0.01" placeholder="Max (empty=unlimited)" />
                      </div>
                      <div className="w-32">
                        <Input {...register(`slabs.${i}.commission_percent`)} type="number" step="0.01" placeholder="%" />
                      </div>
                      <Button type="button" onClick={()=>slabRemove(i)} variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {errors.slabs && <p className="text-destructive text-sm mt-1">{String(errors.slabs.message || errors.slabs.root?.message)}</p>}
              </div>
            )}
          </div>
        </Section>

        {/* Fees */}
        <Section title="Additional Fees" subtitle="Configure marketplace fees">
          <div className="space-y-2">
            {feeFields.map((field,i)=> (
              <div key={field.id} className="flex gap-2 items-center">
                <div className="w-32">
                  <Select {...register(`fees.${i}.fee_code`)}>
                    {feeCodes.map(c=> <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="w-24">
                  <Select {...register(`fees.${i}.fee_type`)}>
                    <option value="percent">%</option>
                    <option value="amount">₹</option>
                  </Select>
                </div>
                <div className="flex-1">
                  <Input {...register(`fees.${i}.fee_value`)} type="number" step="0.01" placeholder="Value" />
                </div>
                <Button type="button" onClick={()=>feeRemove(i)} variant="ghost" size="sm">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" onClick={()=>feeAppend({fee_code:"shipping",fee_type:"percent",fee_value:0})} variant="secondary" size="sm">
              <Plus className="w-4 h-4" /> Add Fee
            </Button>
          </div>
        </Section>

        {/* Tax Configuration */}
        <Section title="Tax Configuration">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gst_percent">GST Percentage</Label>
              <Input {...register("gst_percent")} type="number" step="0.01" placeholder="18" />
            </div>
            <div>
              <Label htmlFor="tcs_percent">TCS Percentage</Label>
              <Input {...register("tcs_percent")} type="number" step="0.01" placeholder="1" />
            </div>
          </div>
        </Section>

        {/* Settlement Terms */}
        <Section title="Settlement Terms" subtitle="Configure payment schedules">
          <div className="space-y-4">
            <div>
              <Label>Settlement Basis</Label>
              <Controller
                control={control}
                name="settlement_basis"
                render={({field})=> (
                  <ToggleGroup
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      {value:"t_plus",label:"T+X Days"},
                      {value:"weekly",label:"Weekly"},
                      {value:"bi_weekly",label:"Bi-Weekly"},
                      {value:"monthly",label:"Monthly"}
                    ]}
                  />
                )}
              />
            </div>

            {basis==="t_plus" && (
              <div className="w-48">
                <Label htmlFor="t_plus_days">T+ Days</Label>
                <Input {...register("t_plus_days")} type="number" min="1" placeholder="7" />
                {errors.t_plus_days && <p className="text-destructive text-sm mt-1">{errors.t_plus_days.message}</p>}
              </div>
            )}

            {basis==="weekly" && (
              <div className="w-48">
                <Label htmlFor="weekly_weekday">Weekday</Label>
                <Select {...register("weekly_weekday")}>
                  <option value="">Select day</option>
                  {weekdays.map(d=> <option key={d.value} value={d.value}>{d.label}</option>)}
                </Select>
                {errors.weekly_weekday && <p className="text-destructive text-sm mt-1">{errors.weekly_weekday.message}</p>}
              </div>
            )}

            {basis==="bi_weekly" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bi_weekly_weekday">Weekday</Label>
                  <Select {...register("bi_weekly_weekday")}>
                    <option value="">Select day</option>
                    {weekdays.map(d=> <option key={d.value} value={d.value}>{d.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bi_weekly_which">Which Week</Label>
                  <Select {...register("bi_weekly_which")}>
                    <option value="">Select</option>
                    <option value="first">First</option>
                    <option value="second">Second</option>
                  </Select>
                </div>
                {(errors.bi_weekly_weekday || errors.bi_weekly_which) && <p className="text-destructive text-sm mt-1 col-span-2">{errors.bi_weekly_weekday?.message || errors.bi_weekly_which?.message}</p>}
              </div>
            )}

            {basis==="monthly" && (
              <div className="w-48">
                <Label htmlFor="monthly_day">Day of Month</Label>
                <Input {...register("monthly_day")} placeholder="7 or 'eom'" />
                {errors.monthly_day && <p className="text-destructive text-sm mt-1">{errors.monthly_day.message}</p>}
              </div>
            )}

            <div className="w-48">
              <Label htmlFor="grace_days">Grace Days</Label>
              <Input {...register("grace_days")} type="number" min="0" placeholder="0" />
            </div>
          </div>
        </Section>

        {/* Validity */}
        <Section title="Validity Period">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="effective_from">Effective From</Label>
              <Input {...register("effective_from")} type="date" />
              {errors.effective_from && <p className="text-destructive text-sm mt-1">{errors.effective_from.message}</p>}
            </div>
            <div>
              <Label htmlFor="effective_to">Effective To (Optional)</Label>
              <Input {...register("effective_to")} type="date" />
              {errors.effective_to && <p className="text-destructive text-sm mt-1">{errors.effective_to.message}</p>}
            </div>
          </div>
        </Section>

        {/* Additional Options */}
        <Section title="Additional Options">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="global_min_price">Global Min Price</Label>
              <Input {...register("global_min_price")} type="number" step="0.01" placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="global_max_price">Global Max Price</Label>
              <Input {...register("global_max_price")} type="number" step="0.01" placeholder="Optional" />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea
              {...register("notes")}
              className="w-full rounded-lg border-input focus:border-primary focus:ring-primary/30 bg-background text-foreground placeholder-muted-foreground min-h-[80px]"
              placeholder="Additional notes or special terms..."
            />
          </div>
        </Section>

        {/* Form Actions */}
        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isSubmitting} className="min-w-32">
            <Save className="w-4 h-4" />
            {isSubmitting ? "Saving..." : mode==="create" ? "Create" : "Update"}
          </Button>
          <Button type="button" variant="secondary">
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>

        {/* Form Errors */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <h4 className="font-medium text-destructive mb-2">Please fix the following errors:</h4>
            <ul className="text-sm text-destructive space-y-1">
              {Object.entries(errors).map(([key,error])=> (
                <li key={key}>• {error?.message || `Error in ${key}`}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
};

export default RateCardFormV2;