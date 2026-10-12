import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCart, toMinorUnits } from "../app/lib/cart-preview";
const rules={selectedIds:['a','b','c'],qualificationMode:'distinct_products',minimum:3,percent:15};
const line=(productId:string,quantity=1,variantId=productId)=>({productId,variantId,quantity,unitPrice:650});
test('three repeated bars only qualify for total quantity',()=>{
 assert.equal(evaluateCart([line('a',3)],rules).qualifies,false);
 const result=evaluateCart([line('a',3)],{...rules,qualificationMode:'total_quantity'});
 assert.equal(result.qualifies,true);assert.equal(result.discount,293);assert.equal(result.total,1657);
});
test('variants count as one product, but units add together',()=>{
 const lines=[line('a',1,'50g'),line('a',2,'100g')];
 assert.equal(evaluateCart(lines,rules).count,1);
 assert.equal(evaluateCart(lines,{...rules,qualificationMode:'total_quantity'}).count,3);
});
test('unselected items count toward subtotal only',()=>{
 const result=evaluateCart([line('a'),line('b'),line('c'),line('other',5)],rules);
 assert.equal(result.count,3);assert.equal(result.subtotal,5200);assert.equal(result.discount,294);assert.equal(result.total,4906);
});
test('empty cart, no eligible products and threshold boundary',()=>{
 assert.equal(evaluateCart([],rules).qualifies,false);
 assert.equal(evaluateCart([line('other',5)],rules).discount,0);
 assert.equal(evaluateCart([line('a'),line('b')],rules).missing,1);
 assert.equal(evaluateCart([line('a'),line('b'),line('c')],rules).qualifies,true);
});
test('invalid rules and quantities do not produce totals',()=>{
 for(const value of [0,1.5,101,NaN]) {
 assert.equal(evaluateCart([line('a')],{...rules,minimum:value}).valid,false);
 assert.equal(evaluateCart([line('a')],{...rules,percent:value}).valid,false);
 assert.equal(evaluateCart([line('a',value)],rules).valid,false);
 }
});
test('currency conversion supports zero, two and three decimal places',()=>{
 assert.equal(toMinorUnits('6.50',2),650);
 assert.equal(toMinorUnits('100',0),100);
 assert.equal(toMinorUnits('1.234',3),1234);
 const r=evaluateCart([line('a')],{...rules,minimum:1,percent:100});assert.equal(r.total,0);
});
