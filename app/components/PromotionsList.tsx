import { useState } from "react";
import { useNavigate } from "react-router";
type PromotionListItem = {
  id: string;
  collectionTitle?: string | null;
  usageCount: number | null;
  discountStatus: string | null;
  shopifyDiscountId?: string | null;
  activationToken?: string | null;
  name: string;
  discountPercent: number;
  minimumProducts: number;
  qualificationMode: string;
  updatedAt: Date | string;
  _count: { products: number };
};
export default function PromotionsList({
  promotions,
}: {
  promotions: PromotionListItem[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const filtered = promotions.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <s-page heading="Promotions" inlineSize="large">
      {promotions.length > 0 && (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => navigate("/app/promotions/new")}
        >
          Create promotion
        </s-button>
      )}
      {promotions.length === 0 ? (
        <s-section accessibilityLabel="No promotions">
          <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
            <s-icon type="discount" size="base" />
            <s-heading>Create your first promotion</s-heading>
            <s-paragraph>
              Choose products and set discount rules. Save a draft to review
              before publishing.
            </s-paragraph>
            <s-button
              variant="primary"
              onClick={() => navigate("/app/promotions/new")}
            >
              Create promotion
            </s-button>
          </s-grid>
        </s-section>
      ) : (
        <s-section padding="none" accessibilityLabel="Promotions">
          <s-box padding="base">
            <s-stack gap="base">
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-heading>All promotions</s-heading>
                <s-badge>
                  {promotions.length}{" "}
                  {promotions.length === 1 ? "promotion" : "promotions"}
                </s-badge>
              </s-stack>
              <s-box maxInlineSize="400px">
                <s-search-field
                  label="Search promotions"
                  placeholder="Search by name"
                  value={query}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
              </s-box>
            </s-stack>
          </s-box>
          {filtered.length === 0 ? (
            <s-box padding="large">
              <s-stack gap="base">
                <s-heading>No matching promotions</s-heading>
                <s-paragraph>
                  Try another name or clear your search to see all promotions.
                </s-paragraph>
                <s-button onClick={() => setQuery("")}>Clear search</s-button>
              </s-stack>
            </s-box>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Promotion</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
                <s-table-header listSlot="labeled">Discount</s-table-header>
                <s-table-header listSlot="labeled" format="numeric">
                  Eligibility
                </s-table-header>
                <s-table-header listSlot="labeled" format="numeric">
                  Uses
                </s-table-header>
                <s-table-header listSlot="labeled">Last updated</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {filtered.map((p) => (
                  // Row clicks are forwarded to the link, which stays the accessible control.
                  <s-table-row
                    key={p.id}
                    clickDelegate={`promotion-link-${p.id}`}
                  >
                    <s-table-cell>
                      <s-link
                        id={`promotion-link-${p.id}`}
                        href={`/app/promotions/${p.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(`/app/promotions/${p.id}`);
                        }}
                      >
                        {p.name}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack
                        direction="inline"
                        gap="small"
                        alignItems="center"
                      >
                        {p.shopifyDiscountId && (
                          <s-badge
                            tone={
                              p.discountStatus === "ACTIVE"
                                ? "success"
                                : p.discountStatus === "SCHEDULED"
                                  ? "info"
                                  : p.discountStatus === "UNKNOWN" ||
                                      p.discountStatus === "MISSING"
                                    ? "caution"
                                    : "neutral"
                            }
                          >
                            {p.discountStatus === "ACTIVE"
                              ? "Active"
                              : p.discountStatus === "EXPIRED"
                                ? "Deactivated"
                                : p.discountStatus === "SCHEDULED"
                                  ? "Scheduled"
                                  : p.discountStatus === "MISSING"
                                    ? "Removed from Shopify"
                                    : "Status unavailable"}
                          </s-badge>
                        )}
                        <s-badge>
                          <s-stack
                            direction="inline"
                            gap="small-200"
                            alignItems="center"
                          >
                            {!p.activationToken && p.shopifyDiscountId && (
                              <s-box inlineSize="16px">
                                <s-image
                                  src="https://cdn.shopify.com/shopifycloud/brochure/assets/brand-assets/shopify-logo-shopping-bag-full-color-66166b2e55d67988b56b4bd28b63c271e2b9713358cb723070a92bde17ad7d63.svg"
                                  alt=""
                                  aspectRatio="1"
                                  objectFit="contain"
                                />
                              </s-box>
                            )}
                            {p.activationToken
                              ? "Needs review"
                              : p.shopifyDiscountId
                                ? "Linked to Shopify"
                                : "Draft"}
                          </s-stack>
                        </s-badge>
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      {p.discountPercent}% off · {p.minimumProducts}+{" "}
                      {p.qualificationMode === "total_quantity"
                        ? "eligible items"
                        : "different products"}
                    </s-table-cell>
                    <s-table-cell>{p.collectionTitle || `${p._count.products} products`}</s-table-cell>
                    <s-table-cell>
                      {p.usageCount === null
                        ? "Unavailable"
                        : p.usageCount.toLocaleString("en")}
                    </s-table-cell>
                    <s-table-cell>
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      }).format(new Date(p.updatedAt))}{" "}
                      UTC
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
          <s-box padding="base">
            <s-paragraph color="subdued">
              Status is checked with Shopify when this list loads. Drafts are
              not active at checkout. Usage counts come from Shopify and may
              take time to update after an order.
            </s-paragraph>
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}
