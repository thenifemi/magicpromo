// <magicpromo-banner> for Liquid themes. Bundled into the theme app extension's
// assets/magicpromo.js by `pnpm --filter @magicpromo/sdk build:theme`.
import {
  cartProgress,
  formatTemplate,
  itemLabel,
  selectOffer,
  type CartItem,
  type Offer,
  type Placement,
} from "../core";

declare global {
  interface Window {
    Shopify?: { routes?: { root?: string } };
  }
}

/** Shape of the AJAX API's /cart.js that we read. */
type ThemeCart = { items: { product_id: number | string; quantity: number }[] };

type Group = {
  path: string;
  elements: Set<MagicpromoBanner>;
  busy: boolean;
  timer?: ReturnType<typeof setInterval>;
};

const EMPTY_CART: ThemeCart = { items: [] };
const POLL_MS = 15_000;
const PROXY_PATH = /^\/apps\/[a-z0-9_-]+$/;

const toCartItems = (cart: ThemeCart): CartItem[] =>
  cart.items.map((item) => ({
    productId: String(item.product_id),
    quantity: item.quantity,
  }));

// Banners sharing an app proxy path share one fetch loop.
const groups = new Map<string, Group>();
const root = () => window.Shopify?.routes?.root || "/";
const withRoot = (path: string) => `${root().replace(/\/$/, "")}${path}`;

async function update(group: Group, fetchFn: typeof fetch) {
  if (group.busy || document.hidden || !group.elements.size) return;
  group.busy = true;
  try {
    const cartResponse = await fetchFn(`${root()}cart.js`, { cache: "no-store" });
    if (!cartResponse.ok) throw new Error("cart");
    const cart: ThemeCart = await cartResponse.json();
    const productIds = new Set([
      ...cart.items.map((item) => String(item.product_id)),
      ...[...group.elements].map((el) => el.dataset.product).filter(Boolean),
    ]);
    const response = await fetchFn(
      `${withRoot(group.path)}?products=${encodeURIComponent([...productIds].join(","))}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("offers");
    const { offers } = (await response.json()) as { offers: Offer[] };
    for (const element of group.elements) element.render(offers, cart);
  } catch {
    // Banners are informational: on any failure, hide them.
    for (const element of group.elements) element.render([], EMPTY_CART);
  } finally {
    group.busy = false;
  }
}

class MagicpromoBanner extends HTMLElement {
  declare group?: Group;
  declare dismissed?: string;
  declare setupTemplate?: HTMLTemplateElement | null;

  connectedCallback() {
    this.setupTemplate ||= this.querySelector<HTMLTemplateElement>(
      "template[data-mp-setup]",
    );
    if (this.dataset.designMode === "true") this.render([], EMPTY_CART);
    const path = this.dataset.proxy || "";
    if (!PROXY_PATH.test(path)) return;
    let group = groups.get(path);
    if (!group) {
      const created: Group = { path, elements: new Set(), busy: false };
      created.timer = setInterval(() => update(created, nativeFetch), POLL_MS);
      groups.set(path, created);
      group = created;
    }
    group.elements.add(this);
    this.group = group;
    void update(group, nativeFetch);
  }

  disconnectedCallback() {
    const group = this.group;
    group?.elements.delete(this);
    if (group && !group.elements.size) {
      clearInterval(group.timer);
      groups.delete(group.path);
    }
  }

  render(offers: Offer[], cart: ThemeCart) {
    const placement = this.dataset.placement as Placement;
    const items = toCartItems(cart);
    const offer = selectOffer(offers, placement, {
      items,
      productId: this.dataset.product,
    });
    this.replaceChildren();
    this.hidden = true;
    delete this.dataset.setup;
    if (!offer) return this.renderSetup();

    const dismissalKey = `${this.group?.path}:${offer.id}:${offer.settings.message}`;
    if (placement === "announcement" && this.dismissed === dismissalKey) return;

    this.style.setProperty("--mp-bg", offer.settings.background);
    this.style.setProperty("--mp-fg", offer.settings.foreground);
    this.dataset.position = offer.settings.position;

    const labels = {
      items: this.dataset.items ?? "",
      distinct: this.dataset.distinct ?? "",
    };
    const content = document.createElement("div");
    content.className = "mp-content";
    const text = document.createElement("span");
    const progress = placement === "cart" ? cartProgress(offer, items) : undefined;

    if (progress) {
      text.setAttribute("role", "status");
      text.textContent = formatTemplate(
        (progress.qualified ? this.dataset.qualified : this.dataset.progress) ?? "",
        {
          remaining: progress.remaining,
          percent: offer.percent,
          items: itemLabel(offer, labels),
        },
      );
    } else {
      // textContent, never innerHTML: merchant text must not become markup.
      text.textContent = formatTemplate(offer.settings.message, {
        minimum: offer.minimum,
        percent: offer.percent,
        items: itemLabel(offer, labels),
      });
    }

    const link = document.createElement("a");
    link.href = withRoot(offer.settings.destination);
    link.textContent = offer.settings.linkText;
    content.append(text, link);

    if (progress) {
      const bar = document.createElement("progress");
      bar.max = offer.minimum;
      bar.value = Math.min(progress.count, offer.minimum);
      bar.setAttribute("aria-label", text.textContent ?? "");
      content.append(bar);
    }
    if (placement === "announcement") {
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "×";
      close.setAttribute("aria-label", this.dataset.close ?? "");
      close.addEventListener("click", () => {
        this.dismissed = dismissalKey;
        this.hidden = true;
      });
      content.append(close);
    }
    this.append(content);
    this.hidden = false;
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

// Captured before other scripts can wrap fetch.
let nativeFetch: typeof fetch;

function refreshAll() {
  for (const group of groups.values()) void update(group, nativeFetch);
}

/** Refresh whenever the cart may have changed, however the theme changes it. */
function watchCart() {
  document.addEventListener("visibilitychange", refreshAll);
  window.addEventListener("pageshow", refreshAll);
  if ("PerformanceObserver" in window) {
    new PerformanceObserver((list) => {
      const cartChanged = list
        .getEntries()
        .some((entry) => /\/cart\/(add|change|update|clear)(\.js)?(?:\?|$)/.test(entry.name));
      if (cartChanged) refreshAll();
    }).observe({ type: "resource", buffered: false });
  }
  for (const name of ["cart:updated", "cart:change", "magicpromo:cart:changed"])
    document.addEventListener(name, refreshAll);
  document.addEventListener("submit", (event) => {
    if (
      event.target instanceof HTMLFormElement &&
      /\/cart(?:\/|$)/.test(new URL(event.target.action).pathname)
    )
      setTimeout(refreshAll, 800);
  });
  document.addEventListener("change", (event) => {
    if (event.target instanceof Element && event.target.closest('form[action*="/cart"]'))
      setTimeout(refreshAll, 800);
  });
}

// Both app blocks load this script; register once.
if (!customElements.get("magicpromo-banner")) {
  nativeFetch = window.fetch.bind(window);
  customElements.define("magicpromo-banner", MagicpromoBanner);
  watchCart();
}
