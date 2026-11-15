import { z } from 'zod';
export class HttpError extends Error { constructor(status, code, message, details) { super(message); Object.assign(this, {status, code, details}); } }
export const fail = (status, code, message) => { throw new HttpError(status, code, message); };
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s, 'Invalid date');
const money = z.number().int().nonnegative().max(100_000_000);
export const schemas = {
 trip: z.object({name:z.string().trim().min(2).max(100), destination_id:z.uuid(), start_date:day, end_date:day, budget_paise:money, pack_id:z.string().optional()}).refine(v=>v.end_date>=v.start_date,'End date must follow start date'),
 lead: z.object({name:z.string().trim().min(2).max(100),email:z.union([z.email(),z.literal('')]).optional(),phone:z.union([z.string().regex(/^\+?[0-9]{10,15}$/),z.literal('')]).optional(),college:z.string().trim().min(2).max(150), consent:z.literal(true),source:z.string().max(100).default('website'),utm:z.record(z.string(),z.string().max(200)).default({}),rep_code:z.string().max(100).default(''),captcha_token:z.string().max(4096).optional(),website:z.string().max(200).optional()}).refine(v=>v.email||v.phone,'Email or phone required'),
 expense: z.object({amount_paise:money.refine(v=>v>0),payer_id:z.string(),category:z.enum(['stay','ride','food','tickets','other']),note:z.string().trim().min(1).max(300),spent_on:day,mode:z.enum(['equal','percentage','custom']),participants:z.array(z.string()).min(1).max(50),values:z.array(z.number().nonnegative()).optional()}),
 booking: z.object({kind:z.enum(['pack','stay','ride']),ref_id:z.string().min(1),trip_id:z.string().optional(),start_date:day,end_date:day,quantity:z.number().int().min(1).max(50),contact:z.string().trim().min(5).max(150),details:z.object({pickup:z.string().max(200).optional(),drop:z.string().max(200).optional(),time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),journey_type:z.enum(['one_way','return']).default('one_way'),return_date:day.optional(),return_time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),pickup_instructions:z.string().trim().max(500).default(''),passengers:z.number().int().min(1).max(50).optional()}).default({})}).refine(v=>v.end_date>=v.start_date&&(Date.parse(v.end_date)-Date.parse(v.start_date))<=90*86400000,'Bookings support a valid date range of up to 90 days').superRefine((v,ctx)=>{if(v.kind==='ride'&&v.details.journey_type==='return'){if(!v.details.return_date||!v.details.return_time||!v.details.time||`${v.details.return_date}T${v.details.return_time}`<=`${v.start_date}T${v.details.time}`)ctx.addIssue({code:'custom',message:'Return departure must be after the outbound departure.',path:['details','return_date']});if(v.end_date!==v.details.return_date)ctx.addIssue({code:'custom',message:'End date must match the return date.',path:['end_date']});}}),
 price: z.object({category:z.enum(['pack','stay','ride','surcharge']),ref_id:z.string().min(1),unit:z.enum(['per person','per bed per night','per room per night','per unit per night','per trip']),cost_paise:money,margin_type:z.enum(['fixed','percent']),margin_value:z.number().int().nonnegative().max(1_000_000),platform_fee_paise:money,gst_bps:z.number().int().min(0).max(10000),valid_from:day,valid_to:day,min_group:z.number().int().min(1).max(50).default(1),max_group:z.number().int().min(1).max(50).default(50),cancellation_policy_id:z.string(),active:z.boolean().default(true)}).refine(v=>v.valid_to>=v.valid_from&&v.max_group>=v.min_group,'Invalid range'),
 policy:z.object({name:z.string().min(2).max(150),slabs:z.array(z.object({hours_before:z.number().int().nonnegative(),refund_percent:z.number().int().min(0).max(100)})).min(1),processing_charge_paise:money,no_show_charge_paise:money}),
};
export const parse = (schema, value) => { const result=schema.safeParse(value); if(!result.success) throw new HttpError(400,'VALIDATION','Check the form fields.',result.error.flatten()); return result.data; };
export function shares(amount, participants, mode, values) {
 if (!Number.isSafeInteger(amount)||amount<=0||!participants.length||new Set(participants).size!==participants.length) fail(400,'SPLIT','Choose unique participants and a positive amount.');
 const ordered=[...participants].sort(); let result;
 if(mode==='equal') result=ordered.map((user_id,i)=>({user_id,share_paise:Math.floor(amount/ordered.length)+(i<amount%ordered.length?1:0)}));
 else {
  if(!values||values.length!==participants.length||values.some(v=>!Number.isSafeInteger(v)||v<0)) fail(400,'SPLIT','Use whole paise or percentage basis points.');
  const total=values.reduce((a,b)=>a+b,0);
  if(mode==='custom') { if(total!==amount) fail(400,'SPLIT','Custom shares must equal the expense.'); result=participants.map((user_id,i)=>({user_id,share_paise:values[i]})); }
  else { if(mode!=='percentage'||total!==10000) fail(400,'SPLIT','Percentages must add up to 100%.'); result=participants.map((user_id,i)=>({user_id,share_paise:Math.floor(amount*values[i]/10000)})); let left=amount-result.reduce((s,r)=>s+r.share_paise,0); for(const id of ordered) { if(!left) break; result.find(r=>r.user_id===id).share_paise++;left--; } }
 }
 return result;
}
export function balances(state,tripId) {
 const net=Object.fromEntries(state.trip_members.filter(x=>x.trip_id===tripId).map(x=>[x.user_id,0]));
 for(const e of state.expenses.filter(x=>x.trip_id===tripId)) { net[e.payer_id]=(net[e.payer_id]||0)+e.amount_paise; for(const s of state.expense_splits.filter(x=>x.expense_id===e.id)) net[s.user_id]=(net[s.user_id]||0)-s.share_paise; }
 for(const s of state.settlements.filter(x=>x.trip_id===tripId&&x.status==='confirmed')) { net[s.from_user]=(net[s.from_user]||0)+s.amount_paise; net[s.to_user]=(net[s.to_user]||0)-s.amount_paise; }
 const work=Object.entries(net).map(([user_id,amount])=>({user_id,amount}));const transfers=[];
 while(true) {work.sort((a,b)=>a.amount-b.amount||a.user_id.localeCompare(b.user_id));const d=work[0],c=work.at(-1);if(!d||d.amount>=0||c.amount<=0)break;const amount_paise=Math.min(-d.amount,c.amount);transfers.push({from_user:d.user_id,to_user:c.user_id,amount_paise});d.amount+=amount_paise;c.amount-=amount_paise;}
 return {net,transfers};
}
export function sellingPrice(p) { const margin=p.margin_type==='percent'?Math.round(p.cost_paise*p.margin_value/10000):p.margin_value;const subtotal=p.cost_paise+margin;const tax=Math.round((subtotal+p.platform_fee_paise)*p.gst_bps/10000);return {base_paise:subtotal,platform_fee_paise:p.platform_fee_paise,tax_paise:tax,total_paise:subtotal+p.platform_fee_paise+tax}; }
export function quote(state,kind,ref,date,end,quantity) {
 const candidates=state.price_items.filter(p=>p.active&&p.category===kind&&p.ref_id===ref&&p.valid_from<=date&&p.valid_to>=end&&quantity>=p.min_group&&quantity<=p.max_group).sort((a,b)=>b.valid_from.localeCompare(a.valid_from)||b.updated_at.localeCompare(a.updated_at));
 const p=candidates[0];if(!p)return null;
 const policy=state.cancellation_policies.find(x=>x.id===p.cancellation_policy_id);if(!policy) return null;
 const nights=Math.max(1,Math.round((Date.parse(end)-Date.parse(date))/86400000));if(nights>90)fail(400,'DATES','Pilot bookings support up to 90 nights.');
 if(kind==='stay'&&date===end) fail(400,'DATES','Checkout must be after check-in.');
 const room=state.room_types.find(x=>x.id===ref), units=kind==='stay'&&p.unit!=='per bed per night'?Math.ceil(quantity/(room?.capacity||1)):kind==='ride'?1:quantity;
 const multiplier=units*(kind==='stay'?nights:1),base=sellingPrice(p);
 const surcharge=state.price_items.filter(x=>x.active&&x.category==='surcharge'&&x.ref_id===ref&&x.valid_from<=end&&x.valid_to>=date).map(x=>({id:x.id,...sellingPrice(x)}));
 // Surcharges apply only on nights inside the rule, never to an entire stay by accident.
 const additions=surcharge.reduce((sum,x)=>{const rule=state.price_items.find(p=>p.id===x.id);const overlap=kind==='stay'?Math.max(0,Math.ceil((Math.min(Date.parse(end),Date.parse(rule.valid_to)+86400000)-Math.max(Date.parse(date),Date.parse(rule.valid_from)))/86400000)):1;return sum+x.total_paise*units*overlap;},0);
 return {price_item_id:p.id,unit:p.unit,unit_price_paise:base.total_paise,quantity,units,nights:kind==='stay'?nights:undefined,base_paise:base.base_paise*multiplier,platform_fee_paise:base.platform_fee_paise*multiplier,tax_paise:base.tax_paise*multiplier,surcharge_paise:additions,total_paise:base.total_paise*multiplier+additions,cancellation_policy:structuredClone(policy),quoted_at:new Date().toISOString()};
}
export const transitions={Submitted:['In review','Cancelled'],'In review':['Confirmed','Rejected','Cancelled'],Confirmed:['Cancelled','Completed'],Completed:[],Cancelled:[],Rejected:[]};
export function refund(snapshot,paid,start,now=Date.now()) {if(snapshot.legs?.length){let allocated=0;return snapshot.legs.reduce((sum,leg,index)=>{const amount=index===snapshot.legs.length-1?paid-allocated:Math.floor(paid*leg.total_paise/snapshot.total_paise);allocated+=amount;return sum+refund(leg,amount,leg.start_date,now);},0);}const policy=snapshot.cancellation_policy;if(!policy)fail(409,'POLICY','Cancellation policy is missing. Contact ops.');const hours=(Date.parse(`${start}T00:00:00+05:30`)-now)/3600000;const slab=[...policy.slabs].sort((a,b)=>b.hours_before-a.hours_before).find(s=>hours>=s.hours_before);const percent=slab?.refund_percent||0;return Math.max(0,Math.round(paid*percent/100)-policy.processing_charge_paise-(hours<0?policy.no_show_charge_paise:0));}
