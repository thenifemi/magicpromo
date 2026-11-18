const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "magicpromo-activation-"));
let db, activatePromotion, deactivatePromotion, draftFingerprint, saveDraft;
before(async () => {
  const database = path.join(temp, "test.sqlite");
  execFileSync("python3", [
    "-c",
    'import sqlite3,pathlib,sys\nc=sqlite3.connect(sys.argv[1])\nfor p in sorted(pathlib.Path(sys.argv[2]).glob("*/migration.sql")): c.executescript(p.read_text())\nc.close()',
    database,
    path.join(root, "prisma/migrations"),
  ]);
  db = new PrismaClient({ datasources: { db: { url: "file:" + database } } });
  global.prismaGlobal = db;
  await require("esbuild").build({
    stdin: {
      contents: 'export * from "./app/models/promotion-activation.server"; export {saveDraft} from "./app/models/promotion-draft.server";',
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(temp, "activation.cjs"),
    plugins: [
      {
        name: "prisma",
        setup(build) {
          build.onResolve({ filter: /^@prisma\/client$/ }, () => ({
            path: require.resolve("@prisma/client"),
            external: true,
          }));
        },
      },
    ],
  });
  ({ activatePromotion, deactivatePromotion, draftFingerprint, saveDraft } = require(
    path.join(temp, "activation.cjs"),
  ));
});
after(async () => {
  await db?.$disconnect();
  delete global.prismaGlobal;
  fs.rmSync(temp, { recursive: true, force: true });
});
beforeEach(async () => {
  await db.promotionDraftProduct.deleteMany();
  await db.promotionDraft.deleteMany();
});
async function draft(extra = {}) {
  return db.promotionDraft.create({
    data: {
      shop: "test.myshopify.com",
      name: "Explorer",
      minimumProducts: 1,
      products: { create: [{ productId: "gid://shopify/Product/1" }] },
      ...extra,
    },
    include: { products: true },
  });
}
const response = (data) => new Response(JSON.stringify({ data }));
function gateway(options = {}) {
  const calls = [];
  const graphql = async (query, args) => {
    calls.push({ query, variables: args.variables });
    if (query.includes("MagicpromoActivationAccess"))
      return response({
        currentAppInstallation: {
          accessScopes: options.noScope ? [] : [{ handle: "write_discounts" }],
        },
        nodes: options.deletedProduct
          ? [null]
          : [{ id: "gid://shopify/Product/1" }],
      });
    if (query.includes("query MagicpromoDiscount"))
      return response({
        automaticDiscountNode: options.deletedDiscount
          ? null
          : {
              metafield: { id: "gid://shopify/Metafield/5" },
              automaticDiscount: { status: "ACTIVE" },
            },
      });
    if (options.mutation) return options.mutation(query, args);
    const key = query.includes("mutation UpdateMagicpromo")
      ? "discountAutomaticAppUpdate"
      : "discountAutomaticAppCreate";
    return response({
      [key]: {
        automaticAppDiscount: options.reject
          ? null
          : { discountId: "gid://shopify/DiscountAutomaticNode/9" },
        userErrors: options.reject ? [{ message: "Function not found" }] : [],
      },
    });
  };
  return { graphql, calls };
}
const activate = (g, d, shop = "test.myshopify.com") =>
  activatePromotion(g.graphql, shop, d.id, d.updatedAt.toISOString());
test("creates and persists exact saved configuration; subsequent request updates existing ID", async () => {
  const d = await draft();
  const g = gateway();
  assert.deepEqual(await activate(g, d), { success: true });
  const input = g.calls.at(-1).variables.input;
  assert.equal(input.functionHandle, "magicpromo-discount");
  assert.deepEqual(input.discountClasses, ["PRODUCT"]);
  assert.deepEqual(input.combinesWith, {
    orderDiscounts: false,
    productDiscounts: false,
    shippingDiscounts: false,
  });
  assert.equal(input.metafields[0].namespace, "$app:magicpromo");
  assert.equal(JSON.parse(input.metafields[0].value).discountPercent, 15);
  const saved = await db.promotionDraft.findUnique({
    where: { id: d.id },
    include: { products: true },
  });
  assert.equal(
    saved.shopifyDiscountId,
    "gid://shopify/DiscountAutomaticNode/9",
  );
  assert.equal(saved.activationToken, null);
  assert.equal(saved.publishedFingerprint, draftFingerprint(saved));
  assert.deepEqual(await activate(g, saved), { success: true });
  assert.equal(g.calls.at(-1).variables.id, saved.shopifyDiscountId);
  assert.equal(
    g.calls.at(-1).variables.input.metafields[0].id,
    "gid://shopify/Metafield/5",
  );
  assert.equal(
    g.calls.filter((c) => c.query.includes("mutation ActivateMagicpromo"))
      .length,
    1,
  );
});
test("rejects cross-shop and stale requests without API calls", async () => {
  const d = await draft();
  const g = gateway();
  assert.match((await activate(g, d, "other")).error, /not found/);
  assert.match(
    (await activatePromotion(g.graphql, d.shop, d.id, "stale")).error,
    /changed/,
  );
  assert.equal(g.calls.length, 0);
});
for (const [name, option] of [
  ["missing permission", "noScope"],
  ["deleted product", "deletedProduct"],
  ["deleted discount", "deletedDiscount"],
])
  test(name + " blocks mutation", async () => {
    const d = await draft(
      option === "deletedDiscount"
        ? { shopifyDiscountId: "gid://shopify/DiscountAutomaticNode/9" }
        : {},
    );
    const g = gateway({ [option]: true });
    assert.ok((await activate(g, d)).error);
    assert.equal(g.calls.filter((c) => c.query.includes("mutation")).length, 0);
  });
test("impossible distinct-product threshold cannot activate", async () => {
  const d = await draft({ minimumProducts: 3 });
  const g = gateway();
  assert.ok((await activate(g, d)).error);
  assert.equal(g.calls.length, 0);
});
test("definite Shopify rejection releases lock for correction", async () => {
  const d = await draft();
  assert.match(
    (await activate(gateway({ reject: true }), d)).error,
    /Function not found/,
  );
  assert.equal(
    (await db.promotionDraft.findUnique({ where: { id: d.id } }))
      .activationToken,
    null,
  );
});
test("lost response keeps durable lock and blocks retry", async () => {
  const d = await draft();
  const g = gateway({
    mutation: () => {
      throw Error("Simulated network loss");
    },
  });
  assert.match((await activate(g, d)).error, /may have received/);
  const saved = await db.promotionDraft.findUnique({ where: { id: d.id } });
  assert.ok(saved.activationToken);
  const other = gateway();
  assert.ok((await activate(other, saved)).error);
  assert.equal(other.calls.length, 0);
});
test("concurrent submissions send only one mutation", async () => {
  const d = await draft();
  const g = gateway();
  const results = await Promise.all([activate(g, d), activate(g, d)]);
  assert.equal(results.filter((r) => r.success).length, 1);
  assert.equal(g.calls.filter((c) => c.query.includes("mutation")).length, 1);
});
test("saved edits leave the published fingerprint unchanged until update", async () => {
  const d = await draft();
  const g = gateway();
  await activate(g, d);
  await db.promotionDraft.update({
    where: { id: d.id },
    data: { discountPercent: 20 },
  });
  const edited = await db.promotionDraft.findUnique({
    where: { id: d.id },
    include: { products: true },
  });
  assert.notEqual(edited.publishedFingerprint, draftFingerprint(edited));
  await activate(g, edited);
  assert.equal(
    JSON.parse(g.calls.at(-1).variables.input.metafields[0].value)
      .discountPercent,
    20,
  );
});

const linkedDraft = () => draft({ shopifyDiscountId: "gid://shopify/DiscountAutomaticNode/9", publishedFingerprint: "saved-rules" });
const deactivate = (g, d, shop = d.shop) => deactivatePromotion(g, shop, d.id, d.updatedAt.toISOString());
const deactivated = () => response({ discountAutomaticDeactivate: { automaticDiscountNode: { id: "gid://shopify/DiscountAutomaticNode/9", automaticDiscount: { status: "EXPIRED" } }, userErrors: [] } });
test("deactivation preserves discount link and rules; reactivation updates that ID", async () => {
 const d = await linkedDraft(); let calls = 0;
 assert.deepEqual(await deactivate(async (query, args) => { calls++; assert.match(query, /DeactivateMagicpromo/); assert.equal(args.variables.id, d.shopifyDiscountId); return deactivated(); }, d), { success: true });
 const saved = await db.promotionDraft.findUnique({ where: { id: d.id }, include: { products: true } });
 assert.equal(calls, 1); assert.equal(saved.activationToken, null); assert.equal(saved.shopifyDiscountId, d.shopifyDiscountId); assert.equal(saved.publishedFingerprint, "saved-rules"); assert.equal(saved.products.length, 1);
 const g = gateway(); assert.deepEqual(await activate(g, saved), { success: true }); assert.match(g.calls.at(-1).query, /UpdateMagicpromo/);
});
test("deactivation rejects cross-shop, unlinked and stale requests without contacting Shopify", async () => {
 const d = await draft(); const noCall = () => { throw Error("Should not call Shopify"); };
 assert.ok((await deactivate(noCall, d, "other-shop")).error); assert.ok((await deactivate(noCall, d)).error);
 const linked = await linkedDraft(); assert.ok((await deactivatePromotion(noCall, linked.shop, linked.id, "stale")).error);
});
test("deactivation and activation cannot race", async () => {
 const d = await linkedDraft(); let release; let entered;
 const started = new Promise(resolve => { entered = resolve; });
 const running = deactivate(async () => { entered(); await new Promise(resolve => { release = resolve; }); return deactivated(); }, d);
 await started; const g = gateway(); assert.ok((await activate(g, d)).error); assert.equal(g.calls.length, 0); release(); assert.deepEqual(await running, {success:true});
});
test("deactivation rejection releases lock and reports Shopify error", async () => {
 const d = await linkedDraft(); const result = await deactivate(async () => response({discountAutomaticDeactivate:{automaticDiscountNode:null,userErrors:[{message:"Permission denied"}]}}), d);
 assert.match(result.error, /Permission denied/); assert.equal((await db.promotionDraft.findUnique({where:{id:d.id}})).activationToken,null);
});
test("uncertain deactivation keeps lock and never claims success", async () => {
 const d = await linkedDraft(); const result = await deactivate(async () => { throw Error("Simulated lost response"); }, d);
 assert.ok(result.error); assert.ok((await db.promotionDraft.findUnique({where:{id:d.id}})).activationToken);
});

test("combination choices persist, publish, and can all be disabled again", async () => {
  let previous = null;
  const fingerprints = new Set();
  for (const mask of [0, 1, 2, 3, 4, 5, 6, 7, 0]) {
    const settings = {
      combineProductDiscounts: !!(mask & 1),
      combineOrderDiscounts: !!(mask & 2),
      combineShippingDiscounts: !!(mask & 4),
    };
    const saved = await saveDraft({
      shop: "test.myshopify.com", id: previous?.id ?? null,
      name: "Combinations", productIds: ["gid://shopify/Product/1"],
      discountPercent: 15, minimumProducts: 1,
      qualificationMode: "distinct_products", ...settings,
    });
    const d = await db.promotionDraft.findUnique({where: {id: saved.id}, include: {products: true}});
    for (const [key, value] of Object.entries(settings)) assert.equal(d[key], value);
    const fingerprint = draftFingerprint(d);
    if (previous) assert.notEqual(fingerprint, d.publishedFingerprint);
    fingerprints.add(fingerprint);
    const g = gateway();
    assert.deepEqual(await activate(g, d), {success: true});
    assert.deepEqual(g.calls.at(-1).variables.input.combinesWith, {
      productDiscounts: settings.combineProductDiscounts,
      orderDiscounts: settings.combineOrderDiscounts,
      shippingDiscounts: settings.combineShippingDiscounts,
    });
    previous = d;
  }
  assert.equal(fingerprints.size, 8);
});

test("default combination settings preserve existing published fingerprints", async () => {
  const d = await draft();
  const original = require("node:crypto").createHash("sha256").update(JSON.stringify({
    name: d.name, version: 1, productIds: d.products.map(p => p.productId).sort(),
    discountPercent: d.discountPercent, minimumProducts: d.minimumProducts,
    qualificationMode: d.qualificationMode,
  })).digest("hex");
  assert.equal(draftFingerprint(d), original);
});

test("Dev app prefixes Shopify titles on create and update without renaming the draft", async () => {
  const original = process.env.SHOPIFY_API_KEY;
  try {
    process.env.SHOPIFY_API_KEY = '9e6dabfa2ea6894ed70bd75ae6cf22b2';
    const d = await draft();
    const g = gateway();
    assert.deepEqual(await activate(g, d), { success: true });
    assert.equal(g.calls.at(-1).variables.input.title, '[DEV] Explorer');
    const saved = await db.promotionDraft.findUnique({ where: { id: d.id } });
    assert.equal(saved.name, 'Explorer');
    assert.deepEqual(await activate(g, saved), { success: true });
    assert.equal(g.calls.at(-1).variables.input.title, '[DEV] Explorer');
    process.env.SHOPIFY_API_KEY = 'e306339e4e0012ba5f3d1a42607324d4';
    const latest = await db.promotionDraft.findUnique({ where: { id: d.id } });
    assert.deepEqual(await activate(g, latest), { success: true });
    assert.equal(g.calls.at(-1).variables.input.title, 'Explorer');
  } finally {
    if (original === undefined) delete process.env.SHOPIFY_API_KEY;
    else process.env.SHOPIFY_API_KEY = original;
  }
});

test("collection eligibility publishes the collection ID rather than a product snapshot", async () => {
  const collectionId = "gid://shopify/Collection/9";
  const d = await draft({ collectionId, collectionTitle: "Dark Side", minimumProducts: 2, qualificationMode: "total_quantity" });
  let input;
  const result = await activatePromotion(async (query, options) => {
    if (query.includes("MagicpromoActivationAccess")) return Response.json({ data: { currentAppInstallation: { accessScopes: [{ handle: "write_discounts" }] }, nodes: [{ id: collectionId }] } });
    input = options.variables.input;
    return Response.json({ data: { discountAutomaticAppCreate: { automaticAppDiscount: { discountId: "gid://shopify/DiscountAutomaticNode/9" }, userErrors: [] } } });
  }, d.shop, d.id, d.updatedAt.toISOString());
  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(input.metafields[0].value).collectionIds, [collectionId]);
});
test("messaging changes affect publishing fingerprint and publish with saved rules", async () => {
  const d = await draft();
  const original = await db.promotionDraft.findUnique({ where: { id: d.id }, include: { products: true } });
  const changed = { ...original, storefrontSettings: JSON.stringify({ announcement: true }) };
  assert.notEqual(draftFingerprint(original), draftFingerprint(changed));
});
