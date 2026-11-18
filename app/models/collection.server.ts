import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
export const COLLECTION = `#graphql
  query MagicpromoCollection($id: ID!) {
    collection(id: $id) { id title handle }
  }
`;
export const MEMBERSHIP = `#graphql
  query MagicpromoMembership($ids: [ID!]!, $collectionId: ID!) {
    nodes(ids: $ids) { ... on Product { id inCollection(id: $collectionId) } }
  }
`;
export async function getCollection(graphql: AdminGraphqlClient, id: string) {
  const response = await graphql(COLLECTION, { variables: { id } });
  const { data } = await response.json();
  if (!data) throw new Error("Could not load collection");
  return data.collection ?? null;
}
export async function collectionProductIds(
  graphql: AdminGraphqlClient,
  ids: string[],
  collectionId: string,
) {
  if (!ids.length) return [];
  const response = await graphql(MEMBERSHIP, {
    variables: { ids, collectionId },
  });
  const { data } = await response.json();
  if (!data) throw new Error("Could not verify collection membership");
  // nodes() returns null for deleted IDs.
  return data.nodes.flatMap((node) => (node?.inCollection ? [node.id] : []));
}
