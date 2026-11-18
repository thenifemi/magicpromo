// Server-only: the API key must never reach the browser.
import { OFFERS_API_VERSION, type Offer, type OffersResponse } from "./core";

export type MagicpromoServerConfig = {
  /** e.g. https://your-magicpromo-host/api/v1/offers */
  endpoint: string;
  apiKey: string;
  timeoutMs?: number;
};

const PRODUCT_ID = /^(?:gid:\/\/shopify\/Product\/)?\d{1,20}$/;
const MAX_PRODUCTS = 100;

function assertSecureEndpoint(url: URL) {
  const isLocal =
    url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocal)
    throw new Error("Magicpromo requires HTTPS");
}

const isOffersResponse = (body: unknown): body is OffersResponse =>
  typeof body === "object" &&
  body !== null &&
  (body as OffersResponse).version === OFFERS_API_VERSION &&
  Array.isArray((body as OffersResponse).offers);

/** Fetches active offers for these products from a server loader or action. */
export async function getMagicpromoOffers(
  config: MagicpromoServerConfig,
  productIds: string[],
): Promise<Offer[]> {
  const url = new URL(config.endpoint);
  assertSecureEndpoint(url);

  const ids = [...new Set(productIds)];
  if (ids.length > MAX_PRODUCTS || ids.some((id) => !PRODUCT_ID.test(id)))
    throw new Error(`Provide up to ${MAX_PRODUCTS} product IDs`);
  url.searchParams.set("products", ids.join(","));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    cache: "no-store",
    // A redirect could forward the bearer token to another host.
    redirect: "error",
    signal: AbortSignal.timeout(config.timeoutMs ?? 3000),
  });
  if (!response.ok)
    throw new Error(`Magicpromo request failed (${response.status})`);

  const body: unknown = await response.json();
  if (!isOffersResponse(body)) throw new Error("Unsupported Magicpromo response");
  return body.offers;
}
