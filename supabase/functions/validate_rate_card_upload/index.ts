import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5?dts";

type TemplateField = {
  key?: string;
  label: string;
  aliases?: string[];
  mandatory?: boolean;
};

type TemplateRecord = {
  template_type: "flat" | "tiered";
  version: string;
  headers_json: TemplateField[];
  header_row_index?: number | null;
  data_start_index?: number | null;
};

type ParsedTable = {
  header: string[];
  rows: string[][];
  rawRows: string[][];
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const normalize = (value: string) =>
  value.replace(/\ufeff/g, "").toLowerCase().trim().replace(/\s+/g, " ");

const canonical = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, "");

const decodeBase64 = (base64: string): Uint8Array => {
  const clean = base64.includes(",") ? base64.split(",").pop() ?? base64 : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const parseCsv = (text: string): ParsedTable => {
  const sanitized = text.replace(/\r/g, "");
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    rows.push(row.map((value) => value.replace(/^\ufeff/, "")));
    row = [];
  };

  for (let i = 0; i < sanitized.length; i += 1) {
    const char = sanitized[i];
    if (char === '"') {
      if (inQuotes && sanitized[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      pushCell();
    } else if (char === "\n" && !inQuotes) {
      pushCell();
      pushRow();
    } else {
      cell += char;
    }
  }
  pushCell();
  pushRow();

  return {
    header: rows[2] ?? [],
    rows: rows.slice(3).filter((r) => r.some((value) => value.trim().length > 0)),
    rawRows: rows,
  };
};

const parseXlsx = (bytes: Uint8Array): ParsedTable => {
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<string[]>({ ...sheet }, { header: 1, raw: false }) as string[][];
  return {
    header: data[2] ?? [],
    rows: data.slice(3).map((row) => row.map((value) => value ?? "")).filter((row) => row.some((value) => value.trim().length > 0)),
    rawRows: data,
  };
};

const fetchTemplates = async (supabase: ReturnType<typeof createClient>) => {
  const { data, error } = await supabase
    .from('rate_card_templates')
    .select('template_type, version, headers_json, header_row_index, data_start_index')
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((record): record is TemplateRecord => record.template_type === 'flat' || record.template_type === 'tiered');
};

const scoreHeaderMatch = (template: TemplateRecord, header: string[]) => {
  const canonicalHeader = header.map(canonical);
  let matches = 0;
  let mandatoryMatches = 0;
  for (const field of template.headers_json) {
    const aliases = [field.label, ...(field.aliases ?? [])].map((alias) => canonical(alias));
    const found = canonicalHeader.some((value) => aliases.includes(value));
    if (found) {
      matches += 1;
      if (field.mandatory) mandatoryMatches += 1;
    }
  }
  return { matches, mandatoryMatches };
};

const compareHeaders = (template: TemplateRecord, header: string[]) => {
  const trimmed = header.map((value) => value.trim());
  const canonicalHeader = header.map(canonical);

  const mapped: string[] = [];
  const missingMandatory: string[] = [];

  for (const field of template.headers_json) {
    const aliases = [field.label, ...(field.aliases ?? [])].map((alias) => canonical(alias));
    if (aliases.some((alias) => canonicalHeader.includes(alias))) {
      mapped.push(field.label);
    } else if (field.mandatory) {
      missingMandatory.push(field.label);
    }
  }

  const validCanonical = new Set(
    template.headers_json.flatMap((field) => [field.label, ...(field.aliases ?? [])]).map((alias) => canonical(alias))
  );
  const unmapped = trimmed.filter((label, index) => {
    const key = canonicalHeader[index];
    return key && !validCanonical.has(key);
  });

  return { mapped, missingMandatory, unmapped };
};

const mapRowsToObjects = (template: TemplateRecord, rows: string[][]) => {
  const headers = template.headers_json.map((field) => field.label);
  return rows.map((row) => {
    const entry: Record<string, string> = {};
    headers.forEach((label, index) => {
      entry[label] = row[index] ?? '';
    });
    return entry;
  });
};

const handleRequest = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'ready' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ status: 'error', message: 'Supabase credentials not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { file, file_name } = await req.json();
    if (typeof file !== 'string' || !file.length || typeof file_name !== 'string') {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid payload: expected base64 file and file_name.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const templates = await fetchTemplates(supabase);
    if (!templates.length) {
      throw new Error('No active templates configured.');
    }

    const bytes = decodeBase64(file);
    const extension = file_name.toLowerCase().split('.').pop() ?? '';

    let parsed: ParsedTable;
    if (['xlsx', 'xlsm', 'xls'].includes(extension)) {
      parsed = parseXlsx(bytes);
    } else {
      const text = new TextDecoder().decode(bytes);
      parsed = parseCsv(text);
    }

    if (!parsed.header.length) {
      return new Response(JSON.stringify({ status: 'error', message: 'Unable to locate header row in file.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ranked = templates
      .map((template) => ({ template, score: scoreHeaderMatch(template, parsed.header) }))
      .sort((a, b) => {
        if (b.score.matches !== a.score.matches) return b.score.matches - a.score.matches;
        if (b.score.mandatoryMatches !== a.score.mandatoryMatches) return b.score.mandatoryMatches - a.score.mandatoryMatches;
        return 0;
      });

    const match = ranked[0];
    if (!match || match.score.matches === 0) {
      return new Response(JSON.stringify({ status: 'error', message: 'Headers do not match any active template.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { mapped, missingMandatory, unmapped } = compareHeaders(match.template, parsed.header);
    const structuredRows = mapRowsToObjects(match.template, parsed.rows);

    const preview = structuredRows.slice(0, 20);

    const response = {
      status: missingMandatory.length ? 'error' : 'success',
      template_type: match.template.template_type,
      version: match.template.version,
      mapped,
      missing_mandatory: missingMandatory,
      unmapped,
      row_preview: preview,
      rows: structuredRows,
      issues: unmapped.length ? [`Unrecognized columns: ${unmapped.join(', ')}`] : [],
      headers: match.template.headers_json?.map((field) => ({
        label: field.label,
        mandatory: Boolean(field.mandatory),
      })) ?? [],
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ status: 'error', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handleRequest);
