import PolarisCheckbox from "./PolarisCheckbox";

type Money = { amount: string; currencyCode: string };

export type ProductSummary = {
  id: string;
  title: string;
  status: string;
  variants: {
    nodes: { id: string; title: string; price: string }[];
    pageInfo: { hasNextPage: boolean };
  };
  priceRangeV2: { minVariantPrice: Money; maxVariantPrice: Money };
  featuredMedia: {
    preview: { image: { url: string; altText: string | null } | null } | null;
  } | null;
};

function formatPriceRange({
  minVariantPrice: min,
  maxVariantPrice: max,
}: ProductSummary["priceRangeV2"]) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: min.currencyCode,
    currencyDisplay: "narrowSymbol",
  });
  const minimum = formatter.format(Number(min.amount));
  const range =
    Number(min.amount) === Number(max.amount)
      ? minimum
      : `${minimum}–${formatter.format(Number(max.amount))}`;
  return `${range} ${min.currencyCode}`;
}

export default function ProductPicker({
  products,
  selectedIds,
  onSelectionChange,
}: {
  products: ProductSummary[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const selectedCount = selectedIds.length;

  function toggleProduct(id: string, checked: boolean) {
    onSelectionChange(
      checked
        ? [...new Set([...selectedIds, id])]
        : selectedIds.filter((value) => value !== id),
    );
  }

  return (
    <s-section heading="Promotion products" padding="none">
      <s-box padding="base">
        <s-stack gap="small">
          <s-paragraph>
            Select the products to include in your promotion. All variants of
            each product are included.
          </s-paragraph>
          <s-stack direction="inline" gap="base" alignItems="center">
            <span role="status" aria-live="polite">
              {selectedCount} selected
            </span>
            {products.length > 0 && (
              <>
                <s-button
                  variant="tertiary"
                  onClick={() =>
                    onSelectionChange([
                      ...new Set([
                        ...selectedIds,
                        ...products.map((product) => product.id),
                      ]),
                    ])
                  }
                >
                  Select all shown
                </s-button>
                <s-button
                  variant="tertiary"
                  onClick={() => onSelectionChange([])}
                >
                  Clear selection
                </s-button>
              </>
            )}
          </s-stack>
        </s-stack>
      </s-box>
      {products.length === 0 ? (
        <s-box padding="base">
          <s-paragraph>
            No products found. Add a product in Shopify Products, then refresh
            this page.
          </s-paragraph>
        </s-box>
      ) : (
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Product</s-table-header>
            <s-table-header listSlot="secondary">Status</s-table-header>
            <s-table-header format="numeric" listSlot="labeled">
              Price
            </s-table-header>
          </s-table-header-row>
          <s-table-body>
            {products.map((product) => {
              const image = product.featuredMedia?.preview?.image;
              return (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small" alignItems="center">
                      {image ? (
                        <s-thumbnail
                          src={image.url}
                          alt={image.altText ?? ""}
                          size="small"
                        />
                      ) : (
                        <s-icon type="product" />
                      )}
                      <PolarisCheckbox
                        checked={selectedIds.includes(product.id)}
                        onChange={(checked) =>
                          toggleProduct(product.id, checked)
                        }
                        label={product.title}
                      />
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge
                      tone={product.status === "ACTIVE" ? "success" : "neutral"}
                    >
                      {product.status.charAt(0) +
                        product.status.slice(1).toLowerCase()}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {formatPriceRange(product.priceRangeV2)}
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
      )}
      <s-box padding="base">
        <s-paragraph color="subdued">
          Showing up to 10 products. Prices reflect all variants.
        </s-paragraph>
      </s-box>
    </s-section>
  );
}
