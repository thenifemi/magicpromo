const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const result = buildSync({ entryPoints: ['app/models/theme-setup.server.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const mod = { exports: {} };
new Function('module', 'exports', result.outputFiles[0].text)(mod, mod.exports);
const { themeSetup, themeEditorLinks } = mod.exports;
const dev = '9e6dabfa2ea6894ed70bd75ae6cf22b2';
const data = (value) => ({ data: {
  themes: { nodes: [{ id: 'gid://shopify/OnlineStoreTheme/1', name: 'Live', role: 'MAIN' }, { id: 'gid://shopify/OnlineStoreTheme/2', name: 'Copy', role: 'UNPUBLISHED' }] },
  currentAppInstallation: { id: 'gid://shopify/AppInstallation/3', proxyPath: value ? { value } : null },
} });
test('Dev setup connects only its installation and includes the live theme', async () => {
  let calls = 0;
  const themes = await themeSetup(async (_, input) => {
    if (calls++ === 0) return Response.json(data());
    assert.deepEqual(input.variables.metafields[0], { ownerId: 'gid://shopify/AppInstallation/3', namespace: 'magicpromo', key: 'proxy_path', type: 'single_line_text_field', value: '/apps/magicpromo-dev' });
    return Response.json({ data: { metafieldsSet: { userErrors: [] } } });
  }, dev);
  assert.deepEqual(themes.map((theme) => theme.id), ['1', '2']);
  assert.equal(calls, 2);
});
test('existing matching configuration is not rewritten', async () => {
  let calls = 0;
  await themeSetup(async () => { calls++; return Response.json(data('/apps/magicpromo')); }, 'production');
  assert.equal(calls, 1);
});
test('permission or connection failures do not report setup ready', async () => {
  await assert.rejects(themeSetup(async () => Response.json({ errors: [{ message: 'Denied' }] }), dev));
  let calls = 0;
  await assert.rejects(themeSetup(async () => calls++ === 0 ? Response.json(data()) : Response.json({ data: { metafieldsSet: { userErrors: [{ message: 'Denied' }] } } }), dev));
});
test('editor links select the exact app, theme and placement', () => {
  const links = themeEditorLinks('example.myshopify.com', dev, '2');
  const announcement = new URL(links.announcement);
  assert.equal(announcement.pathname, '/admin/themes/2/editor');
  assert.equal(announcement.searchParams.get('activateAppId'), `${dev}/announcement`);
  const cart = new URL(links.cart);
  assert.equal(cart.searchParams.get('template'), 'cart');
  assert.equal(cart.searchParams.get('target'), 'newAppsSection');
  assert.equal(cart.searchParams.get('addAppBlockId'), `${dev}/offer`);
  assert.equal(new URL(links.product).searchParams.get('target'), 'mainSection');
  assert.equal(themeEditorLinks('evil.test', dev, '2'), null);
  assert.equal(themeEditorLinks('example.myshopify.com', dev, '../../current'), null);
});
test('setup stores the authenticated app handle for its own editor return link', async () => {
  for (const handle of ['magicpromo-dev', 'magicpromo2']) {
    let calls = 0;
    await themeSetup(async (_, input) => {
      if (calls++ === 0) {
        const result = data('/apps/magicpromo');
        result.data.currentAppInstallation.app = { handle };
        return Response.json(result);
      }
      assert.deepEqual(input.variables.metafields, [{ ownerId: 'gid://shopify/AppInstallation/3', namespace: 'magicpromo', key: 'app_handle', type: 'single_line_text_field', value: handle }]);
      return Response.json({ data: { metafieldsSet: { userErrors: [] } } });
    }, 'production');
    assert.equal(calls, 2);
  }
});
