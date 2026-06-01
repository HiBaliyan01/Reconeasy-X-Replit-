import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const res = await db.execute(sql`
  SELECT rate_card_id, weight_min_grams, weight_max_grams, zone, forward_fee, reverse_fee
  FROM rate_card_logistics_slabs
  ORDER BY created_at DESC
  LIMIT 5
`);

console.log(JSON.stringify(res.rows, null, 2));
