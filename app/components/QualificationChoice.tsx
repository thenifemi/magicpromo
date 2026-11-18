import { useEffect, useRef } from "react";

export default function QualificationChoice({
  value,
  onChange,
  label = "How the cart qualifies",
  options = [{ value: "distinct_products", label: "Number of different products" }, { value: "total_quantity", label: "Total quantity of eligible items" }],
}: {
  label?: string;
  options?: { value: string; label: string }[];
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
    <s-choice-list ref={ref} label={label}>
      {options.map((option) => <s-choice key={option.value} value={option.value}>{option.label}</s-choice>)}
    </s-choice-list>
  );
}
