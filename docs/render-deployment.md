# Render deployment

## Database paths

- Local development: `prisma/schema.prisma` and `prisma/migrations` still use SQLite. Magicpromo Dev uses `prisma/magicpromo-dev.sqlite`. Earlier data remains in `prisma/dev.sqlite`; a pre-migration backup is in the ignored `backups/` directory.
- Render: `prisma/postgresql/schema.prisma` and its own `migrations` directory use PostgreSQL through `DATABASE_URL`.
- `npm run db:postgres:schema` derives the PostgreSQL schema from the local model definitions. After changing models, generate and review migrations for both providers. Generating the schema alone does not migrate a database.
- `npm run build:render` generates the PostgreSQL client then builds the web app. `npm run start:render` applies PostgreSQL migrations before starting the server. Docker uses these scripts automatically.
- These scripts replace the generated Prisma client in that installation. If you run a Render build on your laptop, run `npm run setup` before returning to SQLite development. Docker builds are isolated and do not replace the laptop client.

## Render web service

1. Connect the Git repository containing Magicpromo.
2. Choose Docker, repository root, and Oregon (the same region as the database).
3. Use the Dockerfile's default command and `/health` as the health-check path.
4. Set `DATABASE_URL` to Render's **Internal Database URL**. Do not add credentials to source control or Docker build arguments.
5. Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `SHOPIFY_APP_URL` for the intended Shopify app. The app URL must be the permanent HTTPS Render service URL. Docker already sets `NODE_ENV=production`, `HOST=0.0.0.0`, and a default port; Render may override `PORT`.
6. Configure Shopify's application URL and authentication redirect URLs to match the hosted service, then deploy the intended Shopify configuration and extensions separately. Keep development and hosted configurations separate so `shopify app dev` does not replace the hosted URL.

Web-service deployment does not publish the Function. Shopify app deployment does not host the web service.

## Existing data

The initial PostgreSQL migration creates empty tables. It does **not** transfer local drafts or session credentials. Keep the SQLite backup until a deliberate, verified data-copy step is complete. Do not recreate linked discounts just to recover missing drafts: preserve the stored Shopify discount IDs if copying data for the same store and app. For a separate Shopify app, its sessions and app-owned discounts must be established independently.

## Learning database

The chosen free Render database shows an expiry of November 11, 2026. Upgrade or export the learning data before expiry if you want to keep it.

## Separate Shopify apps

- `npm run dev` explicitly uses `shopify.app.development.toml` and Magicpromo Dev. The conventional `shopify.app.toml` also targets Dev.
- `npm run deploy` releases the development app only.
- `npm run deploy:production` releases the hosted Magicpromo app using `shopify.app.production.toml`.
- Render keeps the original Magicpromo credentials and PostgreSQL database. Do not replace those with Dev credentials.
- Install Magicpromo Dev by opening the preview from `npm run dev`. It starts with an empty local database; historical sessions and discount links belong to the original app.
- Separate app registrations do not isolate store data. Both apps can affect the same store; use a separate development store for full isolation.
