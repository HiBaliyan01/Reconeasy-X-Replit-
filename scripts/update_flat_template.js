import { Client } from 'pg';
import ExcelJS from 'exceljs';

const supabaseUrlRaw = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseUrl = supabaseUrlRaw ? supabaseUrlRaw.replace(/\/$/, '') : null;
const serviceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceKey || !databaseUrl) {
  throw new Error('Missing Supabase or database configuration.');
}

const bucketName = 'templates';
const version = 'v3.2';
const csvObjectPath = 'RateCard_Flat_v3.2.csv';
const xlsxObjectPath = 'RateCard_Flat_v3.2.xlsx';
const publicBase = `${supabaseUrl}/storage/v1/object/public/${bucketName}`;

const labelOverrides = {
  marketplace: 'Marketplace',
  category: 'Category',
  commission_type: 'Commission Type',
  effective_from: 'Effective From',
  effective_to: 'Effective To',
  gst_percent: 'GST %',
  tcs_percent: 'TCS %',
  settlement_basis: 'Settlement Basis',
  t_plus_days: 'T + Days',
  settlement_cycle_days: 'Settlement Cycle (Days)',
  grace_days: 'Grace Days',
  commission_percent: 'Commission %',
  storage_fee: 'Storage Fee (₹)',
  logistics_fee: 'Logistics Fee (₹)',
  return_fee: 'Return Fee (₹)',
  tech_fee: 'Tech Fee (₹)',
  collection_fee_percent: 'Collection Fee %',
  cancellation_fee: 'Cancellation Fee (₹)',
  promo_contribution_percent: 'Discount / Promo Contribution %',
  damage_deduction_percent: 'Damage / Dispute Deduction %',
  penalty_type: 'Penalty Type',
  penalty_value: 'Penalty Value (₹)',
  min_price: 'Min Price (₹)',
  max_price: 'Max Price (₹)',
  return_window_days: 'Return Window (Days)',
  utr_prefix: 'UTR Prefix',
  notes: 'Notes',
};

const mandatoryKeys = new Set([
  'marketplace',
  'category',
  'commission_type',
  'effective_from',
  'gst_percent',
  'settlement_basis',
  'commission_percent',
]);

const FIELD_CONFIG = {
  marketplace: {
    label: labelOverrides.marketplace,
    description: 'Name of the marketplace platform',
    aliases: ['platform', 'channel'],
    example: 'Amazon',
  },
  category: {
    label: labelOverrides.category,
    description: 'Product category or vertical',
    aliases: ['vertical', 'product category'],
    example: 'Apparel',
  },
  commission_type: {
    label: labelOverrides.commission_type,
    description: 'Flat or Tiered commission structure',
    aliases: ['commission basis', 'type'],
    example: 'Flat',
  },
  effective_from: {
    label: labelOverrides.effective_from,
    description: 'Date from which rate card becomes effective',
    aliases: ['start date'],
    example: '2025-10-01',
  },
  effective_to: {
    label: labelOverrides.effective_to,
    description: 'Date until which rate card is valid',
    aliases: ['end date'],
    example: '2025-12-31',
  },
  gst_percent: {
    label: labelOverrides.gst_percent,
    description: 'GST percentage applied on marketplace charges',
    aliases: ['gst', 'tax%'],
    example: '18',
  },
  tcs_percent: {
    label: labelOverrides.tcs_percent,
    description: 'TCS percentage deducted by marketplace',
    aliases: ['tcs', 'tax collected source'],
    example: '1',
  },
  settlement_basis: {
    label: labelOverrides.settlement_basis,
    description: 'Unit of settlement – Order, Item, or Shipment',
    aliases: ['basis', 'settlement type'],
    example: 'Order',
  },
  t_plus_days: {
    label: labelOverrides.t_plus_days,
    description: 'Days after delivery when payment is released',
    aliases: ['tplus', 'settlement delay'],
    example: '7',
  },
  settlement_cycle_days: {
    label: labelOverrides.settlement_cycle_days,
    description: 'Time interval of settlement batches (weekly, bi-weekly, etc.)',
    aliases: ['payout cycle', 'cycle days'],
    example: '14',
  },
  grace_days: {
    label: labelOverrides.grace_days,
    description: 'Additional buffer days allowed by marketplace for payment delay',
    aliases: ['buffer days'],
    example: '2',
  },
  commission_percent: {
    label: labelOverrides.commission_percent,
    description: 'Marketplace commission percentage charged on sale value',
    aliases: ['commission', 'commission%', 'comm %'],
    example: '12',
  },
  storage_fee: {
    label: labelOverrides.storage_fee,
    description: 'Storage fee charged per unit or per day',
    example: '2.5',
  },
  logistics_fee: {
    label: labelOverrides.logistics_fee,
    description: 'Forward logistics cost per shipment/order',
    example: '45',
  },
  return_fee: {
    label: labelOverrides.return_fee,
    description: 'Reverse logistics or return shipping charge',
    example: '30',
  },
  tech_fee: {
    label: labelOverrides.tech_fee,
    description: 'Technology or platform usage fee',
    example: '5',
  },
  collection_fee_percent: {
    label: labelOverrides.collection_fee_percent,
    description: 'COD or payment collection charge percentage',
    example: '2',
  },
  cancellation_fee: {
    label: labelOverrides.cancellation_fee,
    description: 'Fee charged for order cancellations',
    example: '10',
  },
  promo_contribution_percent: {
    label: labelOverrides.promo_contribution_percent,
    description: 'Brand’s contribution to platform promotions or discounts',
    example: '5',
  },
  damage_deduction_percent: {
    label: labelOverrides.damage_deduction_percent,
    description: 'Expected deduction for damaged or disputed items',
    example: '2',
  },
  penalty_type: {
    label: labelOverrides.penalty_type,
    description: 'Type of penalty applied, e.g. Fixed or Percentage',
    example: 'Percentage',
  },
  penalty_value: {
    label: labelOverrides.penalty_value,
    description: 'Penalty amount or percentage value',
    example: '50',
  },
  min_price: {
    label: labelOverrides.min_price,
    description: 'Minimum price range applicable (if any)',
    example: '299',
  },
  max_price: {
    label: labelOverrides.max_price,
    description: 'Maximum price range applicable (if any)',
    example: '999',
  },
  return_window_days: {
    label: labelOverrides.return_window_days,
    description: 'Days within which customer returns are accepted',
    aliases: ['return period', 'return days'],
    example: '15',
  },
  utr_prefix: {
    label: labelOverrides.utr_prefix,
    description: 'Prefix used in UTR references for marketplace payouts',
    example: 'AMZ',
  },
  notes: {
    label: labelOverrides.notes,
    description: 'Additional notes or context for rate card entry',
    example: 'Festive promo rates',
  },
};

const flatHeaderDefinition = [
  'marketplace',
  'category',
  'commission_type',
  'effective_from',
  'effective_to',
  'gst_percent',
  'tcs_percent',
  'settlement_basis',
  't_plus_days',
  'settlement_cycle_days',
  'grace_days',
  'commission_percent',
  'storage_fee',
  'logistics_fee',
  'return_fee',
  'tech_fee',
  'collection_fee_percent',
  'cancellation_fee',
  'promo_contribution_percent',
  'damage_deduction_percent',
  'penalty_type',
  'penalty_value',
  'min_price',
  'max_price',
  'return_window_days',
  'utr_prefix',
  'notes',
];

const metadataRow = 'Fields marked * are mandatory. Do not change header names.';

const sampleRowsByKey = [
  {
    marketplace: 'Amazon',
    category: 'Apparel',
    commission_type: 'Flat',
    commission_percent: '12',
    promo_contribution_percent: '5',
    penalty_type: 'Percentage',
    penalty_value: '50',
    damage_deduction_percent: '2',
    cancellation_fee: '10',
    return_window_days: '15',
    storage_fee: '2.5',
    logistics_fee: '45',
    return_fee: '30',
    tech_fee: '5',
    collection_fee_percent: '2',
    gst_percent: '18',
    tcs_percent: '1',
    settlement_basis: 'Order',
    t_plus_days: '7',
    settlement_cycle_days: '14',
    grace_days: '2',
    min_price: '299',
    max_price: '999',
    dispute_term_days: '15',
    effective_from: '2025-10-01',
    effective_to: '2025-12-31',
    utr_prefix: 'AMZ',
    notes: 'Festive promo rates',
  },
  {
    marketplace: 'Flipkart',
    category: 'Electronics',
    commission_type: 'Flat',
    commission_percent: '10',
    promo_contribution_percent: '3',
    penalty_type: 'Fixed',
    penalty_value: '75',
    damage_deduction_percent: '1.5',
    cancellation_fee: '8',
    return_window_days: '10',
    storage_fee: '3.2',
    logistics_fee: '42',
    return_fee: '28',
    tech_fee: '4',
    collection_fee_percent: '1.5',
    gst_percent: '18',
    tcs_percent: '1',
    settlement_basis: 'Item',
    t_plus_days: '5',
    settlement_cycle_days: '7',
    grace_days: '1',
    min_price: '499',
    max_price: '1499',
    dispute_term_days: '12',
    effective_from: '2025-10-01',
    effective_to: '2025-11-30',
    utr_prefix: 'FKP',
    notes: 'Diwali deals',
  },
];

const escapeCsv = (value) => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const uploadObject = async (objectPath, body, contentType) => {
  const resp = await fetch(`${supabaseUrl}/storage/v1/object/${bucketName}/${encodeURIComponent(objectPath)}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to upload ${objectPath}: ${resp.status} ${text}`);
  }
};

(async () => {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: existing } = await client.query(
    "SELECT id FROM rate_card_templates WHERE template_type = 'flat' AND version = $1 LIMIT 1",
    [version]
  );

  const toLabel = (key) => labelOverrides[key] || key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const headers = flatHeaderDefinition.map((key) => {
    const config = FIELD_CONFIG[key] ?? {};
    return {
      key,
      label: config.label || toLabel(key),
      aliases: config.aliases ?? [],
      mandatory: mandatoryKeys.has(key),
      description: config.description ?? '',
      example: config.example ?? '',
    };
  });

  if (!existing.length) {
    await client.query("UPDATE rate_card_templates SET is_active = FALSE WHERE template_type = 'flat'");
    await client.query(
      `INSERT INTO rate_card_templates (template_type, version, headers_json, description, is_active, header_row_index, data_start_index)
       VALUES ('flat', $1, $2::jsonb, $3, TRUE, 3, 4)`,
      [version, JSON.stringify(headers), 'Flat rate card template v3.2 Compact']
    );
  } else {
    await client.query(
      `UPDATE rate_card_templates
         SET headers_json = $1::jsonb,
             description = $2,
             is_active = TRUE,
             header_row_index = 3,
             data_start_index = 4
       WHERE template_type = 'flat' AND version = $3`,
      [JSON.stringify(headers), 'Flat rate card template v3.2 Compact', version]
    );
  }

  const headerRow = headers.map((field) => `${field.mandatory ? '*' : ''}${field.label}`);
  const sampleRows = sampleRowsByKey.map((row) =>
    headers.map((field) => escapeCsv(row[field.key ?? ''] || field.example || ''))
  );

  const csvContent = [
    metadataRow,
    '',
    headerRow.map(escapeCsv).join(','),
    ...sampleRows.map((row) => row.join(',')),
  ].join('\n');

  await uploadObject(csvObjectPath, csvContent, 'text/csv');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Flat Rate Card');

  const addRow = (values, style) => {
    const row = worksheet.addRow(values);
    if (style) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        style(cell, colNumber - 1);
      });
    }
    return row;
  };

  addRow([metadataRow], (cell) => {
    cell.font = { bold: true, size: 13, color: { argb: 'FF0F172A' } };
  });
  worksheet.addRow([]);

  const headerLabels = headers.map((field) => `${field.mandatory ? '*' : ''}${field.label}`);
  addRow(headerLabels, (cell, index) => {
    const isMandatory = headers[index].mandatory;
    cell.font = { bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isMandatory ? 'FFE0F2F1' : 'FFFFFFFF' },
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFCBD5F5' } },
    };
  });

  sampleRowsByKey.forEach((row, rowIndex) => {
    addRow(
      headers.map((field, index) => {
        const value = row[field.key ?? ''] ?? field.example ?? '';
        return index === headers.length - 1 ? value : value;
      }),
      (cell, columnIndex) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: columnIndex === headers.length - 1 ? 'right' : 'left',
          wrapText: true,
        };
        cell.font = { size: 11, color: { argb: 'FF1F2937' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowIndex % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' },
        };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
      }
    );
  });

  worksheet.views = [{ state: 'frozen', ySplit: 2 }];

  headers.forEach((field, index) => {
    const column = worksheet.getColumn(index + 1);
    const exampleLengths = sampleRowsByKey.map((row) => (row[field.key ?? ''] || field.example || '').length);
    const maxLength = Math.max(field.label.length + 4, ...exampleLengths.map((len) => len + 4));
    column.width = Math.min(Math.max(maxLength * 0.9, 16), 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  await uploadObject(
    xlsxObjectPath,
    Buffer.from(buffer),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  const csvUrl = `${publicBase}/${encodeURIComponent(csvObjectPath)}`;
  const xlsxUrl = `${publicBase}/${encodeURIComponent(xlsxObjectPath)}`;
  const sampleUrlPayload = JSON.stringify({ csv: csvUrl, xlsx: xlsxUrl });

  await client.query(
    "UPDATE rate_card_templates SET sample_data_url = $1 WHERE template_type = 'flat' AND version = $2",
    [sampleUrlPayload, version]
  );

  await client.end();
  console.log('Updated flat rate card template files and metadata.');
})();
