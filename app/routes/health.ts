// Render liveness check: no Shopify session is required.
export function loader() {
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}
