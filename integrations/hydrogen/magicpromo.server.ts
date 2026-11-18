import type { Offer } from "./types";

export type MagicpromoConfig = {
  endpoint: string;
  apiKey: string;
  timeoutMs?: number;
};
// Import only from server loaders/actions. Never return config to the browser.
export async function getMagicpromoOffers(
  config: MagicpromoConfig,
  productIds: string[],
): Promise<Offer[]> {
  const url = new URL(config.endpoint);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Magicpromo requires HTTPS");
  const ids = [...new Set(productIds)];
  if (
    ids.length > 100 ||
    ids.some((id) => !/^(?:gid:\/\/shopify\/Product\/)?\d{1,20}$/.test(id))
  )
    throw new Error("Provide up to 100 product IDs");
  url.searchParams.set("products", ids.join(","));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(config.timeoutMs ?? 3000),
  });
  if (!response.ok)
    throw new Error(`Magicpromo request failed (${response.status})`);
  const body = (await response.json()) as {
    version?: number;
    offers?: Offer[];
  };
  if (body.version !== 1 || !Array.isArray(body.offers))
    throw new Error("Unsupported Magicpromo response");
  return body.offers;
}
