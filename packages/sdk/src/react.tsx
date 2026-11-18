// Ready-made React banners for Hydrogen. Pass offers fetched on the server.
import { useState, type CSSProperties } from "react";
import {
  cartProgress,
  itemLabel,
  offerMessage,
  selectOffer,
  type CartItem,
  type Offer,
} from "./core";

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

export function ProductBanner(props: BannerProps & { productId: string }) {
  const offer = selectOffer(props.offers, "product", { productId: props.productId });
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

export function CartProgressBanner(props: BannerProps & { items: CartItem[] }) {
  const offer = selectOffer(props.offers, "cart", { items: props.items });
  if (!offer) return null;
  const progress = cartProgress(offer, props.items);
  const message = progress.qualified
    ? `You qualify for ${offer.percent}% off eligible items. Final discount calculated at checkout.`
    : `Add ${progress.remaining} more ${itemLabel(offer)} to qualify for ${offer.percent}% off.`;
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
