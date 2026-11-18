// <magicpromo-banner> for Liquid themes, plus window.Magicpromo for developers.
// Bundled into the theme app extension's assets/magicpromo.js by
// `pnpm --filter @magicpromo/sdk build:theme`.
import { createMagicpromo, type MagicpromoClient } from "../client";
import {
  cartProgress,
  formatTemplate,
  itemLabel,
  selectOffer,
  type CartItem,
  type Offer,
  type Placement,
} from "../core";
import type { MagicpromoThemeApi, RenderContext, Renderer } from "../render";
import { defaultRenderer } from "./default-renderer";
import { ajaxCart, appProxyOffers, withRoot } from "./sources";

declare global {
  interface Window {
    Shopify?: { routes?: { root?: string } };
    Magicpromo?: MagicpromoThemeApi;
  }
}

const VERSION = "0.2.0";
const POLL_MS = 15_000;
const PROXY_PATH = /^\/apps\/[a-z0-9_-]+$/;

const renderers = new Map<Placement, Renderer>();
// One client per app proxy path, shared by every banner on the page.
const clients = new Map<string, MagicpromoClient>();
const banners = new Set<MagicpromoBanner>();
// Captured before other scripts can wrap fetch.
let nativeFetch: typeof fetch;

function clientFor(path: string) {
  let client = clients.get(path);
  if (!client) {
    client = createMagicpromo({
      offers: appProxyOffers(path, nativeFetch),
      cart: ajaxCart(nativeFetch),
      // Product banners need their product checked even if it isn't in the cart.
      productIds: () =>
        [...banners]
          .filter((banner) => banner.path === path)
          .map((banner) => banner.dataset.product ?? "")
          .filter(Boolean),
      pollMs: POLL_MS,
    });
    clients.set(path, client);
  }
  return client;
}

class MagicpromoBanner extends HTMLElement {
  declare path?: string;
  declare dismissed?: string;
  declare setupTemplate?: HTMLTemplateElement | null;
  declare unsubscribe?: () => void;
  declare last?: { offers: Offer[]; items: CartItem[] };

  connectedCallback() {
    this.setupTemplate ||= this.querySelector<HTMLTemplateElement>("template[data-mp-setup]");
    if (this.dataset.designMode === "true") this.render([], []);
    const path = this.dataset.proxy ?? "";
    if (!PROXY_PATH.test(path)) return;
    this.path = path;
    banners.add(this);
    this.unsubscribe = clientFor(path).subscribe((state) =>
      this.render(state.offers, state.items),
    );
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    banners.delete(this);
  }

  /** Re-render with the last data, e.g. after a renderer is registered. */
  repaint() {
    if (this.last) this.render(this.last.offers, this.last.items);
  }

  render(offers: Offer[], items: CartItem[]) {
    this.last = { offers, items };
    const placement = this.dataset.placement as Placement;
    const offer = selectOffer(offers, placement, { items, productId: this.dataset.product });
    this.replaceChildren();
    this.hidden = true;
    delete this.dataset.setup;
    if (!offer) return this.renderSetup();

    const dismissalKey = `${this.path}:${offer.id}:${offer.settings.message}`;
    if (this.dismissed === dismissalKey) return;

    const context = this.context(placement, offer, items, () => {
      this.dismissed = dismissalKey;
      this.hidden = true;
    });
    const renderer = renderers.get(placement) ?? defaultRenderer;
    let output: Node | string | null;
    try {
      output = renderer(context);
    } catch (error) {
      // A broken custom renderer must not break the storefront.
      console.error("[magicpromo] renderer failed", error);
      return;
    }
    if (output == null) return;
    if (typeof output === "string") {
      const text = document.createElement("span");
      text.textContent = output;
      output = text;
    }
    this.append(output);
    this.hidden = false;
  }

  private context(
    placement: Placement,
    offer: Offer,
    items: CartItem[],
    dismiss: () => void,
  ): RenderContext {
    // Liquid passes translated strings as data attributes.
    const labels = { items: this.dataset.items ?? "", distinct: this.dataset.distinct ?? "" };
    const values = { percent: offer.percent, items: itemLabel(offer, labels) };
    const progress = placement === "cart" ? cartProgress(offer, items) : undefined;
    const message = progress
      ? formatTemplate(
          (progress.qualified ? this.dataset.qualified : this.dataset.progress) ?? "",
          { ...values, remaining: progress.remaining },
        )
      : formatTemplate(offer.settings.message, { ...values, minimum: offer.minimum });
    return {
      placement,
      offer,
      message,
      progress,
      href: withRoot(offer.settings.destination),
      dismiss,
      host: this,
    };
  }

  /** In the theme editor only, show a setup card when no offer applies. */
  private renderSetup() {
    if (this.dataset.designMode !== "true") return;
    this.dataset.setup = "true";
    if (this.setupTemplate) {
      this.append(this.setupTemplate.content.cloneNode(true));
    } else {
      const message = document.createElement("div");
      message.className = "mp-placeholder";
      message.textContent = this.dataset.placeholder ?? "";
      this.append(message);
    }
    this.hidden = false;
  }
}

const repaint = (placement: Placement) => {
  for (const banner of banners)
    if (banner.dataset.placement === placement) banner.repaint();
};

const api: MagicpromoThemeApi = {
  version: VERSION,
  render(placement, renderer) {
    renderers.set(placement, renderer);
    repaint(placement);
    return () => {
      if (renderers.get(placement) !== renderer) return;
      renderers.delete(placement);
      repaint(placement);
    };
  },
  refresh() {
    for (const client of clients.values()) void client.refresh();
  },
};

// Both app blocks load this script; install once.
if (!customElements.get("magicpromo-banner")) {
  nativeFetch = window.fetch.bind(window);
  window.Magicpromo = api;
  customElements.define("magicpromo-banner", MagicpromoBanner);
  // Scripts that load before ours can wait for this event.
  document.dispatchEvent(new CustomEvent("magicpromo:ready", { detail: api }));
}
