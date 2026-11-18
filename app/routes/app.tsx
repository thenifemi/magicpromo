import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import styles from "../styles/dev-environment.module.css";
import { isDevelopmentApp } from "../lib/environment";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const showDevBanner = isDevelopmentApp(apiKey);

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app" {...{ rel: "home" }}>Magicpromo</s-link>
        <s-link href="/app">Promotions</s-link>
        <s-link href="/app/storefront">Storefront</s-link>
        <s-link href="/app/hydrogen">Hydrogen</s-link>
      </s-app-nav>
      <div className={showDevBanner ? styles.content : undefined}>
        <Outlet />
      </div>
      {showDevBanner && (
        <footer className={styles.banner} aria-label="App environment">
          <s-text type="strong">Magicpromo Dev</s-text>
          <s-text>Development environment</s-text>
        </footer>
      )}
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
