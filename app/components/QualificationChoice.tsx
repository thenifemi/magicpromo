import { useEffect, useRef } from "react";

export default function QualificationChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLElementTagNameMap["s-choice-list"]>(null);
  // React 18 needs explicit custom-element event and property handling.
  useEffect(() => {
    let cancelled = false;
    const element = ref.current;
    const change = () => {
      if (element) onChange(element.values[0]);
    };
    element?.addEventListener("change", change);
    void customElements.whenDefined("s-choice-list").then(() => {
      if (!cancelled && element) element.values = [value];
    });
    return () => {
      cancelled = true;
      element?.removeEventListener("change", change);
    };
  }, [value, onChange]);
  return (
    <s-choice-list ref={ref} label="How the cart qualifies">
      <s-choice value="distinct_products">
        Number of different products
      </s-choice>
      <s-choice value="total_quantity">
        Total quantity of eligible items
      </s-choice>
    </s-choice-list>
  );
}
