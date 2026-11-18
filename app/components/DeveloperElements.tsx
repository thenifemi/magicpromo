import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { Placement } from "@magicpromo/sdk";
import { PLACEMENT_LABELS, developerSnippet } from "../lib/storefront-display";
import styles from "./DeveloperElements.module.css";

export const DEVELOPER_MODAL_ID = "developer-elements-modal";

const ALL_PLACEMENTS = Object.keys(PLACEMENT_LABELS) as Placement[];

/** Explains bring-your-own-element rendering and hands over a starter snippet. */
export function DeveloperElementsModal({
  placements,
  offerId,
}: {
  /** Placements to offer first; falls back to all of them. */
  placements: Placement[];
  /** Scope the snippet to one promotion's offer. */
  offerId?: string | null;
}) {
  const shopify = useAppBridge();
  const choices = placements.length ? placements : ALL_PLACEMENTS;
  const [placement, setPlacement] = useState<Placement>(choices[0]);
  const snippet = developerSnippet(placement, offerId);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      shopify.toast.show("Snippet copied");
    } catch {
      shopify.toast.show("Couldn’t copy. Select the code and copy it.", { isError: true });
    }
  }

  return (
    <s-modal id={DEVELOPER_MODAL_ID} heading="Use your own elements" size="large">
      <s-stack gap="base">
        <s-paragraph>
          Your theme developer can replace Magicpromo’s banner with an element
          from your theme, like a badge beside the price or a line in the cart
          drawer. Magicpromo still chooses the offer, tracks the cart and keeps
          the message up to date. Checkout discounts don’t change.
        </s-paragraph>
        <s-select
          label="Placement"
          value={placement}
          onChange={(event) => setPlacement(event.currentTarget.value as Placement)}
        >
          {choices.map((value) => (
            <s-option key={value} value={value}>
              {PLACEMENT_LABELS[value]}
            </s-option>
          ))}
        </s-select>
        <s-box background="subdued" borderRadius="base" padding="base">
          <pre className={styles.code}>
            <code>{snippet}</code>
          </pre>
        </s-box>
        {offerId && (
          <s-paragraph color="subdued">
            Scoped to this promotion. Other promotions keep the Magicpromo banner.
          </s-paragraph>
        )}
        <s-stack gap="small-200">
          <s-text type="strong">The function receives</s-text>
          <s-unordered-list>
            <s-list-item>
              <s-text type="strong">message</s-text>: ready-to-show text, translated and filled in
            </s-list-item>
            <s-list-item>
              <s-text type="strong">href</s-text>: the offer’s destination link
            </s-list-item>
            <s-list-item>
              <s-text type="strong">progress</s-text>: cart only, items counted and remaining
            </s-list-item>
            <s-list-item>
              <s-text type="strong">offer</s-text>: percent, minimum and your messaging settings
            </s-list-item>
          </s-unordered-list>
          <s-paragraph color="subdued">
            Return an element, plain text, or nothing to hide the banner. Paste
            the snippet into a Custom Liquid section or the theme’s layout file.
          </s-paragraph>
        </s-stack>
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={copy}>
        Copy snippet
      </s-button>
      <s-button slot="secondary-actions" commandFor={DEVELOPER_MODAL_ID} command="--hide">
        Close
      </s-button>
    </s-modal>
  );
}

/** "Default banner" vs "your own elements", side by side. */
export function StorefrontDisplayOptions({
  placements,
  configureHref,
  configureDisabled,
}: {
  placements: Placement[];
  configureHref: string;
  configureDisabled?: boolean;
}) {
  return (
    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
      <s-box border="base" borderRadius="base" padding="base">
        <s-stack gap="small">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-heading>Magicpromo banner</s-heading>
            <s-badge>Default</s-badge>
          </s-stack>
          <s-paragraph color="subdued">
            Ready-made announcement bar, product banner and cart progress,
            styled with your messaging colors.
          </s-paragraph>
          {placements.length ? (
            <s-stack direction="inline" gap="small-200">
              {placements.map((placement) => (
                <s-badge key={placement} tone="success">
                  {PLACEMENT_LABELS[placement]}
                </s-badge>
              ))}
            </s-stack>
          ) : (
            <s-text color="subdued">No placements turned on</s-text>
          )}
          <s-button href={configureHref} disabled={configureDisabled}>
            Configure messaging
          </s-button>
        </s-stack>
      </s-box>
      <s-box border="base" borderRadius="base" padding="base">
        <s-stack gap="small">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-heading>Your own elements</s-heading>
            <s-badge tone="info">For developers</s-badge>
          </s-stack>
          <s-paragraph color="subdued">
            Show this offer with your theme’s own components. Magicpromo keeps
            choosing the offer and updating the message.
          </s-paragraph>
          <s-button commandFor={DEVELOPER_MODAL_ID} command="--show" icon="code">
            Get developer snippet
          </s-button>
        </s-stack>
      </s-box>
    </s-grid>
  );
}
