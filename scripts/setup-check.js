import {inspectConfig} from '../server/config.js';
import {readiness} from '../server/readiness.js';
import {closeDatabase} from '../server/database.js';
const report=inspectConfig();const result={configuration:report,manual_checks:['Supabase phone provider and SMS delivery','Google OAuth redirect allow-list and real sign-in','Supabase CAPTCHA secret and per-number OTP limits','Turnstile widget hostnames and real challenge completion','Approved prices, cancellation terms, support contact and backup restore']};
try{if(process.argv.includes('--online')){
 result.readiness=await readiness();
 if(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY){try{const response=await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:process.env.SUPABASE_ANON_KEY},signal:AbortSignal.timeout(8000)});const data=await response.json();result.auth={reachable:response.ok,phone_enabled:data.external?.phone===true,google_enabled:data.external?.google===true};result.auth.ok=response.ok&&(process.env.AUTH_PHONE_ENABLED==='false'||result.auth.phone_enabled)&&(process.env.AUTH_GOOGLE_ENABLED==='false'||result.auth.google_enabled);}catch{result.auth={reachable:false};}}
 }console.log(JSON.stringify(result,null,2));if(!report.ok||result.readiness?.ok===false||result.auth?.reachable===false||result.auth?.ok===false)process.exitCode=1;
}finally{await closeDatabase();}
