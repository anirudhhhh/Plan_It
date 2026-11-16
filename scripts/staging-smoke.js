// Read-only deployment probes. Does not send SMS, add leads or create bookings.
const base=process.env.SMOKE_BASE_URL||process.env.SITE_URL;if(!base)throw new Error('Set SMOKE_BASE_URL or SITE_URL.');
const auth=process.env.SMOKE_USER_ACCESS_TOKEN,ops=process.env.SMOKE_OPS_ACCESS_TOKEN;
const checks=[];async function check(name,path,validate,token){try{const r=await fetch(new URL(path,base),{headers:{...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},signal:AbortSignal.timeout(15000)});const data=await r.text();checks.push({name,ok:r.ok&&await validate(data,r)});}catch{checks.push({name,ok:false});}}
await check('homepage','/',s=>s.includes('PLAN-IT'));
await check('configuration','/api/v1/config',s=>{const c=JSON.parse(s).data;return !c.demo&&!c.setup_required;});
await check('liveness','/health/live',s=>JSON.parse(s).data?.ok===true);
await check('readiness','/health',s=>JSON.parse(s).data?.ok===true);
await check('catalogue','/api/v1/packs',s=>JSON.parse(s).data?.length>=3);
await check('deep link','/packs/rajgir',s=>s.includes('PLAN-IT')&&s.includes('<h1>')&&s.includes('application/ld+json'));
await check('robots','/robots.txt',s=>s.includes('Disallow: /admin'));
if(auth)await check('user session','/api/v1/me',s=>!!JSON.parse(s).data?.user?.id,auth);
if(ops)await check('organiser access','/api/v1/admin/booking-requests',s=>Array.isArray(JSON.parse(s).data),ops);
console.log(JSON.stringify({checks,manual_checks:['Complete Turnstile and submit a consented waitlist entry','Google login on the target hostname','Phone OTP delivery and verification','Priced request, status change, in-app update and cancellation','Review approved partner/price/policy content']},null,2));if(checks.some(c=>!c.ok))process.exitCode=1;
