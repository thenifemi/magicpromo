import type { OfferSettings } from "@magicpromo/sdk";

// The app produces what the SDK consumes: one type, so they can't drift.
export type StorefrontSettings = OfferSettings;
export const defaultStorefrontSettings: StorefrontSettings = {
  announcement: false,
  product: false,
  cart: false,
  message: "Buy {minimum} {items} and save {percent}%",
  linkText: "Shop the offer",
  destination: "/collections/all",
  background: "#251510",
  foreground: "#fff8ed",
  position: "bottom",
  priority: 0,
};
export function parseStorefrontSettings(
  value: unknown,
): StorefrontSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as StorefrontSettings;
  if (
    [s.announcement, s.product, s.cart].some((v) => typeof v !== "boolean") ||
    typeof s.message !== "string" ||
    !s.message.trim() ||
    s.message.length > 200 ||
    typeof s.linkText !== "string" ||
    !s.linkText.trim() ||
    s.linkText.length > 50 ||
    typeof s.destination !== "string" ||
    !/^\/collections\/[a-z0-9-]+$/.test(s.destination) ||
    !/^#[a-f0-9]{6}$/i.test(s.background) ||
    !/^#[a-f0-9]{6}$/i.test(s.foreground) ||
    !["top", "bottom"].includes(s.position) ||
    !Number.isInteger(s.priority) ||
    s.priority < 0 ||
    s.priority > 100
  )
    return null;
  return {
    announcement: s.announcement,
    product: s.product,
    cart: s.cart,
    message: s.message.trim(),
    linkText: s.linkText.trim(),
    destination: s.destination,
    background: s.background,
    foreground: s.foreground,
    position: s.position,
    priority: s.priority,
  };
}
export function storefrontSettingsFromJson(json: string) {
  try {
    return (
      parseStorefrontSettings(JSON.parse(json)) ?? {
        ...defaultStorefrontSettings,
      }
    );
  } catch {
    return { ...defaultStorefrontSettings };
  }
}
