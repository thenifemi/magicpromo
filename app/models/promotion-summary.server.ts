type Graphql = (
  query: string,
  options?: { variables: Record<string, unknown> },
) => Promise<Response>;

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
export async function readDiscountSummaries(graphql: Graphql, ids: string[]) {
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
      const result = await response.json();
      if (
        !response.ok ||
        result.errors?.length ||
        !Array.isArray(result.data?.nodes)
      )
        continue;
      batch.forEach((id, index) => {
        const node = result.data.nodes[index];
        const discount = node?.automaticDiscount ?? node?.discount;
        const count = discount?.asyncUsageCount;
        counts.set(id, {
          usageCount: Number.isInteger(count) && count >= 0 ? count : null,
          status: node === null ? "MISSING" : (discount?.status ?? "UNKNOWN"),
        });
      });
    } catch {
      // Shopify summaries are supplementary: a failed lookup must not block the editor list.
    }
  }
  return counts;
}
