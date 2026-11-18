import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import { isDevelopmentApp } from "../lib/environment";
import type { MetafieldsSetInput } from "../types/admin.types";

export const THEME_SETUP = `#graphql
  query MagicpromoThemeSetup {
    themes(first: 100) { nodes { id name role } }
    currentAppInstallation {
      id
      app { handle }
      appHandle: metafield(namespace: "magicpromo", key: "app_handle") { value }
      proxyPath: metafield(namespace: "magicpromo", key: "proxy_path") { value }
    }
  }
`;
export const SET_PROXY = `#graphql
  mutation MagicpromoThemeConnection($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;
export async function themeSetup(graphql: AdminGraphqlClient, clientId: string) {
  const development = isDevelopmentApp(clientId);
  const path = development ? "/apps/magicpromo-dev" : "/apps/magicpromo";
  const response = await graphql(THEME_SETUP);
  const { data } = await response.json();
  if (!data?.currentAppInstallation) throw new Error("Theme setup unavailable");
  const installation = data.currentAppInstallation;
  const handle = installation.app?.handle;
  const metafields: MetafieldsSetInput[] = [];
  if (installation.proxyPath?.value !== path) {
    metafields.push({
      ownerId: installation.id,
      namespace: "magicpromo",
      key: "proxy_path",
      type: "single_line_text_field",
      value: path,
    });
  }
  if (handle && installation.appHandle?.value !== handle) {
    metafields.push({
      ownerId: installation.id,
      namespace: "magicpromo",
      key: "app_handle",
      type: "single_line_text_field",
      value: handle,
    });
  }
  if (metafields.length) {
    const saved = await graphql(SET_PROXY, {
      variables: {
        metafields,
      },
    });
    const { data: setData } = await saved.json();
    // Mutations report validation problems in userErrors, not by throwing.
    if (!setData?.metafieldsSet || setData.metafieldsSet.userErrors.length)
      throw new Error("Theme connection unavailable");
  }
  return (data.themes?.nodes ?? [])
    .filter((theme) => development || theme.role !== "DEVELOPMENT")
    .map((theme) => ({ ...theme, id: theme.id.split("/").pop()! }));
}
export function themeEditorLinks(
  shop: string,
  clientId: string,
  themeId: string,
) {
  if (
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) ||
    !/^[a-z0-9]+$/i.test(clientId) ||
    !/^\d+$/.test(themeId)
  )
    return null;
  const base = `https://${shop}/admin/themes/${themeId}/editor`;
  return {
    announcement: `${base}?${new URLSearchParams({ context: "apps", activateAppId: `${clientId}/announcement` })}`,
    product: `${base}?${new URLSearchParams({ template: "product", addAppBlockId: `${clientId}/offer`, target: "mainSection" })}`,
    cart: `${base}?${new URLSearchParams({ template: "cart", addAppBlockId: `${clientId}/offer`, target: "newAppsSection" })}`,
  };
}
