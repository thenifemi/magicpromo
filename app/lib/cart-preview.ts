export type PreviewLine = {
  variantId: string;
  productId: string;
  unitPrice: number;
  quantity: number;
};
export type PreviewRules = {
  selectedIds: string[];
  qualificationMode: string;
  minimum: number;
  percent: number;
};

// Amounts are integer minor units (cents for USD). Round the discount per line.
export function evaluateCart(lines: PreviewLine[], rules: PreviewRules) {
  const valid =
    ["distinct_products", "total_quantity"].includes(rules.qualificationMode) &&
    Number.isInteger(rules.minimum) &&
    rules.minimum >= 1 &&
    rules.minimum <= 100 &&
    Number.isInteger(rules.percent) &&
    rules.percent >= 1 &&
    rules.percent <= 100 &&
    lines.every(
      (line) =>
        Number.isSafeInteger(line.unitPrice) &&
        line.unitPrice >= 0 &&
        Number.isInteger(line.quantity) &&
        line.quantity >= 1 &&
        line.quantity <= 100,
    );
  const eligible = lines.filter((line) =>
    rules.selectedIds.includes(line.productId),
  );
  const count =
    rules.qualificationMode === "distinct_products"
      ? new Set(eligible.map((line) => line.productId)).size
      : eligible.reduce((sum, line) => sum + line.quantity, 0);
  const qualifies = valid && eligible.length > 0 && count >= rules.minimum;
  const subtotal = valid
    ? lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
    : 0;
  const discount = qualifies
    ? eligible.reduce(
        (sum, line) =>
          sum +
          Math.round((line.unitPrice * line.quantity * rules.percent) / 100),
        0,
      )
    : 0;
  return {
    valid,
    qualifies,
    count,
    missing: Math.max(0, rules.minimum - count),
    subtotal,
    discount,
    total: subtotal - discount,
  };
}

export function toMinorUnits(amount: string, digits: number) {
  const [whole, fraction = ""] = amount.split(".");
  return (
    Number(whole) * 10 ** digits +
    Number(fraction.padEnd(digits, "0").slice(0, digits))
  );
}
