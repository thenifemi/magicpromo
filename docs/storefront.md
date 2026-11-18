# Storefront promotions

Magicpromo's Shopify sidebar has two app navigation pages:

- **Promotions:** eligibility, discount rules, publishing, status, and usage.
- **Storefront:** theme setup and a messaging editor for each promotion.

## Try the Dark Side offer in development

1. Restart `npm run dev` after pulling these changes. The local Prisma migration and client generation must have run (`npm run setup`). Accept the new app proxy permission if Shopify prompts you.
2. Create a promotion in **Promotions**. Choose **Collection**, select **The Dark Side**, set **20%**, choose **Total quantity of eligible items**, and set the minimum to **2**. This allows two of the same chocolate; choose different products instead if you want two different chocolates.
3. Save the promotion, then open **Storefront messaging**. Enable the sitewide announcement and cart progress placements. Choose The Dark Side as the destination collection. A message such as `Buy {minimum} Dark Side chocolates and save {percent}%` stays tied to the rule values.
4. Save messaging, then **Publish and activate**. This publishes all saved discount rules and messaging together. Saving alone does not change the storefront.
5. Open **Storefront**, choose your unpublished test theme, and click **Add announcement bar**. Shopify opens with the embed selected. Preview it and click **Save**.
6. Return to Magicpromo and click **Add cart progress** for the same theme, then save in Shopify. **Add product banner** is optional. Each button adds one placement; skip placements you have already added to that theme.
7. Preview the theme. Check zero, one, and two eligible items, plus an unrelated product. Then deactivate the promotion and confirm the messaging disappears after refresh.

The connection and product/cart placement are configured automatically. The setup page stores the app-specific proxy path in an AppInstallation metafield; Liquid reads it without exposing a technical setting to merchants. This app-data metafield is isolated by installation and does not use a metafield definition. No credentials are stored in it.

Theme discovery requires `read_themes`. Restart the development server and accept Shopify's updated permissions when prompted. Dev setup includes the published theme with a Live label and requires an explicit theme selection. Production defaults to the live theme and also allows an unpublished theme for preview. Shopify still requires the merchant to save changes in its editor; clicking a setup button does not prove the placement was saved.

App configuration and extension changes must be deployed to the intended Shopify app separately from deploying the web backend to Render.

## How it works

Collection eligibility uses current Shopify collection membership in the Discount Function. Adding or removing a product from the collection changes its eligibility without maintaining a copied product list.

The theme extension is reusable. It requests public offer data through a signed Shopify app proxy. The backend reads the published discount configuration and current Shopify status, rather than showing unpublished editor values. Storefront’s Display order list controls which active offer appears first. Move promotions up or down and save the order; this takes effect independently of publishing discount rules. Unpublished and inactive offers are still excluded. New promotions are appended after the saved list. Until an order is saved, the legacy priority ordering is preserved. Product banners also require that the current product qualifies.

The cart banner prefers offers matching products already in the cart, using display order to break ties. Empty carts and carts with no matching offer use the first enabled offer in display order. Relevance never changes the discount calculation. The cart banner counts eligible units or distinct products using the promotion's qualification mode. It describes qualification; Shopify checkout decides the actual discount, including combinations with other offers.

Offer data refreshes on detected cart changes, page visibility changes, and every 15 seconds while visible. API failures hide the banner. The Dev server must remain running; the production web backend must be reachable.

## Current boundaries

- One eligible collection per promotion, or manually selected products.
- A dismissible sitewide announcement, inline product block, and cart-page progress block.
- Cart drawers need theme-specific integration; adding a cart-page block does not automatically modify a drawer. A theme integration can dispatch `magicpromo:cart:changed` after cart updates.
- Theme editor placeholders appear when no active offer is available; shoppers do not see those placeholders.
- Live banner placement and cart behavior must be checked in the selected theme. Automated Function and backend tests do not replace that check.

### Saved placement status

The Storefront page checks the selected theme through an authenticated, read-only
`/app/theme-status` request. It reads saved theme settings and product/cart JSON
templates (including alternate templates), paginates the files, and matches the
current Shopify app handle plus the extension block handle. Dev and production
placements are checked independently.

Enabled announcement embeds show **Enabled**; enabled product/cart blocks show
**Added**. Disabled blocks or sections show **Disabled**. **Manage placement** opens
the editor without adding another block. Product status means a placement exists
on at least one product template, not necessarily every product. This does not
verify cart drawers or Liquid-only templates.

Status refreshes on theme selection and when the page regains focus/visibility,
with a **Refresh status** button as fallback. The merchant must save in Shopify;
opening the editor does not mark setup complete. API/permission or parsing errors
show an unknown status. Installed placements still require active promotion
messaging before a shopper sees a banner. Checking status does not change the theme.
