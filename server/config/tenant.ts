// Tenant configuration
// TODO: Replace with dynamic auth context when multi-tenant auth is implemented
export const DEFAULT_TENANT_ID = "1935f074-7acd-4799-8090-1f8cb085d1a4";

export const PAYMENT_FEE_CODES: Record<string, string[]> = {
  amazon: ["principal", "itemprice", "item price"],
  flipkart: [],
  myntra: [],
};
