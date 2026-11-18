import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";

export const THEME_PLACEMENTS = `#graphql
  query MagicpromoThemePlacements($id: ID!, $after: String) {
    currentAppInstallation { app { handle } }
    theme(id: $id) {
      files(first: 50, after: $after, filenames: ["config/settings_data.json", "templates/product*.json", "templates/cart*.json"]) {
        nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;
export type PlacementStatus = {
  state: "added" | "disabled" | "missing" | "unknown";
  template?: string;
  /**
   * An empty Apps section already in the template. Deep links target it with
   * `sectionId:<id>`, so "Add" doesn't stack up new Apps sections each click.
   */
  emptyAppsSectionId?: string;
};
export type ThemePlacements = Record<
  "announcement" | "product" | "cart",
  PlacementStatus
>;
type ThemeFile = { filename: string; body: { content?: string } };

export function detectPlacements(
  files: ThemeFile[],
  appHandle: string,
): ThemePlacements {
  const result: ThemePlacements = {
    announcement: { state: "missing" },
    product: { state: "missing" },
    cart: { state: "missing" },
  };
  const malformed = new Set<keyof ThemePlacements>();
  let settingsFound = false;
  let emptyCartAppsSection: string | undefined;
  for (const file of files) {
    const match = /^templates\/(product|cart)(?:\.[^/]+)?\.json$/.exec(
      file.filename,
    );
    const placement =
      file.filename === "config/settings_data.json"
        ? "announcement"
        : (match?.[1] as "product" | "cart" | undefined);
    if (!placement) continue;
    if (placement === "announcement") settingsFound = true;
    try {
      // Shopify adds a generated-file comment before its JSON content.
      const content = file.body.content;
      if (typeof content !== "string") throw new Error("Unreadable theme file");
      const parsed = JSON.parse(
        content
          .replace(/^\uFEFF/, "")
          .replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)*/, ""),
      );
      const root =
        placement === "announcement" &&
        parsed.current &&
        typeof parsed.current === "object"
          ? parsed.current.blocks || {}
          : parsed.sections;
      if (!root || typeof root !== "object")
        throw new Error("Unrecognized theme file");
      const visit = (value: unknown, disabled = false) => {
        if (!value || typeof value !== "object") return;
        const node = value as Record<string, unknown>;
        const hidden = disabled || node.disabled === true;
        const handle = placement === "announcement" ? "announcement" : "offer";
        const prefix = `shopify://apps/${appHandle}/blocks/${handle}/`;
        if (
          typeof node.type === "string" &&
          node.type.startsWith(prefix) &&
          node.type.length > prefix.length
        ) {
          if (!hidden || result[placement!].state !== "added") {
            result[placement!] = {
              state: hidden ? "disabled" : "added",
              ...(match ? { template: file.filename.slice(10, -5) } : {}),
            };
          }
        }
        // Only traverse saved blocks/sections, not arbitrary merchant settings.
        if (node.blocks && typeof node.blocks === "object") {
          const blocks = node.blocks as Record<string, unknown>;
          const ids = Array.isArray(node.block_order)
            ? node.block_order
            : Object.keys(blocks);
          for (const id of ids)
            if (typeof id === "string") visit(blocks[id], hidden);
        }
      };
      const ids =
        placement !== "announcement" && Array.isArray(parsed.order)
          ? parsed.order
          : Object.keys(root);
      for (const id of ids) {
        const section = root[id] as Record<string, unknown> | undefined;
        if (
          file.filename === "templates/cart.json" &&
          section?.type === "apps" &&
          section.disabled !== true &&
          !emptyCartAppsSection &&
          Object.keys((section.blocks as object | undefined) ?? {}).length === 0
        )
          emptyCartAppsSection = id;
        visit(section);
      }
    } catch {
      malformed.add(placement);
    }
  }
  if (!settingsFound) malformed.add("announcement");
  if (result.cart.state === "missing" && emptyCartAppsSection)
    result.cart.emptyAppsSectionId = emptyCartAppsSection;
  for (const placement of malformed)
    if (result[placement].state !== "added")
      result[placement] = { state: "unknown" };
  return result;
}

async function fetchThemeFilesPage(
  graphql: AdminGraphqlClient,
  themeId: string,
  after: string | null,
) {
  const response = await graphql(THEME_PLACEMENTS, {
    variables: { id: `gid://shopify/OnlineStoreTheme/${themeId}`, after },
  });
  const { data } = await response.json();
  const connection = data?.theme?.files;
  const appHandle = data?.currentAppInstallation?.app?.handle;
  if (!connection || !appHandle) throw new Error("Theme status unavailable");
  return { connection, appHandle };
}

export async function themePlacements(graphql: AdminGraphqlClient, themeId: string) {
  if (!/^\d+$/.test(themeId)) throw new Error("Invalid theme");
  const files: ThemeFile[] = [];
  let after: string | null = null;
  let appHandle = "";
  do {
    const page = await fetchThemeFilesPage(graphql, themeId, after);
    appHandle = page.appHandle;
    files.push(...page.connection.nodes);
    const { hasNextPage, endCursor } = page.connection.pageInfo;
    const next = hasNextPage ? endCursor ?? null : null;
    if (hasNextPage && (!next || next === after))
      throw new Error("Incomplete theme status");
    after = next;
  } while (after);
  return detectPlacements(files, appHandle);
}
