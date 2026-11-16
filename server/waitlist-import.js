import {seedId} from './ids.js';
export function prepareLegacy(records,{verifiedConsent=false}={}){
 const rows=[],seen=new Set();const counts={invalid:0,missing_consent:0,duplicate:0};
 for(const raw of records){const email=typeof raw?.email==='string'?raw.email.trim().toLowerCase():'';const timestamp=raw?.consent_at||raw?.signedUpAt;
  if(!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)||email.length>254||!timestamp||Number.isNaN(Date.parse(timestamp))){counts.invalid++;continue;}
  if(raw.consent===false||raw.withdrawn_at||raw.deleted_at||raw.unsubscribed===true){counts.missing_consent++;continue;}
  if(raw.consent!==true&&!raw.consent_at&&!verifiedConsent){counts.missing_consent++;continue;}
  if(seen.has(email)){counts.duplicate++;continue;}seen.add(email);const time=new Date(timestamp).toISOString();
  rows.push({id:seedId('legacy-lead:'+email),name:raw.name||null,email,phone:null,college:raw.college||null,source:'legacy_blob',interest:raw.interest||null,utm:raw.utm||{},rep_code:raw.rep_code||'',consent_at:time,created_at:time,updated_at:time,legacy:{signedUpAt:raw.signedUpAt||null,consent_verified:verifiedConsent}});
 }return {rows,counts};
}
