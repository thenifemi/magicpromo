// Generated from packages/sdk/src/theme. Do not edit; run pnpm build:theme.
"use strict";
(() => {
  // src/core.ts
  var defaultItemLabels = {
    items: "eligible items",
    distinct: "different eligible products"
  };
  var toProductId = (id) => String(id).split("/").pop() ?? "";
  var isEligible = (offer, productId) => offer.eligibleProductIds.includes(toProductId(productId));
  function selectOffer(offers, placement, context = {}) {
    const { items = [], productId } = context;
    const candidates = offers.filter(
      (offer) => offer.settings[placement] && (placement !== "product" || productId != null && isEligible(offer, productId))
    );
    if (placement === "cart") {
      const relevant = candidates.find(
        (offer) => items.some((item) => item.quantity > 0 && isEligible(offer, item.productId))
      );
      if (relevant) return relevant;
    }
    return candidates[0];
  }
  function cartProgress(offer, items) {
    const eligible = items.filter(
      (item) => item.quantity > 0 && isEligible(offer, item.productId)
    );
    const count = offer.mode === "distinct_products" ? new Set(eligible.map((item) => toProductId(item.productId))).size : eligible.reduce((sum, item) => sum + item.quantity, 0);
    return {
      count,
      remaining: Math.max(0, offer.minimum - count),
      qualified: count >= offer.minimum
    };
  }
  function formatTemplate(template, values) {
    return template.replace(
      /\{(\w+)\}/g,
      (match, key) => key in values ? String(values[key]) : match
    );
  }
  var itemLabel = (offer, labels = defaultItemLabels) => offer.mode === "distinct_products" ? labels.distinct : labels.items;

  // src/client.ts
  var pageIsVisible = () => typeof document === "undefined" || !document.hidden;
  function createMagicpromo(options) {
    const { pollMs = 0, isVisible = pageIsVisible } = options;
    const listeners = /* @__PURE__ */ new Set();
    let state = { status: "loading", offers: [], items: [] };
    let inFlight = null;
    let rerun = false;
    let destroyed = false;
    let stopPolling;
    let stopWatching;
    const emit = (next) => {
      state = next;
      for (const listener of listeners) listener(state);
    };
    async function load() {
      try {
        const items = options.cart ? await options.cart.read() : [];
        const productIds = /* @__PURE__ */ new Set([
          ...items.map((item) => toProductId(item.productId)),
          ...(options.productIds?.() ?? []).map(toProductId)
        ]);
        const offers = await options.offers([...productIds]);
        if (!destroyed) emit({ status: "ready", offers, items });
      } catch (error) {
        if (!destroyed) emit({ status: "error", offers: [], items: state.items, error });
      }
    }
    function refresh() {
      if (destroyed || !isVisible()) return Promise.resolve();
      if (inFlight) {
        rerun = true;
        return inFlight;
      }
      inFlight = load().finally(() => {
        inFlight = null;
        if (rerun) {
          rerun = false;
          void refresh();
        }
      });
      return inFlight;
    }
    function start() {
      if (pollMs > 0) {
        const timer = setInterval(() => void refresh(), pollMs);
        stopPolling = () => clearInterval(timer);
      }
      stopWatching = options.cart?.watch?.(() => void refresh());
    }
    function stop() {
      stopPolling?.();
      stopWatching?.();
      stopPolling = stopWatching = void 0;
    }
    return {
      getState: () => state,
      subscribe(listener) {
        if (destroyed) return () => {
        };
        listeners.add(listener);
        if (listeners.size === 1) start();
        void refresh();
        return () => {
          if (listeners.delete(listener) && listeners.size === 0) stop();
        };
      },
      refresh,
      destroy() {
        destroyed = true;
        stop();
        listeners.clear();
      }
    };
  }

  // src/theme/default-renderer.ts
  var defaultRenderer = ({ placement, offer, message, progress, href, dismiss, host }) => {
    host.style.setProperty("--mp-bg", offer.settings.background);
    host.style.setProperty("--mp-fg", offer.settings.foreground);
    host.dataset.position = offer.settings.position;
    const content = document.createElement("div");
    content.className = "mp-content";
    const text = document.createElement("span");
    text.textContent = message;
    if (progress) text.setAttribute("role", "status");
    const link = document.createElement("a");
    link.href = href;
    link.textContent = offer.settings.linkText;
    content.append(text, link);
    if (progress) {
      const bar = document.createElement("progress");
      bar.max = offer.minimum;
      bar.value = Math.min(progress.count, offer.minimum);
      bar.setAttribute("aria-label", message);
      content.append(bar);
    }
    if (placement === "announcement") {
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "\xD7";
      close.setAttribute("aria-label", host.dataset.close ?? "");
      close.addEventListener("click", dismiss);
      content.append(close);
    }
    return content;
  };

  // src/theme/sources.ts
  var storefrontRoot = () => window.Shopify?.routes?.root || "/";
  var withRoot = (path) => `${storefrontRoot().replace(/\/$/, "")}${path}`;
  function appProxyOffers(path, fetchFn) {
    return async (productIds) => {
      const query = encodeURIComponent(productIds.join(","));
      const response = await fetchFn(`${withRoot(path)}?products=${query}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Offers request failed (${response.status})`);
      const { offers } = await response.json();
      return offers;
    };
  }
  var CART_MUTATION = /\/cart\/(add|change|update|clear)(\.js)?(?:\?|$)/;
  var CART_EVENTS = ["cart:updated", "cart:change", "magicpromo:cart:changed"];
  var FORM_SETTLE_MS = 800;
  function ajaxCart(fetchFn) {
    return {
      async read() {
        const response = await fetchFn(`${storefrontRoot()}cart.js`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Cart request failed (${response.status})`);
        const cart = await response.json();
        return cart.items.map((item) => ({
          productId: String(item.product_id),
          quantity: item.quantity
        }));
      },
      watch(onChange) {
        const later = () => setTimeout(onChange, FORM_SETTLE_MS);
        const onSubmit = (event) => {
          if (event.target instanceof HTMLFormElement && /\/cart(?:\/|$)/.test(new URL(event.target.action).pathname))
            later();
        };
        const onFieldChange = (event) => {
          if (event.target instanceof Element && event.target.closest('form[action*="/cart"]'))
            later();
        };
        const observer = "PerformanceObserver" in window ? new PerformanceObserver((list) => {
          if (list.getEntries().some((entry) => CART_MUTATION.test(entry.name)))
            onChange();
        }) : void 0;
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
      }
    };
  }

  // src/theme/magicpromo-banner.ts
  var VERSION = "0.2.0";
  var POLL_MS = 15e3;
  var PROXY_PATH = /^\/apps\/[a-z0-9_-]+$/;
  var renderers = /* @__PURE__ */ new Map();
  var clients = /* @__PURE__ */ new Map();
  var banners = /* @__PURE__ */ new Set();
  var nativeFetch;
  function clientFor(path) {
    let client = clients.get(path);
    if (!client) {
      client = createMagicpromo({
        offers: appProxyOffers(path, nativeFetch),
        cart: ajaxCart(nativeFetch),
        // Product banners need their product checked even if it isn't in the cart.
        productIds: () => [...banners].filter((banner) => banner.path === path).map((banner) => banner.dataset.product ?? "").filter(Boolean),
        pollMs: POLL_MS
      });
      clients.set(path, client);
    }
    return client;
  }
  var MagicpromoBanner = class extends HTMLElement {
    connectedCallback() {
      this.setupTemplate || (this.setupTemplate = this.querySelector("template[data-mp-setup]"));
      if (this.dataset.designMode === "true") this.render([], []);
      const path = this.dataset.proxy ?? "";
      if (!PROXY_PATH.test(path)) return;
      this.path = path;
      banners.add(this);
      this.unsubscribe = clientFor(path).subscribe(
        (state) => this.render(state.offers, state.items)
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
    render(offers, items) {
      this.last = { offers, items };
      const placement = this.dataset.placement;
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
      let output;
      try {
        output = renderer(context);
      } catch (error) {
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
    context(placement, offer, items, dismiss) {
      const labels = { items: this.dataset.items ?? "", distinct: this.dataset.distinct ?? "" };
      const values = { percent: offer.percent, items: itemLabel(offer, labels) };
      const progress = placement === "cart" ? cartProgress(offer, items) : void 0;
      const message = progress ? formatTemplate(
        (progress.qualified ? this.dataset.qualified : this.dataset.progress) ?? "",
        { ...values, remaining: progress.remaining }
      ) : formatTemplate(offer.settings.message, { ...values, minimum: offer.minimum });
      return {
        placement,
        offer,
        message,
        progress,
        href: withRoot(offer.settings.destination),
        dismiss,
        host: this
      };
    }
    /** In the theme editor only, show a setup card when no offer applies. */
    renderSetup() {
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
  };
  var repaint = (placement) => {
    for (const banner of banners)
      if (banner.dataset.placement === placement) banner.repaint();
  };
  var api = {
    version: VERSION,
    defaultRenderer,
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
    }
  };
  if (!customElements.get("magicpromo-banner")) {
    nativeFetch = window.fetch.bind(window);
    window.Magicpromo = api;
    customElements.define("magicpromo-banner", MagicpromoBanner);
    document.dispatchEvent(new CustomEvent("magicpromo:ready", { detail: api }));
  }
})();
