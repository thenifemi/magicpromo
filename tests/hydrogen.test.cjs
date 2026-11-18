const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {PrismaClient} = require('@prisma/client');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'magicpromo-hydrogen-'));
function load(file) {
 const output = require('esbuild').buildSync({entryPoints:[file],bundle:true,platform:'node',format:'cjs',external:['@prisma/client'],write:false});
 const mod={exports:{}}; new Function('module','exports','require',output.outputFiles[0].text)(mod,mod.exports,require); return mod.exports;
}
let db, keys;
before(async()=>{
 const database=path.join(temp,'test.sqlite');
 execFileSync('python3',['-c','import sqlite3,pathlib,sys\nc=sqlite3.connect(sys.argv[1])\nfor p in sorted(pathlib.Path(sys.argv[2]).glob("*/migration.sql")): c.executescript(p.read_text())\nc.close()',database,path.resolve('prisma/migrations')]);
 db=new PrismaClient({datasources:{db:{url:'file:'+database}}}); global.prismaGlobal=db;
 keys=load('app/models/hydrogen-key.server.ts');
});
after(async()=>{await db.$disconnect();delete global.prismaGlobal;fs.rmSync(temp,{recursive:true});});
test('keys are hashed, app-scoped, shop-scoped for management, and revocable',async()=>{
 const secret=await keys.createHydrogenKey('one.myshopify.com','dev','Test');
 const row=await keys.authenticateHydrogenKey('Bearer '+secret,'dev');
 assert.equal(row.shop,'one.myshopify.com'); assert.notEqual(row.keyHash,secret); assert.equal(JSON.stringify(row).includes(secret),false);
 assert.equal(await keys.authenticateHydrogenKey('Bearer '+secret,'production'),null);
 assert.equal(await keys.authenticateHydrogenKey('Bearer bad','dev'),null);
 assert.equal((await keys.revokeHydrogenKey('other.myshopify.com','dev',row.id)).count,0);
 await keys.revokeHydrogenKey(row.shop,'dev',row.id);
 assert.equal(await keys.authenticateHydrogenKey('Bearer '+secret,'dev'),null);
});
test('rotation invalidates old key atomically and cannot rotate another shop key',async()=>{
 const old=await keys.createHydrogenKey('two.myshopify.com','dev','Old');
 const row=await keys.authenticateHydrogenKey('Bearer '+old,'dev');
 await assert.rejects(keys.createHydrogenKey('other.myshopify.com','dev','New',row.id));
 assert.ok(await keys.authenticateHydrogenKey('Bearer '+old,'dev'));
 const next=await keys.createHydrogenKey(row.shop,'dev','New',row.id);
 assert.equal(await keys.authenticateHydrogenKey('Bearer '+old,'dev'),null);
 assert.ok(await keys.authenticateHydrogenKey('Bearer '+next,'dev'));
});
test('cart chooses relevant offers while respecting display order and distinct products',()=>{
 const {selectOffer,cartProgress}=load('packages/sdk/src/core.ts');
 const a={id:'a',minimum:3,mode:'distinct_products',eligibleProductIds:['1'],settings:{cart:true,product:true,announcement:true}};
 const b={...a,id:'b',eligibleProductIds:['2']};
 const items=[{productId:'gid://shopify/Product/2',quantity:4},{productId:'2',quantity:1}];
 assert.equal(selectOffer([a,b],'cart',{items}).id,'b');
 assert.equal(selectOffer([a,b],'announcement').id,'a');
 assert.equal(selectOffer([a,b],'product',{productId:'3'}),undefined);
 assert.deepEqual(cartProgress(b,items),{count:1,remaining:2,qualified:false});
 assert.deepEqual(cartProgress({...b,mode:'quantity'},items),{count:5,remaining:0,qualified:true});
});
test('server helper sends credentials only to configured endpoint and rejects redirects/errors',async()=>{
 const {getMagicpromoOffers}=load('packages/sdk/src/server.ts');
 const original=global.fetch;
 try {
  global.fetch=async(url,opts)=>{assert.equal(url.origin,'https://example.test');assert.equal(opts.redirect,'error');assert.equal(opts.headers.Authorization,'Bearer test');return Response.json({version:1,offers:[]});};
  assert.deepEqual(await getMagicpromoOffers({endpoint:'https://example.test/api/v1/offers',apiKey:'test'},['gid://shopify/Product/1']),[]);
  await assert.rejects(getMagicpromoOffers({endpoint:'http://example.test',apiKey:'test'},[]));
  await assert.rejects(getMagicpromoOffers({endpoint:'https://example.test',apiKey:'test'},['bad']));
  global.fetch=async()=>new Response(null,{status:401});
  await assert.rejects(getMagicpromoOffers({endpoint:'https://example.test',apiKey:'test'},[]),/401/);
 } finally {global.fetch=original;}
});
test('endpoint derives shop from authenticated key and validates input before Shopify access',async()=>{
 let authorized=true, calls=0, seenShop;
 const output=require('esbuild').buildSync({entryPoints:['app/routes/api.v1.offers.ts'],bundle:false,platform:'node',format:'cjs',write:false});
 const mod={exports:{}};
 new Function('module','exports','require',output.outputFiles[0].text)(mod,mod.exports,(name)=>{
  if(name.includes('hydrogen-key'))return {authenticateHydrogenKey:async()=>authorized?{id:'key',shop:'trusted.myshopify.com'}:null};
  if(name.includes('published-offers'))return {publishedOffers:async(shop,graphql,ids)=>{seenShop=shop;assert.deepEqual(ids,['42']);return [];}};
  if(name.includes('shopify.server'))return {unauthenticated:{admin:async()=>{calls++;return {admin:{graphql:()=>{}}};}}};
  if(name.includes('db.server'))return {hydrogenKey:{updateMany:async()=>({count:1})}};
  return require(name);
 });
 const call=(query)=>mod.exports.loader({request:new Request('https://app.test/api/v1/offers'+query)});
 authorized=false; assert.equal((await call('')).status,401);assert.equal(calls,0);
 authorized=true; assert.equal((await call('?products=bad')).status,400);assert.equal(calls,0);
 const response=await call('?products=gid://shopify/Product/42&shop=attacker.myshopify.com');
 assert.equal(response.status,200);assert.equal(seenShop,'trusted.myshopify.com');assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{version:1,offers:[]});
});
