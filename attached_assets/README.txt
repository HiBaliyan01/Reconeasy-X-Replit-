# ReconEasy Rate Card v2 — Replit-ready Bundle (FULL)

## Frontend
- Install deps (root):
  ```bash
  npm i react-hook-form zod @hookform/resolvers axios lucide-react
  ```
- Add component: `client/src/components/RateCardFormV2.tsx`
- Use:
  ```tsx
  import RateCardFormV2 from "@/components/RateCardFormV2";
  export default function NewRateCard() {
    return <div className="p-6"><RateCardFormV2 mode="create" /></div>;
  }
  ```
- If using Vite, add dev proxy:
  ```ts
  // vite.config.ts
  export default { server: { proxy: { "/api": "http://localhost:5000" } } } as any;
  ```

## Backend
- Files:
  - `server/src/index.ts`
  - `server/src/routes/rateCards.ts`
  - `server/src/db/schema.ts`
  - `server/package.json`
- In Replit Secrets: set `DATABASE_URL` to Neon Postgres URL.
- Run:
  ```bash
  cd server
  npm i
  npm run dev
  ```

## Tables
- `rate_cards`, `rate_card_slabs`, `rate_card_fees` as per `schema.ts` (migrate with your preferred method).

## API
- `POST /api/rate-cards` (create) — returns `{ id }`
- `PUT /api/rate-cards` (update) — expects `id` in body
