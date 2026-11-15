import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='production';process.env.LOCAL_DEMO='true';delete process.env.DATABASE_URL;
const {authenticate}=await import('../server/auth.js');
const {transact,demo}=await import('../server/store.js');
test('production ignores local persona headers even when LOCAL_DEMO is set',async()=>{assert.equal(demo,false);assert.equal(await authenticate({headers:{'x-demo-user':'admin'}}),null);});
test('production cannot silently fall back to a local file store',async()=>{await assert.rejects(transact(()=>({ok:true})),/Configure DATABASE_URL/);});
