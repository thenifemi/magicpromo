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

  // src/theme/magicpromo-banner.ts
  var EMPTY_CART = { items: [] };
  var POLL_MS = 15e3;
  var PROXY_PATH = /^\/apps\/[a-z0-9_-]+$/;
  var toCartItems = (cart) => cart.items.map((item) => ({
    productId: String(item.product_id),
    quantity: item.quantity
  }));
  var groups = /* @__PURE__ */ new Map();
  var root = () => window.Shopify?.routes?.root || "/";
  var withRoot = (path) => `${root().replace(/\/$/, "")}${path}`;
  async function update(group, fetchFn) {
    if (group.busy || document.hidden || !group.elements.size) return;
    group.busy = true;
    try {
      const cartResponse = await fetchFn(`${root()}cart.js`, { cache: "no-store" });
      if (!cartResponse.ok) throw new Error("cart");
      const cart = await cartResponse.json();
      const productIds = /* @__PURE__ */ new Set([
        ...cart.items.map((item) => String(item.product_id)),
        ...[...group.elements].map((el) => el.dataset.product).filter(Boolean)
      ]);
      const response = await fetchFn(
        `${withRoot(group.path)}?products=${encodeURIComponent([...productIds].join(","))}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("offers");
      const { offers } = await response.json();
      for (const element of group.elements) element.render(offers, cart);
    } catch {
      for (const element of group.elements) element.render([], EMPTY_CART);
    } finally {
      group.busy = false;
    }
  }
  var MagicpromoBanner = class extends HTMLElement {
    connectedCallback() {
      this.setupTemplate || (this.setupTemplate = this.querySelector(
        "template[data-mp-setup]"
      ));
      if (this.dataset.designMode === "true") this.render([], EMPTY_CART);
      const path = this.dataset.proxy || "";
      if (!PROXY_PATH.test(path)) return;
      let group = groups.get(path);
      if (!group) {
        const created = { path, elements: /* @__PURE__ */ new Set(), busy: false };
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
    render(offers, cart) {
      const placement = this.dataset.placement;
      const items = toCartItems(cart);
      const offer = selectOffer(offers, placement, {
        items,
        productId: this.dataset.product
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
        distinct: this.dataset.distinct ?? ""
      };
      const content = document.createElement("div");
      content.className = "mp-content";
      const text = document.createElement("span");
      const progress = placement === "cart" ? cartProgress(offer, items) : void 0;
      if (progress) {
        text.setAttribute("role", "status");
        text.textContent = formatTemplate(
          (progress.qualified ? this.dataset.qualified : this.dataset.progress) ?? "",
          {
            remaining: progress.remaining,
            percent: offer.percent,
            items: itemLabel(offer, labels)
          }
        );
      } else {
        text.textContent = formatTemplate(offer.settings.message, {
          minimum: offer.minimum,
          percent: offer.percent,
          items: itemLabel(offer, labels)
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
        close.textContent = "\xD7";
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
  var nativeFetch;
  function refreshAll() {
    for (const group of groups.values()) void update(group, nativeFetch);
  }
  function watchCart() {
    document.addEventListener("visibilitychange", refreshAll);
    window.addEventListener("pageshow", refreshAll);
    if ("PerformanceObserver" in window) {
      new PerformanceObserver((list) => {
        const cartChanged = list.getEntries().some((entry) => /\/cart\/(add|change|update|clear)(\.js)?(?:\?|$)/.test(entry.name));
        if (cartChanged) refreshAll();
      }).observe({ type: "resource", buffered: false });
    }
    for (const name of ["cart:updated", "cart:change", "magicpromo:cart:changed"])
      document.addEventListener(name, refreshAll);
    document.addEventListener("submit", (event) => {
      if (event.target instanceof HTMLFormElement && /\/cart(?:\/|$)/.test(new URL(event.target.action).pathname))
        setTimeout(refreshAll, 800);
    });
    document.addEventListener("change", (event) => {
      if (event.target instanceof Element && event.target.closest('form[action*="/cart"]'))
        setTimeout(refreshAll, 800);
    });
  }
  if (!customElements.get("magicpromo-banner")) {
    nativeFetch = window.fetch.bind(window);
    customElements.define("magicpromo-banner", MagicpromoBanner);
    watchCart();
  }
})();
