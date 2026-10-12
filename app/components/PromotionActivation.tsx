type Props = {
  combinationLabels: string[];
  saved: boolean;
  linked: boolean;
  dirty: boolean;
  busy: boolean;
  pending: boolean;
  needsSync: boolean;
  status: string | null;
  onActivate: () => void;
  onDeactivate: () => void;
};
export default function PromotionActivation({
  combinationLabels,
  saved,
  linked,
  dirty,
  busy,
  pending,
  needsSync,
  status,
  onActivate,
  onDeactivate,
}: Props) {
  const statusLabel = pending
    ? "Needs review"
    : status === "ACTIVE"
      ? "Active"
      : status === "EXPIRED"
        ? "Inactive"
        : status === "SCHEDULED"
          ? "Scheduled"
          : linked
            ? "Status unavailable"
            : "Draft";
  return (
    <s-section accessibilityLabel="Shopify discount">
      <s-stack gap="base">
        <s-stack
          direction="inline"
          justifyContent="space-between"
          alignItems="center"
          gap="small"
        >
          <s-heading>Shopify discount</s-heading>
          <s-badge tone={statusLabel === "Active" ? "success" : "auto"}>
            {statusLabel}
          </s-badge>
        </s-stack>
        <s-stack gap="small">
          <s-paragraph>
            {pending
              ? "A Shopify update is pending or needs review. Check Shopify Discounts before another attempt."
              : !saved
                ? "Save your draft before activating it."
                : dirty
                  ? "Save your changes before sending them to Shopify."
                  : needsSync
                    ? "Your saved changes have not been sent to Shopify. The previous published rules still apply if the discount is active."
                    : status === "ACTIVE"
                      ? "Active on selected products."
                      : "Activation starts this automatic discount immediately, with no end date."}
          </s-paragraph>
          <s-text color="subdued">
            {combinationLabels.length
              ? `Allows combinations with ${combinationLabels.join(", ")} discounts.`
              : "Cannot combine with other discounts."}
          </s-text>
        </s-stack>
        <s-divider />
        <s-grid gridTemplateColumns="1fr" gap="small" justifyItems="stretch">
          <s-button
            variant="primary"
            onClick={onActivate}
            {...(!saved || dirty || busy || pending || status === "MISSING"
              ? { disabled: true }
              : {})}
          >
            {status === "EXPIRED"
              ? "Reactivate promotion"
              : linked
                ? "Update and activate"
                : "Activate promotion"}
          </s-button>
          {linked && (status === "ACTIVE" || status === "SCHEDULED") && (
            <s-button
              tone="critical"
              onClick={onDeactivate}
              {...(dirty || busy || pending ? { disabled: true } : {})}
            >
              Deactivate promotion
            </s-button>
          )}
        </s-grid>
        {linked && (status === "ACTIVE" || status === "SCHEDULED") && (
          <s-text color="subdued">
            Deactivating keeps your rules for later.
          </s-text>
        )}
        {status === "MISSING" && (
          <s-paragraph tone="critical">
            The linked discount was removed in Shopify. Resolve the missing link
            before activating again.
          </s-paragraph>
        )}
      </s-stack>
    </s-section>
  );
}
