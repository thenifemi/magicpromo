import { useEffect, useRef } from "react";

// React 18 needs an explicit bridge for custom-element properties and events.
export default function PolarisCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLElementTagNameMap["s-checkbox"]>(null);
  useEffect(() => {
    let cancelled = false;
    const element = ref.current;
    const change = () => {
      if (element) onChange(element.checked);
    };
    element?.addEventListener("change", change);
    void customElements.whenDefined("s-checkbox").then(() => {
      if (!cancelled && element) element.checked = checked;
    });
    return () => {
      cancelled = true;
      element?.removeEventListener("change", change);
    };
  }, [checked, onChange]);
  return <s-checkbox ref={ref} label={label} />;
}
