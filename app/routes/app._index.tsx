import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import PromotionsList from "../components/PromotionsList";
import { listDrafts } from "../models/promotion-draft.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { promotions: await listDrafts(session.shop) };
};

export default function Promotions() {
  const { promotions } = useLoaderData<typeof loader>();
  return <PromotionsList promotions={promotions} />;
}
export const headers: HeadersFunction = (args) => boundary.headers(args);
