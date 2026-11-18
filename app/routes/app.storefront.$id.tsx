import { useState, useCallback } from "react";
import {
  data,
  useFetcher,
  useLoaderData,
  useBeforeUnload,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getDraft } from "../models/promotion-draft.server";
import {
  activatePromotion,
  draftFingerprint,
} from "../models/promotion-activation.server";
import {
  parseStorefrontSettings,
  storefrontSettingsFromJson,
} from "../lib/storefront-settings";
import QualificationChoice from "../components/QualificationChoice";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const draft = await getDraft(session.shop, params.id!);
  if (!draft) throw new Response("Not found", { status: 404 });
  return {
    draft,
    settings: storefrontSettingsFromJson(draft.storefrontSettings),
    published: draft.publishedFingerprint === draftFingerprint(draft),
  };
}
export async function action({ request, params }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const draft = await getDraft(session.shop, params.id!);
  if (!draft) throw new Response("Not found", { status: 404 });
  const version = String(form.get("version"));
  if (draft.updatedAt.toISOString() !== version || draft.activationToken)
    return data(
      {
        error:
          "This promotion changed or an update is pending. Refresh before saving.",
      },
      { status: 409 },
    );
  if (form.get("intent") === "publish")
    return activatePromotion(admin.graphql, session.shop, draft.id, version);
  let settings;
  try {
    settings = parseStorefrontSettings(
      JSON.parse(String(form.get("settings"))),
    );
  } catch {
    settings = null;
  }
  if (!settings)
    return data(
      { error: "Check the message, collection link, and colors." },
      { status: 400 },
    );
  const saved = await prisma.promotionDraft.updateMany({
    where: {
      id: draft.id,
      shop: session.shop,
      updatedAt: draft.updatedAt,
      activationToken: null,
    },
    data: { storefrontSettings: JSON.stringify(settings) },
  });
  return saved.count
    ? { success: true }
    : data(
        { error: "This promotion changed. Refresh before saving." },
        { status: 409 },
      );
}
export default function MessagingPage() {
  const loaded = useLoaderData<typeof loader>();
  return (
    <MessagingEditor
      key={`${loaded.draft.id}:${loaded.draft.updatedAt}`}
      {...loaded}
    />
  );
}
function MessagingEditor({
  draft,
  settings,
  published,
}: ReturnType<typeof useLoaderData<typeof loader>>) {
  const [value, setValue] = useState(settings);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const dirty = JSON.stringify(value) !== JSON.stringify(settings);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [dirty],
    ),
  );
  const busy = fetcher.state !== "idle";
  const disabled = busy || !!draft.activationToken;
  async function chooseDestination() {
    const selected = await shopify.resourcePicker({
      type: "collection",
      multiple: false,
      action: "select",
    });
    if (selected?.[0])
      setValue((s) => ({
        ...s,
        destination: `/collections/${selected[0].handle}`,
      }));
  }
  const preview = value.message
    .replaceAll("{minimum}", String(draft.minimumProducts))
    .replaceAll("{percent}", String(draft.discountPercent))
    .replaceAll(
      "{items}",
      draft.qualificationMode === "distinct_products"
        ? "different eligible products"
        : "eligible items",
    );
  return (
    <s-page heading={`${draft.name} · Messaging`} inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/app/storefront">
        Storefront
      </s-link>
      <s-button
        slot="primary-action"
        variant="primary"
        {...(disabled || !dirty ? { disabled: true } : {})}
        onClick={() =>
          fetcher.submit(
            {
              settings: JSON.stringify(value),
              version: new Date(draft.updatedAt).toISOString(),
            },
            { method: "post" },
          )
        }
      >
        Save messaging
      </s-button>
      <s-button
        slot="secondary-actions"
        {...(disabled || dirty ? { disabled: true } : {})}
        onClick={() =>
          fetcher.submit(
            {
              intent: "publish",
              version: new Date(draft.updatedAt).toISOString(),
            },
            { method: "post" },
          )
        }
      >
        Publish and activate
      </s-button>
      <s-stack gap="base">
        {fetcher.data && "error" in fetcher.data && (
          <s-banner tone="critical">{fetcher.data.error}</s-banner>
        )}
        <s-banner>
          Publishing activates the promotion and publishes all saved rules and
          messaging together. Saving alone keeps your edits as a draft.
        </s-banner>
        <s-section heading="Placements">
          <s-stack gap="base">
            <s-checkbox
              label="Sitewide announcement bar"
              checked={value.announcement}
              onChange={(event) =>
                setValue({
                  ...value,
                  announcement: event.currentTarget.checked,
                })
              }
            />
            <s-checkbox
              label="Inline banner on eligible product pages"
              checked={value.product}
              onChange={(event) =>
                setValue({ ...value, product: event.currentTarget.checked })
              }
            />
            <s-checkbox
              label="Cart progress banner"
              checked={value.cart}
              onChange={(event) =>
                setValue({ ...value, cart: event.currentTarget.checked })
              }
            />
            <s-paragraph color="subdued">
              Enable the theme embed for announcements; add the offer block for
              inline placements. The first eligible active promotion in your
              display order appears. Cart banners prefer offers relevant to
              items in the cart.
            </s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="Content">
          <s-stack gap="base">
            <s-text-field
              label="Message"
              value={value.message}
              maxLength={200}
              onInput={(e) =>
                setValue({ ...value, message: e.currentTarget.value })
              }
            />
            <s-paragraph color="subdued">
              Use {"{minimum}"}, {"{percent}"}, and {"{items}"} for the
              published rules. The items variable distinguishes quantities from
              different products.
            </s-paragraph>
            <s-box maxInlineSize="320px">
              <s-text-field
                label="Link text"
                value={value.linkText}
                maxLength={50}
                onInput={(e) =>
                  setValue({ ...value, linkText: e.currentTarget.value })
                }
              />
            </s-box>
            <s-text>Destination: {value.destination}</s-text>
            <s-button onClick={chooseDestination}>
              Choose destination collection
            </s-button>
          </s-stack>
        </s-section>
        <s-section heading="Appearance">
          <s-stack gap="base">
            <QualificationChoice
              label="Announcement position"
              value={value.position}
              onChange={(position) =>
                setValue({ ...value, position: position as "top" | "bottom" })
              }
              options={[
                { value: "top", label: "Top of window" },
                { value: "bottom", label: "Bottom of window" },
              ]}
            />
            <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
              <s-text-field
                label="Background color (hex)"
                value={value.background}
                onInput={(e) =>
                  setValue({ ...value, background: e.currentTarget.value })
                }
              />
              <s-text-field
                label="Text color (hex)"
                value={value.foreground}
                onInput={(e) =>
                  setValue({ ...value, foreground: e.currentTarget.value })
                }
              />
            </s-grid>
            <s-link href="/app/storefront">
              Manage promotion display order
            </s-link>
          </s-stack>
        </s-section>
      </s-stack>
      <s-section slot="aside" heading="Message preview">
        <s-stack gap="base">
          <s-badge>
            {dirty
              ? "Unsaved changes"
              : published
                ? "Published configuration"
                : "Unpublished changes"}
          </s-badge>
          <s-text type="strong">{preview}</s-text>
          <s-text>{value.linkText} →</s-text>
          <s-paragraph color="subdued">
            Cart progress is generated from the rules and current eligible
            quantities. Checkout determines the final discount, including
            combinations.
          </s-paragraph>
          <s-link href={`/app/promotions/${draft.id}`}>
            View discount rules
          </s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}
