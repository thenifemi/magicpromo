/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.d.ts';

export type MagicpromoCollectionQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type MagicpromoCollectionQuery = { collection?: AdminTypes.Maybe<Pick<AdminTypes.Collection, 'id' | 'title' | 'handle'>> };

export type MagicpromoMembershipQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
  collectionId: AdminTypes.Scalars['ID']['input'];
}>;


export type MagicpromoMembershipQuery = { nodes: Array<AdminTypes.Maybe<Pick<AdminTypes.Product, 'id' | 'inCollection'>>> };

export type ActivateMagicpromoMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.DiscountAutomaticAppInput;
}>;


export type ActivateMagicpromoMutation = { discountAutomaticAppCreate?: AdminTypes.Maybe<{ automaticAppDiscount?: AdminTypes.Maybe<Pick<AdminTypes.DiscountAutomaticApp, 'discountId'>>, userErrors: Array<Pick<AdminTypes.DiscountUserError, 'field' | 'message'>> }> };

export type UpdateMagicpromoMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  input: AdminTypes.DiscountAutomaticAppInput;
}>;


export type UpdateMagicpromoMutation = { discountAutomaticAppUpdate?: AdminTypes.Maybe<{ automaticAppDiscount?: AdminTypes.Maybe<Pick<AdminTypes.DiscountAutomaticApp, 'discountId'>>, userErrors: Array<Pick<AdminTypes.DiscountUserError, 'field' | 'message'>> }> };

export type MagicpromoDiscountQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type MagicpromoDiscountQuery = { automaticDiscountNode?: AdminTypes.Maybe<{ metafield?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'id'>>, automaticDiscount: Pick<AdminTypes.DiscountAutomaticApp, 'status' | 'asyncUsageCount'> }> };

export type MagicpromoActivationAccessQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type MagicpromoActivationAccessQuery = { currentAppInstallation: { accessScopes: Array<Pick<AdminTypes.AccessScope, 'handle'>> }, nodes: Array<AdminTypes.Maybe<Pick<AdminTypes.Collection, 'id'> | Pick<AdminTypes.Product, 'id'>>> };

export type DeactivateMagicpromoMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type DeactivateMagicpromoMutation = { discountAutomaticDeactivate?: AdminTypes.Maybe<{ automaticDiscountNode?: AdminTypes.Maybe<(
      Pick<AdminTypes.DiscountAutomaticNode, 'id'>
      & { automaticDiscount: Pick<AdminTypes.DiscountAutomaticApp, 'status' | 'asyncUsageCount'> }
    )>, userErrors: Array<Pick<AdminTypes.DiscountUserError, 'field' | 'message'>> }> };

export type MagicpromoProductsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type MagicpromoProductsQuery = { products: { nodes: Array<(
      Pick<AdminTypes.Product, 'id' | 'title' | 'status'>
      & { variants: { nodes: Array<Pick<AdminTypes.ProductVariant, 'id' | 'title' | 'price'>>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage'> }, priceRangeV2: { minVariantPrice: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'>, maxVariantPrice: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> }, featuredMedia?: AdminTypes.Maybe<{ preview?: AdminTypes.Maybe<{ image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url' | 'altText'>> }> }> }
    )> } };

export type ValidatePromotionProductsQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type ValidatePromotionProductsQuery = { nodes: Array<AdminTypes.Maybe<Pick<AdminTypes.Product, 'id'>>> };

export type MagicpromoSummariesQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type MagicpromoSummariesQuery = { nodes: Array<AdminTypes.Maybe<{ automaticDiscount: Pick<AdminTypes.DiscountAutomaticApp, 'asyncUsageCount' | 'status'> } | { discount: Pick<AdminTypes.DiscountAutomaticApp, 'asyncUsageCount' | 'status'> }>> };

export type MagicpromoStorefrontQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type MagicpromoStorefrontQuery = { nodes: Array<AdminTypes.Maybe<{ metafield?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'jsonValue'>>, automaticDiscount: Pick<AdminTypes.DiscountAutomaticApp, 'status'> } | { metafield?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'jsonValue'>>, discount: Pick<AdminTypes.DiscountAutomaticApp, 'status'> }>> };

export type MagicpromoThemePlacementsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type MagicpromoThemePlacementsQuery = { currentAppInstallation: { app: Pick<AdminTypes.App, 'handle'> }, theme?: AdminTypes.Maybe<{ files?: AdminTypes.Maybe<{ nodes: Array<(
        Pick<AdminTypes.OnlineStoreThemeFile, 'filename'>
        & { body: Pick<AdminTypes.OnlineStoreThemeFileBodyText, 'content'> }
      )>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> }> }> };

export type MagicpromoThemeSetupQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type MagicpromoThemeSetupQuery = { themes?: AdminTypes.Maybe<{ nodes: Array<Pick<AdminTypes.OnlineStoreTheme, 'id' | 'name' | 'role'>> }>, currentAppInstallation: (
    Pick<AdminTypes.AppInstallation, 'id'>
    & { app: Pick<AdminTypes.App, 'handle'>, appHandle?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'value'>>, proxyPath?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'value'>> }
  ) };

export type MagicpromoThemeConnectionMutationVariables = AdminTypes.Exact<{
  metafields: Array<AdminTypes.MetafieldsSetInput> | AdminTypes.MetafieldsSetInput;
}>;


export type MagicpromoThemeConnectionMutation = { metafieldsSet?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.MetafieldsSetUserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
  "#graphql\n  query MagicpromoCollection($id: ID!) {\n    collection(id: $id) { id title handle }\n  }\n": {return: MagicpromoCollectionQuery, variables: MagicpromoCollectionQueryVariables},
  "#graphql\n  query MagicpromoMembership($ids: [ID!]!, $collectionId: ID!) {\n    nodes(ids: $ids) { ... on Product { id inCollection(id: $collectionId) } }\n  }\n": {return: MagicpromoMembershipQuery, variables: MagicpromoMembershipQueryVariables},
  "#graphql\n  query MagicpromoDiscount($id: ID!) {\n    automaticDiscountNode: discountNode(id: $id) {\n      metafield(namespace: \"$app:magicpromo\", key: \"configuration\") { id }\n      automaticDiscount: discount { ... on DiscountAutomaticApp { status asyncUsageCount } }\n    }\n  }\n": {return: MagicpromoDiscountQuery, variables: MagicpromoDiscountQueryVariables},
  "#graphql\n  query MagicpromoActivationAccess($ids: [ID!]!) {\n    currentAppInstallation { accessScopes { handle } }\n    nodes(ids: $ids) { ... on Product { id } ... on Collection { id } }\n  }\n": {return: MagicpromoActivationAccessQuery, variables: MagicpromoActivationAccessQueryVariables},
  "#graphql\n    query MagicpromoProducts {\n      products(first: 10) {\n        nodes {\n          id\n          title\n          status\n          variants(first: 100) { nodes { id title price } pageInfo { hasNextPage } }\n          priceRangeV2 {\n            minVariantPrice { amount currencyCode }\n            maxVariantPrice { amount currencyCode }\n          }\n          featuredMedia {\n            preview {\n              image {\n                url\n                altText\n              }\n            }\n          }\n        }\n      }\n    }\n  ": {return: MagicpromoProductsQuery, variables: MagicpromoProductsQueryVariables},
  "#graphql\n    query ValidatePromotionProducts($ids: [ID!]!) {\n      nodes(ids: $ids) { ... on Product { id } }\n    }\n  ": {return: ValidatePromotionProductsQuery, variables: ValidatePromotionProductsQueryVariables},
  "#graphql\n  query MagicpromoSummaries($ids: [ID!]!) {\n    nodes(ids: $ids) {\n      ... on DiscountAutomaticNode {\n        automaticDiscount { ... on DiscountAutomaticApp { asyncUsageCount status } }\n      }\n      ... on DiscountNode {\n        discount { ... on DiscountAutomaticApp { asyncUsageCount status } }\n      }\n    }\n  }\n": {return: MagicpromoSummariesQuery, variables: MagicpromoSummariesQueryVariables},
  "#graphql\n  query MagicpromoStorefront($ids: [ID!]!) {\n    nodes(ids: $ids) {\n      ... on DiscountAutomaticNode {\n        metafield(namespace: \"$app:magicpromo\", key: \"configuration\") { jsonValue }\n        automaticDiscount { ... on DiscountAutomaticApp { status } }\n      }\n      ... on DiscountNode {\n        metafield(namespace: \"$app:magicpromo\", key: \"configuration\") { jsonValue }\n        discount { ... on DiscountAutomaticApp { status } }\n      }\n    }\n  }\n": {return: MagicpromoStorefrontQuery, variables: MagicpromoStorefrontQueryVariables},
  "#graphql\n  query MagicpromoThemePlacements($id: ID!, $after: String) {\n    currentAppInstallation { app { handle } }\n    theme(id: $id) {\n      files(first: 50, after: $after, filenames: [\"config/settings_data.json\", \"templates/product*.json\", \"templates/cart*.json\"]) {\n        nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }\n        pageInfo { hasNextPage endCursor }\n      }\n    }\n  }\n": {return: MagicpromoThemePlacementsQuery, variables: MagicpromoThemePlacementsQueryVariables},
  "#graphql\n  query MagicpromoThemeSetup {\n    themes(first: 100) { nodes { id name role } }\n    currentAppInstallation {\n      id\n      app { handle }\n      appHandle: metafield(namespace: \"magicpromo\", key: \"app_handle\") { value }\n      proxyPath: metafield(namespace: \"magicpromo\", key: \"proxy_path\") { value }\n    }\n  }\n": {return: MagicpromoThemeSetupQuery, variables: MagicpromoThemeSetupQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation ActivateMagicpromo($input: DiscountAutomaticAppInput!) {\n    discountAutomaticAppCreate(automaticAppDiscount: $input) {\n      automaticAppDiscount { discountId }\n      userErrors { field message }\n    }\n  }\n": {return: ActivateMagicpromoMutation, variables: ActivateMagicpromoMutationVariables},
  "#graphql\n  mutation UpdateMagicpromo($id: ID!, $input: DiscountAutomaticAppInput!) {\n    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {\n      automaticAppDiscount { discountId }\n      userErrors { field message }\n    }\n  }\n": {return: UpdateMagicpromoMutation, variables: UpdateMagicpromoMutationVariables},
  "#graphql\n  mutation DeactivateMagicpromo($id: ID!) {\n    discountAutomaticDeactivate(id: $id) {\n      automaticDiscountNode {\n        id\n        automaticDiscount { ... on DiscountAutomaticApp { status asyncUsageCount } }\n      }\n      userErrors { field message }\n    }\n  }\n": {return: DeactivateMagicpromoMutation, variables: DeactivateMagicpromoMutationVariables},
  "#graphql\n  mutation MagicpromoThemeConnection($metafields: [MetafieldsSetInput!]!) {\n    metafieldsSet(metafields: $metafields) {\n      userErrors { field message }\n    }\n  }\n": {return: MagicpromoThemeConnectionMutation, variables: MagicpromoThemeConnectionMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
