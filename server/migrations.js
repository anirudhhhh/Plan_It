import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {seed,tables} from './seed.js';
export async function migrate(client,{directory=new URL('../db/',import.meta.url)}={}){
 await client.query('BEGIN');try{
  await client.query("SET LOCAL lock_timeout='15000ms'");await client.query('SELECT pg_advisory_xact_lock(723601)');
  await client.query('CREATE TABLE IF NOT EXISTS public.plan_it_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  await client.query('ALTER TABLE public.plan_it_migrations ENABLE ROW LEVEL SECURITY');await client.query('REVOKE ALL ON public.plan_it_migrations FROM anon, authenticated');
  const applied=[];
  for(const name of (await readdir(directory)).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
   const sql=await readFile(new URL(name,directory),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
   const existing=(await client.query('SELECT checksum FROM public.plan_it_migrations WHERE name=$1',[name])).rows[0];
   if(existing){if(existing.checksum!==checksum)throw new Error('An applied migration has changed; add a new migration instead.');continue;}
   await client.query(sql);await client.query('INSERT INTO public.plan_it_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);applied.push(name);
  }
  const data=seed();let inserted=0;
  for(const table of tables)for(const row of data[table]){const result=await client.query(`INSERT INTO public.${table}(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`,[row.id,JSON.stringify(row)]);inserted+=result.rowCount;}
  await client.query('COMMIT');return {applied,inserted};
 }catch(error){await client.query('ROLLBACK');throw error;}
}
