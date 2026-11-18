// Framework-free data layer: loads offers for the current cart, keeps them
// fresh, and notifies subscribers. Rendering lives elsewhere.
import { toProductId, type CartItem, type Offer } from "./core";

/** Fetches offers for these numeric product IDs (app proxy, API, mock...). */
export type OfferSource = (productIds: string[]) => Promise<Offer[]>;

export type CartSource = {
  read: () => Promise<CartItem[]>;
  /** Calls `onChange` whenever the cart may have changed. Returns a cleanup. */
  watch?: (onChange: () => void) => () => void;
};

export type MagicpromoState =
  | { status: "loading"; offers: Offer[]; items: CartItem[] }
  | { status: "ready"; offers: Offer[]; items: CartItem[] }
  | { status: "error"; offers: Offer[]; items: CartItem[]; error: unknown };

export type MagicpromoOptions = {
  offers: OfferSource;
  /** Omit for pages without a cart; items will be empty. */
  cart?: CartSource;
  /** Extra products to check, such as the product page being viewed. */
  productIds?: () => string[];
  /** Re-fetch interval while subscribed. 0 disables polling. */
  pollMs?: number;
  /** Skip work while hidden. Defaults to the page's visibility. */
  isVisible?: () => boolean;
};

export type MagicpromoClient = {
  getState: () => MagicpromoState;
  /** Starts loading on the first subscriber; stops on the last unsubscribe. */
  subscribe: (listener: (state: MagicpromoState) => void) => () => void;
  refresh: () => Promise<void>;
  destroy: () => void;
};

const pageIsVisible = () =>
  typeof document === "undefined" || !document.hidden;

export function createMagicpromo(options: MagicpromoOptions): MagicpromoClient {
  const { pollMs = 0, isVisible = pageIsVisible } = options;
  const listeners = new Set<(state: MagicpromoState) => void>();
  let state: MagicpromoState = { status: "loading", offers: [], items: [] };
  let inFlight: Promise<void> | null = null;
  let rerun = false;
  let destroyed = false;
  let stopPolling: (() => void) | undefined;
  let stopWatching: (() => void) | undefined;

  const emit = (next: MagicpromoState) => {
    state = next;
    for (const listener of listeners) listener(state);
  };

  async function load() {
    try {
      const items = options.cart ? await options.cart.read() : [];
      const productIds = new Set([
        ...items.map((item) => toProductId(item.productId)),
        ...(options.productIds?.() ?? []).map(toProductId),
      ]);
      const offers = await options.offers([...productIds]);
      if (!destroyed) emit({ status: "ready", offers, items });
    } catch (error) {
      // Offers are informational: show nothing rather than stale promises.
      if (!destroyed) emit({ status: "error", offers: [], items: state.items, error });
    }
  }

  function refresh(): Promise<void> {
    if (destroyed || !isVisible()) return Promise.resolve();
    // Coalesce bursts (several cart events at once) into one extra request.
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
    stopPolling = stopWatching = undefined;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      if (destroyed) return () => {};
      listeners.add(listener);
      if (listeners.size === 1) start();
      // Every new subscriber may add product IDs, so always refresh.
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
    },
  };
}
