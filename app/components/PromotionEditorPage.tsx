import { useAppBridge } from "@shopify/app-bridge-react";
import { useState, useCallback, useRef } from "react";
import { useFetcher, useNavigate, useBeforeUnload } from "react-router";
import type { savePromotion } from "../models/promotion-editor.server";
import styles from "./PromotionEditorPage.module.css";
import PolarisCheckbox from "./PolarisCheckbox";
import PromotionActivation from "./PromotionActivation";
import CartPreview from "./CartPreview";
import QualificationChoice from "./QualificationChoice";
import ProductPicker, { type ProductSummary } from "./ProductPicker";

type Draft = {
  id: string;
  updatedAt: Date | string;
  shopifyDiscountId?: string | null;
  activationToken?: string | null;
  name: string;
  productIds: string[];
  collectionId?: string | null;
  collectionTitle?: string | null;
  combineProductDiscounts: boolean;
  combineOrderDiscounts: boolean;
  combineShippingDiscounts: boolean;

  discountPercent: number;
  minimumProducts: number;
  qualificationMode: string;
};

export default function PromotionEditorPage({
  products,
  collectionProductIds = [],
  draft,
  discountStatus = null,
  needsSync = false,
  usageCount = null,
}: {
  products: ProductSummary[];
  collectionProductIds?: string[];
  draft: Draft | null;
  discountStatus?: string | null;
  needsSync?: boolean;
  usageCount?: number | null;
}) {
  const shopify = useAppBridge();
  const [eligibility, setEligibility] = useState(draft?.collectionId ? "collection" : "products");
  const [collection, setCollection] = useState({ id: draft?.collectionId ?? "", title: draft?.collectionTitle ?? "" });
  const collectionId = eligibility === "collection" ? collection.id : "";
  const collectionPreviewReady = eligibility !== "collection" || (!!collectionId && collectionId === draft?.collectionId);
  async function chooseCollection() {
    const selection = await shopify.resourcePicker({ type: "collection", multiple: false, action: "select" });
    if (selection?.[0]) setCollection({ id: selection[0].id, title: selection[0].title });
  }
  const fetcher = useFetcher<typeof savePromotion>();
  const navigate = useNavigate();
  const discardModal = useRef<HTMLElementTagNameMap["s-modal"]>(null);
  const [qualificationMode, setQualificationMode] = useState(
    draft?.qualificationMode ?? "distinct_products",
  );
  const [discountPercent, setDiscountPercent] = useState(
    String(draft?.discountPercent ?? 15),
  );
  const [minimumProducts, setMinimumProducts] = useState(
    String(draft?.minimumProducts ?? 3),
  );
  const [name, setName] = useState(draft?.name ?? "");
  const [selectedIds, setSelectedIds] = useState(draft?.productIds ?? []);
  const [combineProductDiscounts, setCombineProductDiscounts] = useState(
    draft?.combineProductDiscounts ?? false,
  );
  const [combineOrderDiscounts, setCombineOrderDiscounts] = useState(
    draft?.combineOrderDiscounts ?? false,
  );
  const [combineShippingDiscounts, setCombineShippingDiscounts] = useState(
    draft?.combineShippingDiscounts ?? false,
  );
  const busy = fetcher.state !== "idle";
  const locked = !!draft?.activationToken;
  const dirty =
    collectionId !== (draft?.collectionId ?? "") ||
    eligibility !== (draft?.collectionId ? "collection" : "products") ||
    combineProductDiscounts !== (draft?.combineProductDiscounts ?? false) ||
    combineOrderDiscounts !== (draft?.combineOrderDiscounts ?? false) ||
    combineShippingDiscounts !== (draft?.combineShippingDiscounts ?? false) ||
    qualificationMode !== (draft?.qualificationMode ?? "distinct_products") ||
    discountPercent !== String(draft?.discountPercent ?? 15) ||
    minimumProducts !== String(draft?.minimumProducts ?? 3) ||
    name !== (draft?.name ?? "") ||
    [...selectedIds].sort().join() !==
      [...(draft?.productIds ?? [])].sort().join();
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [dirty],
    ),
  );
  function back() {
    if (dirty) discardModal.current?.showOverlay();
    else navigate("/app");
  }
  function save() {
    if (busy || locked) return;
    const form = new FormData();
    form.set("name", name);
    form.set("collectionId", collectionId);
    form.set("discountPercent", discountPercent);
    form.set("minimumProducts", minimumProducts);
    form.set("qualificationMode", qualificationMode);
    form.set("combineProductDiscounts", String(combineProductDiscounts));
    form.set("combineOrderDiscounts", String(combineOrderDiscounts));
    form.set("combineShippingDiscounts", String(combineShippingDiscounts));
    selectedIds.forEach((id) => form.append("productId", id));
    fetcher.submit(form, { method: "post" });
  }
  const linked = !!draft?.shopifyDiscountId;
  const canDeactivate = linked && (discountStatus === "ACTIVE" || discountStatus === "SCHEDULED");
  const activationDisabled = !draft || dirty || busy || locked || discountStatus === "MISSING";
  const activationLabel = discountStatus === "EXPIRED"
    ? "Reactivate promotion"
    : discountStatus === "ACTIVE"
      ? "Update promotion"
      : linked ? "Update and activate" : "Activate promotion";
  function activate() {
    if (activationDisabled || !draft) return;
    fetcher.submit({ intent: "activate", version: new Date(draft.updatedAt).toISOString() }, { method: "post" });
  }
  function deactivate() {
    if (!draft || !canDeactivate || dirty || busy || locked) return;
    fetcher.submit({ intent: "deactivate", version: new Date(draft.updatedAt).toISOString() }, { method: "post" });
  }
  return (
    <s-page heading={draft ? draft.name : "Create promotion"} inlineSize="base">
      <s-link
        slot="breadcrumb-actions"
        href="/app"
        onClick={(event) => {
          event.preventDefault();
          back();
        }}
      >
        magicpromo
      </s-link>
      <s-button
        slot={!draft || dirty ? "primary-action" : "secondary-actions"}
        variant={!draft || dirty ? "primary" : "secondary"}
        onClick={save}
        {...(busy || locked || (!!draft && !dirty) ? { disabled: true } : {})}
        {...(busy && !fetcher.formData?.get("intent") ? { loading: true } : {})}
      >
        {linked ? "Save changes" : "Save draft"}
      </s-button>
      {draft && (
        <s-button
          slot={dirty ? "secondary-actions" : "primary-action"}
          variant={dirty ? "secondary" : "primary"}
          onClick={activate}
          {...(activationDisabled ? { disabled: true } : {})}
          {...(busy && fetcher.formData?.get("intent") === "activate" ? { loading: true } : {})}
        >
          {activationLabel}
        </s-button>
      )}
      <s-button
        slot="secondary-actions"
        commandFor="promotion-cart-preview"
        command="--show"
        {...(busy || locked ? { disabled: true } : {})}
      >
        Test promotion
      </s-button>
      {canDeactivate && (
        <s-button
          slot="secondary-actions"
          tone="critical"
          onClick={deactivate}
          {...(dirty || busy || locked ? { disabled: true } : {})}
          {...(busy && fetcher.formData?.get("intent") === "deactivate" ? { loading: true } : {})}
        >
          Deactivate promotion
        </s-button>
      )}
      <s-stack
        gap="base"
        ref={(element) => {
          if (element) element.inert = busy || locked;
        }}
      >
        {fetcher.data && "error" in fetcher.data && (
          <s-banner tone="critical">{fetcher.data.error}</s-banner>
        )}
        <s-section heading="Promotion details">
          <s-stack gap="base">
            <s-box maxInlineSize="480px">
              <s-text-field
                label="Promotion name"
                value={name}
                maxLength={100}
                onInput={(event) => setName(event.currentTarget.value)}
                placeholder="e.g. Chocolate Explorer"
              />
            </s-box>
          </s-stack>
        </s-section>
        <s-section heading="Discount rules">
          <s-stack gap="base">
            <s-box maxInlineSize="180px">
              <s-number-field
                label="Percentage off"
                value={discountPercent}
                min={1}
                max={100}
                step={1}
                suffix="%"
                onInput={(event) =>
                  setDiscountPercent(event.currentTarget.value)
                }
              />
            </s-box>
            <QualificationChoice
              value={qualificationMode}
              onChange={setQualificationMode}
            />
            <s-box maxInlineSize="240px">
              <s-number-field
                label={
                  qualificationMode === "total_quantity"
                    ? "Minimum eligible items"
                    : "Minimum different products"
                }
                value={minimumProducts}
                min={1}
                max={100}
                step={1}
                onInput={(event) =>
                  setMinimumProducts(event.currentTarget.value)
                }
              />
            </s-box>
            <s-paragraph color="subdued">
              {qualificationMode === "total_quantity"
                ? "Every unit of a selected product counts, including repeated products and different sizes. Three bars of the same flavour can qualify."
                : "Each selected product counts once, regardless of size or quantity. Three bars of the same flavour count as one product."}
            </s-paragraph>
          </s-stack>
        </s-section>
        <s-section heading="Eligibility">
          <s-stack gap="base">
            <QualificationChoice label="Eligible products" value={eligibility} onChange={setEligibility}
              options={[{ value: "products", label: "Selected products" }, { value: "collection", label: "Products in a collection" }]} />
            {eligibility === "collection" && <>
              <s-text type="strong">{collection.title || "No collection selected"}</s-text>
              <s-button onClick={chooseCollection}>Choose collection</s-button>
              <s-paragraph color="subdued">All products currently in this collection qualify. Adding or removing products from the collection updates eligibility automatically.</s-paragraph>
            </>}
          </s-stack>
        </s-section>
        {eligibility === "products" && <ProductPicker products={products} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />}
        {draft && <s-section heading="Storefront messaging">
          <s-paragraph>Configure announcement bars, product banners, and cart progress on a separate page.</s-paragraph>
          <s-button {...(dirty ? { disabled: true } : {})} href={`/app/storefront/${draft.id}`}>Configure messaging</s-button>
          {dirty && <s-paragraph color="subdued">Save your changes before opening messaging.</s-paragraph>}
        </s-section>}
        <s-section heading="Combinations">
          <s-stack gap="small">
            <s-paragraph>This promotion can combine with:</s-paragraph>
            <PolarisCheckbox
              label="Product discounts"
              checked={combineProductDiscounts}
              onChange={setCombineProductDiscounts}
            />
            <PolarisCheckbox
              label="Order discounts"
              checked={combineOrderDiscounts}
              onChange={setCombineOrderDiscounts}
            />
            <PolarisCheckbox
              label="Shipping discounts"
              checked={combineShippingDiscounts}
              onChange={setCombineShippingDiscounts}
            />
            <s-paragraph color="subdued">
              The other discount must also allow the combination. Shopify
              determines which eligible discounts apply at checkout.
            </s-paragraph>
          </s-stack>
        </s-section>
      </s-stack>
      <div slot="aside" className={styles.sidebar}>
        <s-stack gap="base">
          <s-section heading="Summary">
            <s-stack gap="base">
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-badge>
                  {draft?.shopifyDiscountId ? "Saved rules" : "Draft"}
                </s-badge>
                <s-text color="subdued">
                  {needsSync
                    ? "Unpublished changes"
                    : "Promotion configuration"}
                </s-text>
              </s-stack>
              <s-heading>{name.trim() || "Untitled promotion"}</s-heading>
              <s-unordered-list>
                <s-list-item>
                  {discountPercent || "—"}% off eligible products
                </s-list-item>
                <s-list-item>
                  {eligibility === "collection" ? `Collection: ${collection.title || "Choose a collection"}` : `${selectedIds.length} products selected · all sizes`}
                </s-list-item>
                <s-list-item>
                  Minimum {minimumProducts || "—"}{" "}
                  {qualificationMode === "total_quantity"
                    ? "eligible items"
                    : "different eligible products"}
                </s-list-item>
              </s-unordered-list>
              {eligibility === "products" && qualificationMode === "distinct_products" &&
                Number(minimumProducts) > selectedIds.length && (
                  <s-paragraph tone="caution">
                    Select at least {minimumProducts} products for this rule to
                    be achievable.
                  </s-paragraph>
                )}
              <s-divider />
              <span role="status" aria-live="polite">
                {busy
                  ? fetcher.formData?.get("intent") === "activate"
                    ? "Activating…"
                    : fetcher.formData?.get("intent") === "deactivate"
                      ? "Deactivating…"
                      : "Saving…"
                  : dirty
                    ? "Unsaved changes"
                    : draft
                      ? linked ? "Changes saved" : "Draft saved"
                      : "Not saved yet"}
              </span>
              <s-paragraph color="subdued">
                Saving keeps these rules in Magicpromo. Use the Shopify discount
                panel or the page actions to activate or publish updates.
              </s-paragraph>
            </s-stack>
          </s-section>
          {draft && (
            <s-section heading="Discount usage">
              <s-stack gap="small">
                <s-text type="strong">
                  {usageCount === null ? "Usage unavailable" : `${usageCount.toLocaleString("en")} ${usageCount === 1 ? "use" : "uses"}`}
                </s-text>
                <s-paragraph color="subdued">
                  {usageCount === null
                    ? "We couldn’t retrieve this discount’s usage. Try refreshing the page."
                    : "Times used on orders, as reported by Shopify. Counts may take time to update."}
                </s-paragraph>
              </s-stack>
            </s-section>
          )}
          <PromotionActivation
            combinationLabels={[
              ...(combineProductDiscounts ? ["product"] : []),
              ...(combineOrderDiscounts ? ["order"] : []),
              ...(combineShippingDiscounts ? ["shipping"] : []),
            ]}
            saved={!!draft}
            linked={!!draft?.shopifyDiscountId}
            dirty={dirty}
            busy={busy}
            pending={locked}
            needsSync={needsSync}
            status={discountStatus}
            onDeactivate={deactivate}
            onActivate={activate}
          />
          <s-section heading="Test your promotion">
            <s-stack gap="base">
              <s-paragraph>
                Build a sample cart to check which items qualify and estimate
                the savings.
              </s-paragraph>
              <s-button commandFor="promotion-cart-preview" command="--show">
                Test promotion
              </s-button>
              <s-paragraph color="subdued">
                Uses your current edits, including unsaved changes.
              </s-paragraph>
            </s-stack>
          </s-section>
        </s-stack>
      </div>
      <s-modal
        id="promotion-cart-preview"
        heading="Test promotion"
        size="large"
      >
        {!collectionPreviewReady ? <s-paragraph>Save the collection selection before testing its current products.</s-paragraph> : <CartPreview
          products={products}
          selectedIds={eligibility === "collection" ? collectionProductIds : selectedIds}
          qualificationMode={qualificationMode}
          minimum={Number(minimumProducts)}
          percent={Number(discountPercent)}
        />}
        <s-button
          slot="secondary-actions"
          commandFor="promotion-cart-preview"
          command="--hide"
        >
          Done
        </s-button>
      </s-modal>
      <s-modal
        id="discard-promotion-changes"
        ref={discardModal}
        heading="Discard unsaved changes?"
      >
        <s-paragraph>
          Your changes will be lost if you leave without saving.
        </s-paragraph>
        <s-button
          slot="secondary-actions"
          commandFor="discard-promotion-changes"
          command="--hide"
        >
          Keep editing
        </s-button>
        <s-button
          slot="primary-action"
          tone="critical"
          onClick={() => {
            discardModal.current?.hideOverlay();
            navigate("/app");
          }}
        >
          Discard changes
        </s-button>
      </s-modal>
    </s-page>
  );
}
