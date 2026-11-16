import {seedId} from './ids.js';
import { demo } from './store.js';
import { fail } from './domain.js';
const personas={student:{id:'demo-student',name:'Campus explorer',email:'student@local.test',role:'member'},friend:{id:'demo-friend',name:'Travel buddy',email:'friend@local.test',role:'member'},ops:{id:'demo-ops',name:'Organiser ops',email:'ops@local.test',role:'ops'},admin:{id:'demo-admin',name:'Organiser admin',email:'admin@local.test',role:'admin'}};
export async function authenticate(req){
 if(demo) { const p=req.headers['x-demo-user'];if(p&&personas[p])return {...personas[p],id:seedId(personas[p].id),reauth:true}; }
 const token=req.headers.authorization?.replace(/^Bearer /,'');if(!token)return null;
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;if(!url||!key)fail(503,'AUTH_CONFIG','Sign-in is not configured.');
 const result=await fetch(`${url}/auth/v1/user`,{headers:{Authorization:`Bearer ${token}`,apikey:key},signal:AbortSignal.timeout(8000)});if(result.status>=500)fail(503,'AUTH_PROVIDER','Sign-in is temporarily unavailable.');if(!result.ok)fail(401,'AUTH','Sign in again.');
 const user=await result.json();let claims={};try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{}
 return {id:user.id,email:user.email,phone:user.phone,name:user.user_metadata?.full_name||user.email||user.phone,role:'member',reauth:claims.amr?.some(x=>x.method==='otp'&&Date.now()/1000-x.timestamp<300)};
}
export async function captcha(token,ip,hostname){if(demo)return;if(!process.env.TURNSTILE_SECRET)fail(503,'CAPTCHA_CONFIG','Signup is not configured yet.');const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET,response:token||'',remoteip:ip}),signal:AbortSignal.timeout(8000)});const result=await r.json();if(!result.success||(hostname&&result.hostname!==hostname))fail(400,'CAPTCHA','Complete the verification and try again.');}

// Auth redeems the token itself. Never pre-verify an OTP token with Siteverify.
export async function sendPhoneOTP(phone,captchaToken){
 const response=await fetch(`${process.env.SUPABASE_URL}/auth/v1/otp`,{method:'POST',headers:{apikey:process.env.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({phone,channel:'sms',gotrue_meta_security:{captcha_token:captchaToken}}),signal:AbortSignal.timeout(8000)});
 if(response.status===429)fail(429,'OTP_RATE_LIMIT','Too many code requests. Please try later.');
 if(!response.ok)fail(response.status>=500?503:400,'OTP','Unable to send a code. Check your phone number or try later.');
 return {ok:true};
}
