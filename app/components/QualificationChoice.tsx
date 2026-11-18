export default function QualificationChoice({
  value,
  onChange,
  label = "How the cart qualifies",
  options = [
    { value: "distinct_products", label: "Number of different products" },
    { value: "total_quantity", label: "Total quantity of eligible items" },
  ],
}: {
  label?: string;
  options?: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  // React 19 sets custom-element properties (values) and wires their events directly.
  return (
    <s-choice-list
      label={label}
      values={[value]}
      onChange={(event) => onChange(event.currentTarget.values[0])}
    >
      {options.map((option) => (
        <s-choice key={option.value} value={option.value}>
          {option.label}
        </s-choice>
      ))}
    </s-choice-list>
  );
}
