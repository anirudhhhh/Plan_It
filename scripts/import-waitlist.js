import {readFile} from 'node:fs/promises';
import {list,get} from '@vercel/blob';
import {prepareLegacy} from '../server/waitlist-import.js';
import {transact,closeStore} from '../server/store.js';
const args=process.argv.slice(2),input=args.includes('--file')?args[args.indexOf('--file')+1]:null;
try{
 let records=[];
 if(input){const data=JSON.parse(await readFile(input,'utf8'));records=Array.isArray(data)?data:[data];}
 else if(args.includes('--blob')){let cursor;do{const page=await list({prefix:'waitlist/',limit:1000,cursor});for(const blob of page.blobs){const result=await get(blob.pathname,{access:'private'});if(!result?.stream||result.blob.size>32768)throw new Error('Invalid legacy record.');records.push(await new Response(result.stream).json());}cursor=page.hasMore?page.cursor:undefined;}while(cursor);}
 else throw new Error('Choose --file or --blob.');
 const prepared=prepareLegacy(records,{verifiedConsent:args.includes('--confirm-legacy-consent')});
 if(!args.includes('--apply'))console.log(JSON.stringify({dry_run:true,eligible:prepared.rows.length,skipped:prepared.counts}));
 else{const result=await transact(s=>{let imported=0,existing=0;for(const row of prepared.rows){if(s.leads.some(l=>l.email?.toLowerCase()===row.email)){existing++;continue;}s.leads.push(row);imported++;}return {imported,existing};});console.log(JSON.stringify({ok:true,...result,skipped:prepared.counts}));}
}catch{console.error(JSON.stringify({ok:false,message:'Import failed. Check the input, Blob access, consent flags and database setup. No personal records or credentials are logged.'}));process.exitCode=1;}finally{await closeStore();}
