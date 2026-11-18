(() => {
  if (customElements.get("magicpromo-banner")) return;
  const groups = new Map();
  const format = (template, values) =>
    template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
  const root = window.Shopify?.routes?.root || "/";
  const nativeFetch = window.fetch.bind(window);
  async function update(group) {
    if (group.busy || document.hidden || !group.elements.size) return;
    group.busy = true;
    try {
      const cartResponse = await nativeFetch(`${root}cart.js`, {
        cache: "no-store",
      });
      if (!cartResponse.ok) throw new Error("cart");
      const cart = await cartResponse.json();
      const productIds = [
        ...new Set([
          ...cart.items.map((item) => String(item.product_id)),
          ...[...group.elements]
            .map((el) => el.dataset.product)
            .filter(Boolean),
        ]),
      ];
      const response = await nativeFetch(
        `${root.replace(/\/$/, "")}${group.path}?products=${encodeURIComponent(productIds.join(","))}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("offers");
      const { offers } = await response.json();
      for (const element of group.elements) element.render(offers, cart);
    } catch {
      for (const element of group.elements) element.render([], { items: [] });
    } finally {
      group.busy = false;
    }
  }
  class MagicpromoBanner extends HTMLElement {
    connectedCallback() {
      this.setupTemplate ||= this.querySelector("template[data-mp-setup]");
      if (this.dataset.designMode === "true") this.render([], { items: [] });
      const path = this.dataset.proxy;
      if (!/^\/apps\/[a-z0-9_-]+$/.test(path || "")) return;
      let group = groups.get(path);
      if (!group) {
        group = { path, elements: new Set(), busy: false };
        groups.set(path, group);
        group.timer = setInterval(() => update(group), 15000);
      }
      group.elements.add(this);
      this.group = group;
      update(group);
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
      const candidates = offers.filter(
        (p) =>
          p.settings[placement] &&
          (placement !== "product" ||
            p.eligibleProductIds.includes(this.dataset.product)),
      );
      const offer =
        (placement === "cart"
          ? candidates.find((p) =>
              cart.items.some(
                (item) =>
                  item.quantity > 0 &&
                  p.eligibleProductIds.includes(String(item.product_id)),
              ),
            )
          : undefined) || candidates[0];
      this.replaceChildren();
      this.hidden = true;
      delete this.dataset.setup;
      if (!offer) {
        if (this.dataset.designMode === "true") {
          this.dataset.setup = "true";
          if (this.setupTemplate) {
            this.append(this.setupTemplate.content.cloneNode(true));
          } else {
            const message = document.createElement("div");
            message.className = "mp-placeholder";
            message.textContent = this.dataset.placeholder;
            this.append(message);
          }
          this.hidden = false;
        }
        return;
      }
      const dismissalKey = `${this.group.path}:${offer.id}:${offer.settings.message}`;
      if (placement === "announcement" && this.dismissed === dismissalKey)
        return;
      this.style.setProperty("--mp-bg", offer.settings.background);
      this.style.setProperty("--mp-fg", offer.settings.foreground);
      this.dataset.position = offer.settings.position;
      const content = document.createElement("div");
      content.className = "mp-content";
      const text = document.createElement("span");
      let count = 0;
      if (placement === "cart") {
        const eligible = cart.items.filter((item) =>
          offer.eligibleProductIds.includes(String(item.product_id)),
        );
        count =
          offer.mode === "distinct_products"
            ? new Set(eligible.map((item) => String(item.product_id))).size
            : eligible.reduce((sum, item) => sum + item.quantity, 0);
        text.setAttribute("role", "status");
        text.textContent = format(
          count >= offer.minimum
            ? this.dataset.qualified
            : this.dataset.progress,
          {
            remaining: Math.max(0, offer.minimum - count),
            percent: offer.percent,
            items:
              offer.mode === "distinct_products"
                ? this.dataset.distinct
                : this.dataset.items,
          },
        );
      } else
        text.textContent = format(offer.settings.message, {
          minimum: offer.minimum,
          percent: offer.percent,
          items:
            offer.mode === "distinct_products"
              ? this.dataset.distinct
              : this.dataset.items,
        });
      const link = document.createElement("a");
      link.href = `${root.replace(/\/$/, "")}${offer.settings.destination}`;
      link.textContent = offer.settings.linkText;
      content.append(text, link);
      if (placement === "cart") {
        const progress = document.createElement("progress");
        progress.max = offer.minimum;
        progress.value = Math.min(count, offer.minimum);
        progress.setAttribute("aria-label", text.textContent);
        content.append(progress);
      }
      if (placement === "announcement") {
        const close = document.createElement("button");
        close.type = "button";
        close.textContent = "×";
        close.setAttribute("aria-label", this.dataset.close);
        close.addEventListener("click", () => {
          this.dismissed = dismissalKey;
          this.hidden = true;
        });
        content.append(close);
      }
      this.append(content);
      this.hidden = false;
    }
  }
  customElements.define("magicpromo-banner", MagicpromoBanner);
  const refresh = () => {
    for (const group of groups.values()) update(group);
  };
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pageshow", refresh);
  if ("PerformanceObserver" in window) {
    const observer = new PerformanceObserver((list) => {
      if (
        list
          .getEntries()
          .some((entry) =>
            /\/cart\/(add|change|update|clear)(\.js)?(?:\?|$)/.test(entry.name),
          )
      )
        refresh();
    });
    observer.observe({ type: "resource", buffered: false });
  }
  document.addEventListener("cart:updated", refresh);
  document.addEventListener("cart:change", refresh);
  document.addEventListener("magicpromo:cart:changed", refresh);
  document.addEventListener("submit", (event) => {
    if (
      event.target instanceof HTMLFormElement &&
      /\/cart(?:\/|$)/.test(new URL(event.target.action).pathname)
    )
      setTimeout(refresh, 800);
  });
  document.addEventListener("change", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest('form[action*="/cart"]')
    )
      setTimeout(refresh, 800);
  });
})();
