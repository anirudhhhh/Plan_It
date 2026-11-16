import {inspectConfig,localDemo} from './config.js';
import {databasePool} from './database.js';
import {tables} from './seed.js';
export async function readiness(){
 if(localDemo())return {ok:true,mode:'local-demo',checks:{configuration:true,database:true,schema:true}};
 const checks={configuration:inspectConfig().ok,database:false,schema:false,access:false};
 if(process.env.DATABASE_URL)try{const c=await databasePool().connect();try{await c.query('BEGIN READ ONLY');await c.query("SET LOCAL statement_timeout='3000ms'");const r=await c.query('SELECT unnest($1::text[]) AS name, to_regclass(unnest($1::text[])) IS NOT NULL AS installed',[tables.map(t=>'public.'+t)]);checks.database=true;checks.schema=r.rows.every(x=>x.installed);if(checks.schema){const count=await c.query('SELECT count(*)::int AS n FROM public.destinations');checks.schema=count.rows[0].n>=3;const protectedTables=await c.query("SELECT relrowsecurity,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_access,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') AS user_access FROM pg_class WHERE oid=ANY($1::regclass[])",[tables.map(t=>'public.'+t)]);checks.access=protectedTables.rows.length===tables.length&&protectedTables.rows.every(r=>r.relrowsecurity&&!r.anon_access&&!r.user_access);}await c.query('COMMIT');}catch{await c.query('ROLLBACK');}finally{c.release();}}catch{/* Public health output never includes database details or secrets. */}
 return {ok:Object.values(checks).every(Boolean),mode:'production',checks};
}
