import prisma from "../db.server";
import type { ThemePlacements } from "../models/theme-placement.server";
import {
  arrangePromotions,
  saveDisplayOrder,
} from "../models/display-order.server";
import { useState, useEffect, useCallback } from "react";
import styles from "../styles/storefront.module.css";
import PlacementPreview from "../components/PlacementPreview";
import QualificationChoice from "../components/QualificationChoice";
import { themeSetup, themeEditorLinks } from "../models/theme-setup.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { listDrafts } from "../models/promotion-draft.server";
import { storefrontSettingsFromJson } from "../lib/storefront-settings";
import { isDevelopmentApp } from "../lib/environment";
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const clientId = process.env.SHOPIFY_API_KEY || "";
  let themes: Awaited<ReturnType<typeof themeSetup>> = [];
  let setupError = false;
  try {
    themes = await themeSetup(admin.graphql, clientId);
  } catch {
    setupError = true;
  }
  const order = await prisma.storefrontDisplayOrder.findUnique({
    where: { shop: session.shop },
  });
  return {
    revision: order?.revision || 0,
    promotions: arrangePromotions(
      await listDrafts(session.shop),
      JSON.parse(order?.promotionIds || "[]"),
    ).map((p) => ({
      id: p.id,
      name: p.name,
      settings: storefrontSettingsFromJson(p.storefrontSettings),
    })),
    development: isDevelopmentApp(clientId),
    setupError,
    themes: themes.map((theme) => ({
      ...theme,
      links: themeEditorLinks(session.shop, clientId, theme.id),
    })),
  };
}
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  let ids: unknown;
  try {
    ids = JSON.parse(String(form.get("ids")));
  } catch {
    return data(
      { error: "The display order is invalid. Refresh and try again." },
      { status: 400 },
    );
  }
  const saved = await saveDisplayOrder(
    session.shop,
    ids,
    Number(form.get("revision")),
  );
  return saved
    ? { success: true }
    : data(
        {
          error:
            "Your promotions or display order changed. Refresh before saving again.",
        },
        { status: 409 },
      );
}
export default function Storefront() {
  const { promotions, themes, development, setupError, revision } =
    useLoaderData<typeof loader>();
  const orderFetcher = useFetcher<typeof action>();
  const savedOrder = JSON.stringify(promotions.map((p) => p.id));
  const [orderIds, setOrderIds] = useState<string[]>(JSON.parse(savedOrder));
  useEffect(() => setOrderIds(JSON.parse(savedOrder)), [savedOrder, revision]);
  const orderDirty = JSON.stringify(orderIds) !== savedOrder;
  const orderedPromotions = orderIds
    .map((id) => promotions.find((p) => p.id === id))
    .filter((p): p is (typeof promotions)[number] => !!p);
  function movePromotion(index: number, direction: number) {
    setOrderIds((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  const [themeView, setThemeView] = useState<"live" | "test">("live");
  const [selectedThemes, setSelectedThemes] = useState({ live: "", test: "" });
  const visibleThemes = themes.filter((item) =>
    themeView === "live" ? item.role === "MAIN" : item.role !== "MAIN",
  );
  const theme =
    visibleThemes.find((item) => item.id === selectedThemes[themeView]) ||
    (themeView === "live" ? visibleThemes[0] : undefined);
  const statusFetcher = useFetcher<{
    themeId: string;
    placements: ThemePlacements | null;
    error: boolean;
  }>();
  const { load: loadStatus } = statusFetcher;
  const themeId = theme?.id;
  const refreshStatus = useCallback(() => {
    if (themeId) void loadStatus(`/app/theme-status?theme=${themeId}`);
  }, [themeId, loadStatus]);
  useEffect(() => {
    refreshStatus();
    let timer: ReturnType<typeof setTimeout>;
    const onReturn = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      timer = setTimeout(refreshStatus, 200);
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refreshStatus]);
  const checking =
    !!themeId &&
    (statusFetcher.state !== "idle" || statusFetcher.data?.themeId !== themeId);
  const status =
    statusFetcher.data?.themeId === themeId ? statusFetcher.data : undefined;
  function manageLink(placement: keyof ThemePlacements) {
    const href = theme?.links?.[placement];
    if (!href) return undefined;
    const url = new URL(href);
    url.searchParams.delete("addAppBlockId");
    url.searchParams.delete("activateAppId");
    url.searchParams.delete("target");
    const template = status?.placements?.[placement].template;
    if (template) url.searchParams.set("template", template);
    return url.toString();
  }
  const steps = [
    {
      title: "Announcement bar",
      placement: "announcement" as const,
      description:
        "Introduce your offer on every page and link shoppers to eligible products.",
      label: "Add announcement bar",
      href: theme?.links?.announcement,
    },
    {
      title: "Product banner",
      placement: "product" as const,
      description:
        "Put the offer beside the products it applies to, while shoppers are deciding.",
      label: "Add product banner",
      href: theme?.links?.product,
    },
    {
      title: "Cart progress",
      placement: "cart" as const,
      description:
        "Help shoppers see how many more items they need to earn the discount.",
      label: "Add cart progress",
      href: theme?.links?.cart,
    },
  ];
  return (
    <s-page heading="Storefront" inlineSize="base">
      <s-stack gap="base">
        <s-section heading="Make your offers easy to discover">
          <s-stack gap="base">
            <s-paragraph color="subdued">
              Choose your theme, add a placement, then customize the message for
              each promotion.
            </s-paragraph>
            <div className={styles.themeToolbar}>
              <s-button-group gap="none" accessibilityLabel="Theme view">
                <s-button
                  slot="secondary-actions"
                  variant="secondary"
                  aria-pressed={themeView === "live"}
                  icon={themeView === "live" ? "check" : undefined}
                  onClick={() => setThemeView("live")}
                >
                  Live theme
                </s-button>
                <s-button
                  slot="secondary-actions"
                  variant="secondary"
                  aria-pressed={themeView === "test"}
                  icon={themeView === "test" ? "check" : undefined}
                  onClick={() => setThemeView("test")}
                >
                  Test themes
                </s-button>
              </s-button-group>
              {theme && (
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-text type="strong">{theme.name}</s-text>
                  <s-badge tone={theme.role === "MAIN" ? "success" : "auto"}>
                    {theme.role === "MAIN" ? "Live" : "Unpublished"}
                  </s-badge>
                </s-stack>
              )}
            </div>
            {setupError ? (
              <s-banner tone="warning">
                We couldn’t load your themes. Refresh to try again, and accept
                updated Shopify permissions if prompted.
              </s-banner>
            ) : visibleThemes.length === 0 ? (
              <s-box background="subdued" padding="base" borderRadius="base">
                <s-paragraph>
                  {themeView === "live"
                    ? "No live theme yet. Publish a theme in Online Store → Themes to get started."
                    : "No test themes yet. Duplicate your live theme in Online Store → Themes, then refresh this page."}
                </s-paragraph>
              </s-box>
            ) : (
              themeView === "test" && (
                <QualificationChoice
                  label="Choose a test theme"
                  value={theme?.id || ""}
                  onChange={(id) =>
                    setSelectedThemes((current) => ({ ...current, test: id }))
                  }
                  options={visibleThemes.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
              )
            )}
            {theme && (
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                  onClick={refreshStatus}
                  {...(checking ? { disabled: true } : {})}
                >
                  {checking ? "Checking placements…" : "Refresh status"}
                </s-button>
                <s-text color="subdued">
                  Checks placements saved in this theme.
                </s-text>
              </s-stack>
            )}
            {status?.error && !checking && (
              <s-banner tone="warning">
                We couldn’t check this theme. Refresh status to try again. You
                can still open the theme editor.
              </s-banner>
            )}
            <s-paragraph color="subdued">
              {development && theme?.role === "MAIN"
                ? "Changes to this live theme reach shoppers when you save in Shopify."
                : "Each placement opens in Shopify’s theme editor. Preview it and click Save to finish."}
            </s-paragraph>
          </s-stack>
        </s-section>
        <div className={styles.placements}>
          {steps.map((step, index) => {
            const placement = status?.placements?.[step.placement];
            const added = !checking && placement?.state === "added";
            const missing = !checking && placement?.state === "missing";
            const disabled = !checking && placement?.state === "disabled";
            return (
              <s-section key={step.placement}>
                <div className={styles.placementCard}>
                  <PlacementPreview placement={step.placement} />
                  <s-stack direction="inline" gap="small" alignItems="center">
                    <s-heading>{step.title}</s-heading>
                    {theme &&
                      (added ? (
                        <s-badge tone="success" icon="check-circle">
                          {step.placement === "announcement"
                            ? "Enabled"
                            : "Added"}
                        </s-badge>
                      ) : (
                        <s-badge>
                          {checking
                            ? "Checking…"
                            : disabled
                              ? "Disabled"
                              : missing
                                ? "Not added"
                                : "Couldn’t check"}
                        </s-badge>
                      ))}
                  </s-stack>
                  <div className={styles.description}>
                    <s-paragraph color="subdued">
                      {step.description}
                    </s-paragraph>
                  </div>
                  <s-button
                    variant={index === 0 && missing ? "primary" : "secondary"}
                    href={missing ? step.href : manageLink(step.placement)}
                    target="_blank"
                    {...(!step.href ? { disabled: true } : {})}
                  >
                    {missing ? step.label : "Manage placement"}
                  </s-button>
                </div>
              </s-section>
            );
          })}
        </div>
        <s-paragraph color="subdued">
          Added placements appear when an active promotion has messaging
          enabled. Product banners may be added to specific product templates.
        </s-paragraph>
        <s-section heading="Display order">
          <s-stack gap="base">
            <s-paragraph color="subdued">
              The first eligible promotion appears. Cart banners prefer offers
              matching items already in the cart, then follow this order. Saving
              changes the storefront display order without changing discounts.
            </s-paragraph>
            {promotions.length ? (
              orderedPromotions.map((p, index) => (
                <s-box
                  key={p.id}
                  padding="base"
                  background="subdued"
                  borderRadius="base"
                >
                  <div className={styles.promotionRow}>
                    <s-stack gap="small">
                      <s-link href={`/app/storefront/${p.id}`}>
                        {index + 1}. {p.name}
                      </s-link>
                      <s-stack direction="inline" gap="small">
                        {p.settings.announcement && (
                          <s-badge>Announcement bar</s-badge>
                        )}
                        {p.settings.product && (
                          <s-badge>Product banner</s-badge>
                        )}
                        {p.settings.cart && <s-badge>Cart progress</s-badge>}
                        {!p.settings.announcement &&
                          !p.settings.product &&
                          !p.settings.cart && (
                            <s-text color="subdued">
                              No placements enabled
                            </s-text>
                          )}
                      </s-stack>
                    </s-stack>
                    <s-stack direction="inline" gap="small">
                      <s-button
                        accessibilityLabel={`Move ${p.name} up`}
                        {...(index === 0 || orderFetcher.state !== "idle"
                          ? { disabled: true }
                          : {})}
                        onClick={() => movePromotion(index, -1)}
                      >
                        Move up
                      </s-button>
                      <s-button
                        accessibilityLabel={`Move ${p.name} down`}
                        {...(index === orderedPromotions.length - 1 ||
                        orderFetcher.state !== "idle"
                          ? { disabled: true }
                          : {})}
                        onClick={() => movePromotion(index, 1)}
                      >
                        Move down
                      </s-button>
                      <s-button href={`/app/storefront/${p.id}`}>
                        Edit messaging
                      </s-button>
                    </s-stack>
                  </div>
                </s-box>
              ))
            ) : (
              <s-box padding="large" background="subdued" borderRadius="base">
                <s-stack gap="base" alignItems="center">
                  <s-heading>Your next promotion starts here</s-heading>
                  <s-paragraph>
                    Create an offer, then give it a message shoppers can see.
                  </s-paragraph>
                  <s-button href="/app/promotions/new">
                    Create promotion
                  </s-button>
                </s-stack>
              </s-box>
            )}
            {orderFetcher.data && "error" in orderFetcher.data && (
              <s-banner tone="critical">{orderFetcher.data.error}</s-banner>
            )}
            {orderFetcher.data &&
              "success" in orderFetcher.data &&
              !orderDirty && <s-text>Display order saved.</s-text>}
            {orderDirty && (
              <s-stack direction="inline" gap="small">
                <s-button
                  variant="primary"
                  {...(orderFetcher.state !== "idle" ? { disabled: true } : {})}
                  onClick={() =>
                    orderFetcher.submit(
                      {
                        ids: JSON.stringify(orderIds),
                        revision: String(revision),
                      },
                      { method: "post" },
                    )
                  }
                >
                  Save display order
                </s-button>
                <s-button
                  {...(orderFetcher.state !== "idle" ? { disabled: true } : {})}
                  onClick={() => setOrderIds(JSON.parse(savedOrder))}
                >
                  Discard changes
                </s-button>
              </s-stack>
            )}
            {promotions.length > 0 && (
              <s-text color="subdued">
                Showing saved settings. Publish your messaging when you’re ready
                for shoppers to see it.
              </s-text>
            )}
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
