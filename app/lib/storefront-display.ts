import type { Placement } from "@magicpromo/sdk";
import { storefrontSettingsFromJson } from "./storefront-settings";

export const PLACEMENT_LABELS: Record<Placement, string> = {
  announcement: "Announcement bar",
  product: "Product banner",
  cart: "Cart progress",
};

const PLACEMENTS = Object.keys(PLACEMENT_LABELS) as Placement[];

/** Placements switched on in a promotion's saved messaging. */
export function enabledPlacements(storefrontSettingsJson: string | null | undefined) {
  const settings = storefrontSettingsFromJson(storefrontSettingsJson ?? "{}");
  return PLACEMENTS.filter((placement) => settings[placement]);
}

/**
 * A copy-paste starting point for theme developers. Scoped to one offer when
 * `offerId` is given, so other promotions keep the default banner.
 */
export function developerSnippet(placement: Placement, offerId?: string | null) {
  const guard = offerId
    ? `    // Only this promotion; others keep the default banner.\n    if (offer.id !== "${offerId}") return Magicpromo.defaultRenderer(context);\n`
    : "";
  return `<script>
function useMyElements(Magicpromo) {
  Magicpromo.render("${placement}", (context) => {
    const { offer, message, href } = context;
${guard}    const el = document.createElement("a");
    el.className = "my-offer";
    el.href = href;
    el.textContent = message;
    return el;
  });
}
if (window.Magicpromo) useMyElements(window.Magicpromo);
else document.addEventListener("magicpromo:ready", (e) => useMyElements(e.detail), { once: true });
</script>`;
}
