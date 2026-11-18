// @shopify/app-bridge-types (0.7.4) still augments the global JSX namespace,
// which React 19's types no longer read. Re-register the App Bridge elements
// we use on React's own JSX namespace. The import makes this file a module,
// so `declare module "react"` augments React instead of replacing it.
// Delete once app-bridge-types targets React.JSX.
import type { SAppNavAttributes } from "@shopify/app-bridge-types";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": SAppNavAttributes;
    }
  }
}
