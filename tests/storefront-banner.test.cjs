const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function banner(placement) {
  const registry = new Map();
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.style = { setProperty() {} }; this.listeners = {}; }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
  }
  vm.runInNewContext(fs.readFileSync('extensions/magicpromo-banner/assets/magicpromo.js', 'utf8'), {
    HTMLElement: Element,
    customElements: { get: (name) => registry.get(name), define: (name, value) => registry.set(name, value) },
    window: { Shopify: { routes: { root: '/fr/' } }, fetch() {}, addEventListener() {} },
    document: { createElement: (tag) => new Element(tag), addEventListener() {} },
  });
  const instance = new (registry.get('magicpromo-banner'))();
  instance.group = { path: '/apps/magicpromo-dev' };
  instance.dataset = { placement, product: '1', items: 'eligible items', distinct: 'different eligible products', progress: 'Add {remaining} {items} for {percent}%', qualified: 'Qualifies for {percent}%', close: 'Close' };
  return instance;
}
const offer = {
  id: 'discount-1', percent: 20, minimum: 2, mode: 'total_quantity', eligibleProductIds: ['1'],
  settings: { announcement: true, product: true, cart: true, message: 'Buy {minimum} {items}: {percent}%', destination: '/collections/dark-side', linkText: 'Shop', background: '#000000', foreground: '#ffffff', position: 'bottom' },
};

test('cart progress counts only eligible quantities and updates after removal', () => {
  const el = banner('cart');
  el.render([offer], { items: [{ product_id: 1, quantity: 2 }, { product_id: 9, quantity: 20 }] });
  assert.equal(el.children[0].children[0].textContent, 'Qualifies for 20%');
  el.render([offer], { items: [{ product_id: 1, quantity: 1 }, { product_id: 9, quantity: 20 }] });
  assert.equal(el.children[0].children[0].textContent, 'Add 1 eligible items for 20%');
  assert.equal(el.children[0].children[2].value, 1);
});

test('distinct-product progress does not count duplicate variants or quantities twice', () => {
  const el = banner('cart');
  el.render([{ ...offer, mode: 'distinct_products' }], { items: [{ product_id: 1, quantity: 4 }, { product_id: 1, quantity: 2 }] });
  assert.equal(el.children[0].children[0].textContent, 'Add 1 different eligible products for 20%');
});

test('ineligible product and withdrawn offers hide existing banners', () => {
  const el = banner('product');
  el.render([offer], { items: [] });
  assert.equal(el.hidden, false);
  el.dataset.product = '9';
  el.render([offer], { items: [] });
  assert.equal(el.hidden, true);
  el.render([], { items: [] });
  assert.equal(el.children.length, 0);
});

test('announcement uses text content, localized links, and remains dismissed after refresh', () => {
  const el = banner('announcement');
  const unsafeText = { ...offer, settings: { ...offer.settings, message: '<img src=x onerror=alert(1)>' } };
  el.render([unsafeText], { items: [] });
  assert.equal(el.children[0].children[0].textContent, unsafeText.settings.message);
  assert.equal(el.children[0].children[1].href, '/fr/collections/dark-side');
  el.children[0].children[2].listeners.click();
  el.render([unsafeText], { items: [] });
  assert.equal(el.hidden, true);
});

test('cart selects a relevant offer ahead of an unrelated higher-ranked offer', () => {
  const el = banner('cart');
  const unrelated = { ...offer, id: 'unrelated', percent: 10, eligibleProductIds: ['9'] };
  el.render([unrelated, offer], { items: [{ product_id: 1, quantity: 1 }] });
  assert.equal(el.children[0].children[0].textContent, 'Add 1 eligible items for 20%');
});
test('multiple matching offers retain display order and empty carts use the first offer', () => {
  const el = banner('cart');
  const first = { ...offer, id: 'first', percent: 10 };
  el.render([first, offer], { items: [{ product_id: 1, quantity: 2 }] });
  assert.equal(el.children[0].children[0].textContent, 'Qualifies for 10%');
  el.render([first, offer], { items: [] });
  assert.equal(el.children[0].children[0].textContent, 'Add 2 eligible items for 10%');
});
test('cart relevance skips offers disabled for cart; announcement order stays unchanged', () => {
  const disabled = { ...offer, settings: { ...offer.settings, cart: false } };
  const fallback = { ...offer, id: 'fallback', percent: 10, eligibleProductIds: ['9'] };
  const cart = banner('cart');
  cart.render([disabled, fallback], { items: [{ product_id: 1, quantity: 1 }] });
  assert.equal(cart.children[0].children[0].textContent, 'Add 2 eligible items for 10%');
  const announcement = banner('announcement');
  announcement.render([fallback, offer], { items: [{ product_id: 1, quantity: 1 }] });
  assert.equal(announcement.children[0].children[0].textContent, 'Buy 2 eligible items: 10%');
});

test('setup preview is editor-only and is replaced when an offer becomes available', () => {
  const el = banner('cart');
  const preview = { tag: 'setup-card' };
  el.setupTemplate = { content: { cloneNode: () => preview } };
  el.dataset.designMode = 'true';
  el.render([], { items: [] });
  assert.equal(el.hidden, false);
  assert.equal(el.dataset.setup, 'true');
  assert.equal(el.children[0], preview);
  el.render([offer], { items: [] });
  assert.equal(el.dataset.setup, undefined);
  assert.notEqual(el.children[0], preview);
  el.dataset.designMode = 'false';
  el.render([], { items: [] });
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
