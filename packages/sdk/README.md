# @magicpromo/sdk

Show Magicpromo offers on any Shopify storefront, with Magicpromo's banners or your own elements.

Magicpromo decides **which** offer applies and keeps it current with the cart. You decide **what it looks like**. Shopify's discount Function still calculates the real discount at checkout.

| Storefront | Use | Entry point |
| --- | --- | --- |
| Liquid theme | `window.Magicpromo` (loaded by the Magicpromo app blocks) | built from `src/theme` |
| Hydrogen / React | server fetch + React banners or hooks | `@magicpromo/sdk/server`, `@magicpromo/sdk/react` |
| Anything else | data client and pure helpers | `@magicpromo/sdk` |

## Liquid themes: bring your own element

Add a Magicpromo app block or embed in the theme editor, then register a renderer:

```html
<script>
  function useMyElements(Magicpromo) {
    Magicpromo.render("product", ({ offer, message, href }) => {
      const badge = document.createElement("a");
      badge.className = "my-offer";
      badge.href = href;
      badge.textContent = message;
      return badge;
    });
  }
  if (window.Magicpromo) useMyElements(window.Magicpromo);
  else document.addEventListener("magicpromo:ready", (e) => useMyElements(e.detail), { once: true });
</script>
```

### `Magicpromo.render(placement, renderer)`

`placement` is `"announcement" | "product" | "cart"`. Returns a function that restores the default.

The renderer receives a `RenderContext` and returns a `Node`, a string (rendered as text, never HTML), or `null` to hide.

| Field | Type | Meaning |
| --- | --- | --- |
| `offer` | `Offer` | The offer chosen for this placement. |
| `message` | `string` | Ready-to-show text, translated and filled in. |
| `progress` | `CartProgress?` | Cart only: `{ count, remaining, qualified }`. |
| `href` | `string` | Destination with the market/locale prefix. |
| `dismiss` | `() => void` | Hide until the offer or message changes. |
| `host` | `HTMLElement` | The `<magicpromo-banner>` element. |

Keep the default for some offers:

```js
Magicpromo.render("cart", (context) =>
  context.offer.id === "gid://shopify/DiscountAutomaticNode/123"
    ? myCartLine(context)
    : Magicpromo.defaultRenderer(context),
);
```

A renderer that throws hides only its own banner. Call `Magicpromo.refresh()` after changing the cart in a way Magicpromo can't detect.

## Hydrogen: bring your own component

Create an API key in Magicpromo → Hydrogen. Keep it on the server, behind a route of your own:

```ts
// app/routes/api.magicpromo.ts
import { getMagicpromoOffers } from "@magicpromo/sdk/server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const products = new URL(request.url).searchParams.get("products")?.split(",") ?? [];
  const offers = await getMagicpromoOffers(
    { endpoint: context.env.MAGICPROMO_API_URL, apiKey: context.env.MAGICPROMO_API_KEY },
    products.filter(Boolean),
  ).catch(() => []); // banners are optional; never break the page
  return Response.json({ offers }, { headers: { "Cache-Control": "no-store" } });
}
```

Wrap your layout once, passing the cart:

```tsx
import { MagicpromoProvider } from "@magicpromo/sdk/react";

<MagicpromoProvider
  items={cart.lines.nodes.map((line) => ({
    productId: line.merchandise.product.id,
    quantity: line.quantity,
  }))}
  productIds={product ? [product.id] : []}
  initialOffers={offersFromLoader}
>
  {children}
</MagicpromoProvider>;
```

Then render offers with your own components:

```tsx
import { useOffer } from "@magicpromo/sdk/react";

function CartNudge() {
  const view = useOffer("cart");
  if (!view.offer) return null;
  return (
    <div className="cart-nudge">
      <p>{view.message}</p>
      <meter value={view.progress?.count} max={view.offer.minimum} />
    </div>
  );
}
```

| Hook | Returns |
| --- | --- |
| `useOffer(placement, { productId? })` | `{ offer: undefined }` or `{ offer, message, progress? }` |
| `useMagicpromo()` | Raw client state: `{ status: "loading" \| "ready" \| "error", offers, items }` |

Progress updates instantly as `items` change. Offers refresh when the set of products changes and every 30 seconds while the tab is visible. Pass `labels` and `templates` to the provider for translations.

Prefer ready-made markup? `AnnouncementBanner`, `ProductBanner` and `CartProgressBanner` take `offers` and use the same rules (`unstyled`, `className` and `linkPrefix` supported). `describeOffer()` is the non-hook version of `useOffer`.

## Core API

| Function | Purpose |
| --- | --- |
| `selectOffer(offers, placement, { items?, productId? })` | The one offer to show; `offers` must be in display order. |
| `cartProgress(offer, items)` | `{ count, remaining, qualified }` for the cart. |
| `offerMessage(offer, labels?)` | Merchant message with `{minimum}`, `{percent}`, `{items}` filled in. |
| `progressMessage(offer, progress, templates?, labels?)` | Cart text: "Add 1 more…" or "You qualify…". |
| `createMagicpromo({ offers, cart?, productIds?, pollMs?, initialOffers? })` | Data client: `subscribe`, `refresh`, `getState`, `destroy`. |

`offers` and `cart` are pluggable sources, so the client works with the app proxy, the API, or test fakes.

## Offers contract (v1)

`{ "version": 1, "offers": Offer[] }`. See `Offer` in `src/core.ts`. Fields are only added in v1; breaking changes bump `version`.

## Develop

The theme script is generated. Edit `src/theme`, then:

```sh
pnpm --filter @magicpromo/sdk build:theme
```

A test fails if `extensions/magicpromo-banner/assets/magicpromo.js` is out of date.
