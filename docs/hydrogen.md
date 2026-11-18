# Hydrogen integration

Magicpromo manages promotions and messaging. Your Hydrogen store owns the banner markup and styling. Shopify's discount Function still calculates the actual discount at checkout.

Browser → your Hydrogen `/api/magicpromo` route → Magicpromo `/api/v1/offers` → published Shopify discounts.

## 1. Connect the store

Install Magicpromo on the same Shopify store used by Hydrogen. In Magicpromo → Hydrogen, create an API key and copy the endpoint. Keep development and production keys/endpoints separate.

Add these **server-only** variables to Hydrogen's local `.env` and, later, its hosting environment:

```dotenv
MAGICPROMO_API_URL=https://your-magicpromo-host/api/v1/offers
MAGICPROMO_API_KEY=your-key
```

Never put the key in a `PUBLIC_` variable, browser bundle, Git, or loader response. Magicpromo stores only its hash. Replace or revoke it from the Hydrogen page; replacing immediately invalidates the old key. Uninstalling the app revokes its keys.

## 2. Copy the components

Copy the three source files from `integrations/hydrogen` into your project:

- `magicpromo.server.ts`: authenticated server fetch, three-second timeout, no cache, no redirects.
- `types.ts`: offer selection and cart progress.
- `MagicpromoBanners.tsx`: announcement, product, and cart components.

These are editable source files, not a published npm package. The sibling `timis-chocolates-hydrogen` project includes a working integration pattern with a server resource route and `useOffers` hook.

The resource route uses its own configured credential. It must never accept an upstream URL, API key, or shop from the browser. Return only public offer data, with `Cache-Control: no-store`. Hide banners on failures without interrupting shopping.

## 3. Publish and test

Create and activate a promotion in Magicpromo. Configure its message and placements in Storefront, then publish the messaging. Liquid theme setup buttons are unnecessary for Hydrogen.

The sample storefront refreshes offers every 30 seconds while visible, on returning to the tab, and when product IDs change. Cart quantities update progress immediately. Changes may take until the next refresh to appear; banners are informational and checkout is authoritative.

Check announcement ordering, an eligible and ineligible product, collection membership, cart thresholds, deactivation, and revoked credentials. Test with your real store: sample-catalog product IDs do not match Timi's promotions.

## Customize

Use `className`, `style`, or `unstyled` on the React components. Edit their source for typography, layout, dismissal, translations, or your design system. `linkPrefix` supports market subfolders. Merchant colors and text are defaults; developers control final rendering. The example places announcements in normal document flow above the header or below the footer rather than overlaying navigation.

Only one offer is shown per placement. Announcement uses display order; product banners filter by eligible product; cart banners prefer an offer relevant to cart contents, then display order. Distinct-product rules count each product once across variants. Quantity rules sum eligible quantities.

## API contract (v1)

`GET /api/v1/offers?products=123,456`

Header: `Authorization: Bearer <key>`.

Accepts up to 100 numeric product IDs or `gid://shopify/Product/...` IDs. For collection promotions, send all relevant cart products and the current product so current collection membership can be checked. Omit products for an announcement-only request. Requests above the limit are rejected; the example hides banners instead of calculating partial progress.

Success: `{ "version": 1, "offers": [...] }`. Each offer contains `id`, `percent`, `minimum`, `mode`, `eligibleProductIds`, and `settings`; see `integrations/hydrogen/types.ts` for the complete type. Offers contain only active, published messaging. Drafts, credentials, customer data, and Admin API tokens are excluded.

Errors: `400` invalid product IDs; `401` missing/invalid/revoked/wrong-app key; `503` offer verification unavailable. No CORS is required for server-to-server requests. Do not cache active-offer responses indefinitely.

## Deployment

Apply the new database migration before serving this API. Existing Render startup runs PostgreSQL migrations. Deploy the backend and set the Hydrogen variables separately. A development tunnel URL can change: update the endpoint when it does. The endpoint requires Magicpromo's valid offline Shopify session for the key's store.

Before public rollout, add hosting-level request rate limits and monitoring for this endpoint and your Hydrogen resource route. The current implementation has bounded input and request timeouts but no distributed rate limiter.
