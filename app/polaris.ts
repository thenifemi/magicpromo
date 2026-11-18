// One source of truth: AppProvider's script tag, the server's preload header
// and the public landing page must all load the same Polaris bundle.
// polaris-2.js tracks stable 2.x; keep @shopify/polaris-types on ^2.0.0 to match.
export const POLARIS_URL = "https://cdn.shopify.com/shopifycloud/polaris-2.js";
