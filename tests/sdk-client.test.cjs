const test = require('node:test');
const assert = require('node:assert/strict');

function load(file) {
  const output = require('esbuild').buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', output.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}
const { createMagicpromo } = load('packages/sdk/src/client.ts');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const offer = { id: 'd1', eligibleProductIds: ['1'] };

test('first subscriber loads offers for cart and extra products', async () => {
  let asked;
  const client = createMagicpromo({
    offers: async (ids) => { asked = ids; return [offer]; },
    cart: { read: async () => [{ productId: 'gid://shopify/Product/1', quantity: 2 }] },
    productIds: () => ['7', '1'],
  });
  const states = [];
  client.subscribe((s) => states.push(s));
  await tick();
  assert.deepEqual(asked, ['1', '7']);
  assert.equal(states.at(-1).status, 'ready');
  assert.deepEqual(states.at(-1).offers, [offer]);
});

test('bursts of refreshes coalesce into one extra request', async () => {
  let calls = 0;
  const client = createMagicpromo({ offers: async () => { calls++; await tick(); return []; } });
  client.subscribe(() => {});
  client.refresh();
  client.refresh();
  client.refresh();
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(calls, 2);
});

test('failures clear offers and report the error', async () => {
  const client = createMagicpromo({ offers: async () => { throw new Error('down'); } });
  let state;
  client.subscribe((s) => { state = s; });
  await tick();
  assert.equal(state.status, 'error');
  assert.deepEqual(state.offers, []);
  assert.equal(state.error.message, 'down');
});

test('cart watching starts with the first subscriber and stops with the last', async () => {
  let watching = 0;
  let notify;
  let reads = 0;
  const client = createMagicpromo({
    offers: async () => [],
    cart: {
      read: async () => { reads++; return []; },
      watch: (onChange) => { watching++; notify = onChange; return () => { watching--; }; },
    },
  });
  const a = client.subscribe(() => {});
  const b = client.subscribe(() => {});
  assert.equal(watching, 1);
  await tick();
  notify();
  await tick();
  assert.ok(reads >= 2);
  a();
  assert.equal(watching, 1);
  b();
  assert.equal(watching, 0);
});

test('hidden pages skip work and destroy silences listeners', async () => {
  let visible = false;
  let calls = 0;
  const client = createMagicpromo({ offers: async () => { calls++; return []; }, isVisible: () => visible });
  const states = [];
  client.subscribe((s) => states.push(s));
  await tick();
  assert.equal(calls, 0);
  visible = true;
  client.destroy();
  await client.refresh();
  assert.equal(calls, 0);
  assert.equal(states.length, 0);
});
