# Magicpromo

Magicpromo is a Shopify app for "buy more, save more" promotions. A merchant picks products (or a collection), sets a percentage and a minimum ("30% off when you buy 5 different chocolates"), and Magicpromo does two jobs:

1. **Applies the discount at checkout**, using a Shopify Function.
2. **Tells shoppers about the offer on the storefront**, with banners: an announcement bar, an inline banner on product pages, and a cart progress bar ("Add 3 more to save 30%").

The second job works on both kinds of Shopify storefront, **Liquid themes** and **Hydrogen**, and developers can **bring their own elements** instead of using Magicpromo's banners. That idea runs through the whole codebase, and most of this document explains it.

This README is written to be read alongside the code. File paths point to where each idea lives.

---

## Contents

1. [The big picture](#1-the-big-picture)
2. [Shopify concepts, and how Magicpromo uses each one](#2-shopify-concepts-and-how-magicpromo-uses-each-one)
3. [What the merchant does](#3-what-the-merchant-does)
4. [How an offer travels: admin → checkout → storefront](#4-how-an-offer-travels-admin--checkout--storefront)
5. [The SDK: `@magicpromo/sdk`](#5-the-sdk-magicpromosdk)
6. [Bring your own element](#6-bring-your-own-element)
7. [Liquid vs Hydrogen, side by side](#7-liquid-vs-hydrogen-side-by-side)
8. [Who edits what, and how](#8-who-edits-what-and-how)
9. [Repository map](#9-repository-map)
10. [Engineering decisions and refactors](#10-engineering-decisions-and-refactors)
11. [Known limitations and next steps](#11-known-limitations-and-next-steps)
12. [Interview questions this project answers](#12-interview-questions-this-project-answers)
13. [Running it locally](#13-running-it-locally)

---

## 1. The big picture

```text
                         ┌──────────────────────────────────────────┐
                         │      Magicpromo app (React Router)       │
  Merchant ─ Shopify ──▶ │  Embedded admin UI: Polaris + App Bridge │
  admin (iframe)         │  Prisma DB: drafts, display order, keys  │
                         └───────┬───────────────────────┬──────────┘
                                 │ Admin GraphQL API     │ serves offers
                                 ▼                       ▼
              ┌─────────────────────────────┐   ┌──────────────────────────┐
              │ Shopify                     │   │ GET /storefront          │ ◀─ App proxy (Liquid)
              │  Automatic app discount     │   │ GET /api/v1/offers       │ ◀─ Bearer key (Hydrogen)
              │  + metafield (config JSON)  │   └────────────┬─────────────┘
              └──────────────┬──────────────┘                │ Offer[]
                             │ at checkout                   ▼
                             ▼                  ┌──────────────────────────┐
              ┌─────────────────────────────┐   │ @magicpromo/sdk          │
              │ Shopify Function (Wasm)     │   │  core rules, data client │
              │  reads cart + metafield     │   │  Liquid: <magicpromo-    │
              │  returns discount ops       │   │   banner>, window.API    │
              └─────────────────────────────┘   │  Hydrogen: React hooks   │
                                                └──────────────────────────┘
```

The rule that holds it together: **the Function decides the discount; the banners only describe it.** If a banner is wrong or missing, checkout is still right.

---

## 2. Shopify concepts, and how Magicpromo uses each one

### Shopify app

An app is a web service that Shopify lets into a store through OAuth. The merchant approves **access scopes** (permissions) on install. The app then calls Shopify's APIs on the merchant's behalf.

- Magicpromo's scopes, from `shopify.app.toml`: `write_discounts` (create the discount), `write_products`, `read_themes` (check whether banners are placed), and `write_app_proxy` (serve the storefront endpoint).
- App configuration lives in TOML files: `shopify.app.toml`, `shopify.app.development.toml` and `shopify.app.production.toml`. There are **two app registrations**, "Magicpromo Dev" for local development and "Magicpromo" for production, so experiments never touch the live app (`docs/render-deployment.md`).
- The server framework is **React Router 7** with `@shopify/shopify-app-react-router` (`app/shopify.server.ts`), which handles OAuth, session storage (Prisma) and request authentication.

### Embedded app

An **embedded app** shows its admin UI *inside* the Shopify admin, in an iframe. This page is called **App Home**. Magicpromo is embedded (`embedded = true`).

- **App Bridge** is the script that connects the iframe to the admin around it. It provides navigation (`<s-app-nav>`), toasts (`shopify.toast.show`), the resource picker (`shopify.resourcePicker`), modals and the save bar. See `app/routes/app.tsx`, and `app/components/PromotionEditorPage.tsx` for the resource picker.
- Requests from the iframe carry a **session token** (a short-lived JWT). `authenticate.admin(request)` checks it on every admin route.
- **Polaris web components** (`<s-page>`, `<s-section>`, `<s-button>`…) are Shopify's design system as custom HTML elements, loaded from Shopify's CDN. Magicpromo uses **Polaris 2** (`app/polaris.ts`), which follows the admin's current look automatically. We style only layout; colours and shapes come from Polaris, so the app matches both the old and new admin themes.

### Unembedded app (and pages outside the admin)

An **unembedded app** (`embedded = false`) opens on its own domain in a normal browser tab, not inside the admin iframe. It has no App Bridge and no session token, so it must authenticate users itself. Some apps are fully unembedded, for example merchant custom apps or tools with their own login.

Magicpromo is embedded, but some of its surfaces run **outside** the admin and work like an unembedded app:

| Surface | Who calls it | How it's authenticated |
| --- | --- | --- |
| `/` login page (`app/routes/_index/route.tsx`) | A person visiting the app URL directly | The shop domain form starts OAuth; no session token |
| `/storefront` (app proxy, `app/routes/storefront.ts`) | Shoppers' browsers, via the store's domain | Shopify's HMAC signature on the proxied request |
| `/api/v1/offers` (`app/routes/api.v1.offers.ts`) | A Hydrogen server | A Bearer API key that Magicpromo issued |
| `/webhooks/*` | Shopify | Webhook HMAC (`authenticate.webhook`) |

The difference matters: embedded pages trust the **session token**, while everything outside the admin needs a different proof of who is calling.

### Offline vs online access tokens

- An **online token** belongs to a logged-in staff member and expires with their session.
- An **offline token** belongs to the shop and lets the app work when nobody is logged in.

The storefront endpoints run when no merchant is around, so they use the **offline** session: `unauthenticated.admin(shop)` in `api.v1.offers.ts`, and the session from `authenticate.public.appProxy`. The app opts into **expiring offline tokens** (`future.expiringOfflineAccessTokens` in `app/shopify.server.ts`).

### Admin GraphQL API

This is the API apps use to read and write store data. Magicpromo uses it to create and update the discount, read its status and usage count, check collection membership, list themes and read theme files.

- **Typed with codegen.** `pnpm graphql-codegen` reads every `#graphql` string in the app and generates TypeScript types (`app/types/admin.generated.d.ts`). `admin.graphql(QUERY)` then returns typed data, and a misspelled field fails at compile time.
- **Errors.** The admin client **throws** on GraphQL errors (`GraphqlQueryError`), so code doesn't check `result.errors`. **Mutations** still report validation problems in `userErrors`, and the code always checks those (`promotion-activation.server.ts`).
- **`nodes(ids:)`** returns `null` for deleted IDs, and every caller handles that.

### Discounts and Shopify Functions

A **Shopify Function** is your own code that Shopify runs *inside its checkout*, compiled to **WebAssembly**. It has strict size and instruction limits and no network access. It gets an input (described by a GraphQL **input query**) and returns operations.

- Magicpromo's Function is `extensions/magicpromo-discount/`. Its target is `cart.lines.discounts.generate.run`, a **product discount**.
- **The input query** (`src/cart_lines_discounts_generate_run.graphql`) asks for cart lines, product IDs and the discount's **metafield**.
- **Input variables.** `[extensions.input.variables]` in its TOML tells Shopify to fill the query's `$collectionIds` variable from the metafield. That's how `inAnyCollection(ids: $collectionIds)` knows which collection to check, and why collection promotions follow the collection live without copying product lists.
- **Configuration through a metafield.** The admin writes the promotion rules as JSON into a metafield on the discount (namespace `$app:magicpromo`, key `configuration`). The Function reads it, validates it with the shared parser, and returns `productDiscountsAdd` with the eligible lines as targets.
- **Automatic app discount.** `discountAutomaticAppCreate` creates a discount that applies by itself (no code), owned by our Function (`functionHandle: "magicpromo-discount"`, `discountClasses: ["PRODUCT"]`). `combinesWith` controls stacking with other product, order and shipping discounts.

### Metafields

Metafields are custom fields attached to Shopify objects. `$app:` namespaces are **app-owned**: only this app can write them.

- **Discount metafield:** the promotion config, which the Function reads at checkout and the storefront endpoint reads to build offers.
- **AppInstallation metafields:** `magicpromo.proxy_path` and `magicpromo.app_handle`, written by `theme-setup.server.ts`. Liquid reads them as `app.metafields.magicpromo.proxy_path`, so the theme knows which proxy path to call without the merchant typing a setting.

### Theme app extensions: app blocks and app embeds

A **theme app extension** (`extensions/magicpromo-banner/`) is how an app adds UI to a **Liquid theme** without editing the theme's code. Merchants add and remove it in the **theme editor**, and uninstalling the app removes it cleanly. It contains:

- `blocks/`: Liquid files with a `{% schema %}`.
- `assets/`: JS and CSS that Shopify serves from its CDN.
- `locales/`: translated strings.
- `snippets/`: shared Liquid.

There are two kinds of block, and Magicpromo uses both:

| | **App embed** (`blocks/announcement.liquid`) | **App block** (`blocks/offer.liquid`) |
| --- | --- | --- |
| Schema `target` | `"body"` (injected before `</body>`) | `"section"` |
| Where merchants find it | Theme settings → **App embeds**, an on/off switch | Inside a template section, dragged into position |
| Scope | Every page | Only the template it's placed in (product, cart) |
| Good for | Floating or site-wide UI: announcement bars, chat bubbles, tracking | Inline UI next to theme content: product banner, cart progress |
| Magicpromo use | Sitewide announcement bar | Product banner and cart progress (`enabled_on: product, cart`) |

Both render the same element, `<magicpromo-banner>`, with `data-*` attributes from Liquid:

- `data-placement` (`template.name` or `announcement`)
- `data-product` (`product.id`)
- `data-proxy` (the AppInstallation metafield)
- translated strings (`{{ 'banner.progress' | t }}`)
- `data-design-mode` (`request.design_mode`)

**`request.design_mode`** is true only inside the theme editor. Magicpromo uses it to show a **setup card** to the merchant when no offer applies; shoppers never see that card (`snippets/setup-preview.liquid`).

**`settings: []`.** The blocks have no theme-editor settings on purpose. All messaging is edited in the Magicpromo app, so one promotion's message is the same on every page and every theme.

**Deep links** take a merchant from the app straight into the theme editor (`themeEditorLinks` in `app/models/theme-setup.server.ts`):

- `?context=apps&activateAppId={client_id}/announcement` switches on the app embed.
- `?template=product&addAppBlockId={client_id}/offer&target=mainSection` adds the block to the product section.
- `?template=cart&addAppBlockId=…&target=newAppsSection` adds the block to the cart page in a new "Apps" section.
- `target=sectionId:{id}` adds it to an **existing** section. Magicpromo uses this to reuse an empty Apps section instead of stacking new ones.

**Checking placements.** The merchant must click **Save** in the theme editor, and a deep link can't confirm that they did. So `app/models/theme-placement.server.ts` reads the theme's actual files through the Admin API: `config/settings_data.json` for app embeds, and `templates/product*.json` and `templates/cart*.json` for app blocks. From those it reports each placement as **added**, **disabled**, **missing** or **unknown**. The Storefront page refreshes this when the merchant returns to the tab.

### App proxy

An **app proxy** makes a path on the **store's own domain** forward to the app's server. Magicpromo's config:

```toml
[app_proxy]
url = "/storefront"      # route in our app
prefix = "apps"
subpath = "magicpromo-dev"
```

A shopper's browser calls `https://timis-chocolates.myshopify.com/apps/magicpromo-dev?products=1,2`. Shopify forwards it to `https://our-app/storefront?products=1,2&shop=…&signature=…`.

Why it matters:

- **Same origin.** The theme's JavaScript calls its own domain, so there's no CORS setup.
- **Signed by Shopify.** Shopify adds a `signature` (HMAC with the app secret). `authenticate.public.appProxy(request)` checks it and returns the shop's offline session, so we know which shop is asking without any key in the browser.
- **No secrets on the storefront.** That's why the Liquid path needs no API key, and why the Hydrogen path (which can't use the app proxy) needs a server-side key instead.

### Two kinds of storefront: Liquid and Hydrogen

- **Liquid (Online Store 2.0)** is Shopify's hosted theme system. Pages are **JSON templates** (`templates/product.json`) made of **sections** and **blocks**, rendered server-side with Liquid. Merchants edit them visually in the **theme editor**. Apps integrate through **theme app extensions**. Most Shopify stores are Liquid stores.
- **Hydrogen** is Shopify's React framework for **headless** storefronts. Developers write the storefront as a React Router app, read data from the **Storefront API**, and usually host it on **Oxygen**. There's no theme editor and no theme app extensions; apps integrate through **APIs and npm packages**, and the developer owns all the markup.

Magicpromo supports both from one backend and one SDK. Section 7 compares them.

### Webhooks

Webhooks are Shopify calling your app when something happens. Magicpromo subscribes to:

- `app/uninstalled`: deletes sessions and **revokes Hydrogen API keys** (`webhooks.app.uninstalled.tsx`).
- `app/scopes_update`: keeps the stored scopes in sync.

---

## 3. What the merchant does

1. **Create a promotion** (`/app/promotions/new`, `PromotionEditorPage.tsx`):
   - Name, percent and minimum.
   - Qualification mode: **distinct products** ("5 different chocolates") or **total quantity** ("any 5 items").
   - Eligibility: a list of products, or one collection.
   - Which discount types it combines with.
   - A cart preview to test it. Saving creates a **draft** in the database only.
2. **Publish and activate.** This creates or updates the automatic app discount and its config metafield in Shopify (`promotion-activation.server.ts`), covered in detail in section 4.
3. **Choose how shoppers see it.** The promotion page's **Storefront display** section compares two options:
   - **Magicpromo banner** (default): turn placements on and edit the message, link and colours on the messaging page (`/app/storefront/:id`).
   - **Your own elements** (for developers): opens a promotion-specific code snippet to copy (`DeveloperElements.tsx`).
4. **Place banners in the theme.** On the Storefront page (`/app/storefront`), choose a theme and use the deep-link buttons. Placement status is read back from the theme.
5. **Set the display order.** When several promotions qualify, the first in the saved order wins (`display-order.server.ts`).
6. **Hydrogen stores:** create an API key on the Hydrogen page (`/app/hydrogen`). It's shown once and stored only as a SHA-256 hash.

The promotions list (`PromotionsList.tsx`) shows each promotion's live Shopify status, usage count (`asyncUsageCount`), where it's shown, and a callout for developers. Clicking anywhere on a row opens it (`clickDelegate`).

---

## 4. How an offer travels: admin → checkout → storefront

**Saving.** The editor posts to `savePromotion`, which writes a `PromotionDraft` with Prisma. Nothing changes in Shopify yet.

**Activating** (`activatePromotion`):

1. **Optimistic concurrency.** The request carries the draft's `updatedAt`. If someone changed it since, activation stops.
2. **Validation.** `configuration(draft)` builds the JSON and `parsePromotionConfig` checks it. That's the **same parser the Function uses** (`shared/promotion-config.ts`).
3. **Read-only pre-checks.** The app checks it has `write_discounts`, that the products or collection still exist, and that a linked discount is still there.
4. **A durable lock.** An `activationToken` is written to the database. Shopify and our database aren't one transaction, so if the response is uncertain the draft stays locked rather than risk creating a **duplicate discount**.
5. **Create or update.** `discountAutomaticAppCreate` or `discountAutomaticAppUpdate` runs with the metafield. `userErrors` release the lock and are shown to the merchant.
6. **Record the result.** The Shopify discount ID is saved with a **fingerprint** of the published rules, so the UI can show "unpublished changes".

**At checkout**, the Function runs on every cart change:

1. It parses the metafield.
2. It counts eligible lines (distinct products or total quantity).
3. If the minimum is met, it returns `productDiscountsAdd` for those lines.

Shopify then applies the discount, together with any combinable discounts.

**On the storefront:**

1. A banner asks for offers for the products in view: the cart's products plus the current product.
2. `publishedOffers` (`app/models/published-offers.server.ts`) loads the shop's linked drafts and the saved display order.
3. `storefrontOffers` (`storefront.server.ts`) reads each discount's **live status and published metafield** from Shopify. It keeps only `ACTIVE` discounts whose messaging is valid, and resolves collection membership for the requested products.

The result is `Offer[]`. Because it comes from **published** Shopify data, not drafts, the storefront never shows unpublished edits.

### The Offer contract

One TypeScript type, `Offer` in `packages/sdk/src/core.ts`, describes what the endpoints return and what every renderer receives:

```ts
type Offer = {
  id: string;                      // Shopify discount GID
  percent: number;                 // 30
  minimum: number;                 // 5
  mode: "distinct_products" | "total_quantity";
  eligibleProductIds: string[];    // numeric IDs
  settings: {                      // merchant messaging
    announcement: boolean; product: boolean; cart: boolean;
    message: string; linkText: string; destination: string;
    background: string; foreground: string;
    position: "top" | "bottom"; priority: number;
  };
};
```

The app's server builds values of this exact type (`storefront.server.ts` imports it). So the code that produces offers and the code that consumes them can't drift apart. The response is versioned (`{ version: 1, offers }`): v1 only ever adds fields, and a breaking change bumps the version.

---

## 5. The SDK: `@magicpromo/sdk`

`packages/sdk` is a pnpm workspace package. It's the single place where storefront rules live. It's layered so each piece has one job:

```text
core.ts      Pure rules. Offer type, selectOffer, cartProgress, offerMessage, progressMessage.
             No DOM, no React, no fetch. Runs anywhere.
client.ts    createMagicpromo(): the data layer. Loads offers, polls, watches the cart,
             merges bursts of refreshes, notifies subscribers. Framework-free.
render.ts    The "bring your own element" contract: RenderContext, Renderer.
theme/       Liquid adapter. <magicpromo-banner>, window.Magicpromo, the default banner,
             and the app-proxy and AJAX-cart sources. Bundled into the theme extension.
server.ts    Hydrogen server helper: getMagicpromoOffers() with the Bearer key.
react.tsx    Hydrogen/React adapter: MagicpromoProvider, useOffer, useMagicpromo,
             describeOffer, and ready-made banners.
```

### Core rules (`core.ts`)

- **`selectOffer(offers, placement, { items, productId })`** picks the one offer to show:
  - **Announcement:** the first enabled offer in display order.
  - **Product:** the first enabled offer that includes this product.
  - **Cart:** the first enabled offer matching something already in the cart. If nothing matches, the first enabled offer.
- **`cartProgress(offer, items)`** returns `{ count, remaining, qualified }`. Distinct mode counts each product once across variants; quantity mode adds up units.
- **`offerMessage` / `progressMessage`** fill `{minimum}`, `{percent}`, `{items}` and `{remaining}` into merchant or translated templates.

### Data client (`client.ts`)

```ts
const client = createMagicpromo({
  offers: (productIds) => fetchOffersSomehow(productIds), // OfferSource
  cart: { read, watch },                                  // CartSource (optional)
  productIds: () => ["123"],                              // extra products, e.g. the page's product
  pollMs: 15_000,
  initialOffers,                                          // server-loaded, no flash
});
const unsubscribe = client.subscribe((state) => render(state));
```

Design decisions:

- **Data sources you can swap.** The client doesn't know about app proxies or `/cart.js`. The theme passes `appProxyOffers` and `ajaxCart`, Hydrogen passes `routeOffers`, and tests pass fakes. This is **dependency injection**, and it's why one client serves both storefronts.
- **Starts lazily, cleans up.** Polling and cart watching start with the first subscriber and stop with the last. Every setup call returns its cleanup function (`subscribe` → unsubscribe).
- **Burst handling.** Many cart events at once cause one request in flight plus one rerun, not one request per event.
- **Fails quietly.** On error, `state.status` is `"error"` and offers are cleared. Banners are informational, so it's better to show nothing than a stale promise.
- **The state is a union.** `{ status: "loading" | "ready" | "error", … }`, so the `error` field only exists in the error case.

### Liquid adapter (`theme/`)

`theme/magicpromo-banner.ts` defines the `<magicpromo-banner>` custom element:

1. **On connect,** it reads its `data-*` attributes and subscribes to the **one shared client** for its proxy path. Several banners on a page share one fetch loop.
2. **On each state,** it calls `selectOffer`, builds a `RenderContext` (with the message already translated and filled in, the link with the locale prefix, cart progress, and a `dismiss` function), and calls the renderer the developer registered **or the default renderer**.
3. **The default renderer** (`theme/default-renderer.ts`) is the stock banner. It sets the CSS variables `--mp-bg` and `--mp-fg` from the merchant's colours, and `assets/magicpromo.css` styles it.

Cart watching (`theme/sources.ts`) has to cope with themes changing the cart in many different ways. It listens to:

- `PerformanceObserver` resource entries for `/cart/add|change|update|clear`, which catches any theme or app using `fetch` or XHR without patching `fetch`;
- common theme events (`cart:updated`, `cart:change`);
- cart form submits and changes;
- tab visibility.

**Build.** A theme app extension ships static files, so esbuild bundles `src/theme` into one file, `extensions/magicpromo-banner/assets/magicpromo.js` (about 13 KB, not minified). The generated file is committed, and **a test fails if it's stale** (`tests/storefront-banner.test.cjs`).

### Hydrogen adapter (`server.ts`, `react.tsx`)

- **`getMagicpromoOffers({ endpoint, apiKey }, productIds)`** runs **on the Hydrogen server only**. It enforces HTTPS, sets `redirect: "error"` (a redirect could leak the Bearer token to another host), uses a 3-second timeout, and checks the response version.
- **`MagicpromoProvider`** creates one client per app. It reads offers from the developer's own server route (`routeOffers("/api/magicpromo")`), so the key never reaches the browser.
- **`useOffer(placement, { productId })`** returns `{ offer: undefined }` or `{ offer, message, progress }`. It uses **`useSyncExternalStore`**, React's built-in way to subscribe to an outside store without different components seeing different data in the same render.
- **Cart `items` come from Hydrogen's cart as props.** Progress updates instantly; offers are only refetched when the *set of products* changes.

---

## 6. Bring your own element

### The idea

Most promotion apps inject a fixed widget. It looks foreign in a carefully designed theme, and developers end up fighting it with CSS. Magicpromo separates **deciding** from **drawing**:

| Magicpromo owns (the rules) | The developer owns (the look) |
| --- | --- |
| Which offer applies to this placement, cart and product | The element: a badge, a line in the cart drawer, a custom component |
| Keeping it current as the cart changes | Markup, styling, animation, accessibility details |
| The message, translated and filled in | Where it sits in the layout |
| Cart progress maths that matches checkout | Whether to show it at all |

The developer gets a **`RenderContext`** and returns an element. They never re-implement eligibility or progress rules, so the storefront can't disagree with the Function.

### On a Liquid storefront

The banner script exposes `window.Magicpromo`:

```html
<script>
  function useMyElements(Magicpromo) {
    Magicpromo.render("product", ({ offer, message, href }) => {
      const badge = document.createElement("a");
      badge.className = "my-offer-badge";   // the theme's own styles
      badge.href = href;
      badge.textContent = message;
      return badge;
    });
  }
  if (window.Magicpromo) useMyElements(window.Magicpromo);
  else document.addEventListener("magicpromo:ready", (e) => useMyElements(e.detail), { once: true });
</script>
```

| Field | Meaning |
| --- | --- |
| `offer` | The chosen `Offer` |
| `message` | Ready-to-show text, translated (Liquid `t` filter) and filled in |
| `progress` | Cart only: `{ count, remaining, qualified }` |
| `href` | Destination with the market/locale prefix (`Shopify.routes.root`) |
| `dismiss()` | Hide until the offer or message changes |
| `host` | The `<magicpromo-banner>` element |

Rules that make this safe and predictable:

- **Return values.** A `Node` renders as is, a **string renders as text, never HTML** (so merchant text can't inject markup), and `null` hides the banner.
- **Undo.** `render()` returns a function that restores the default.
- **Per-offer fallback.** `Magicpromo.defaultRenderer(context)` keeps the stock banner for offers you don't customise:

  ```js
  Magicpromo.render("cart", (ctx) =>
    ctx.offer.id === "gid://shopify/DiscountAutomaticNode/123" ? myCartLine(ctx) : Magicpromo.defaultRenderer(ctx));
  ```

- **Failure is contained.** A renderer that throws hides only its own banner and logs to the console. It never breaks the page.
- **Load order doesn't matter.** The `magicpromo:ready` event covers scripts that run before ours.
- **Where to put it.** In a Custom Liquid section, in `theme.liquid`, or in the theme's own JS bundle.

The **app embed or app block still has to be in the theme**: it provides the `<magicpromo-banner>` host element and loads the script. The developer replaces only what goes *inside* it.

### On a Hydrogen storefront

There's no theme editor, so the developer controls everything:

```tsx
// Server route: keeps the API key secret
const offers = await getMagicpromoOffers({ endpoint, apiKey }, productIds);

// Layout: once
<MagicpromoProvider items={cartLines} productIds={[product.id]} initialOffers={offers}>

// Anywhere: your own component
function CartNudge() {
  const view = useOffer("cart");
  if (!view.offer) return null;           // TypeScript narrows the union here
  return <p className="nudge">{view.message}</p>;
}
```

`describeOffer()` is the same logic without the hook. The ready-made `AnnouncementBanner`, `ProductBanner` and `CartProgressBanner` are built on it, so custom and stock components follow identical rules.

### In the admin

Merchants usually aren't developers, so the admin explains the option in plain language using Polaris components:

- the **Storefront display** cards on each promotion;
- a callout on the promotions list;
- a modal (`DeveloperElements.tsx`) with a placement picker and a ready-to-paste snippet scoped to that promotion's offer ID, which they can copy and send to their developer.

---

## 7. Liquid vs Hydrogen, side by side

| | **Liquid theme** | **Hydrogen** |
| --- | --- | --- |
| What it is | Shopify-hosted theme (Online Store 2.0) | Headless React storefront (often on Oxygen) |
| How Magicpromo gets in | Theme app extension: app embed + app block | npm package: `@magicpromo/sdk/server` + `/react` |
| Who places it | The merchant, in the theme editor | The developer, in code |
| Offers endpoint | `/apps/magicpromo` → app proxy → `/storefront` | Developer's server route → `/api/v1/offers` |
| Authentication | Shopify's app proxy HMAC signature; no secret in the browser | Bearer API key, kept on the Hydrogen server, stored hashed in Magicpromo |
| CORS | Not needed (same origin) | Not needed (server to server) |
| Cart source | AJAX API `/cart.js`, plus watching theme cart events | Hydrogen's cart, passed as `items` props |
| Translations | Liquid `t` filter → `data-*` attributes | `labels` / `templates` props |
| Locale-aware links | `window.Shopify.routes.root` | `linkPrefix` prop / your router |
| Default UI | `<magicpromo-banner>` + `magicpromo.css` | `AnnouncementBanner`, `ProductBanner`, `CartProgressBanner` |
| Bring your own element | `window.Magicpromo.render(placement, renderer)` | `useOffer(placement)` in your components |
| Shared logic | `packages/sdk/src/core.ts` + `client.ts` | the same files |
| Setup preview | `request.design_mode` setup card | n/a (no theme editor) |
| Shipping changes | `shopify app deploy` (extension version) | npm/package update in the storefront |

---

## 8. Who edits what, and how

### Merchants

- **In Magicpromo:** promotion rules, messaging (text, link, colours, position, which placements), display order, Hydrogen keys.
- **In the theme editor:**
  - switch the **app embed** on or off (Theme settings → App embeds);
  - **drag the app block** to the right spot; Shopify adds new blocks at the end of a section, so move the product banner above the buy buttons;
  - **Save**. Nothing goes live until they save, and the theme editor preview shows the real banner with live data.
- **Publishing.** Messaging edits are drafts until **Publish and activate**, which writes them to Shopify together with the rules.

### Theme developers (Liquid)

- Register renderers with `window.Magicpromo.render` (section 6).
- Or keep the default banner and restyle it with CSS: `magicpromo-banner .mp-content`, plus the `--mp-bg` and `--mp-fg` variables and the `data-position` attribute on the host.

### Hydrogen developers

- Use `useOffer` / `describeOffer` for their own components, or the ready-made banners with `unstyled` and `className`.

### Magicpromo developers (this repo)

- **Storefront script:** edit `packages/sdk/src/theme`, then run `pnpm --filter @magicpromo/sdk build:theme`.
- **Function:** edit `extensions/magicpromo-discount/src`; its config validation is `shared/promotion-config.ts`.
- **Admin GraphQL:** after editing a query, run `pnpm graphql-codegen` to regenerate types.
- **Database:** edit `prisma/schema.prisma` and add migrations for both SQLite and PostgreSQL (`docs/render-deployment.md`).

---

## 9. Repository map

```text
app/
  routes/
    app.tsx                     Embedded shell: AppProvider (Polaris 2 URL), s-app-nav, dev badge
    app._index.tsx              Promotions list (loader adds live status + usage from Shopify)
    app.promotions.new/$id.tsx  Promotion editor
    app.storefront._index.tsx   Theme picker, placement status, deep links, display order
    app.storefront.$id.tsx      Messaging editor for one promotion
    app.theme-status.ts         Placement detection endpoint
    app.hydrogen.tsx            Hydrogen API key management
    storefront.ts               App proxy endpoint (Liquid)
    api.v1.offers.ts            Bearer-key endpoint (Hydrogen)
    webhooks.app.*.tsx          Uninstall + scope webhooks
    _index/route.tsx            Public login page (outside the admin)
  models/                       Server logic (*.server.ts never ships to the browser)
    promotion-activation.server.ts  Create/update/deactivate the Shopify discount, with locking
    storefront.server.ts            Build Offer[] from live Shopify data
    published-offers.server.ts      Apply display order
    theme-setup.server.ts           Themes, proxy-path metafields, deep links
    theme-placement.server.ts       Read theme files → added/disabled/missing
    hydrogen-key.server.ts          Issue, hash, rotate, revoke API keys
  components/                   Admin UI (Polaris web components)
    DeveloperElements.tsx       "Your own elements" cards + snippet modal
  lib/                          Shared helpers (storefront settings, placements, environment)
  types/                        Generated Admin GraphQL types (codegen)
  polaris.ts                    Single Polaris CDN URL
shared/promotion-config.ts      One validator for app + Function
extensions/
  magicpromo-discount/          Shopify Function (product discount, Wasm)
  magicpromo-banner/            Theme app extension (app embed + app block)
packages/sdk/                   @magicpromo/sdk (core, client, theme, server, react) + README
tests/                          node:test suites (TypeScript loaded through esbuild)
docs/                           storefront.md, hydrogen.md, render-deployment.md
```

---

## 10. Engineering decisions and refactors

The first version was written quickly. These refactors are good examples of reading existing code and fixing it:

1. **One validator instead of four.** The promotion config was validated with long `||` chains in the Function, in activation, and in the storefront offers code. Now there's `parsePromotionConfig(input: unknown): ParseResult<PromotionConfig>`, a pure function with no dependencies (to fit the Function's Wasm limits). It returns a **Result union** and builds a fresh object, so unknown keys never leak through.
2. **Typed GraphQL instead of casts.** A hand-written `Graphql` type and `as` casts were replaced with `AdminGraphqlClient` and codegen types. The compiler then found:
   - **dead `result.errors` checks** (the client throws instead);
   - **unhandled `null`s from `nodes()`**;
   - a hand-written `ProductSummary` that said a field was always present when Shopify says it can be missing.
3. **Polaris 2.** Upgraded `@shopify/shopify-app-react-router` to v4 and pinned one Polaris URL for the `AppProvider`, the preload header and the login page. Hard-coded colours were replaced with `<s-box>` / `<s-badge>` so the app follows both admin themes.
4. **React 19.** React 18 couldn't set properties on custom elements, so the code had `PolarisCheckbox` and `useEffect` workarounds. React 19 passes `checked` and `values` straight to Polaris web components, so those were deleted.
5. **The SDK extraction.** The same offer-selection logic existed as untyped JavaScript in the theme script and again in TypeScript for Hydrogen. It's now one typed core, with adapters on top.
6. **Accessible clickable rows.** `clickDelegate` on `<s-table-row>` forwards clicks to the row's real link, so keyboard and screen-reader users still get a proper link.
7. **Theme placement fixes:**
   - **Reusing empty Apps sections.** "Add cart progress" now targets an existing empty Apps section (`target=sectionId:…`) instead of creating a new one on every click.
   - **Re-enabling the embed.** A disabled announcement embed now gets a "Turn on" link that keeps `activateAppId`; the old "Manage" link stripped it.
   - **Top by default.** New promotions put the announcement at the top, because the bottom edge is crowded by chat widgets, popups and Sidekick.
8. **Tooling.** Standardised on pnpm (two lockfiles had installed two copies of `graphql`). Generated GraphQL enums are emitted as string unions (`enumsAsConst`), because a `.d.ts` `enum` has no value at runtime.

---

## 11. Known limitations and next steps

- **Function tests.** `extensions/magicpromo-discount/tests/default.test.js` uses `@shopify/shopify-function-test-helpers`, which doesn't yet read Shopify CLI 5's function info, so it fails before running. The 31 fixtures pass when run directly against the bundled Function.
- **API versions don't match.** Webhooks use `2027-01`, but the newest version the installed app package offers is `October26`, and the app uses `July26`.
- **Rate limiting.** `/api/v1/offers` validates and bounds its input, but there's no distributed rate limiter.
- **Hydrogen product registration.** A component using `useOffer('product', { productId })` must also have that product listed in the provider's `productIds`.
- **Ideas for later:**
  - tiered and buy-one-get-one (BOGO) promotions, using a discriminated union on `type` plus config version 2;
  - a published npm package and hosted docs (readme.com, published from this README in CI).

---

## 12. Interview questions this project answers

**What's the difference between an app embed and an app block?**
An embed (`target: body/head`) is injected site-wide and toggled in Theme settings → App embeds. It's good for floating UI. A block (`target: section`) is placed by the merchant inside a template section, for inline UI. Magicpromo uses an embed for the announcement bar and a block for the product and cart banners.

**Why use an app proxy instead of calling your server from the theme?**
It's same-origin (no CORS), Shopify signs the request (HMAC), so you know the shop without a key in the browser, and it gives you the shop's offline session.

**Why can't Hydrogen use the app proxy?**
App proxies are an Online Store feature that runs on the theme's domain. A headless storefront calls the app from its own server with a credential instead. Magicpromo issues per-shop API keys, stores only their hash, and revokes them on uninstall.

**Embedded vs unembedded?**
Embedded apps run in the admin iframe with App Bridge and session tokens. Unembedded apps run on their own domain and authenticate users themselves. Magicpromo is embedded, but its login page, app proxy, Hydrogen API and webhooks all run outside the admin, each with its own proof of identity.

**Why put the discount logic in a Function, and not just show banners?**
Checkout must be authoritative and fast, and it can't call out to your server. Functions run inside Shopify as Wasm, with input from a GraphQL query and config from a metafield. Banners are only advice.

**How do you avoid duplicate discounts when the API call might have succeeded?**
Pre-checks first, then a durable `activationToken` lock in the database. If the outcome is uncertain, stay locked and ask the merchant to check, rather than retry blindly.

**How would you design an SDK that lets developers render their own UI?**
Keep the rules pure (`core`), the data layer framework-free with sources you can swap (`client`), and the rendering contract small and typed (`RenderContext` → `Node | string | null`). Make it safe by default (text, not HTML; contained failures), give every setup call a cleanup, and provide a default renderer and a way to fall back to it.

**How do you keep the theme and Hydrogen consistent?**
They share one core and one `Offer` type, which the server also produces.

**How do you know a merchant actually saved the block?**
You can't from a deep link. Read the theme files (`settings_data.json`, template JSON) through the Admin API and report the actual state.

**What breaks when you move to Polaris 2 / React 19?**
Polaris 2 changes looks, not APIs: load `polaris-2.js` once, match `polaris-types`, and remove CSS that copies Polaris tokens. React 19 lets you use controlled custom elements directly. App Bridge's JSX types still target the global `JSX` namespace, so a small module augmentation is needed (`app/app-bridge.d.ts`).

---

## 13. Running it locally

Requirements: Node 22+, pnpm 10.26+ (the repo uses pnpm 12), and the Shopify CLI (`npm i -g @shopify/cli`).

```sh
pnpm install
pnpm dev                 # shopify app dev --config development (Magicpromo Dev)
pnpm typecheck && pnpm lint
node --test tests/*.cjs  # app, SDK and theme tests
pnpm --filter @magicpromo/sdk build:theme   # rebuild the theme script after SDK changes
pnpm graphql-codegen     # regenerate Admin API types after editing queries
```

Press **p** in the CLI to open the app in the dev store. More guides:

- `docs/storefront.md`: Liquid setup and theme developer guide.
- `docs/hydrogen.md`: Hydrogen setup.
- `packages/sdk/README.md`: SDK reference.
- `docs/render-deployment.md`: PostgreSQL and Render deployment.
