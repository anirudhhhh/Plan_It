// Uses a fresh disposable cluster, never the user's running PostgreSQL database.
import {mkdtemp,rm,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir,userInfo} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import {migrate} from '../server/migrations.js';
import {readiness} from '../server/readiness.js';
import {seed, tables} from '../server/seed.js';
const directory=await mkdtemp(join(tmpdir(),'plan-it-postgres-')),cluster=join(directory,'cluster');
const port='55478',user=userInfo().username;
let started=false,pool;
try{
 execFileSync('initdb',['-D',cluster,'-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync('pg_ctl',['-D',cluster,'-l',join(directory,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${directory}`,'-w','start'],{stdio:'pipe'});started=true;
 process.env.DATABASE_URL=`postgresql://${encodeURIComponent(user)}@127.0.0.1:${port}/postgres`;process.env.DATABASE_SSL='false';process.env.LOCAL_DEMO='true';
 pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 await pool.query('CREATE ROLE anon; CREATE ROLE authenticated;');
 const migrationClient=await pool.connect();
 try{const first=await migrate(migrationClient),second=await migrate(migrationClient);assert.equal(first.applied.length,1);assert.equal(second.applied.length,0);assert.equal(second.inserted,0);const bad=join(directory,'bad-migrations');await mkdir(bad);await writeFile(join(bad,'001_pilot.sql'),await readFile(new URL('../db/001_pilot.sql',import.meta.url)));await writeFile(join(bad,'002_broken.sql'),'CREATE TABLE public.migration_must_rollback(id int); SELECT * FROM public.missing_plan_it_table;');await assert.rejects(migrate(migrationClient,{directory:pathToFileURL(bad+'/')}));assert.equal((await migrationClient.query("SELECT to_regclass('public.migration_must_rollback') AS relation")).rows[0].relation,null);}finally{migrationClient.release();}
 const initial=seed();
 const {transact,closeStore}=await import('../server/store.js');
 try{
  assert.equal(await transact(s=>s.packs.length),3);
  const before=await transact(s=>s.packs[0].title);
  await assert.rejects(transact(s=>{s.packs[0].title='Must roll back';throw new Error('intentional rollback');}));
  assert.equal(await transact(s=>s.packs[0].title),before);
  await Promise.all(Array.from({length:5},(_,i)=>transact(s=>s.events.push({id:crypto.randomUUID(),name:'concurrent-test',properties:{i},created_at:new Date().toISOString(),updated_at:new Date().toISOString()}))));
  assert.equal(await transact(s=>s.events.length),5);
  const c=await pool.connect();try{await c.query('SET ROLE authenticated');await assert.rejects(c.query('SELECT * FROM public.users'),e=>e.code==='42501');await c.query('RESET ROLE');await c.query('SET ROLE anon');await assert.rejects(c.query('INSERT INTO public.price_items(id,data) VALUES(gen_random_uuid(),\'{}\')'),e=>e.code==='42501');await c.query('RESET ROLE');}finally{c.release();}
  const {api}=await import('../server/api.js');const req={url:'/api/v1/trips',method:'POST',headers:{'x-demo-user':'student',host:'localhost'},body:{name:'PostgreSQL trip',destination_id:initial.destinations[0].id,start_date:'2027-01-01',end_date:'2027-01-02',budget_paise:10000},socket:{remoteAddress:'test'}};
  const trip=await api(req);const persisted=await pool.query('SELECT data FROM public.trips WHERE id=$1',[trip.id]);assert.equal(persisted.rows[0].data.name,'PostgreSQL trip');
  const row=await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.price_items'::regclass");assert.equal(row.rows[0].relrowsecurity,true);
  Object.assign(process.env,{LOCAL_DEMO:'false',SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_public',TURNSTILE_SITE_KEY:'0xreal-site-key',TURNSTILE_SECRET:'test-secret',SITE_URL:'https://plan-it.example.org'});assert.equal((await readiness()).ok,true);await pool.query('GRANT SELECT ON public.users TO anon');assert.equal((await readiness()).checks.access,false);await pool.query('REVOKE SELECT ON public.users FROM anon');
  console.log('PostgreSQL integration passed: idempotent tracked migrations, readiness and RLS grant checks, migration, seed, atomic rollback, concurrent writes, browser-role isolation, UUIDs and persisted API trip.');
 }finally{await closeStore();}
}finally{await pool?.end();if(started)execFileSync('pg_ctl',['-D',cluster,'-m','fast','-w','stop'],{stdio:'pipe'});await rm(directory,{recursive:true,force:true});}
