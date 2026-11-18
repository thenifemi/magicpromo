const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Loads the built theme asset in a fake DOM and returns one unconnected banner.
function banner(placement) {
  const registry = new Map();
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.style = { setProperty() {} }; this.listeners = {}; }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
  }
  const events = [];
  const window = { Shopify: { routes: { root: '/fr/' } }, fetch() {}, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync('extensions/magicpromo-banner/assets/magicpromo.js', 'utf8'), {
    HTMLElement: Element,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    console: { error() {} },
    customElements: { get: (name) => registry.get(name), define: (name, value) => registry.set(name, value) },
    window,
    document: { createElement: (tag) => new Element(tag), addEventListener() {}, dispatchEvent: (e) => events.push(e) },
  });
  const instance = new (registry.get('magicpromo-banner'))();
  instance.path = '/apps/magicpromo-dev';
  instance.dataset = { placement, product: '1', items: 'eligible items', distinct: 'different eligible products', progress: 'Add {remaining} {items} for {percent}%', qualified: 'Qualifies for {percent}%', close: 'Close' };
  instance.api = window.Magicpromo;
  instance.events = events;
  return instance;
}
const offer = {
  id: 'discount-1', percent: 20, minimum: 2, mode: 'total_quantity', eligibleProductIds: ['1'],
  settings: { announcement: true, product: true, cart: true, message: 'Buy {minimum} {items}: {percent}%', destination: '/collections/dark-side', linkText: 'Shop', background: '#000000', foreground: '#ffffff', position: 'bottom' },
};

test('cart progress counts only eligible quantities and updates after removal', () => {
  const el = banner('cart');
  el.render([offer], [{ productId: '1', quantity: 2 }, { productId: '9', quantity: 20 }]);
  assert.equal(el.children[0].children[0].textContent, 'Qualifies for 20%');
  el.render([offer], [{ productId: '1', quantity: 1 }, { productId: '9', quantity: 20 }]);
  assert.equal(el.children[0].children[0].textContent, 'Add 1 eligible items for 20%');
  assert.equal(el.children[0].children[2].value, 1);
});

test('distinct-product progress does not count duplicate variants or quantities twice', () => {
  const el = banner('cart');
  el.render([{ ...offer, mode: 'distinct_products' }], [{ productId: '1', quantity: 4 }, { productId: '1', quantity: 2 }]);
  assert.equal(el.children[0].children[0].textContent, 'Add 1 different eligible products for 20%');
});

test('ineligible product and withdrawn offers hide existing banners', () => {
  const el = banner('product');
  el.render([offer], []);
  assert.equal(el.hidden, false);
  el.dataset.product = '9';
  el.render([offer], []);
  assert.equal(el.hidden, true);
  el.render([], []);
  assert.equal(el.children.length, 0);
});

test('announcement uses text content, localized links, and remains dismissed after refresh', () => {
  const el = banner('announcement');
  const unsafeText = { ...offer, settings: { ...offer.settings, message: '<img src=x onerror=alert(1)>' } };
  el.render([unsafeText], []);
  assert.equal(el.children[0].children[0].textContent, unsafeText.settings.message);
  assert.equal(el.children[0].children[1].href, '/fr/collections/dark-side');
  el.children[0].children[2].listeners.click();
  el.render([unsafeText], []);
  assert.equal(el.hidden, true);
});

test('cart selects a relevant offer ahead of an unrelated higher-ranked offer', () => {
  const el = banner('cart');
  const unrelated = { ...offer, id: 'unrelated', percent: 10, eligibleProductIds: ['9'] };
  el.render([unrelated, offer], [{ productId: '1', quantity: 1 }]);
  assert.equal(el.children[0].children[0].textContent, 'Add 1 eligible items for 20%');
});
test('multiple matching offers retain display order and empty carts use the first offer', () => {
  const el = banner('cart');
  const first = { ...offer, id: 'first', percent: 10 };
  el.render([first, offer], [{ productId: '1', quantity: 2 }]);
  assert.equal(el.children[0].children[0].textContent, 'Qualifies for 10%');
  el.render([first, offer], []);
  assert.equal(el.children[0].children[0].textContent, 'Add 2 eligible items for 10%');
});
test('cart relevance skips offers disabled for cart; announcement order stays unchanged', () => {
  const disabled = { ...offer, settings: { ...offer.settings, cart: false } };
  const fallback = { ...offer, id: 'fallback', percent: 10, eligibleProductIds: ['9'] };
  const cart = banner('cart');
  cart.render([disabled, fallback], [{ productId: '1', quantity: 1 }]);
  assert.equal(cart.children[0].children[0].textContent, 'Add 2 eligible items for 10%');
  const announcement = banner('announcement');
  announcement.render([fallback, offer], [{ productId: '1', quantity: 1 }]);
  assert.equal(announcement.children[0].children[0].textContent, 'Buy 2 eligible items: 10%');
});

test('setup preview is editor-only and is replaced when an offer becomes available', () => {
  const el = banner('cart');
  const preview = { tag: 'setup-card' };
  el.setupTemplate = { content: { cloneNode: () => preview } };
  el.dataset.designMode = 'true';
  el.render([], []);
  assert.equal(el.hidden, false);
  assert.equal(el.dataset.setup, 'true');
  assert.equal(el.children[0], preview);
  el.render([offer], []);
  assert.equal(el.dataset.setup, undefined);
  assert.notEqual(el.children[0], preview);
  el.dataset.designMode = 'false';
  el.render([], []);
  assert.equal(el.hidden, true);
  assert.equal(el.children.length, 0);
});

test('theme asset is the current build of packages/sdk/src/theme', () => {
  const output = require('esbuild').buildSync({
    absWorkingDir: require('node:path').resolve('packages/sdk'),
    entryPoints: ['src/theme/magicpromo-banner.ts'],
    bundle: true, format: 'iife', target: 'es2020', legalComments: 'none', write: false,
    banner: { js: '// Generated from packages/sdk/src/theme. Do not edit; run pnpm build:theme.' },
  });
  assert.equal(
    fs.readFileSync('extensions/magicpromo-banner/assets/magicpromo.js', 'utf8'),
    output.outputFiles[0].text,
    'Run: pnpm --filter @magicpromo/sdk build:theme',
  );
});

test('installs window.Magicpromo and announces it with magicpromo:ready', () => {
  const el = banner('product');
  assert.equal(typeof el.api.render, 'function');
  assert.equal(el.events[0].type, 'magicpromo:ready');
  assert.equal(el.events[0].detail, el.api);
});

test('custom renderer receives a ready context and its element replaces the default', () => {
  const el = banner('cart');
  let context;
  const undo = el.api.render('cart', (ctx) => { context = ctx; return { tag: 'my-badge' }; });
  el.render([offer], [{ productId: '1', quantity: 1 }]);
  assert.equal(el.children[0].tag, 'my-badge');
  assert.equal(el.hidden, false);
  assert.equal(context.message, 'Add 1 eligible items for 20%');
  assert.deepEqual({ ...context.progress }, { count: 1, remaining: 1, qualified: false });
  assert.equal(context.href, '/fr/collections/dark-side');
  undo();
  el.render([offer], [{ productId: '1', quantity: 1 }]);
  assert.equal(el.children[0].className, 'mp-content');
});

test('renderer strings render as text, null hides, and dismiss sticks', () => {
  const el = banner('product');
  el.api.render('product', () => '<b>20% off</b>');
  el.render([offer], []);
  assert.equal(el.children[0].textContent, '<b>20% off</b>');
  el.api.render('product', () => null);
  el.render([offer], []);
  assert.equal(el.hidden, true);
  el.api.render('product', (ctx) => { ctx.dismiss(); return 'x'; });
  el.render([offer], []);
  el.api.render('product', () => 'back');
  el.render([offer], []);
  assert.equal(el.hidden, true);
});

test('a throwing renderer hides the banner instead of breaking the page', () => {
  const el = banner('product');
  el.api.render('product', () => { throw new Error('boom'); });
  assert.doesNotThrow(() => el.render([offer], []));
  assert.equal(el.hidden, true);
});

test('custom renderers can fall back to the default banner per offer', () => {
  const el = banner('product');
  el.api.render('product', (ctx) => ctx.offer.id === 'other' ? 'custom' : el.api.defaultRenderer(ctx));
  el.render([offer], []);
  assert.equal(el.children[0].className, 'mp-content');
});
