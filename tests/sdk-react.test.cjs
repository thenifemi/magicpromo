const test = require('node:test');
const assert = require('node:assert/strict');
const { createElement: h } = require('react');
const { renderToString } = require('react-dom/server');

function load(file) {
  const output = require('esbuild').buildSync({
    entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false,
    jsx: 'automatic', external: ['react', 'react-dom'],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', output.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}
const sdk = load('packages/sdk/src/react.tsx');
const offer = {
  id: 'd1', percent: 20, minimum: 2, mode: 'total_quantity', eligibleProductIds: ['1'],
  settings: { announcement: true, product: true, cart: true, message: 'Buy {minimum} {items}, save {percent}%', linkText: 'Shop', destination: '/collections/all', background: '#000000', foreground: '#ffffff', position: 'top', priority: 0 },
};

test('useOffer renders your own element from initial offers, with no flash', () => {
  function MyBadge() {
    const view = sdk.useOffer('product', { productId: 'gid://shopify/Product/1' });
    return view.offer ? h('my-badge', null, view.message) : null;
  }
  const html = renderToString(
    h(sdk.MagicpromoProvider, { initialOffers: [offer], productIds: ['1'] }, h(MyBadge)),
  );
  assert.equal(html, '<my-badge>Buy 2 eligible items, save 20%</my-badge>');
});

test('cart view uses live items for progress and translated templates', () => {
  function CartLine() {
    const view = sdk.useOffer('cart');
    return h('p', null, view.offer ? `${view.message} (${view.progress.remaining})` : 'none');
  }
  const html = renderToString(
    h(sdk.MagicpromoProvider, {
      initialOffers: [offer],
      items: [{ productId: '1', quantity: 1 }],
      templates: { progress: 'Encore {remaining} pour {percent}%', qualified: 'OK' },
    }, h(CartLine)),
  );
  assert.equal(html, '<p>Encore 1 pour 20% (1)</p>');
});

test('hooks explain themselves when used outside the provider', () => {
  function Orphan() { sdk.useOffer('cart'); return null; }
  assert.throws(() => renderToString(h(Orphan)), /inside <MagicpromoProvider>/);
});

test('describeOffer hides product offers for ineligible products', () => {
  assert.deepEqual(sdk.describeOffer([offer], 'product', { productId: '9' }), { offer: undefined });
});

test('ready-made banners share the same rules', () => {
  const html = renderToString(h(sdk.CartProgressBanner, { offers: [offer], items: [{ productId: '1', quantity: 2 }], unstyled: true }));
  assert.match(html, /You qualify for 20% off/);
  assert.match(html, /<progress value="2" max="2"/);
});

test('routeOffers reads { offers } from your server route', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url) => { assert.equal(url, '/api/magicpromo?products=1%2C2'); return Response.json({ offers: [offer] }); };
    assert.deepEqual(await sdk.routeOffers('/api/magicpromo')(['1', '2']), [offer]);
    global.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(sdk.routeOffers('/api/magicpromo')([]), /503/);
  } finally { global.fetch = original; }
});
