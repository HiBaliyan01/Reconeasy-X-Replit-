import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse as parseCsv } from "https://deno.land/std@0.224.0/csv/parse.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

type Fee = { fee_code: string; fee_type: "percent" | "amount"; fee_value: number };
type Slab = { min_price: number; max_price: number | null; commission_percent: number };
type Payload = {
  platform_id: string; category_id: string;
  commission_type: "flat" | "tiered"; commission_percent: number | null;
  gst_percent: number; tcs_percent: number;
  settlement_basis: "t_plus" | "weekly" | "bi_weekly" | "monthly";
  t_plus_days?: number | null; weekly_weekday?: number | null;
  bi_weekly_weekday?: number | null; bi_weekly_which?: string | null;
  monthly_day?: number | null; grace_days?: number | null;
  effective_from: string; effective_to: string | null;
  global_min_price?: number | null; global_max_price?: number | null;
  notes?: string | null; slabs: Slab[]; fees: Fee[];
};
type RowResult = { row: number; status: "valid"|"similar"|"duplicate"|"error"; message: string; payload?: Payload };

const FEE_CODES = ["shipping","rto","packaging","fixed","collection","tech","storage"] as const;

function parseJsonArrayField(row: Record<string, any>, key: string, errs: string[]) {
  if (!(key in row)) {
    return { present: false, value: [] as any[] };
  }

  const raw = row[key];
  if (raw === null || raw === undefined) {
    return { present: true, value: [] as any[] };
  }

  const text = String(raw).trim();
  if (!text) {
    return { present: true, value: [] as any[] };
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return { present: true, value: parsed };
    }
    errs.push(`${key} must be a JSON array`);
  } catch (err: any) {
    errs.push(`Failed to parse ${key}: ${err?.message ?? "Invalid JSON"}`);
  }

  return { present: true, value: [] as any[] };
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors() } });
}
function num(v: any): number | null { if (v===null||v===undefined||v==="") return null; const n=Number(v); return Number.isNaN(n)?null:n; }
function asDate(v: any): string | null {
  if (v===null||v===undefined||v==="") return null;
  const s=String(v).trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d=new Date(s); return Number.isNaN(d.valueOf())?null:d.toISOString().slice(0,10);
}
function req<T>(val:T|null|undefined,name:string,errs:string[]){ if(val===null||val===undefined||(typeof val==="string"&&val.trim()==="")) errs.push(`${name} is required`); return val as T; }

function collectFees(row: Record<string,any>, errs: string[]): Fee[] {
  const parsed = parseJsonArrayField(row, "fees_json", errs);
  const out: Fee[] = [];

  if (parsed.present) {
    for (const entry of parsed.value) {
      if (!entry || typeof entry !== "object") {
        errs.push("fees_json entries must be objects");
        continue;
      }

      const codeRaw = String((entry as Record<string, any>).fee_code ?? "").trim().toLowerCase();
      if (!codeRaw) {
        errs.push("fees_json: fee_code is required");
        continue;
      }
      if (!FEE_CODES.includes(codeRaw as typeof FEE_CODES[number])) {
        errs.push(`fee ${codeRaw}: unsupported fee_code`);
        continue;
      }

      const typeRaw = String((entry as Record<string, any>).fee_type ?? "percent").trim().toLowerCase();
      const fee_type = typeRaw === "amount" ? "amount" : "percent";
      const valueNum = num((entry as Record<string, any>).fee_value);

      if (valueNum === null) {
        errs.push(`fee ${codeRaw}: fee_value required`);
        continue;
      }
      if (fee_type === "percent" && (valueNum < 0 || valueNum > 100)) {
        errs.push(`fee ${codeRaw}: percent must be 0-100`);
      }
      if (fee_type === "amount" && valueNum < 0) {
        errs.push(`fee ${codeRaw}: amount must be >= 0`);
      }

      out.push({ fee_code: codeRaw, fee_type, fee_value: valueNum });
    }
  } else {
    for (const code of FEE_CODES) {
      const t=(row[`fee_${code}_type`]??"").toString().toLowerCase().trim();
      const v=num(row[`fee_${code}_value`]);
      if (!t && (v===null||v===undefined)) continue;
      const fee_type = t==="amount"?"amount":"percent";
      if (v===null){ errs.push(`fee ${code}: value required`); continue; }
      if (fee_type==="percent" && (v<0||v>100)) errs.push(`fee ${code}: percent must be 0-100`);
      if (fee_type==="amount"  && v<0)          errs.push(`fee ${code}: amount must be >= 0`);
      out.push({ fee_code: code, fee_type, fee_value: v });
    }
  }

  const seen=new Set<string>();
  for (const f of out){ const k=`${f.fee_code}|${f.fee_type}`; if (seen.has(k)) errs.push(`Duplicate fee ${k}`); seen.add(k); }
  return out;
}

function collectSlabs(row: Record<string,any>, errs: string[]): Slab[] {
  const parsed = parseJsonArrayField(row, "slabs_json", errs);
  const out: Slab[] = [];

  if (parsed.present) {
    for (let idx = 0; idx < parsed.value.length; idx++) {
      const entry = parsed.value[idx];
      if (!entry || typeof entry !== "object") {
        errs.push(`slabs_json entry ${idx + 1} must be an object`);
        continue;
      }

      const min = num((entry as Record<string, any>).min_price);
      const max = num((entry as Record<string, any>).max_price);
      const pct = num((entry as Record<string, any>).commission_percent);

      if (min === null || pct === null) {
        errs.push(`slabs_json entry ${idx + 1}: min_price and commission_percent required`);
        continue;
      }
      if (pct < 0 || pct > 100) {
        errs.push(`slabs_json entry ${idx + 1}: commission_percent must be 0-100`);
      }
      if (max !== null && max <= min) {
        errs.push(`slabs_json entry ${idx + 1}: max_price must be > min_price or empty`);
      }

      out.push({ min_price: min, max_price: max, commission_percent: pct });
    }
  } else {
    for (let i=1;i<=3;i++){
      const min=num(row[`slab${i}_min_price`]); const max=num(row[`slab${i}_max_price`]); const pct=num(row[`slab${i}_commission_percent`]);
      if (min===null && max===null && pct===null) continue;
      if (min===null || pct===null){ errs.push(`slab${i}: min_price and commission_percent required`); continue; }
      if (pct<0||pct>100) errs.push(`slab${i}: commission_percent must be 0-100`);
      if (max!==null && max<=min) errs.push(`slab${i}: max_price must be > min_price or empty`);
      out.push({ min_price: min, max_price: max, commission_percent: pct });
    }
  }

  out.sort((a,b)=>a.min_price-b.min_price);
  for (let i=0;i<out.length-1;i++){ const a=out[i], b=out[i+1]; const aMax=a.max_price??Number.POSITIVE_INFINITY; if (aMax>b.min_price){ errs.push(`slabs overlap between rows ${i+1} and ${i+2}`); break; } }
  return out;
}

function rangesOverlap(aFrom:string,aTo:string|null,bFrom:string,bTo:string|null){
  const A1=new Date(aFrom).getTime(), A2=bTo?new Date(bTo).getTime():Number.POSITIVE_INFINITY;
  const B1=new Date(bFrom).getTime(), B2=aTo?new Date(aTo).getTime():Number.POSITIVE_INFINITY;
  return A1<=A2 && B1<=B2;
}
function slabsEqual(a:Slab[],b:Slab[]){ if(a.length!==b.length) return false; for(let i=0;i<a.length;i++){const x=a[i],y=b[i]; if(x.min_price!==y.min_price||x.max_price!==y.max_price||x.commission_percent!==y.commission_percent) return false;} return true; }
function feesEqual(a:Fee[],b:Fee[]){ if(a.length!==b.length) return false; const key=(f:Fee)=>`${f.fee_code}|${f.fee_type}|${f.fee_value}`; const A=a.map(key).sort(); const B=b.map(key).sort(); return A.join(",")===B.join(","); }

async function fetchExisting(platform_id:string, category_id:string){
  const { data, error } = await supabase
    .from("rate_cards_v2")
    .select(`id, platform_id, category_id, commission_type, commission_percent, effective_from, effective_to,
             rate_card_slabs ( min_price, max_price, commission_percent ),
             rate_card_fees  ( fee_code, fee_type, fee_value )`)
    .eq("platform_id", platform_id).eq("category_id", category_id);
  if (error) throw error;
  return (data??[]).map((rc:any)=>({
    id:rc.id, platform_id:rc.platform_id, category_id:rc.category_id,
    commission_type:rc.commission_type,
    commission_percent: rc.commission_type==="flat" ? Number(rc.commission_percent) : null,
    effective_from:rc.effective_from, effective_to:rc.effective_to,
    slabs:(rc.rate_card_slabs??[]).map((s:any)=>({min_price:Number(s.min_price),max_price:s.max_price===null?null:Number(s.max_price),commission_percent:Number(s.commission_percent)})),
    fees:(rc.rate_card_fees??[]).map((f:any)=>({fee_code:String(f.fee_code),fee_type:f.fee_type==="amount"?"amount":"percent",fee_value:Number(f.fee_value)}))
  }));
}

async function classifyOverlap(p:Payload): Promise<"duplicate"|"similar"|null>{
  const existing=await fetchExisting(p.platform_id,p.category_id);
  for(const e of existing){
    if(!rangesOverlap(p.effective_from,p.effective_to,e.effective_from,e.effective_to)) continue;
    const sameRange=p.effective_from===e.effective_from && (p.effective_to??null)===(e.effective_to??null);
    const sameCommission=p.commission_type===e.commission_type && (p.commission_type==="flat" ? (p.commission_percent??null)===(e.commission_percent??null) : slabsEqual(p.slabs,e.slabs));
    const sameFees=feesEqual(p.fees,e.fees);
    if(sameRange && sameCommission && sameFees) return "duplicate";
    return "similar";
  }
  return null;
}

function rowToPayload(row:Record<string,any>, errs:string[]):Payload{
  const platform_id=String(row.platform_id??"").trim();
  const category_id=String(row.category_id??"").trim();
  const commission_type=String(row.commission_type??"").trim().toLowerCase() as "flat"|"tiered";
  const commission_percent=commission_type==="flat"?num(row.commission_percent):null;

  const gst_percent=num(row.gst_percent) ?? 18;
  const tcs_percent=num(row.tcs_percent) ?? 1;

  const settlement_basis=String(row.settlement_basis??"").trim().toLowerCase() as Payload["settlement_basis"];
  const t_plus_days=num(row.t_plus_days);
  const weekly_weekday=num(row.weekly_weekday);
  const bi_weekly_weekday=num(row.bi_weekly_weekday);
  const bi_weekly_which=(row.bi_weekly_which??null)?String(row.bi_weekly_which):null;
  const monthly_day=num(row.monthly_day);
  const grace_days=num(row.grace_days) ?? 0;

  const effective_from=asDate(row.effective_from);
  const effective_to=asDate(row.effective_to);

  const global_min_price=num(row.global_min_price);
  const global_max_price=num(row.global_max_price);
  const notes=(row.notes??null)?String(row.notes):null;

  const fees=collectFees(row, errs);
  const slabs=commission_type==="tiered"?collectSlabs(row, errs):[];

  req(platform_id,"platform_id",errs);
  req(category_id,"category_id",errs);
  req(commission_type,"commission_type",errs);
  req(settlement_basis,"settlement_basis",errs);
  req(effective_from,"effective_from",errs);

  if(commission_type==="flat"){
    if(commission_percent===null) errs.push("commission_percent required for flat");
    if(commission_percent!==null && (commission_percent<0||commission_percent>100)) errs.push("commission_percent must be 0-100");
  } else {
    if(slabs.length===0) errs.push("tiered commission requires at least one slab");
  }

  if(settlement_basis==="t_plus"   && (t_plus_days==null))                      errs.push("t_plus_days required for t_plus");
  if(settlement_basis==="weekly"   && (weekly_weekday==null))                   errs.push("weekly_weekday required for weekly");
  if(settlement_basis==="bi_weekly"&& (bi_weekly_weekday==null || !bi_weekly_which)) errs.push("bi_weekly_weekday and bi_weekly_which required for bi_weekly");
  if(settlement_basis==="monthly"  && (monthly_day==null))                      errs.push("monthly_day required for monthly");

  return {
    platform_id, category_id, commission_type,
    commission_percent: commission_type==="flat" ? (commission_percent ?? 0) : null,
    gst_percent, tcs_percent, settlement_basis,
    t_plus_days: t_plus_days ?? null, weekly_weekday: weekly_weekday ?? null,
    bi_weekly_weekday: bi_weekly_weekday ?? null, bi_weekly_which,
    monthly_day: monthly_day ?? null, grace_days,
    effective_from: effective_from!, effective_to,
    global_min_price: global_min_price ?? null, global_max_price: global_max_price ?? null,
    notes, slabs, fees
  };
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    const url = new URL(req.url);

    if (url.pathname.endsWith("/parse") && req.method === "POST") {
      const fd = await req.formData();
      const file = fd.get("file") as File | null;
      if (!file) return json({ message: "No file uploaded" }, 400);

      const text = await file.text();
      const rows = await parseCsv(text, { columns: true, skipFirstRow: false, trimLeadingSpace: true }) as Record<string,any>[];

      const results: RowResult[] = [];
      let valid=0, similar=0, duplicate=0, error=0;

      for (let i=0;i<rows.length;i++){
        const row=rows[i]; const errs:string[]=[];
        const payload=rowToPayload(row, errs);

        if (errs.length){ results.push({ row:i+2, status:"error", message:errs.join("; ") }); error++; continue; }

        const overlap=await classifyOverlap(payload);
        if (overlap==="duplicate"){ results.push({ row:i+2, status:"duplicate", message:"Exact duplicate in same platform/category and date range", payload }); duplicate++; }
        else if (overlap==="similar"){ results.push({ row:i+2, status:"similar", message:"Overlaps with an existing card; confirm to import", payload }); similar++; }
        else { results.push({ row:i+2, status:"valid", message:"Ready to import", payload }); valid++; }
      }

      return json({ summary:{ total: rows.length, valid, similar, duplicate, error }, rows: results });
    }

    if (url.pathname.endsWith("/import") && req.method === "POST") {
      const body = await req.json().catch(()=>({}));
      const rows: Payload[] = Array.isArray(body?.rows) ? body.rows : [];
      const include_similar = Boolean(body?.include_similar);
      if (!rows.length) return json({ message: "No rows to import" }, 400);

      const results: Array<{row:number; status:"imported"|"skipped"; id?:string; message?:string}> = [];
      let inserted=0;

      for (let i=0;i<rows.length;i++){
        const p=rows[i];
        const errs:string[]=[]; rowToPayload(p as any, errs);
        const overlap=await classifyOverlap(p);
        if (errs.length || overlap==="duplicate" || (overlap==="similar" && !include_similar)){
          results.push({ row:i+1, status:"skipped", message: errs.join("; ") || (overlap==="duplicate" ? "duplicate" : "similar needs confirmation") });
          continue;
        }

        const { data:ins, error:e1 } = await supabase
          .from("rate_cards_v2")
          .insert({
            platform_id:p.platform_id, category_id:p.category_id,
            commission_type:p.commission_type, commission_percent: p.commission_type==="flat"?p.commission_percent:null,
            gst_percent:p.gst_percent, tcs_percent:p.tcs_percent,
            settlement_basis:p.settlement_basis,
            t_plus_days:p.t_plus_days ?? null, weekly_weekday:p.weekly_weekday ?? null,
            bi_weekly_weekday:p.bi_weekly_weekday ?? null, bi_weekly_which:p.bi_weekly_which ?? null,
            monthly_day:p.monthly_day ?? null, grace_days:p.grace_days ?? 0,
            effective_from:p.effective_from, effective_to:p.effective_to,
            global_min_price:p.global_min_price ?? null, global_max_price:p.global_max_price ?? null,
            notes:p.notes ?? null
          })
          .select("id").single();
        if (e1){ results.push({ row:i+1, status:"skipped", message:e1.message }); continue; }

        const id=ins!.id as string;

        if (p.commission_type==="tiered" && p.slabs?.length){
          const { error:e2 } = await supabase.from("rate_card_slabs").insert(
            p.slabs.map(s=>({ rate_card_id:id, min_price:s.min_price, max_price:s.max_price, commission_percent:s.commission_percent }))
          );
          if (e2){ results.push({ row:i+1, status:"skipped", message:e2.message }); continue; }
        }

        if (p.fees?.length){
          const { error:e3 } = await supabase.from("rate_card_fees").insert(
            p.fees.map(f=>({ rate_card_id:id, fee_code:f.fee_code, fee_type:f.fee_type, fee_value:f.fee_value }))
          );
          if (e3){ results.push({ row:i+1, status:"skipped", message:e3.message }); continue; }
        }

        inserted++; results.push({ row:i+1, status:"imported", id });
      }

      return json({ summary:{ inserted, skipped: rows.length - inserted }, results });
    }

    return json({ message:"Not found" }, 404);
  } catch (err:any) {
    console.error(err);
    return json({ message: err?.message || "Server error" }, 500);
  }
});
