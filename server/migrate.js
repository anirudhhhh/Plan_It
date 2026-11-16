import pg from 'pg';
import {databaseOptions} from './database.js';
import {migrate} from './migrations.js';
const pool=new pg.Pool(databaseOptions(process.env,{migration:true}));let client;
try{client=await pool.connect();const result=await migrate(client);console.log(JSON.stringify({ok:true,...result}));}catch(error){console.error(JSON.stringify({ok:false,code:error.code||'MIGRATION_FAILED',message:'Migration failed. Check connectivity, privileges and migration history. No credentials are logged.'}));process.exitCode=1;}finally{client?.release();await pool.end();}
