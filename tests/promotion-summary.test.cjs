const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const { readDiscountSummaries } = (() => {
  const result = buildSync({ entryPoints: ['app/models/promotion-summary.server.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
  const compiled = { exports: {} };
  new Function('module', 'exports', result.outputFiles[0].text)(compiled, compiled.exports);
  return compiled.exports;
})();
const response = (nodes) => Response.json({ data: { nodes } });

test('deduplicates IDs and preserves zero versus missing usage', async () => {
  let calls = 0;
  const counts = await readDiscountSummaries(async (_, { variables }) => {
    calls++;
    assert.deepEqual(variables.ids, ['a', 'b', 'c', 'd']);
    return response([{ discount: { asyncUsageCount: 12 } }, { discount: { asyncUsageCount: 0 } }, null, { discount: {} }]);
  }, ['a', 'b', 'a', 'c', 'd']);
  assert.equal(calls, 1);
  assert.deepEqual([...counts.values()].map((item) => item.usageCount), [12, 0, null, null]);
});
test('no Shopify request for an empty list', async () => {
  assert.equal((await readDiscountSummaries(() => assert.fail('unexpected request'), [])).size, 0);
});
test('network, HTTP and GraphQL failures remain unavailable', async () => {
  for (const graphql of [
    async () => { throw new Error('offline'); },
    async () => Response.json({}, { status: 500 }),
    async () => Response.json({ errors: [{ message: 'denied' }], data: { nodes: [{ discount: { asyncUsageCount: 2 } }] } }),
  ]) {
    assert.deepEqual((await readDiscountSummaries(graphql, ['a'])).get('a'), { usageCount: null, status: 'UNKNOWN' });
  }
});
test('chunks at 250 and preserves successful batches after another fails', async () => {
  let calls = 0;
  const ids = Array.from({ length: 251 }, (_, i) => String(i));
  const counts = await readDiscountSummaries(async (_, { variables }) => {
    calls++;
    assert.ok(variables.ids.length <= 250);
    if (calls === 1) throw new Error('temporary failure');
    return response([{ discount: { asyncUsageCount: 7 } }]);
  }, ids);
  assert.equal(calls, 2);
  assert.equal(counts.get('0').usageCount, null);
  assert.equal(counts.get('250').usageCount, 7);
});

// Automatic discount IDs resolve to this concrete node type through nodes().
test('reads automatic discount nodes, including zero usage', async () => {
  const counts = await readDiscountSummaries(async (query) => {
    assert.match(query, /\.\.\. on DiscountAutomaticNode\s*\{\s*automaticDiscount/);
    return response([
      { automaticDiscount: { asyncUsageCount: 9 } },
      { automaticDiscount: { asyncUsageCount: 0 } },
    ]);
  }, ['gid://shopify/DiscountAutomaticNode/1', 'gid://shopify/DiscountAutomaticNode/2']);
  assert.deepEqual([...counts.values()].map((item) => item.usageCount), [9, 0]);
});

test('returns Shopify lifecycle statuses and distinguishes missing from failed lookups', async () => {
  const result = await readDiscountSummaries(async () => response([
    { automaticDiscount: { asyncUsageCount: 3, status: 'ACTIVE' } },
    { automaticDiscount: { asyncUsageCount: 4, status: 'EXPIRED' } },
    { discount: { asyncUsageCount: 0, status: 'SCHEDULED' } },
    null,
  ]), ['active', 'expired', 'scheduled', 'missing']);
  assert.deepEqual([...result.values()].map((item) => item.status), ['ACTIVE', 'EXPIRED', 'SCHEDULED', 'MISSING']);
  assert.equal(result.get('expired').usageCount, 4);
});
