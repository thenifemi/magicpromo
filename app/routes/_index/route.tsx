import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";
import { POLARIS_URL } from "../../polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;

  return (
    <>
      <script src={POLARIS_URL} />
      <s-page heading="Magicpromo" inlineSize="small">
        <s-section heading="Log in to your store">
          <Form method="post">
            <s-stack gap="base">
              <s-text-field
                label="Shop domain"
                name="shop"
                details="e.g. my-shop-domain.myshopify.com"
                error={errors?.shop}
              />
              {showForm && (
                <s-button type="submit" variant="primary">
                  Log in
                </s-button>
              )}
            </s-stack>
          </Form>
        </s-section>
      </s-page>
    </>
  );
}
