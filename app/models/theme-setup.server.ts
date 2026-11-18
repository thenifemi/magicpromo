import type { Graphql } from "./collection.server";
import { isDevelopmentApp } from "../lib/environment";

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
export async function themeSetup(graphql: Graphql, clientId: string) {
  const development = isDevelopmentApp(clientId);
  const path = development ? "/apps/magicpromo-dev" : "/apps/magicpromo";
  const response = await graphql(THEME_SETUP);
  const result = await response.json();
  if (
    !response.ok ||
    result.errors?.length ||
    !result.data?.currentAppInstallation
  )
    throw new Error("Theme setup unavailable");
  const installation = result.data.currentAppInstallation;
  const handle = installation.app?.handle;
  const metafields = [];
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
    const body = await saved.json();
    if (
      !saved.ok ||
      body.errors?.length ||
      !body.data?.metafieldsSet ||
      body.data.metafieldsSet.userErrors.length
    )
      throw new Error("Theme connection unavailable");
  }
  return (
    result.data.themes.nodes as { id: string; name: string; role: string }[]
  )
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
