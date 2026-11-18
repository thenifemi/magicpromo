// Liquid storefront data sources: the signed app proxy and the AJAX cart API.
import type { CartSource, OfferSource } from "../client";
import type { CartItem, Offer } from "../core";

/** Shape of /cart.js that we read. */
type AjaxCart = { items: { product_id: number | string; quantity: number }[] };

export const storefrontRoot = () => window.Shopify?.routes?.root || "/";
export const withRoot = (path: string) =>
  `${storefrontRoot().replace(/\/$/, "")}${path}`;

/** Offers via the app proxy. Shopify signs the request, so no key is needed. */
export function appProxyOffers(path: string, fetchFn: typeof fetch): OfferSource {
  return async (productIds) => {
    const query = encodeURIComponent(productIds.join(","));
    const response = await fetchFn(`${withRoot(path)}?products=${query}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Offers request failed (${response.status})`);
    const { offers } = (await response.json()) as { offers: Offer[] };
    return offers;
  };
}

const CART_MUTATION = /\/cart\/(add|change|update|clear)(\.js)?(?:\?|$)/;
const CART_EVENTS = ["cart:updated", "cart:change", "magicpromo:cart:changed"];
// Classic cart forms reload or re-render after submit; give them a moment.
const FORM_SETTLE_MS = 800;

/** The theme's cart. Themes change it in many ways, so we listen to all of them. */
export function ajaxCart(fetchFn: typeof fetch): CartSource {
  return {
    async read(): Promise<CartItem[]> {
      const response = await fetchFn(`${storefrontRoot()}cart.js`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Cart request failed (${response.status})`);
      const cart = (await response.json()) as AjaxCart;
      return cart.items.map((item) => ({
        productId: String(item.product_id),
        quantity: item.quantity,
      }));
    },
    watch(onChange) {
      const later = () => setTimeout(onChange, FORM_SETTLE_MS);
      const onSubmit = (event: Event) => {
        if (
          event.target instanceof HTMLFormElement &&
          /\/cart(?:\/|$)/.test(new URL(event.target.action).pathname)
        )
          later();
      };
      const onFieldChange = (event: Event) => {
        if (event.target instanceof Element && event.target.closest('form[action*="/cart"]'))
          later();
      };
      // Catches fetch/XHR cart calls from any theme or app, without patching fetch.
      const observer =
        "PerformanceObserver" in window
          ? new PerformanceObserver((list) => {
              if (list.getEntries().some((entry) => CART_MUTATION.test(entry.name)))
                onChange();
            })
          : undefined;
      observer?.observe({ type: "resource", buffered: false });

      document.addEventListener("visibilitychange", onChange);
      window.addEventListener("pageshow", onChange);
      for (const name of CART_EVENTS) document.addEventListener(name, onChange);
      document.addEventListener("submit", onSubmit);
      document.addEventListener("change", onFieldChange);

      return () => {
        observer?.disconnect();
        document.removeEventListener("visibilitychange", onChange);
        window.removeEventListener("pageshow", onChange);
        for (const name of CART_EVENTS) document.removeEventListener(name, onChange);
        document.removeEventListener("submit", onSubmit);
        document.removeEventListener("change", onFieldChange);
      };
    },
  };
}
