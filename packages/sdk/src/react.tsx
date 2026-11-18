// React bindings for Hydrogen: hooks to render offers with your own components,
// plus ready-made banners. Offers come from your own server route, so the
// Magicpromo API key never reaches the browser.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  createMagicpromo,
  type MagicpromoClient,
  type MagicpromoState,
  type OfferSource,
} from "./client";
import {
  cartProgress,
  defaultItemLabels,
  defaultProgressTemplates,
  offerMessage,
  progressMessage,
  selectOffer,
  type CartItem,
  type CartProgress,
  type ItemLabels,
  type Offer,
  type Placement,
  type ProgressTemplates,
} from "./core";

/** Reads `{ offers }` from your server route, e.g. Hydrogen's /api/magicpromo. */
export function routeOffers(endpoint: string): OfferSource {
  return async (productIds) => {
    const query = encodeURIComponent(productIds.join(","));
    const response = await fetch(`${endpoint}?products=${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Offers request failed (${response.status})`);
    const { offers } = (await response.json()) as { offers: Offer[] };
    return offers;
  };
}

/** What a placement should show, ready to render. */
export type OfferView =
  | { offer: undefined }
  | { offer: Offer; message: string; progress?: CartProgress };

type Text = { labels: ItemLabels; templates: ProgressTemplates };

/** Pure version of `useOffer`, for code that already has the offers. */
export function describeOffer(
  offers: Offer[],
  placement: Placement,
  context: { items?: CartItem[]; productId?: string } = {},
  text: Text = { labels: defaultItemLabels, templates: defaultProgressTemplates },
): OfferView {
  const items = context.items ?? [];
  const offer = selectOffer(offers, placement, { items, productId: context.productId });
  if (!offer) return { offer: undefined };
  if (placement !== "cart") return { offer, message: offerMessage(offer, text.labels) };
  const progress = cartProgress(offer, items);
  return {
    offer,
    progress,
    message: progressMessage(offer, progress, text.templates, text.labels),
  };
}

type ContextValue = { client: MagicpromoClient; items: CartItem[]; text: Text };
const MagicpromoContext = createContext<ContextValue | null>(null);

export type MagicpromoProviderProps = {
  children: ReactNode;
  /** Your server route that calls Magicpromo. Defaults to /api/magicpromo. */
  endpoint?: string;
  /** Current cart lines. Progress updates instantly; offers refresh when products change. */
  items?: CartItem[];
  /** Products shown outside the cart, such as the product being viewed. */
  productIds?: string[];
  /** Offers loaded in your loader, for a flash-free first render. */
  initialOffers?: Offer[];
  /** Refresh interval while mounted. Defaults to 30 seconds. */
  pollMs?: number;
  /** Translations for `{items}` and cart progress text. */
  labels?: ItemLabels;
  templates?: ProgressTemplates;
  /** Advanced: supply your own client (custom transport, tests). */
  client?: MagicpromoClient;
};

export function MagicpromoProvider({
  children,
  endpoint = "/api/magicpromo",
  items = [],
  productIds = [],
  initialOffers,
  pollMs = 30_000,
  labels = defaultItemLabels,
  templates = defaultProgressTemplates,
  client: providedClient,
}: MagicpromoProviderProps) {
  // The client reads the latest products through a ref, so it's created once.
  const products = useRef<string[]>([]);
  products.current = [...productIds, ...items.map((item) => item.productId)];
  const [client] = useState(
    () =>
      providedClient ??
      createMagicpromo({
        offers: routeOffers(endpoint),
        productIds: () => products.current,
        pollMs,
        initialOffers,
      }),
  );
  // No destroy on unmount: the client stops by itself when nothing subscribes,
  // which also keeps it working under StrictMode's mount-unmount-mount.

  // Refetch when the set of products changes, not on every quantity change.
  const productKey = [...new Set(products.current)].sort().join(",");
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void client.refresh();
  }, [client, productKey]);

  const value = useMemo(
    () => ({ client, items, text: { labels, templates } }),
    [client, items, labels, templates],
  );
  return <MagicpromoContext.Provider value={value}>{children}</MagicpromoContext.Provider>;
}

function useMagicpromoContext(hook: string) {
  const context = useContext(MagicpromoContext);
  if (!context) throw new Error(`${hook} must be used inside <MagicpromoProvider>`);
  return context;
}

/** The raw client state: status, offers and error. */
export function useMagicpromo(): MagicpromoState {
  const { client } = useMagicpromoContext("useMagicpromo");
  return useSyncExternalStore(client.subscribe, client.getState, client.getState);
}

/** The offer for one placement, with its message and cart progress. Render it however you like. */
export function useOffer(placement: Placement, options: { productId?: string } = {}): OfferView {
  const { client, items, text } = useMagicpromoContext("useOffer");
  const state = useSyncExternalStore(client.subscribe, client.getState, client.getState);
  return useMemo(
    () => describeOffer(state.offers, placement, { items, productId: options.productId }, text),
    [state.offers, placement, items, options.productId, text],
  );
}

// Ready-made banners. Built on describeOffer, so they match useOffer exactly.

type BannerProps = {
  offers: Offer[];
  className?: string;
  style?: CSSProperties;
  /** Drop merchant colours and padding; style it yourself. */
  unstyled?: boolean;
  /** Prefix for links, e.g. "/fr" for market subfolders. */
  linkPrefix?: string;
};

function appearance(offer: Offer, props: BannerProps): CSSProperties {
  return {
    ...(props.unstyled
      ? {}
      : {
          background: offer.settings.background,
          color: offer.settings.foreground,
          padding: "1rem",
          borderRadius: "0.5rem",
        }),
    ...props.style,
  };
}

function OfferLink({ offer, prefix = "" }: { offer: Offer; prefix?: string }) {
  return (
    <a style={{ color: "inherit" }} href={`${prefix}${offer.settings.destination}`}>
      {offer.settings.linkText}
    </a>
  );
}

export function AnnouncementBanner(props: BannerProps) {
  const view = describeOffer(props.offers, "announcement");
  const [dismissed, setDismissed] = useState<string>();
  const identity = view.offer && `${view.offer.id}:${view.offer.settings.message}`;
  if (!view.offer || identity === dismissed) return null;
  return (
    <aside
      className={props.className}
      style={appearance(view.offer, props)}
      data-position={view.offer.settings.position}
      aria-label="Store promotion"
    >
      <span>{view.message}</span> <OfferLink offer={view.offer} prefix={props.linkPrefix} />{" "}
      <button type="button" aria-label="Dismiss promotion" onClick={() => setDismissed(identity)}>
        ×
      </button>
    </aside>
  );
}

export function ProductBanner(props: BannerProps & { productId: string }) {
  const view = describeOffer(props.offers, "product", { productId: props.productId });
  if (!view.offer) return null;
  return (
    <aside className={props.className} style={appearance(view.offer, props)} aria-label="Product promotion">
      <span>{view.message}</span> <OfferLink offer={view.offer} prefix={props.linkPrefix} />
    </aside>
  );
}

export function CartProgressBanner(props: BannerProps & { items: CartItem[] }) {
  const view = describeOffer(props.offers, "cart", { items: props.items });
  if (!view.offer || !view.progress) return null;
  return (
    <aside className={props.className} style={appearance(view.offer, props)} aria-label="Cart promotion">
      <p role="status">{view.message}</p>
      <progress
        value={Math.min(view.progress.count, view.offer.minimum)}
        max={view.offer.minimum}
        aria-label={view.message}
      />{" "}
      <OfferLink offer={view.offer} prefix={props.linkPrefix} />
    </aside>
  );
}
