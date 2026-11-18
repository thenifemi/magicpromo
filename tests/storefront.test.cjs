const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const result = buildSync({ stdin: { contents: 'export * from "./app/models/storefront.server"; export * from "./app/lib/storefront-settings";', resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false });
const mod = { exports: {} }; new Function('module', 'exports', result.outputFiles[0].text)(mod, mod.exports);
const { storefrontOffers, defaultStorefrontSettings, parseStorefrontSettings } = mod.exports;
const settings = { ...defaultStorefrontSettings, announcement: true, cart: true };
const config = { version: 1, productIds: ['gid://shopify/Product/1'], discountPercent: 20, minimumProducts: 2, qualificationMode: 'total_quantity', storefront: settings };
const node = (status = 'ACTIVE', cfg = config) => ({ automaticDiscount: { status }, metafield: { jsonValue: cfg } });
test('only active published configs with enabled messaging are exposed', async () => {
  const result = await storefrontOffers(async () => Response.json({ data: { nodes: [node(), node('EXPIRED'), node('SCHEDULED'), null, node('ACTIVE', { ...config, storefront: undefined })] } }), ['a', 'b', 'c', 'd', 'e'], ['gid://shopify/Product/1', 'gid://shopify/Product/2']);
  assert.equal(result.length, 1);
  assert.equal(result[0].percent, 20);
  assert.deepEqual(result[0].eligibleProductIds, ['1']);
});
test('collection eligibility uses current membership and ignores old selected products', async () => {
  let calls = 0;
  const result = await storefrontOffers(async (_, { variables }) => {
    if (calls++ === 0) return Response.json({ data: { nodes: [node('ACTIVE', { ...config, collectionIds: ['gid://shopify/Collection/9'] })] } });
    assert.equal(variables.collectionId, 'gid://shopify/Collection/9');
    return Response.json({ data: { nodes: [{ id: 'gid://shopify/Product/1', inCollection: false }, { id: 'gid://shopify/Product/2', inCollection: true }] } });
  }, ['discount'], ['gid://shopify/Product/1', 'gid://shopify/Product/2']);
  assert.deepEqual(result[0].eligibleProductIds, ['2']);
});
test('priority is descending with a stable tie break', async () => {
  const result = await storefrontOffers(async () => Response.json({ data: { nodes: [node(), node('ACTIVE', { ...config, storefront: { ...settings, priority: 10 } }), node()] } }), ['z', 'b', 'a'], []);
  assert.deepEqual(result.map((p) => p.id), ['b', 'a', 'z']);
});
test('verification failures cannot return an apparently active offer', async () => {
  await assert.rejects(storefrontOffers(async () => Response.json({ errors: [{ message: 'unavailable' }] }), ['a'], []));
});
test('settings reject unsafe links and invalid values', () => {
  for (const destination of ['//evil.test', 'javascript:alert(1)', '/collections/x?redirect=evil', '/collections/x/../../admin']) assert.equal(parseStorefrontSettings({ ...settings, destination }), null);
  assert.equal(parseStorefrontSettings({ ...settings, background: 'url(evil)' }), null);
  assert.equal(parseStorefrontSettings({ ...settings, priority: 101 }), null);
  assert.ok(parseStorefrontSettings({ ...settings, destination: '/collections/the-dark-side' }));
});
