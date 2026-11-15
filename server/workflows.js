import {z} from 'zod';
import {fail,HttpError,parse,schemas,quote,balances} from './domain.js';

export function bookingQuote(s,d){
 const outbound=quote(s,d.kind,d.ref_id,d.start_date,d.kind==='ride'?d.start_date:d.end_date,d.quantity);
 if(d.kind!=='ride'||d.details.journey_type!=='return')return outbound;
 const route=s.ride_routes.find(r=>r.id===d.ref_id),reverse=route&&s.ride_routes.find(r=>r.active&&r.from_label===route.to_label&&r.to_label===route.from_label&&r.vehicle_type===route.vehicle_type&&r.capacity>=d.quantity);
 const inbound=reverse?quote(s,'ride',reverse.id,d.details.return_date,d.details.return_date,d.quantity):null;
 if(!outbound||!inbound)return null;
 const result={...outbound,unit:'round trip',unit_price_paise:outbound.total_paise+inbound.total_paise,legs:[{direction:'outbound',route_id:route.id,start_date:d.start_date,...outbound},{direction:'return',route_id:reverse.id,start_date:d.details.return_date,...inbound}]};
 for(const k of ['base_paise','platform_fee_paise','tax_paise','surcharge_paise','total_paise'])result[k]=outbound[k]+inbound[k];
 return result;
}
export function validateBooking(s,d,find,member,u){
 if(d.start_date<new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}))fail(400,'DATE','Choose a future trip date.');
 if(d.trip_id)member(s,find(s,'trips',d.trip_id),u);
 let item;
 if(d.kind==='pack'){item=find(s,'packs',d.ref_id);if(d.quantity<item.min_group||d.quantity>item.max_group)fail(400,'GROUP','Group size is outside this pack’s range.');}
 if(d.kind==='stay'){const room=find(s,'room_types',d.ref_id);if(room.active===false)fail(409,'UNPUBLISHED','This room is not published.');item=find(s,'stays',room.stay_id);}
 if(d.kind==='ride'){item=find(s,'ride_routes',d.ref_id);if(d.quantity>item.capacity)fail(400,'CAPACITY','This vehicle is too small.');if(!d.details.time||!d.details.pickup||!d.details.drop)fail(400,'RIDE','Pickup, drop and departure time are required.');if(d.details.pickup!==item.from_label||d.details.drop!==item.to_label)fail(400,'ROUTE','The selected route does not match the pickup and drop.');}
 if(!item.active)fail(409,'UNPUBLISHED','This partner listing is not published.');
 return item;
}
export function workflowRoutes(ctx,h){
 const {s,u,path,method,body}=ctx,{need,member,owner,find,add,audit,notify,notifyOps,bookingView,syncBooking,stamp}=h;
 if(path==='/notifications'&&method==='GET'){need(u);return s.notifications.filter(n=>(n.user_id===u.id||n.audience==='ops'&&['ops','admin'].includes(u.role))).map(n=>({...n,read_at:n.audience==='ops'?n.read_by?.[u.id]||null:n.read_at})).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100);}
 const notice=path.match(/^\/notifications\/([^/]+)\/read$/);
 if(notice&&method==='POST'){need(u);const n=find(s,'notifications',notice[1]);if(n.user_id!==u.id&&!(n.audience==='ops'&&['ops','admin'].includes(u.role)))fail(403,'PRIVATE','This notification belongs to another account.');if(n.audience==='ops'){n.read_by||={};n.read_by[u.id]=stamp();}else n.read_at=stamp();return {ok:true};}
 const tripMatch=path.match(/^\/trips\/([^/]+)(?:\/(leave|ownership|items\/[^/]+))?$/);
 if(tripMatch&&['PATCH','POST','DELETE'].includes(method)){
  const trip=find(s,'trips',tripMatch[1]),action=tripMatch[2];member(s,trip,u);
  if(!action&&method==='PATCH'){
   owner(trip,u);if(body.expected_revision!==(trip.revision||1))fail(409,'STALE','This trip changed. Reload before saving.');
   const d=parse(schemas.trip,{...trip,...body,destination_id:trip.destination_id,pack_id:trip.pack_id});
   const before=structuredClone(trip);Object.assign(trip,d,{revision:(trip.revision||1)+1,updated_at:stamp()});
   // Day labels are derived from the new start date; bookings keep their own dates.
   for(const b of s.booking_requests.filter(b=>b.trip_id===trip.id))syncBooking(s,b);
   audit(s,u,'trips',trip,'update',before);for(const m of s.trip_members.filter(m=>m.trip_id===trip.id&&!m.left_at&&m.user_id!==u.id))notify(s,m.user_id,'trip_updated',`${trip.name}: trip details updated.`,`/trips/${trip.id}`);return trip;
  }
  if(action==='ownership'&&method==='POST'){
   owner(trip,u);const d=parse(z.object({user_id:z.string(),expected_revision:z.number().int()}),body);
   if(d.expected_revision!==(trip.revision||1))fail(409,'STALE','This trip changed. Reload before transferring.');
   if(d.user_id===trip.owner_id||!s.trip_members.some(m=>m.trip_id===trip.id&&m.user_id===d.user_id&&!m.left_at))fail(400,'OWNER','Choose another current trip member.');
   const before=structuredClone(trip);trip.owner_id=d.user_id;trip.revision=(trip.revision||1)+1;trip.invite_token=h.token();trip.updated_at=stamp();audit(s,u,'trips',trip,'ownership_transferred',before);notify(s,d.user_id,'ownership_transferred',`You now organise ${trip.name}.`,`/trips/${trip.id}`);return trip;
  }
  if(action==='leave'&&method==='POST'){
   if(trip.owner_id===u.id)fail(409,'TRANSFER_FIRST','Transfer ownership to another member before leaving.');
   const net=balances(s,trip.id).net[u.id]||0;
   if(net||s.settlements.some(x=>x.trip_id===trip.id&&x.status==='pending'&&[x.from_user,x.to_user].includes(u.id)))fail(409,'UNSETTLED','Settle your balance and confirm pending payments before leaving.');
   if(s.booking_requests.some(b=>b.trip_id===trip.id&&b.user_id===u.id))fail(409,'LINKED_BOOKING','Detach your booking requests from this trip before leaving.');
   const m=s.trip_members.find(m=>m.trip_id===trip.id&&m.user_id===u.id&&!m.left_at);m.left_at=stamp();m.rsvp='out';notify(s,trip.owner_id,'member_left',`${u.name} left ${trip.name}.`,`/trips/${trip.id}`);return {ok:true};
  }
  if(action?.startsWith('items/')&&method==='DELETE'){
   const item=find(s,'trip_items',action.split('/')[1]);if(item.trip_id!==trip.id)fail(404,'NOT_FOUND','Trip item not found.');
   if(item.booking_request_id)fail(409,'BOOKING_ITEM','Detach the booking from its request instead of deleting this item.');
   if(item.created_by&&item.created_by!==u.id&&trip.owner_id!==u.id)fail(403,'ITEM_OWNER','Only the item author or trip owner can remove it.');
   if(!item.created_by)owner(trip,u);
   s.trip_items=s.trip_items.filter(x=>x.id!==item.id);audit(s,u,'trip_items',item,'delete',item);return {ok:true};
  }
 }
 const bookingMatch=path.match(/^\/booking-requests\/([^/]+)(\/trip)?$/);
 if(bookingMatch&&method==='PATCH'){
  need(u);const b=find(s,'booking_requests',bookingMatch[1]);if(b.user_id!==u.id)fail(403,'OWNER','Only the customer can edit this booking request.');
  if(body.expected_revision!==(b.revision||1))fail(409,'STALE','This request changed. Reload before saving.');
  if(bookingMatch[2]){
   const d=parse(z.object({trip_id:z.string().nullable()}),body);if(d.trip_id)member(s,find(s,'trips',d.trip_id),u);
   const before=structuredClone(b);b.trip_id=d.trip_id||undefined;b.revision=(b.revision||1)+1;b.updated_at=stamp();syncBooking(s,b);audit(s,u,'booking_requests',b,'trip_link_updated',before);return bookingView(s,b);
  }
  if(!['Submitted','In review'].includes(b.status))fail(409,'LOCKED','Only requests awaiting confirmation can be edited.');
  const d=parse(schemas.booking,{...b,...body,kind:b.kind,trip_id:b.trip_id});validateBooking(s,d,find,member,u);
  const snapshot=bookingQuote(s,d);if(!snapshot)fail(409,'PRICE_REQUIRED','An approved price is required for all selected dates and ride legs.');
  if(snapshot.total_paise!==body.expected_total_paise)throw new HttpError(409,'PRICE_CHANGED','The price changed. Review the quote before saving.',{quote:snapshot});
  const before=structuredClone(b),from=b.status;Object.assign(b,d,{status:'Submitted',price_snapshot:snapshot,total_paise:snapshot.total_paise,revision:(b.revision||1)+1,updated_at:stamp()});delete b.driver;b.ops_owner_id=null;
  add(s,'booking_status_history',{request_id:b.id,from_status:from,to_status:'Submitted',actor_id:u.id,note:'Customer revised the request; availability must be checked again.',at:stamp()});audit(s,u,'booking_requests',b,'customer_revision',before);syncBooking(s,b);notifyOps(s,'request_edited',`Updated ${b.kind} request from ${u.name}.`,b.id);notify(s,u.id,'request_edited','Your revised request has been submitted for review.',`/account?request=${b.id}`);return bookingView(s,b);
 }
 return undefined;
}
