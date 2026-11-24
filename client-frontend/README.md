# Tailskart storefront

Next.js 15 app. All catalog, cart pricing, accounts and orders come from the API in `../backend`.

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000 (needs the API on :4000)
npm run build      # production build (standalone output for Docker)
```

| Path | Purpose |
|---|---|
| `src/lib/api.ts` | API client, money formatting, server-side cached reads |
| `src/lib/store.tsx` | Cart, session, wishlist, config |
| `src/lib/useQuote.ts` | Server-side cart pricing |
| `src/data/content.ts` | Editable site content: contact details, blog, FAQ, policies |
| `src/data/pets.ts` | The four top-level store sections |
| `src/components/ProductArt.tsx` | Illustrated placeholder shown until a product has photos |
