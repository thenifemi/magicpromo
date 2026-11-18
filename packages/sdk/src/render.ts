// The "bring your own element" contract for DOM storefronts.
import type { CartProgress, Offer, Placement } from "./core";

export type RenderContext = {
  placement: Placement;
  offer: Offer;
  /** Ready-to-show plain text: the merchant's message, or cart progress. */
  message: string;
  /** Cart placement only. */
  progress?: CartProgress;
  /** Offer destination, already prefixed with the market/locale root. */
  href: string;
  /** Hides this banner until the offer or its message changes. */
  dismiss: () => void;
  /** The <magicpromo-banner> element, e.g. for CSS variables. */
  host: HTMLElement;
};

/**
 * Returns what to show. A string is rendered as text (never HTML);
 * null hides the banner.
 */
export type Renderer = (context: RenderContext) => Node | string | null;

/** Available as `window.Magicpromo` on Liquid storefronts. */
export type MagicpromoThemeApi = {
  version: string;
  /** Replaces the default banner for one placement. Returns an undo function. */
  render: (placement: Placement, renderer: Renderer) => () => void;
  /** The built-in banner. Return it to keep the default for some offers. */
  defaultRenderer: Renderer;
  refresh: () => void;
};
