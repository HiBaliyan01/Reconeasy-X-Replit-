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
const csvObjectPath = 'RateCard_Tiered_v3.2.csv';
const xlsxObjectPath = 'RateCard_Tiered_v3.2.xlsx';
const publicBase = `${supabaseUrl}/storage/v1/object/public/${bucketName}`;

const metadataRow = 'Fields marked * are mandatory. Do not change header names.';

const tieredHeaderOrder = [
  'marketplace',
  'category',
  'commission_type',
  'min_price',
  'max_price',
  'commission_percent',
  'effective_from',
  'effective_to',
  'gst_percent',
  'tcs_percent',
  'settlement_basis',
  't_plus_days',
  'settlement_cycle_days',
  'grace_days',
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
  'return_window_days',
  'utr_prefix',
  'notes',
  'created_at',
  'updated_at',
];

const mandatoryKeys = new Set([
  'marketplace',
  'category',
  'commission_type',
  'min_price',
  'max_price',
  'commission_percent',
  'effective_from',
  'gst_percent',
  'settlement_basis',
]);

const LABELS = {
  marketplace: 'Marketplace',
  category: 'Category',
  commission_type: 'Commission Type',
  min_price: 'Min Price (₹)',
  max_price: 'Max Price (₹)',
  commission_percent: 'Commission %',
  effective_from: 'Effective From',
  effective_to: 'Effective To',
  gst_percent: 'GST %',
  tcs_percent: 'TCS %',
  settlement_basis: 'Settlement Basis',
  t_plus_days: 'T + Days',
  settlement_cycle_days: 'Settlement Cycle (Days)',
  grace_days: 'Grace Days',
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
  return_window_days: 'Return Window (Days)',
  utr_prefix: 'UTR Prefix',
  notes: 'Notes',
  created_at: 'Created At',
  updated_at: 'Updated At',
};

const FIELD_INFO = {
  marketplace: {
    description: 'Name of the marketplace platform',
    aliases: ['platform', 'channel'],
    example: 'Amazon',
  },
  category: {
    description: 'Product category or vertical',
    aliases: ['vertical', 'product category'],
    example: 'Apparel',
  },
  commission_type: {
    description: 'Flat or Tiered commission structure',
    aliases: ['commission basis', 'type'],
    example: 'Tiered',
  },
  min_price: {
    description: 'Minimum price range for this tier',
    example: '0',
  },
  max_price: {
    description: 'Maximum price range for this tier',
    example: '999',
  },
  commission_percent: {
    description: 'Commission percentage for this price tier',
    example: '12',
  },
  effective_from: {
    description: 'Date from which rate card becomes effective',
    aliases: ['start date'],
    example: '2025-04-01',
  },
  effective_to: {
    description: 'Date until which rate card is valid',
    aliases: ['end date'],
    example: '2025-06-30',
  },
  gst_percent: {
    description: 'GST percentage applied on marketplace charges',
    aliases: ['gst', 'tax%'],
    example: '18',
  },
  tcs_percent: {
    description: 'TCS percentage deducted by marketplace',
    aliases: ['tcs', 'tax collected source'],
    example: '1',
  },
  settlement_basis: {
    description: 'Unit of settlement – Order, Item, or Shipment',
    aliases: ['basis', 'settlement type'],
    example: 'Order',
  },
  t_plus_days: {
    description: 'Days after delivery when payment is released',
    aliases: ['tplus', 'settlement delay'],
    example: '7',
  },
  settlement_cycle_days: {
    description: 'Time interval of settlement batches',
    aliases: ['payout cycle', 'cycle days'],
    example: '14',
  },
  grace_days: {
    description: 'Additional buffer days allowed for payment delay',
    aliases: ['buffer days'],
    example: '2',
  },
  storage_fee: {
    description: 'Storage fee charged per unit or per day',
    example: '2.5',
  },
  logistics_fee: {
    description: 'Forward logistics cost per shipment/order',
    example: '45',
  },
  return_fee: {
    description: 'Reverse logistics or return shipping charge',
    example: '30',
  },
  tech_fee: {
    description: 'Technology or platform usage fee',
    example: '5',
  },
  collection_fee_percent: {
    description: 'COD or payment collection charge percentage',
    example: '2',
  },
  cancellation_fee: {
    description: 'Fee charged for order cancellations',
    example: '10',
  },
  promo_contribution_percent: {
    description: 'Brand’s contribution to platform promotions or discounts',
    example: '5',
  },
  damage_deduction_percent: {
    description: 'Expected deduction for damaged or disputed items',
    example: '2',
  },
  penalty_type: {
    description: 'Type of penalty applied (Fixed or Percentage)',
    example: 'Percentage',
  },
  penalty_value: {
    description: 'Penalty amount or percentage value',
    example: '100',
  },
  return_window_days: {
    description: 'Days within which customer returns are accepted',
    aliases: ['return period', 'return days'],
    example: '15',
  },
  utr_prefix: {
    description: 'Prefix used in UTR references for payouts',
    example: 'AMZ',
  },
  notes: {
    description: 'Additional notes or context for rate card entry',
    example: 'Festive promo rates',
  },
  created_at: {
    description: 'Timestamp when entry was created',
    example: '2025-03-15T12:00:00Z',
  },
  updated_at: {
    description: 'Timestamp when entry was last updated',
    example: '2025-03-20T09:30:00Z',
  },
};

const sampleRows = [
  {
    marketplace: 'Amazon',
    category: 'Apparel',
    commission_type: 'Tiered',
    min_price: '0',
    max_price: '999',
    commission_percent: '12',
    effective_from: '2025-04-01',
    effective_to: '2025-06-30',
    gst_percent: '18',
    tcs_percent: '1',
    settlement_basis: 'Item',
    t_plus_days: '5',
    settlement_cycle_days: '14',
    grace_days: '2',
    storage_fee: '2.5',
    logistics_fee: '40',
    return_fee: '28',
    tech_fee: '4',
    collection_fee_percent: '1.5',
    cancellation_fee: '6',
    promo_contribution_percent: '4',
    damage_deduction_percent: '1.2',
    penalty_type: 'Percentage',
    penalty_value: '20',
    return_window_days: '12',
    utr_prefix: 'AMZ',
    notes: 'Summer promotion slab',
    created_at: '2025-03-15T12:00:00Z',
    updated_at: '2025-03-20T09:30:00Z',
  },
  {
    marketplace: 'Myntra',
    category: 'Beauty',
    commission_type: 'Tiered',
    min_price: '1000',
    max_price: '2999',
    commission_percent: '10',
    effective_from: '2025-04-01',
    effective_to: '2025-06-30',
    gst_percent: '18',
    tcs_percent: '1',
    settlement_basis: 'Order',
    t_plus_days: '6',
    settlement_cycle_days: '10',
    grace_days: '1',
    storage_fee: '3.1',
    logistics_fee: '48',
    return_fee: '32',
    tech_fee: '5',
    collection_fee_percent: '1.8',
    cancellation_fee: '7',
    promo_contribution_percent: '3',
    damage_deduction_percent: '1.5',
    penalty_type: 'Fixed',
    penalty_value: '80',
    return_window_days: '10',
    utr_prefix: 'MYN',
    notes: 'Beauty tier slab',
    created_at: '2025-03-16T10:15:00Z',
    updated_at: '2025-03-21T08:45:00Z',
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

  const headers = tieredHeaderOrder.map((key) => ({
    key,
    label: LABELS[key],
    mandatory: mandatoryKeys.has(key),
    description: FIELD_INFO[key]?.description ?? '',
    aliases: FIELD_INFO[key]?.aliases ?? [],
    example: FIELD_INFO[key]?.example ?? '',
  }));

  await client.query("UPDATE rate_card_templates SET is_active = FALSE WHERE template_type = 'tiered'");

  const { rows: existing } = await client.query(
    "SELECT id FROM rate_card_templates WHERE template_type = 'tiered' AND version = $1 LIMIT 1",
    [version]
  );

  if (!existing.length) {
    await client.query(
      `INSERT INTO rate_card_templates (template_type, version, headers_json, description, is_active, header_row_index, data_start_index)
       VALUES ('tiered', $1, $2::jsonb, $3, TRUE, 3, 4)`,
      [version, JSON.stringify(headers), 'Tiered rate card template v3.2 Compact']
    );
  } else {
    await client.query(
      `UPDATE rate_card_templates
         SET headers_json = $1::jsonb,
             description = $2,
             is_active = TRUE,
             header_row_index = 3,
             data_start_index = 4
       WHERE template_type = 'tiered' AND version = $3`,
      [JSON.stringify(headers), 'Tiered rate card template v3.2 Compact', version]
    );
  }

  const headerRow = headers.map((field) => `${field.mandatory ? '*' : ''}${field.label}`);
  const csvRows = [
    metadataRow,
    '',
    headerRow.join(','),
    ...sampleRows.map((row) =>
      tieredHeaderOrder
        .map((key) => escapeCsv(row[key] ?? FIELD_INFO[key]?.example ?? ''))
        .join(',')
    ),
  ];

  await uploadObject(csvObjectPath, csvRows.join('\n'), 'text/csv');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tiered Rate Card');
  worksheet.views = [{ state: 'frozen', ySplit: 3 }];

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

  addRow(
    headerRow,
    (cell, index) => {
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
    }
  );

  sampleRows.forEach((row, rowIndex) => {
    addRow(
      tieredHeaderOrder.map((key, colIndex) => row[key] ?? FIELD_INFO[key]?.example ?? ''),
      (cell, colIndex) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: colIndex >= 3 && colIndex <= 5 ? 'right' : 'left',
          wrapText: true,
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowIndex % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' },
        };
        cell.font = { size: 11, color: { argb: 'FF1F2937' } };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
      }
    );
  });

  tieredHeaderOrder.forEach((key, index) => {
    const column = worksheet.getColumn(index + 1);
    const baseWidth = Math.max(headers[index].label.length + 4, 16);
    column.width = Math.min(baseWidth, 42);
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
    "UPDATE rate_card_templates SET sample_data_url = $1 WHERE template_type = 'tiered' AND version = $2",
    [sampleUrlPayload, version]
  );

  await client.end();
  console.log('Tiered template v3.2 generated and uploaded.');
})();
