import { useState } from "react";
import {
  data,
  useFetcher,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  createHydrogenKey,
  revokeHydrogenKey,
} from "../models/hydrogen-key.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const keys = await prisma.hydrogenKey.findMany({
    where: {
      shop: session.shop,
      appId: process.env.SHOPIFY_API_KEY || "",
      revokedAt: null,
    },
    select: {
      id: true,
      label: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    keys,
    endpoint: `${process.env.SHOPIFY_APP_URL?.replace(/\/$/, "")}/api/v1/offers`,
  };
}
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const appId = process.env.SHOPIFY_API_KEY || "";
  const intent = String(form.get("intent"));
  const headers = { "Cache-Control": "no-store" };
  if (intent === "revoke") {
    await revokeHydrogenKey(session.shop, appId, String(form.get("id")));
    return data({ secret: null, error: null }, { headers });
  }
  if (!["create", "rotate"].includes(intent))
    return data(
      { secret: null, error: "Unknown action" },
      { status: 400, headers },
    );
  try {
    const secret = await createHydrogenKey(
      session.shop,
      appId,
      String(form.get("label") || ""),
      intent === "rotate" ? String(form.get("id")) : undefined,
    );
    return data({ secret, error: null }, { headers });
  } catch (error) {
    return data(
      {
        secret: null,
        error: error instanceof Error ? error.message : "Could not create key",
      },
      { status: 400, headers },
    );
  }
}
export default function Hydrogen() {
  const { keys, endpoint } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [label, setLabel] = useState("Hydrogen storefront");
  const [hiddenSecret, setHiddenSecret] = useState<string | null>(null);
  const busy = fetcher.state !== "idle";
  return (
    <s-page heading="Hydrogen" inlineSize="base">
      <s-stack gap="base">
        <s-section heading="Connect your custom storefront">
          <s-stack gap="base">
            <s-paragraph>
              Connect once with your developer. Then manage offers, messages,
              and display order in Magicpromo.
            </s-paragraph>
            <s-ordered-list>
              <s-list-item>
                Create a read-only key for this storefront.
              </s-list-item>
              <s-list-item>
                Save the key and API address in your Hydrogen server’s
                environment variables.
              </s-list-item>
              <s-list-item>
                Add the React banners and make a request. The connection status
                below updates after a successful request.
              </s-list-item>
            </s-ordered-list>
            <s-text-field
              label="Offers API address"
              value={endpoint}
              readOnly
            />
            <s-text-field
              label="Connection name"
              value={label}
              onInput={(e) => setLabel(e.currentTarget.value)}
            />
            <s-button
              variant="primary"
              {...(busy ? { disabled: true } : {})}
              onClick={() =>
                fetcher.submit({ intent: "create", label }, { method: "post" })
              }
            >
              Create API key
            </s-button>
            {fetcher.data?.error && (
              <s-banner tone="critical">{fetcher.data.error}</s-banner>
            )}
            {fetcher.data?.secret && hiddenSecret !== fetcher.data.secret && (
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack gap="base">
                  <s-heading>Save your key now</s-heading>
                  <s-paragraph>
                    This is the only time we show it. Keep it on your Hydrogen
                    server, never in browser code.
                  </s-paragraph>
                  <s-text-field
                    label="Secret API key"
                    value={fetcher.data.secret}
                    readOnly
                  />
                  <s-button
                    onClick={() => setHiddenSecret(fetcher.data!.secret)}
                  >
                    I’ve saved my key
                  </s-button>
                </s-stack>
              </s-box>
            )}
          </s-stack>
        </s-section>
        <s-section heading="Your connections">
          <s-stack gap="base">
            {!keys.length && (
              <s-paragraph>
                No connections yet. Create a key to get started.
              </s-paragraph>
            )}
            {keys.map((key) => (
              <s-box
                key={key.id}
                padding="base"
                background="subdued"
                borderRadius="base"
              >
                <s-stack gap="small">
                  <s-heading>{key.label}</s-heading>
                  <s-badge tone={key.lastUsedAt ? "success" : "auto"}>
                    {key.lastUsedAt ? "Connected" : "Awaiting first request"}
                  </s-badge>
                  <s-text>{key.prefix}…</s-text>
                  {key.lastUsedAt && (
                    <s-text>
                      Last successful request:{" "}
                      {new Date(key.lastUsedAt).toISOString()}
                    </s-text>
                  )}
                  <s-stack direction="inline" gap="small">
                    <s-button
                      {...(busy ? { disabled: true } : {})}
                      onClick={() =>
                        fetcher.submit(
                          { intent: "rotate", id: key.id, label: key.label },
                          { method: "post" },
                        )
                      }
                    >
                      Replace key
                    </s-button>
                    <s-button
                      tone="critical"
                      {...(busy ? { disabled: true } : {})}
                      onClick={() =>
                        fetcher.submit(
                          { intent: "revoke", id: key.id },
                          { method: "post" },
                        )
                      }
                    >
                      Revoke key
                    </s-button>
                  </s-stack>
                  <s-text color="subdued">
                    Replacing or revoking a key stops requests using the old
                    key. Discounts stay active.
                  </s-text>
                </s-stack>
              </s-box>
            ))}
            <s-button onClick={() => window.location.reload()}>
              Refresh connection status
            </s-button>
            <s-link href="/app/storefront">Manage storefront messaging</s-link>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
