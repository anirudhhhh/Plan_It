import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import pg from 'pg';
import { tables, seed } from './seed.js';
let queue=Promise.resolve();let pool;
export const demo=process.env.LOCAL_DEMO==='true'&&process.env.NODE_ENV!=='production';
const path=process.env.DEMO_DATA_FILE||'.local/data.json';
export async function transact(fn) {
 const run=async()=>{
 if(process.env.DATABASE_URL) {
  pool||=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:true}});
  const c=await pool.connect();try {await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(723601)");const state={};
   for(const t of tables)state[t]=(await c.query(`SELECT data FROM public.${t}`)).rows.map(x=>x.data);
   const before=structuredClone(state),result=await fn(state);
   for(const t of tables) {
    const old=new Map(before[t].map(x=>[x.id,JSON.stringify(x)])),next=new Set(state[t].map(x=>x.id));
    for(const row of before[t])if(!next.has(row.id))await c.query(`DELETE FROM public.${t} WHERE id=$1`,[row.id]);
    for(const row of state[t])if(old.get(row.id)!==JSON.stringify(row))await c.query(`INSERT INTO public.${t}(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`,[row.id,JSON.stringify(row)]);
   }await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 if(!demo)throw new Error('Configure DATABASE_URL. Local file persistence requires LOCAL_DEMO=true outside production.');
 let state;try{state=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state=seed();}
 for(const t of tables)state[t]||=[];
 const result=await fn(state);await mkdir(dirname(path),{recursive:true});await writeFile(`${path}.tmp`,JSON.stringify(state,null,2),{mode:0o600});await rename(`${path}.tmp`,path);return result;
 };
 const pending=queue.then(run,run);queue=pending.catch(()=>{});return pending;
}
export async function closeStore(){await pool?.end();}
