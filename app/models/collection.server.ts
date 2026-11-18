export type Graphql = (
  query: string,
  options?: { variables: Record<string, unknown> },
) => Promise<Response>;
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
export async function getCollection(graphql: Graphql, id: string) {
  const response = await graphql(COLLECTION, { variables: { id } });
  const result = await response.json();
  if (!response.ok || result.errors?.length)
    throw new Error("Could not load collection");
  return result.data?.collection as {
    id: string;
    title: string;
    handle: string;
  } | null;
}
export async function collectionProductIds(
  graphql: Graphql,
  ids: string[],
  collectionId: string,
) {
  if (!ids.length) return [];
  const response = await graphql(MEMBERSHIP, {
    variables: { ids, collectionId },
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length || !result.data)
    throw new Error("Could not verify collection membership");
  return result.data.nodes
    .filter((p: { inCollection?: boolean } | null) => p?.inCollection)
    .map((p: { id: string }) => p.id) as string[];
}
