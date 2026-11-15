import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {seed,tables} from './seed.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:true}});const c=await pool.connect();
try{await c.query(await readFile(new URL('../db/001_pilot.sql',import.meta.url),'utf8'));await c.query('BEGIN');const state=seed();for(const t of tables)for(const row of state[t])await c.query(`INSERT INTO public.${t}(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`,[row.id,JSON.stringify(row)]);await c.query('COMMIT');console.log('Migration and unpriced catalogue seed complete.');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
