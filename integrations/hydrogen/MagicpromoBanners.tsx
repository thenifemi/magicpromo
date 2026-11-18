import { useState, type CSSProperties } from "react";
import {
  cartProgress,
  offerMessage,
  selectOffer,
  type Offer,
  type CartItem,
  type Placement,
} from "./types";

type Props = {
  offers: Offer[];
  className?: string;
  style?: CSSProperties;
  unstyled?: boolean;
  linkPrefix?: string;
};
function appearance(offer: Offer, props: Props): CSSProperties {
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
    <a
      style={{ color: "inherit" }}
      href={`${prefix}${offer.settings.destination}`}
    >
      {offer.settings.linkText}
    </a>
  );
}
export function AnnouncementBanner(props: Props) {
  const offer = selectOffer(props.offers, "announcement");
  const [dismissed, setDismissed] = useState<string>();
  const identity = offer && `${offer.id}:${offer.settings.message}`;
  if (!offer || identity === dismissed) return null;
  return (
    <aside
      className={props.className}
      style={appearance(offer, props)}
      data-position={offer.settings.position}
      aria-label="Store promotion"
    >
      <span>{offerMessage(offer)}</span>{" "}
      <OfferLink offer={offer} prefix={props.linkPrefix} />{" "}
      <button
        type="button"
        aria-label="Dismiss promotion"
        onClick={() => setDismissed(identity)}
      >
        ×
      </button>
    </aside>
  );
}
export function ProductBanner(props: Props & { productId: string }) {
  const offer = selectOffer(props.offers, "product", [], props.productId);
  if (!offer) return null;
  return (
    <aside
      className={props.className}
      style={appearance(offer, props)}
      aria-label="Product promotion"
    >
      <span>{offerMessage(offer)}</span>{" "}
      <OfferLink offer={offer} prefix={props.linkPrefix} />
    </aside>
  );
}
export function CartProgressBanner(props: Props & { items: CartItem[] }) {
  const offer = selectOffer(props.offers, "cart", props.items);
  if (!offer) return null;
  const progress = cartProgress(offer, props.items);
  const units =
    offer.mode === "distinct_products"
      ? "different eligible products"
      : "eligible items";
  const message = progress.qualified
    ? `You qualify for ${offer.percent}% off eligible items. Final discount calculated at checkout.`
    : `Add ${progress.remaining} more ${units} to qualify for ${offer.percent}% off.`;
  return (
    <aside
      className={props.className}
      style={appearance(offer, props)}
      aria-label="Cart promotion"
    >
      <p role="status">{message}</p>
      <progress
        value={Math.min(progress.count, offer.minimum)}
        max={offer.minimum}
        aria-label={message}
      />{" "}
      <OfferLink offer={offer} prefix={props.linkPrefix} />
    </aside>
  );
}
export type { Offer, CartItem, Placement };
