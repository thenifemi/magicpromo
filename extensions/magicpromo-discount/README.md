# Magicpromo discount Function

Applies a percentage discount to all units of selected products once the cart
contains enough eligible distinct products or eligible units. Different variants
and separate lines for one product count as one distinct product. Other products
and custom merchandise neither qualify nor receive a discount.

## Configuration contract

The app activation action creates a Shopify app discount with the PRODUCT
discount class and writes a JSON metafield on that discount:

- Namespace: `$app:magicpromo`
- Key: `configuration`
- Type: `json`

Example (replace these example IDs with the draft's selected product IDs):

```json
{
  "version": 1,
  "productIds": ["gid://shopify/Product/1", "gid://shopify/Product/2"],
  "discountPercent": 15,
  "minimumProducts": 2,
  "qualificationMode": "distinct_products"
}
```

`qualificationMode` also accepts `total_quantity`; `minimumProducts` then means
minimum eligible units, matching the existing draft field. Percentage and minimum
must be integers from 1 to 100. Between 1 and 100 product IDs are supported.
Missing or malformed configuration and unsupported versions return no operations.

The Function does not read Prisma or call the app server. Saving a local draft
does not update this metafield or activate a Shopify discount. The app editor provides activation and an explicit update action. Editing a saved
promotion alone does not change the published rules.

## Execution

The input query asks Shopify for cart-line IDs, quantities, parent product IDs,
discount classes, and the configuration. The TypeScript function validates the
configuration, filters eligible lines, counts them according to the selected mode,
and returns one percentage candidate targeting all eligible lines. Shopify handles
monetary calculations and discount combinations; the app's preview is an estimate.

Only the cart-lines target is registered. No shipping or order-subtotal discounts
are generated. `FIRST` selects the sole candidate within this Function's output;
it does not control how this promotion combines with other discounts.

## Local checks

From this extension directory:

```sh
shopify app function typegen
shopify app function build
npm test -- --run
```

Tests validate input/output fixtures against the schema and execute the compiled
WebAssembly. They do not replace an end-to-end checkout test after activation.
