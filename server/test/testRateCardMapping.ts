import Papa from 'papaparse';
import { normalizeHeaders } from '../src/utils/rateCardHeaders';

const testCSVFlat = `
Marketplace,Category,Type,Commission %,Fixed Fee ₹,Logistics Fee ₹,Storage Fee ₹,Return Logistics Fee ₹,Collection Fee %,Tech Fee ₹,TCS %,GST %,Penalty Type,Penalty Value ₹,Discount / Promo Contribution %,Return Window (Days),Settlement Cycle (Days),UTR Prefix,Valid From,Valid To
Amazon,Apparel,Flat,12,10,20,5,8,2,3,1,18,Late Dispatch,5,10,7,15,AMZ,2025-01-01,2025-03-31
`;

const testCSVTiered = `
Marketplace,Category,Type,Commission % (Tier),Min Price ₹,Max Price ₹,Fixed Fee ₹,Tech Fee ₹,Return Logistics Fee ₹,Settlement Cycle (Days),UTR Prefix,Valid From,Valid To
Myntra,BPC,Tiered,10,100,1000,15,5,10,15,MYN,2025-01-01,2025-03-31
`;

function testMapping(csvText: string, label: string) {
  const { data } = Papa.parse<Record<string, any>>(csvText.trim(), { header: true });
  console.log(`\n🧩 Testing ${label}:`);
  for (const row of data) {
    const normalized = normalizeHeaders(row);
    console.log(normalized);
  }
}

testMapping(testCSVFlat, 'Flat Template');
testMapping(testCSVTiered, 'Tiered Template');
