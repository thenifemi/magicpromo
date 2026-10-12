import { useState } from "react";
import type { ProductSummary } from "./ProductPicker";
import {
  evaluateCart,
  toMinorUnits,
  type PreviewRules,
} from "../lib/cart-preview";

export default function CartPreview({
  products,
  ...rules
}: PreviewRules & { products: ProductSummary[] }) {
  const variants = products.flatMap((product) =>
    product.variants.nodes.map((variant) => ({
      ...variant,
      productId: product.id,
      name: `${product.title} · ${variant.title}`,
      currency: product.priceRangeV2.minVariantPrice.currencyCode,
    })),
  );
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, string>>({});
  const shownProducts = products.filter((product) =>
    product.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  function add(id: string) {
    setCart((current) => ({
      ...current,
      [id]: String(Math.min(100, (Number(current[id]) || 0) + 1)),
    }));
  }
  const currency = variants[0]?.currency ?? "USD";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const money = (amount: number) => formatter.format(amount / 10 ** digits);
  const lines = variants
    .filter((v) => v.id in cart)
    .map((v) => ({
      ...v,
      variantId: v.id,
      unitPrice: toMinorUnits(v.price, digits),
      quantity: Number(cart[v.id]),
    }));
  const result = evaluateCart(lines, rules);
  function remove(id: string) {
    setCart((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  return (
    <s-stack gap="base">
      <s-paragraph color="subdued">
        Build a sample cart to try your current rules. No order will be created.
      </s-paragraph>
      <s-query-container>
        <s-grid
          gridTemplateColumns="@container (inline-size > 700px) 1fr 1fr, 1fr"
          gap="large"
          alignItems="start"
        >
          <s-stack gap="base">
            <s-heading>Add products</s-heading>
            <s-search-field
              label="Search products"
              labelAccessibilityVisibility="exclusive"
              placeholder="Search products"
              value={search}
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
            {/* Scroll regions need keyboard focus so keyboard users can browse products. */}
            <div
              role="region"
              aria-label="Products to add"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard access to scrollable product list.
              tabIndex={0}
              style={{ maxHeight: 360, overflowY: "auto" }}
            >
              <s-stack gap="base">
                {shownProducts.map((product) => {
                  const image = product.featuredMedia?.preview?.image;
                  return (
                    <s-box
                      key={product.id}
                      paddingBlockEnd="base"
                      borderWidth="none none base none"
                    >
                      <s-grid
                        gridTemplateColumns="40px minmax(0, 1fr)"
                        gap="base"
                      >
                        <s-thumbnail
                          src={image?.url}
                          alt={image?.altText ?? product.title}
                          size="small"
                        />
                        <s-stack gap="small">
                          <s-text type="strong">{product.title}</s-text>
                          <s-text color="subdued">
                            {rules.selectedIds.includes(product.id)
                              ? "Eligible for this promotion"
                              : "Not eligible · useful for testing"}
                          </s-text>
                          <s-stack direction="inline" gap="small">
                            {product.variants.nodes.map((variant) => (
                              <s-button
                                key={variant.id}
                                accessibilityLabel={`Add ${product.title} · ${variant.title}`}
                                onClick={() => add(variant.id)}
                              >
                                {variant.title} ·{" "}
                                {formatter.format(Number(variant.price))} +
                              </s-button>
                            ))}
                          </s-stack>
                        </s-stack>
                      </s-grid>
                    </s-box>
                  );
                })}
              </s-stack>
            </div>
            {!shownProducts.length && (
              <s-stack gap="small">
                <s-text type="strong">
                  {products.length
                    ? "No matching products"
                    : "No products available"}
                </s-text>
                <s-paragraph color="subdued">
                  {products.length
                    ? "Try another name or clear your search."
                    : "Add products in Shopify, then reload."}
                </s-paragraph>
                {search && (
                  <s-button onClick={() => setSearch("")}>
                    Clear search
                  </s-button>
                )}
              </s-stack>
            )}
            <s-text color="subdued">
              Showing up to 10 products
              {products.some((p) => p.variants.pageInfo.hasNextPage)
                ? " and 100 variants per product"
                : ""}
              .
            </s-text>
          </s-stack>
          <s-section heading="Sample cart">
            <s-stack gap="base">
              {!lines.length ? (
                <s-box paddingBlock="large">
                  <s-stack gap="small">
                    <s-text type="strong">Your sample cart is empty</s-text>
                    <s-paragraph color="subdued">
                      Choose a size to add it. Your discount and estimated total
                      will appear here.
                    </s-paragraph>
                  </s-stack>
                </s-box>
              ) : (
                <>
                  {lines.map((line) => (
                    <s-box
                      key={line.id}
                      paddingBlockEnd="base"
                      borderWidth="none none base none"
                    >
                      <s-stack gap="small">
                        <s-text type="strong">{line.name}</s-text>
                        {!rules.selectedIds.includes(line.productId) && (
                          <s-badge>Not eligible</s-badge>
                        )}
                        <s-grid
                          gridTemplateColumns="80px minmax(0, 1fr) auto"
                          gap="small"
                          alignItems="center"
                        >
                          <s-number-field
                            label={`Quantity for ${line.name}`}
                            labelAccessibilityVisibility="exclusive"
                            value={cart[line.id]}
                            min={1}
                            max={100}
                            step={1}
                            onInput={(event) => {
                              const value = event.currentTarget.value;
                              setCart((current) => ({
                                ...current,
                                [line.id]: value,
                              }));
                            }}
                          />
                          <s-text>
                            {Number.isInteger(line.quantity) &&
                            line.quantity >= 1 &&
                            line.quantity <= 100
                              ? money(line.unitPrice * line.quantity)
                              : "—"}
                          </s-text>
                          <s-button
                            variant="tertiary"
                            accessibilityLabel={`Remove ${line.name}`}
                            onClick={() => remove(line.id)}
                          >
                            Remove
                          </s-button>
                        </s-grid>
                      </s-stack>
                    </s-box>
                  ))}
                  <s-banner
                    tone={
                      !result.valid
                        ? "warning"
                        : result.qualifies
                          ? "success"
                          : "info"
                    }
                    heading={
                      !result.valid
                        ? "Check your inputs"
                        : result.qualifies
                          ? "Cart qualifies"
                          : "Cart does not qualify"
                    }
                  >
                    {!result.valid
                      ? "Use whole numbers: 1–100 for percentage, minimum, and item quantities."
                      : !rules.selectedIds.length
                        ? "Close this preview and select eligible products in the promotion editor."
                        : `${result.count} ${rules.qualificationMode === "total_quantity" ? "eligible items" : "different eligible products"}. ${result.qualifies ? `${rules.percent}% off applies to eligible items.` : `Add ${result.missing} more to reach ${rules.minimum}.`}`}
                  </s-banner>
                  {result.valid && (
                    <s-stack gap="small">
                      <s-text>Subtotal: {money(result.subtotal)}</s-text>
                      <s-text>Discount: −{money(result.discount)}</s-text>
                      <s-text type="strong">
                        Estimated total: {money(result.total)} {currency}
                      </s-text>
                    </s-stack>
                  )}
                  <s-button variant="tertiary" onClick={() => setCart({})}>
                    Clear sample cart
                  </s-button>
                </>
              )}
              <s-text color="subdued">
                Estimate using base prices. Excludes shipping, taxes, market
                pricing and other discounts. Discounts are rounded per line.
              </s-text>
            </s-stack>
          </s-section>
        </s-grid>
      </s-query-container>
    </s-stack>
  );
}
