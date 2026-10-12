import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { loadEditor, savePromotion } from "../models/promotion-editor.server";
import PromotionEditorPage from "../components/PromotionEditorPage";
export const loader = ({ request }: LoaderFunctionArgs) =>
  loadEditor(request, null);
export const action = ({ request }: ActionFunctionArgs) =>
  savePromotion(request, null);
export default function Page() {
  const { products, draft, discountStatus, needsSync } =
    useLoaderData<typeof loader>();
  return (
    <PromotionEditorPage
      key={draft ? `${draft.id}:${draft.updatedAt}` : "new"}
      products={products}
      discountStatus={discountStatus}
      needsSync={needsSync}
      draft={
        draft
          ? { ...draft, productIds: draft.products.map((p) => p.productId) }
          : null
      }
    />
  );
}
export const headers: HeadersFunction = (args) => boundary.headers(args);
