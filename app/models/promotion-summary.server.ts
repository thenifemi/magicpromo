import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";

export const READ_SUMMARIES = `#graphql
  query MagicpromoSummaries($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on DiscountAutomaticNode {
        automaticDiscount { ... on DiscountAutomaticApp { asyncUsageCount status } }
      }
      ... on DiscountNode {
        discount { ... on DiscountAutomaticApp { asyncUsageCount status } }
      }
    }
  }
`;

// Node results follow input order, including null for deleted discounts.
export async function readDiscountSummaries(graphql: AdminGraphqlClient, ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const counts = new Map<string, { usageCount: number | null; status: string }>(
    uniqueIds.map((id) => [id, { usageCount: null, status: "UNKNOWN" }]),
  );
  for (let offset = 0; offset < uniqueIds.length; offset += 250) {
    const batch = uniqueIds.slice(offset, offset + 250);
    try {
      const response = await graphql(READ_SUMMARIES, {
        variables: { ids: batch },
      });
      const { data } = await response.json();
      if (!data) continue;
      batch.forEach((id, index) => {
        const node = data.nodes[index];
        // Narrow the union: which alias exists depends on the node type.
        const discount = !node
          ? undefined
          : "automaticDiscount" in node
            ? node.automaticDiscount
            : "discount" in node
              ? node.discount
              : undefined;
        const count = discount?.asyncUsageCount;
        counts.set(id, {
          usageCount:
            typeof count === "number" && Number.isInteger(count) && count >= 0
              ? count
              : null,
          status: node === null ? "MISSING" : (discount?.status ?? "UNKNOWN"),
        });
      });
    } catch {
      // Shopify summaries are supplementary: a failed lookup must not block the editor list.
    }
  }
  return counts;
}
